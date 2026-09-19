import { useEffect, useRef, useState } from 'react'
import { GameScreen } from './components/GameScreen.tsx'
import { LoginScreen } from './components/LoginScreen.tsx'
import { PlaylistPicker } from './components/PlaylistPicker.tsx'
import { DEMO_TRACKS } from './lib/demoTracks.ts'
import { PLAY_MS, REVEAL_MS, shuffleTracks, THINK_MS } from './lib/gameLoop.ts'
import { fetchTracksForPlaylists, fetchUserPlaylists, pausePlayback, startPlayback } from './lib/spotifyApi.ts'
import {
  clearAuthCallbackFromUrl,
  clearTokens,
  exchangeAuthorizationCode,
  getSpotifyClientId,
  getValidAccessToken,
  readAuthCallback,
  readStoredTokens,
  startSpotifyLogin,
} from './lib/spotifyAuth.ts'
import { connectSpotifyPlayer } from './lib/spotifyPlayer.ts'
import type { AppScreen, GamePhase, Playlist, Track } from './types.ts'

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('login')
  const [demo, setDemo] = useState(false)
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

  const bootstrapped = useRef(false)
  const playerRef = useRef<SpotifyPlayer | null>(null)
  const deviceIdRef = useRef<string | null>(null)
  const timerRef = useRef<number | null>(null)
  const runningRef = useRef(false)
  const indexRef = useRef(0)
  const tracksRef = useRef<Track[]>([])
  const phaseRef = useRef<GamePhase>('idle')

  useEffect(() => {
    if (bootstrapped.current) {
      return
    }
    bootstrapped.current = true
    void bootstrapAuth()
    return () => {
      clearGameTimer()
      playerRef.current?.disconnect()
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
        await openPlaylistScreen(false)
      } catch (cause) {
        setError(toErrorMessage(cause))
      } finally {
        setBusy(false)
      }
      return
    }
    if (readStoredTokens()) {
      try {
        await getValidAccessToken()
        await openPlaylistScreen(false)
      } catch {
        clearTokens()
      }
    }
  }

  async function openPlaylistScreen(useDemo: boolean): Promise<void> {
    setDemo(useDemo)
    setScreen('playlists')
    setError(null)
    if (useDemo) {
      setPlaylists([])
      setSelectedIds([])
      return
    }
    setLoadingPlaylists(true)
    try {
      const items = await fetchUserPlaylists()
      setPlaylists(items)
    } catch (cause) {
      setError(toErrorMessage(cause))
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
      setError(toErrorMessage(cause))
    }
  }

  function handleDemo(): void {
    setTracks([])
    void openPlaylistScreen(true)
  }

  function handleLogout(): void {
    stopRound()
    playerRef.current?.disconnect()
    playerRef.current = null
    deviceIdRef.current = null
    if (!demo) {
      clearTokens()
    }
    setPlaylists([])
    setSelectedIds([])
    setTracks([])
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
      const loaded = demo ? DEMO_TRACKS : await fetchTracksForPlaylists(selectedIds)
      if (loaded.length === 0) {
        throw new Error('Keine abspielbaren Titel gefunden.')
      }
      if (!demo) {
        await ensurePlayer()
      }
      const shuffled = shuffleTracks(loaded)
      tracksRef.current = shuffled
      indexRef.current = 0
      setTracks(shuffled)
      setIndex(0)
      setPhase('idle')
      setScreen('game')
    } catch (cause) {
      setError(toErrorMessage(cause))
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
    if (!track || demo || !deviceId) {
      return
    }
    await startPlayback(deviceId, track.uri)
  }

  async function stopCurrentTrack(): Promise<void> {
    const deviceId = deviceIdRef.current
    if (demo || !deviceId) {
      return
    }
    try {
      await pausePlayback(deviceId)
    } catch {
      await playerRef.current?.pause()
    }
  }

  function clearGameTimer(): void {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  function schedulePhase(next: GamePhase, delay: number): void {
    clearGameTimer()
    timerRef.current = window.setTimeout(() => {
      void advanceTo(next)
    }, delay)
  }

  async function advanceTo(next: GamePhase): Promise<void> {
    if (!runningRef.current) {
      return
    }
    if (next === 'playing') {
      const lastIndex = tracksRef.current.length - 1
      const upcoming = indexRef.current >= lastIndex ? 0 : indexRef.current + 1
      indexRef.current = upcoming
      setIndex(upcoming)
      phaseRef.current = 'playing'
      setPhase('playing')
      try {
        await playCurrentTrack()
      } catch (cause) {
        setError(toErrorMessage(cause))
      }
      schedulePhase('thinking', PLAY_MS)
      return
    }
    if (next === 'thinking') {
      await stopCurrentTrack()
      phaseRef.current = 'thinking'
      setPhase('thinking')
      schedulePhase('reveal', THINK_MS)
      return
    }
    phaseRef.current = 'reveal'
    setPhase('reveal')
    schedulePhase('playing', REVEAL_MS)
  }

  async function handlePlay(): Promise<void> {
    if (tracksRef.current.length === 0) {
      return
    }
    setError(null)
    runningRef.current = true
    setRunning(true)
    phaseRef.current = 'playing'
    setPhase('playing')
    try {
      if (!demo) {
        await playerRef.current?.activateElement()
      }
      await playCurrentTrack()
    } catch (cause) {
      setError(toErrorMessage(cause))
    }
    schedulePhase('thinking', PLAY_MS)
  }

  function stopRound(): void {
    runningRef.current = false
    setRunning(false)
    clearGameTimer()
    phaseRef.current = 'idle'
    setPhase('idle')
    void stopCurrentTrack()
  }

  function handleStop(): void {
    stopRound()
    setScreen('playlists')
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
          onDemo={handleDemo}
        />
      ) : null}
      {screen === 'playlists' ? (
        <PlaylistPicker
          playlists={playlists}
          selectedIds={selectedIds}
          loading={loadingPlaylists}
          loadingTracks={loadingTracks}
          error={error}
          demo={demo}
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
          demo={demo}
          running={running}
          error={error}
          onPlay={() => {
            void handlePlay()
          }}
          onStop={handleStop}
        />
      ) : null}
    </main>
  )
}

function toErrorMessage(cause: unknown): string {
  if (cause instanceof Error && cause.message) {
    return cause.message
  }
  return 'Etwas ist schiefgelaufen.'
}
