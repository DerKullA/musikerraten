import { useEffect, useRef, useState } from 'react'
import { GameScreen } from './components/GameScreen.tsx'
import { LoginScreen } from './components/LoginScreen.tsx'
import { PlaylistPicker } from './components/PlaylistPicker.tsx'
import { nextPhase, phaseDuration, phasePlaysAudio, shuffleTracks } from './lib/gameLoop.ts'
import {
  clearSessionPhaseTimings,
  DEFAULT_PHASE_TIMINGS,
  readSessionPhaseTimings,
  samePhaseTimings,
  timingsAtTrackStart,
  writeSessionPhaseTimings,
  type PhaseTimings,
} from './lib/phaseTimings.ts'
import {
  fetchTracksForPlaylists,
  fetchUserPlaylists,
  pausePlayback,
  resumePlayback,
  startPlayback,
} from './lib/spotifyApi.ts'
import {
  clearAuthCallbackFromUrl,
  clearTokens,
  exchangeAuthorizationCode,
  formatSpotifyUserError,
  getSpotifyClientId,
  getValidAccessToken,
  readAuthCallback,
  readStoredTokens,
  startSpotifyLogin,
} from './lib/spotifyAuth.ts'
import {
  holdQuizMediaSession,
  isQuizMediaSessionActive,
  quizMediaToken,
  startQuizMediaSession,
  stopQuizMediaSession,
  stopQuizMediaSessionIfCurrent,
  syncQuizMediaPlayback,
} from './lib/quizMediaSession.ts'
import { connectSpotifyPlayer } from './lib/spotifyPlayer.ts'
import { stopSpeakerKeepAlive, watchSpeakerKeepAliveGestures } from './lib/speakerKeepAlive.ts'
import type { AppScreen, GamePhase, Playlist, Track } from './types.ts'

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('login')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loadingPlaylists, setLoadingPlaylists] = useState(false)
  const [loadingTracks, setLoadingTracks] = useState(false)
  const [tracks, setTracks] = useState<Track[]>([])
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<GamePhase>('idle')
  const [running, setRunning] = useState(false)
  const [paused, setPaused] = useState(false)
  const [savedTimings, setSavedTimings] = useState<PhaseTimings>(() => readSessionPhaseTimings())
  const [roundTimings, setRoundTimings] = useState<PhaseTimings>(() => readSessionPhaseTimings())

  const bootstrapped = useRef(false)
  const playerRef = useRef<SpotifyPlayer | null>(null)
  const deviceIdRef = useRef<string | null>(null)
  const timerRef = useRef<number | null>(null)
  const runningRef = useRef(false)
  const pausedRef = useRef(false)
  const remainingMsRef = useRef(0)
  const deadlineRef = useRef<number | null>(null)
  const indexRef = useRef(0)
  const tracksRef = useRef<Track[]>([])
  const phaseRef = useRef<GamePhase>('idle')
  const savedTimingsRef = useRef(savedTimings)
  const roundTimingsRef = useRef(roundTimings)

  useEffect(() => {
    if (bootstrapped.current) {
      return
    }
    bootstrapped.current = true
    const unbindKeepAlive = watchSpeakerKeepAliveGestures()
    void bootstrapAuth()
    return () => {
      clearGameTimer()
      stopQuizMediaSession()
      playerRef.current?.disconnect()
      unbindKeepAlive()
      stopSpeakerKeepAlive()
    }
  }, [])

  async function bootstrapAuth(): Promise<void> {
    const callback = readAuthCallback()
    if (callback.error) {
      clearAuthCallbackFromUrl()
      setError(callback.error === 'access_denied' ? 'Anmeldung abgebrochen.' : callback.error)
      return
    }
    if (callback.code) {
      setBusy(true)
      try {
        await exchangeAuthorizationCode(callback.code, callback.state)
        clearAuthCallbackFromUrl()
        resetPhaseTimings()
        await openPlaylistScreen()
      } catch (cause) {
        setError(formatSpotifyUserError(cause))
      } finally {
        setBusy(false)
      }
      return
    }
    if (readStoredTokens()) {
      try {
        await getValidAccessToken()
        await openPlaylistScreen()
      } catch {
        clearTokens()
        resetPhaseTimings()
      }
    }
  }

  async function openPlaylistScreen(): Promise<void> {
    setScreen('playlists')
    setError(null)
    setLoadingPlaylists(true)
    try {
      const items = await fetchUserPlaylists()
      setPlaylists(items)
    } catch (cause) {
      setError(formatSpotifyUserError(cause))
    } finally {
      setLoadingPlaylists(false)
    }
  }

  async function handleSpotifyLogin(): Promise<void> {
    setError(null)
    setBusy(true)
    try {
      await startSpotifyLogin()
    } catch (cause) {
      setBusy(false)
      setError(formatSpotifyUserError(cause))
    }
  }

  function handleLogout(): void {
    stopSpeakerKeepAlive()
    resetPhaseTimings()
    stopRound()
    playerRef.current?.disconnect()
    playerRef.current = null
    deviceIdRef.current = null
    clearTokens()
    tracksRef.current = []
    indexRef.current = 0
    setTracks([])
    setIndex(0)
    setPlaylists([])
    setSelectedIds([])
    setLoadingPlaylists(false)
    setLoadingTracks(false)
    setBusy(false)
    setScreen('login')
    setError(null)
  }

  function handleTogglePlaylist(id: string): void {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )
  }

  function handleToggleAll(): void {
    setSelectedIds((current) =>
      current.length === playlists.length ? [] : playlists.map((playlist) => playlist.id),
    )
  }

  async function handleStartGame(): Promise<void> {
    setError(null)
    setLoadingTracks(true)
    try {
      const loaded = await fetchTracksForPlaylists(selectedIds)
      if (loaded.length === 0) {
        throw new Error('Keine abspielbaren Titel gefunden.')
      }
      await ensurePlayer()
      const shuffled = shuffleTracks(loaded)
      tracksRef.current = shuffled
      indexRef.current = 0
      resetPauseState()
      setTracks(shuffled)
      setIndex(0)
      setPhase('idle')
      phaseRef.current = 'idle'
      beginQuizMedia('idle')
      setScreen('game')
    } catch (cause) {
      setError(formatSpotifyUserError(cause))
    } finally {
      setLoadingTracks(false)
    }
  }

  async function ensurePlayer(): Promise<void> {
    if (playerRef.current && deviceIdRef.current) {
      await playerRef.current.activateElement()
      return
    }
    const { player, deviceId } = await connectSpotifyPlayer('Musikerraten')
    playerRef.current = player
    deviceIdRef.current = deviceId
    await player.activateElement()
  }

  async function playCurrentTrack(): Promise<void> {
    const track = tracksRef.current[indexRef.current]
    const deviceId = deviceIdRef.current
    if (!track || !deviceId) {
      return
    }
    holdQuizMediaSession()
    await startPlayback(deviceId, track.uri)
    if (pausedRef.current) {
      await pauseCurrentTrack()
    }
  }

  async function pauseCurrentTrack(): Promise<void> {
    const deviceId = deviceIdRef.current
    if (!deviceId) {
      return
    }
    holdQuizMediaSession()
    try {
      await pausePlayback(deviceId)
    } catch {
      await playerRef.current?.pause()
    }
  }

  async function resumeCurrentTrack(): Promise<void> {
    const deviceId = deviceIdRef.current
    if (!deviceId) {
      return
    }
    holdQuizMediaSession()
    try {
      await resumePlayback(deviceId)
    } catch {
      await playerRef.current?.resume()
    }
  }

  function clearGameTimer(): void {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  function remainingFromDeadline(): number {
    if (deadlineRef.current === null) {
      return remainingMsRef.current
    }
    return Math.max(0, deadlineRef.current - Date.now())
  }

  function resetPauseState(): void {
    pausedRef.current = false
    remainingMsRef.current = 0
    deadlineRef.current = null
    setPaused(false)
  }

  function schedulePhase(next: GamePhase, delay: number): void {
    clearGameTimer()
    timerRef.current = window.setTimeout(() => {
      void enterPhase(next)
    }, delay)
  }

  function armPhaseTimer(current: GamePhase, delayMs: number): void {
    remainingMsRef.current = delayMs
    deadlineRef.current = Date.now() + delayMs
    schedulePhase(nextPhase(current), delayMs)
  }

  function scheduleFollowingPhase(current: GamePhase, timings: PhaseTimings): void {
    armPhaseTimer(current, phaseDuration(current, timings))
  }

  function capturePhaseTimings(phase: GamePhase): PhaseTimings {
    const nextTimings = timingsAtTrackStart(phase, roundTimingsRef.current, savedTimingsRef.current)
    if (!samePhaseTimings(roundTimingsRef.current, nextTimings)) {
      setRoundTimings(nextTimings)
    }
    roundTimingsRef.current = nextTimings
    return nextTimings
  }

  function handleSaveTimings(next: PhaseTimings): void {
    const stored = writeSessionPhaseTimings(next)
    savedTimingsRef.current = stored
    setSavedTimings(stored)
  }

  function resetPhaseTimings(): void {
    clearSessionPhaseTimings()
    savedTimingsRef.current = DEFAULT_PHASE_TIMINGS
    roundTimingsRef.current = DEFAULT_PHASE_TIMINGS
    setSavedTimings(DEFAULT_PHASE_TIMINGS)
    setRoundTimings(DEFAULT_PHASE_TIMINGS)
  }

  async function enterPhase(next: GamePhase): Promise<void> {
    if (!runningRef.current || pausedRef.current) {
      return
    }
    if (next === 'playing') {
      const lastIndex = tracksRef.current.length - 1
      const upcoming = indexRef.current >= lastIndex ? 0 : indexRef.current + 1
      indexRef.current = upcoming
      setIndex(upcoming)
    }
    const timings = capturePhaseTimings(next)
    phaseRef.current = next
    setPhase(next)
    try {
      await applyPhaseAudio(next)
    } catch (cause) {
      setError(formatSpotifyUserError(cause))
    }
    scheduleFollowingPhase(next, timings)
  }

  async function applyPhaseAudio(next: GamePhase): Promise<void> {
    // Spotify pausiert hier; der Speaker-Wachhalter bleibt aktiv.
    engageQuizMedia(next)
    if (pausedRef.current || next === 'idle' || next === 'thinking') {
      await pauseCurrentTrack()
      return
    }
    if (next === 'playing') {
      await playCurrentTrack()
      return
    }
    await resumeCurrentTrack()
  }

  async function handlePlay(): Promise<void> {
    if (tracksRef.current.length === 0) {
      return
    }
    setError(null)
    runningRef.current = true
    resetPauseState()
    setRunning(true)
    const timings = capturePhaseTimings('playing')
    phaseRef.current = 'playing'
    setPhase('playing')
    engageQuizMedia('playing')
    try {
      await playerRef.current?.activateElement()
      await playCurrentTrack()
    } catch (cause) {
      setError(formatSpotifyUserError(cause))
    }
    scheduleFollowingPhase('playing', timings)
  }

  function stopRound(): void {
    runningRef.current = false
    setRunning(false)
    resetPauseState()
    clearGameTimer()
    phaseRef.current = 'idle'
    setPhase('idle')
    void endQuizPlayback()
  }

  async function endQuizPlayback(): Promise<void> {
    const token = quizMediaToken()
    try {
      await pauseCurrentTrack()
    } finally {
      stopQuizMediaSessionIfCurrent(token)
    }
  }

  function playbackForPhase(phase: GamePhase): 'playing' | 'paused' {
    if (pausedRef.current || !phasePlaysAudio(phase)) {
      return 'paused'
    }
    return 'playing'
  }

  function beginQuizMedia(phase: GamePhase): void {
    startQuizMediaSession(playbackForPhase(phase))
  }

  function engageQuizMedia(phase: GamePhase): void {
    const nextPlayback = playbackForPhase(phase)
    if (!isQuizMediaSessionActive()) {
      startQuizMediaSession(nextPlayback)
      return
    }
    syncQuizMediaPlayback(nextPlayback)
  }

  function handleAbort(): void {
    stopRound()
    setScreen('playlists')
  }

  function handlePause(): void {
    if (!runningRef.current || pausedRef.current || phaseRef.current === 'idle') {
      return
    }
    remainingMsRef.current = remainingFromDeadline()
    deadlineRef.current = null
    clearGameTimer()
    pausedRef.current = true
    setPaused(true)
    engageQuizMedia(phaseRef.current)
    void pauseCurrentTrack()
  }

  async function handleResume(): Promise<void> {
    if (!runningRef.current || !pausedRef.current) {
      return
    }
    pausedRef.current = false
    setPaused(false)
    const current = phaseRef.current
    engageQuizMedia(current)
    const remaining = remainingMsRef.current
    if (remaining <= 0) {
      await enterPhase(nextPhase(current))
      return
    }
    if (phasePlaysAudio(current)) {
      try {
        await resumeCurrentTrack()
      } catch (cause) {
        setError(formatSpotifyUserError(cause))
      }
    }
    armPhaseTimer(current, remaining)
  }

  const currentTrack = tracks[index] ?? null

  return (
    <main className="app">
      <div className="glow" aria-hidden="true" />
      {screen === 'login' ? (
        <LoginScreen
          clientIdPresent={Boolean(getSpotifyClientId())}
          busy={busy}
          error={error}
          onSpotifyLogin={() => {
            void handleSpotifyLogin()
          }}
        />
      ) : null}
      {screen === 'playlists' ? (
        <PlaylistPicker
          playlists={playlists}
          selectedIds={selectedIds}
          loading={loadingPlaylists}
          loadingTracks={loadingTracks}
          error={error}
          savedTimings={savedTimings}
          onSaveTimings={handleSaveTimings}
          onToggle={handleTogglePlaylist}
          onToggleAll={handleToggleAll}
          onStart={() => {
            void handleStartGame()
          }}
          onLogout={handleLogout}
        />
      ) : null}
      {screen === 'game' ? (
        <GameScreen
          track={currentTrack}
          phase={phase}
          index={index}
          total={tracks.length}
          running={running}
          paused={paused}
          error={error}
          roundTimings={roundTimings}
          savedTimings={savedTimings}
          onSaveTimings={handleSaveTimings}
          onPlay={() => {
            void handlePlay()
          }}
          onPause={handlePause}
          onResume={() => {
            void handleResume()
          }}
          onAbort={handleAbort}
          onLogout={handleLogout}
        />
      ) : null}
    </main>
  )
}

