import { useLayoutEffect, useState } from 'react'
import { isConfirmedPaused, pauseConnectedPlayback, readSpotifyPaused } from '@/platform/playback/connectedPlayback.ts'
import {
  AUDIBLE_VOLUME,
  createClipWarmup,
  readQueuedTrackUri,
  readWarmPlayback,
  type ClipCue,
  type ClipWarmup,
  type WarmPlaybackState,
} from '@/platform/playback/clipWarmup/index.ts'
import { adoptLoadedUri, type LoadedUri } from '@/platform/playback/loadedUri.ts'
import type { PlaybackClaimResult } from '@/platform/playback/playbackDevice.ts'
import {
  holdQuizMediaSession,
  isQuizMediaSessionActive,
  quizMediaToken,
  startQuizMediaSession,
  stopQuizMediaSession,
  stopQuizMediaSessionIfCurrent,
  syncQuizMediaPlayback,
} from '@/platform/playback/quizMediaSession.ts'
import { createSilenceWatch, type SilenceWatch } from '@/platform/playback/silenceWatch.ts'
import { trackAfter } from '@/platform/playback/trackAfter.ts'
import { reportClientError } from '@/platform/diagnostics/clientLog.ts'
import { traceGame } from '@/platform/diagnostics/gameDebug.ts'
import { traceSongLoad } from '@/platform/diagnostics/gameDebugSong.ts'
import { ensurePlaybackOnDevice, pausePlayback, queuePlayback, resumePlayback, startPlayback } from '@/platform/spotify/spotifyApi.ts'
import { formatSpotifyUserError } from '@/platform/spotify/spotifyAuth.ts'
import { connectSpotifyPlayer } from '@/platform/spotify/spotifyPlayer.ts'
import type { GamePhase, Track } from '@/types.ts'

export type MediaPlayback = 'playing' | 'paused'

export interface ClipPosition {
  uri: string | null
  positionMs: number
}

// Was die Wiedergabe vom Spiel braucht, ohne es zu besitzen. Alle Getter lesen
// zum Aufrufzeitpunkt den aktuellen Wert (Refs der App), nie einen Render-Stand.
export interface PlaybackHost {
  // Das aktive Spiel spielt Clips (Shotless) statt Runden-Phasen.
  clipGameActive: () => boolean
  gamePhase: () => GamePhase
  tracks: () => readonly Track[]
  currentIndex: () => number
  // Song erraten: die Runde ist pausiert.
  roundPaused: () => boolean
}

export interface PlaybackApi {
  /** Spotify-Player verbinden (einmalig) und das Audio-Element aktivieren. */
  connect: () => Promise<void>
  /** Player trennen und vergessen (Logout). */
  disconnect: () => void
  /** Aufräumen beim Unmount: Medien-Sitzung beenden, Stille-Wächter lösen, Player trennen. */
  dispose: () => void
  /** Wiedergabe beenden und Lautstärke zurücksetzen (Runde verlassen/abbrechen). */
  end: () => Promise<void>

  /** Song erraten: ersten Titel der Runde vorladen. */
  primeOpening: (uri: string) => Promise<void>
  /** Song erraten: aktuellen Titel von vorn abspielen (bei Pause danach pausieren). */
  playCurrent: () => Promise<void>
  /** Aktuellen Titel anhalten und Stille-Wächter scharf schalten. */
  pause: () => Promise<void>
  /** Aktuellen Titel fortsetzen. */
  resume: () => Promise<void>

  /** Shotless: Clip an Position vorladen. */
  primeClip: (uri: string, positionMs: number) => Promise<void>
  /** Shotless: Clip an Position hörbar abspielen. */
  playClip: (uri: string, positionMs: number) => Promise<void>
  /** Vorgeladenen Clip verwerfen. */
  invalidate: () => void
  readPosition: () => Promise<ClipPosition | null>
  readPaused: () => Promise<boolean | null>
  releaseSilence: () => Promise<void>

  /** Medien-Sitzung (Sperrbildschirm) starten. */
  beginMedia: (state: MediaPlayback) => void
  /** Medien-Sitzung starten oder, falls aktiv, auf den Zustand synchronisieren. */
  engageMedia: (state: MediaPlayback) => void
  /** Wie engageMedia, aber nur, solange ein Clip-Spiel (Shotless) aktiv ist. */
  syncMedia: (state: MediaPlayback) => void

  noteFailure: (cause: unknown, action: 'play' | 'restore', uri: string | null) => void
}

export interface PlaybackEngine {
  api: PlaybackApi
  /** Host nachziehen (je Render), damit die Getter nie einen alten Stand lesen. */
  bindHost: (next: PlaybackHost) => void
}

export function createPlaybackEngine(initialHost: PlaybackHost): PlaybackEngine {
  let host = initialHost
  let player: SpotifyPlayer | null = null
  let deviceId: string | null = null
  let silenceWatch: SilenceWatch | null = null
  let warmup: ClipWarmup | null = null
  const loadedUri: { current: LoadedUri | null } = { current: null }

  async function connect(): Promise<void> {
    if (player && deviceId) {
      await player.activateElement()
      return
    }
    const connected = await connectSpotifyPlayer('Musikerraten')
    player = connected.player
    deviceId = connected.deviceId
    await connected.player.activateElement()
  }

  function disconnect(): void {
    player?.disconnect()
    player = null
    deviceId = null
  }

  function dispose(): void {
    stopQuizMediaSession()
    void silenceWatch?.release()
    player?.disconnect()
  }

  function silence(): SilenceWatch {
    silenceWatch ??= createSilenceWatch({
      pause: () => pauseConnectedPlayback(deviceId, player, pausePlayback),
      probe: () => readSpotifyPaused(player),
    })
    return silenceWatch
  }

  function adopt(state: WarmPlaybackState | null): WarmPlaybackState | null {
    return adoptLoadedUri(loadedUri.current, state, (requested, actual) => {
      traceGame('warmup', { aktion: 'andere-uri', soll: requested, aktuell: actual })
    })
  }

  function clipWarmup(): ClipWarmup {
    warmup ??= createClipWarmup({
      getState: async () => {
        const current = player
        if (!current) {
          return null
        }
        try {
          return adopt(readWarmPlayback(await current.getCurrentState()))
        } catch {
          return null
        }
      },
      getVolume: async () => {
        const current = player
        if (!current) {
          return null
        }
        try {
          return await current.getVolume()
        } catch {
          return null
        }
      },
      setVolume: async (volume) => {
        await player?.setVolume(volume)
      },
      seek: async (positionMs) => {
        const current = player
        if (!current) {
          throw new Error('Spotify-Player nicht bereit.')
        }
        await current.seek(positionMs)
      },
      resume: async () => {
        const current = player
        if (!current) {
          throw new Error('Spotify-Player nicht bereit.')
        }
        await current.resume()
      },
      pause: () => pauseConnectedPlayback(deviceId, player, pausePlayback),
      load: async (next) => {
        const device = deviceId
        if (!device) {
          throw new Error('Spotify-Player nicht bereit.')
        }
        const following =
          next.positionMs === 0 ? (trackAfter(host.tracks(), next.uri) ?? undefined) : undefined
        const before = readWarmPlayback((await player?.getCurrentState().catch(() => null)) ?? null)
        loadedUri.current = { requested: next.uri, before: before?.uri ?? null, actual: null, settled: false }
        await startPlayback(device, next.uri, next.positionMs, following)
      },
      handoff: async (next) => {
        if (next.positionMs !== 0) {
          return false
        }
        const current = player
        if (!current) {
          return false
        }
        const state = await current.getCurrentState().catch(() => null)
        if (readQueuedTrackUri(state) !== next.uri) {
          return false
        }
        loadedUri.current = null
        await current.nextTrack()
        return true
      },
      claimDevice: (cue) => claimPlaybackDevice(cue),
      queueFollowing: async (next) => {
        const device = deviceId
        const current = player
        const following = trackAfter(host.tracks(), next.uri)
        if (!device || !current || !following) {
          return
        }
        const state = await current.getCurrentState().catch(() => null)
        if (readQueuedTrackUri(state) === following) {
          return
        }
        await queuePlayback(device, following)
      },
      activate: async () => {
        await player?.activateElement()
      },
      suspendSilence: () => silence().suspend(),
      // Nach dem Verlassen ist der Wächter versiegelt; ein neues Vorladen braucht ihn wieder.
      restoreSilence: async () => {
        await silence().release()
        await silence().arm()
      },
      readPhase: playbackPhase,
    })
    return warmup
  }

  function playbackPhase(): string {
    return host.clipGameActive() ? 'shotless' : host.gamePhase()
  }

  async function claimPlaybackDevice(cue?: ClipCue | null): Promise<PlaybackClaimResult> {
    const device = deviceId
    const current = player
    if (!device || !current) {
      return 'idle'
    }
    await current.activateElement().catch((cause: unknown) => {
      const message =
        cause instanceof Error && cause.message
          ? cause.message
          : 'Spotify-Player lässt sich nicht aktivieren.'
      reportClientError(
        message,
        {
          source: 'playback',
          uri: cue?.uri ?? null,
          action: 'transfer',
          phase: playbackPhase(),
          step: 'activate',
        },
        cause,
      )
    })
    return await ensurePlaybackOnDevice(device, {
      uri: cue?.uri,
      phase: playbackPhase(),
      mute: () => current.setVolume(0),
    })
  }

  function noteFailure(cause: unknown, action: 'play' | 'restore', uri: string | null): void {
    const message = cause instanceof Error && cause.message ? cause.message : 'Wiedergabe fehlgeschlagen.'
    reportClientError(
      message,
      {
        source: 'playback',
        uri,
        action,
        phase: playbackPhase(),
      },
      cause,
    )
  }

  function noteSongLoad(uri: string, positionMs: number, art: 'prime' | 'play'): void {
    const known = host.tracks().find((item) => item.uri === uri)
    traceSongLoad({
      art,
      uri,
      positionMs,
      titel: known?.title ?? 'unbekannt',
      interpret: known?.artist ?? '',
    })
  }

  async function openAudiblePlayback(start: () => Promise<void>): Promise<void> {
    await silence().release()
    holdQuizMediaSession()
    await start()
  }

  async function playCurrent(): Promise<void> {
    const track = host.tracks()[host.currentIndex()]
    const device = deviceId
    if (!track || !device) {
      return
    }
    noteSongLoad(track.uri, 0, 'play')
    await openAudiblePlayback(() => clipWarmup().play({ uri: track.uri, positionMs: 0 }))
    if (host.roundPaused()) {
      await pause()
    }
  }

  async function pause(): Promise<void> {
    if (!deviceId && !player) {
      return
    }
    holdQuizMediaSession()
    const paused = await readSpotifyPaused(player)
    if (isConfirmedPaused(paused)) {
      await silence().arm()
      return
    }
    await silence().hold()
  }

  async function resume(): Promise<void> {
    const device = deviceId
    if (!device) {
      return
    }
    await openAudiblePlayback(async () => {
      if (await clipWarmup().resumeDisplaced()) {
        return
      }
      const current = player
      await claimPlaybackDevice()
      if (current) {
        void current.activateElement().catch(() => undefined)
        try {
          await current.setVolume(AUDIBLE_VOLUME)
          await current.resume()
          return
        } catch {
          // Web-API, wenn das SDK die Fortsetzung ablehnt.
        }
      }
      await resumePlayback(device)
    })
  }

  async function end(): Promise<void> {
    const token = quizMediaToken()
    warmup?.invalidate()
    try {
      await silence().seal()
      await pauseConnectedPlayback(deviceId, player, pausePlayback)
      await player?.setVolume(AUDIBLE_VOLUME)?.catch(() => undefined)
    } finally {
      stopQuizMediaSessionIfCurrent(token)
    }
  }

  function beginMedia(state: MediaPlayback): void {
    startQuizMediaSession(state)
  }

  function engageMedia(state: MediaPlayback): void {
    if (!isQuizMediaSessionActive()) {
      startQuizMediaSession(state)
      return
    }
    syncQuizMediaPlayback(state)
  }

  function syncMedia(state: MediaPlayback): void {
    if (!host.clipGameActive()) {
      return
    }
    engageMedia(state)
  }

  function readPaused(): Promise<boolean | null> {
    return readSpotifyPaused(player)
  }

  async function releaseSilence(): Promise<void> {
    await silence().release()
    await player?.setVolume(AUDIBLE_VOLUME)?.catch(() => undefined)
  }

  function readPosition(): Promise<ClipPosition | null> {
    const current = player
    if (!current) {
      return Promise.resolve(null)
    }
    return current
      .getCurrentState()
      .then((state) => {
        const warm = adopt(readWarmPlayback(state))
        if (!warm) {
          return null
        }
        return { uri: warm.uri, positionMs: warm.positionMs }
      })
      .catch(() => null)
  }

  function invalidate(): void {
    warmup?.invalidate()
  }

  function primeOpening(uri: string): Promise<void> {
    noteSongLoad(uri, 0, 'prime')
    return clipWarmup()
      .prime({ uri, positionMs: 0 })
      .catch((cause: unknown) => {
        traceGame('runde', {
          aktion: 'prime-fehler',
          uri,
          fehler: cause instanceof Error && cause.message ? cause.message : 'Prime fehlgeschlagen',
        })
      })
  }

  function primeClip(uri: string, positionMs: number): Promise<void> {
    noteSongLoad(uri, positionMs, 'prime')
    if (!deviceId || !player) {
      traceGame('runde', { aktion: 'prime-aus', uri, positionMs })
      return Promise.resolve()
    }
    return clipWarmup()
      .prime({ uri, positionMs })
      .catch((cause: unknown) => {
        traceGame('runde', {
          aktion: 'prime-fehler',
          uri,
          positionMs,
          fehler: cause instanceof Error && cause.message ? cause.message : 'Prime fehlgeschlagen',
        })
      })
  }

  async function playClip(uri: string, positionMs: number): Promise<void> {
    noteSongLoad(uri, positionMs, 'play')
    try {
      if (!deviceId) {
        throw new Error('Spotify-Player nicht bereit.')
      }
      await openAudiblePlayback(() => clipWarmup().play({ uri, positionMs }))
    } catch (cause) {
      noteFailure(cause, 'play', uri)
      throw new Error(formatSpotifyUserError(cause))
    }
  }

  const api: PlaybackApi = {
    connect,
    disconnect,
    dispose,
    end,
    primeOpening,
    playCurrent,
    pause,
    resume,
    primeClip,
    playClip,
    invalidate,
    readPosition,
    readPaused,
    releaseSilence,
    beginMedia,
    engageMedia,
    syncMedia,
    noteFailure,
  }

  return {
    api,
    bindHost: (next) => {
      host = next
    },
  }
}

// Die Engine wird einmal je Komponente angelegt und bleibt stabil; der Host wird
// nach jedem Render nachgezogen, damit die Getter nie einen alten Stand lesen.
export function usePlaybackEngine(host: PlaybackHost): PlaybackApi {
  const [engine] = useState(() => createPlaybackEngine(host))
  useLayoutEffect(() => {
    engine.bindHost(host)
  })
  return engine.api
}
