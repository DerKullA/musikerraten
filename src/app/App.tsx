import { useEffect, useRef, useState } from 'react'
import { AppFooter } from '@/ui/AppFooter.tsx'
import { GuessSongScreen } from '@/games/guess-song/GuessSongScreen.tsx'
import { LoginScreen } from '@/ui/LoginScreen.tsx'
import { MainMenu } from '@/ui/MainMenu.tsx'
import { PlaylistPicker } from '@/ui/PlaylistPicker.tsx'
import { ShotlessScreen } from '@/games/shotless/ShotlessScreen.tsx'
import { nextPhase, phaseDuration, phasePlaysAudio } from '@/games/guess-song/roundLoop.ts'
import { shuffleTracks } from '@/platform/spotify/mixTracks.ts'
import { GUESS_SONG_ID, SHOTLESS_ID, isPlayableMenuGame } from '@/games/mainMenuGames.ts'
import { clearShotlessSession } from '@/games/shotless/logic/session.ts'
import {
  clearSessionPhaseTimings,
  DEFAULT_PHASE_TIMINGS,
  readSessionPhaseTimings,
  samePhaseTimings,
  timingsAtTrackStart,
  writeSessionPhaseTimings,
  type PhaseTimings,
} from '@/ui/phaseTimings.ts'
import { usePlaybackEngine } from '@/platform/playback/usePlaybackEngine.ts'
import { reportClientWarning } from '@/platform/diagnostics/clientLog.ts'
import { formatGameDebugLog, traceGame } from '@/platform/diagnostics/gameDebug.ts'
import { useGameDebugWatch } from '@/platform/diagnostics/useGameDebug.ts'
import { fetchTracksForPlaylists, fetchUserPlaylists } from '@/platform/spotify/spotifyApi.ts'
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
} from '@/platform/spotify/spotifyAuth.ts'
import { stopSpeakerKeepAlive, watchSpeakerKeepAliveGestures } from '@/platform/playback/speakerKeepAlive.ts'
import type { AppScreen, GamePhase, Playlist, Track } from '@/types.ts'

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
  const [snippetReady, setSnippetReady] = useState(false)
  const [audiblePlay, setAudiblePlay] = useState(false)
  const [savedTimings, setSavedTimings] = useState<PhaseTimings>(() => readSessionPhaseTimings())
  const [roundTimings, setRoundTimings] = useState<PhaseTimings>(() => readSessionPhaseTimings())
  const [menuGameId, setMenuGameId] = useState(GUESS_SONG_ID)
  const [shotlessLive, setShotlessLive] = useState(false)
  const [roundReason, setRoundReason] = useState('start')

  const bootstrapped = useRef(false)
  const screenRef = useRef<AppScreen>('login')
  const phaseEntryRef = useRef(0)
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
  const navigationEpochRef = useRef(0)
  screenRef.current = screen
  const playback = usePlaybackEngine({
    screen: () => screenRef.current,
    gamePhase: () => phaseRef.current,
    tracks: () => tracksRef.current,
    currentIndex: () => indexRef.current,
    roundPaused: () => pausedRef.current,
  })

  useEffect(() => {
    if (bootstrapped.current) {
      return
    }
    bootstrapped.current = true
    const unbindKeepAlive = watchSpeakerKeepAliveGestures()
    void bootstrapAuth()
    return () => {
      clearGameTimer()
      playback.dispose()
      unbindKeepAlive()
      stopSpeakerKeepAlive()
    }
  }, [playback])

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
        showMainMenu()
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
        showMainMenu()
      } catch {
        clearTokens()
        resetPhaseTimings()
      }
    }
  }

  function showMainMenu(): void {
    setError(null)
    setScreen('menu')
  }

  function handleBackToMenu(): void {
    navigationEpochRef.current += 1
    setLoadingPlaylists(false)
    setLoadingTracks(false)
    setShotlessLive(false)
    showMainMenu()
  }

  function handleSelectGame(gameId: string): void {
    if (!isPlayableMenuGame(gameId)) {
      return
    }
    setMenuGameId(gameId)
    setShotlessLive(false)
    void openPlaylistScreen()
  }

  async function openPlaylistScreen(): Promise<void> {
    const epoch = navigationEpochRef.current
    setScreen('playlists')
    setError(null)
    setLoadingPlaylists(true)
    try {
      const items = await fetchUserPlaylists()
      if (epoch !== navigationEpochRef.current) {
        return
      }
      setPlaylists(items)
    } catch (cause) {
      if (epoch !== navigationEpochRef.current) {
        return
      }
      setError(formatSpotifyUserError(cause))
    } finally {
      if (epoch === navigationEpochRef.current) {
        setLoadingPlaylists(false)
      }
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
    clearShotlessSession()
    setShotlessLive(false)
    resetPhaseTimings()
    stopRound()
    playback.disconnect()
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
    const epoch = navigationEpochRef.current
    setError(null)
    setLoadingTracks(true)
    try {
      const loaded = await fetchTracksForPlaylists(selectedIds)
      if (epoch !== navigationEpochRef.current) {
        traceGame('runde', { aktion: 'laden-verworfen', schritt: 'titel' })
        return
      }
      if (loaded.length === 0) {
        throw new Error('Keine abspielbaren Titel gefunden.')
      }
      traceGame('runde', { aktion: 'geladen', anzahl: loaded.length, modus: menuGameId })
      await playback.connect()
      if (epoch !== navigationEpochRef.current) {
        traceGame('runde', { aktion: 'laden-verworfen', schritt: 'player' })
        return
      }
      const shuffled = shuffleTracks(loaded)
      tracksRef.current = shuffled
      indexRef.current = 0
      resetPauseState()
      setTracks(shuffled)
      setIndex(0)
      setPhase('idle')
      phaseRef.current = 'idle'
      beginQuizMedia('idle')
      setRoundReason('bereit')
      if (menuGameId === SHOTLESS_ID) {
        setShotlessLive(false)
        setScreen('shotless')
        return
      }
      setScreen('game')
      const opening = shuffled[0]
      if (opening) {
        void playback.primeOpening(opening.uri)
      }
    } catch (cause) {
      if (epoch !== navigationEpochRef.current) {
        traceGame('runde', { aktion: 'laden-verworfen', schritt: 'fehler' })
        return
      }
      const fehler = formatSpotifyUserError(cause)
      traceGame('runde', { aktion: 'laden-fehler', fehler })
      setError(fehler)
    } finally {
      if (epoch === navigationEpochRef.current) {
        setLoadingTracks(false)
      }
    }
  }

  function currentTrackUri(): string | null {
    return tracksRef.current[indexRef.current]?.uri ?? null
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

  function markSnippetReady(ready: boolean): void {
    setSnippetReady(ready)
  }

  function markAudiblePlay(ready: boolean): void {
    setAudiblePlay(ready)
  }

  function schedulePhase(next: GamePhase, delay: number): void {
    clearGameTimer()
    timerRef.current = window.setTimeout(() => {
      void enterPhase(next)
    }, delay)
  }

  function armPhaseTimer(current: GamePhase, delayMs: number, timings: PhaseTimings): void {
    remainingMsRef.current = delayMs
    deadlineRef.current = Date.now() + delayMs
    schedulePhase(nextPhase(current, timings), delayMs)
  }

  function scheduleFollowingPhase(current: GamePhase, timings: PhaseTimings): void {
    armPhaseTimer(current, phaseDuration(current, timings), timings)
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

  async function enterPhase(
    next: GamePhase,
    grund: 'timer' | 'naechster' | 'aufloesen' | 'weiter' = 'timer',
  ): Promise<void> {
    if (!runningRef.current || pausedRef.current) {
      traceGame('runde', {
        aktion: 'phase-block',
        nach: next,
        grund,
        phase: phaseRef.current,
        pause: pausedRef.current,
      })
      return
    }
    phaseEntryRef.current += 1
    const entry = phaseEntryRef.current
    setRoundReason(grund)
    if (next === 'playing') {
      playback.invalidate()
      const lastIndex = tracksRef.current.length - 1
      const upcoming = indexRef.current >= lastIndex ? 0 : indexRef.current + 1
      indexRef.current = upcoming
      setIndex(upcoming)
    }
    const timings = capturePhaseTimings(next)
    phaseRef.current = next
    setPhase(next)
    if (next === 'playing' || next === 'thinking') {
      markSnippetReady(false)
    }
    if (next === 'playing') {
      markAudiblePlay(false)
    }
    let playbackStarted = false
    try {
      await applyPhaseAudio(next)
      playbackStarted = true
    } catch (cause) {
      playback.noteFailure(cause, 'play', currentTrackUri())
      setError(formatSpotifyUserError(cause))
    }
    if (playbackStarted && phaseRef.current === next && next === 'playing') {
      markAudiblePlay(true)
    }
    if (phaseRef.current === next && next === 'thinking') {
      markSnippetReady(true)
    }
    if (entry !== phaseEntryRef.current) {
      return
    }
    scheduleFollowingPhase(next, timings)
  }

  async function applyPhaseAudio(next: GamePhase): Promise<void> {
    // Spotify pausiert hier; der Speaker-Wachhalter bleibt aktiv.
    engageQuizMedia(next)
    if (pausedRef.current || next === 'idle' || next === 'thinking') {
      await playback.pause()
      return
    }
    if (next === 'playing') {
      await playback.playCurrent()
      return
    }
    await playback.resume()
  }

  async function handlePlay(): Promise<void> {
    if (tracksRef.current.length === 0) {
      traceGame('runde', { aktion: 'starten-leer' })
      return
    }
    setRoundReason('starten')
    setError(null)
    runningRef.current = true
    resetPauseState()
    setRunning(true)
    const timings = capturePhaseTimings('playing')
    phaseRef.current = 'playing'
    setPhase('playing')
    markSnippetReady(false)
    markAudiblePlay(false)
    engageQuizMedia('playing')
    let playbackStarted = false
    try {
      await playback.playCurrent()
      playbackStarted = true
    } catch (cause) {
      playback.noteFailure(cause, 'play', currentTrackUri())
      setError(formatSpotifyUserError(cause))
    }
    if (playbackStarted && phaseRef.current === 'playing') {
      markAudiblePlay(true)
    }
    scheduleFollowingPhase('playing', timings)
  }

  async function restartCurrentSnippet(): Promise<void> {
    if (!runningRef.current || tracksRef.current.length === 0) {
      traceGame('runde', { aktion: 'nochmal-block', phase: phaseRef.current })
      return
    }
    const current = phaseRef.current
    if (current !== 'playing' && current !== 'thinking') {
      traceGame('runde', { aktion: 'nochmal-block', phase: current })
      return
    }
    setRoundReason('nochmal')
    setError(null)
    pausedRef.current = false
    setPaused(false)
    const timings = roundTimingsRef.current
    phaseRef.current = 'playing'
    setPhase('playing')
    markSnippetReady(false)
    markAudiblePlay(false)
    engageQuizMedia('playing')
    let playbackStarted = false
    try {
      await playback.playCurrent()
      playbackStarted = true
    } catch (cause) {
      playback.noteFailure(cause, 'play', currentTrackUri())
      setError(formatSpotifyUserError(cause))
    }
    if (playbackStarted && phaseRef.current === 'playing') {
      markAudiblePlay(true)
    }
    scheduleFollowingPhase('playing', timings)
  }

  async function skipToNextTrack(): Promise<void> {
    if (!runningRef.current || phaseRef.current !== 'reveal') {
      traceGame('runde', { aktion: 'naechster-block', phase: phaseRef.current })
      return
    }
    pausedRef.current = false
    setPaused(false)
    await enterPhase('playing', 'naechster')
  }

  async function forceSkipTrack(): Promise<void> {
    if (!runningRef.current) {
      traceGame('runde', { aktion: 'force-skip-block', phase: phaseRef.current })
      return
    }
    const track = tracksRef.current[indexRef.current]
    reportClientWarning(
      `Force-Skip: ${track ? `${track.artist} – ${track.title}` : 'unbekannter Titel'}${error ? ` (Fehler: ${error})` : ''}`,
      {
        source: 'force-skip',
        uri: track?.uri ?? null,
        action: 'force-skip',
        phase: phaseRef.current,
        step: formatGameDebugLog().split('\n').slice(-6).join(' | '),
      },
    )
    traceGame('runde', { aktion: 'force-skip', phase: phaseRef.current, index: indexRef.current })
    clearGameTimer()
    pausedRef.current = false
    setPaused(false)
    setError(null)
    await enterPhase('playing', 'naechster')
  }

  async function revealCurrentTrack(): Promise<void> {
    if (!runningRef.current) {
      traceGame('runde', { aktion: 'aufloesen-block', phase: phaseRef.current })
      return
    }
    const current = phaseRef.current
    if (current !== 'playing' && current !== 'thinking') {
      traceGame('runde', { aktion: 'aufloesen-block', phase: current })
      return
    }
    pausedRef.current = false
    setPaused(false)
    await enterPhase('reveal', 'aufloesen')
  }

  function stopRound(): void {
    setRoundReason('stopp')
    runningRef.current = false
    setRunning(false)
    resetPauseState()
    clearGameTimer()
    phaseRef.current = 'idle'
    setPhase('idle')
    void playback.end()
  }

  function playbackForPhase(phase: GamePhase): 'playing' | 'paused' {
    if (pausedRef.current || !phasePlaysAudio(phase)) {
      return 'paused'
    }
    return 'playing'
  }

  function beginQuizMedia(phase: GamePhase): void {
    playback.beginMedia(playbackForPhase(phase))
  }

  function engageQuizMedia(phase: GamePhase): void {
    playback.engageMedia(playbackForPhase(phase))
  }

  function handleLeaveShotless(): void {
    setRoundReason('verlassen')
    traceGame('runde', { aktion: 'verlassen', modus: 'shotless' })
    void playback.end()
    handleBackToMenu()
  }

  function handleShotlessToPlaylists(): void {
    setRoundReason('verlassen')
    traceGame('runde', { aktion: 'zur-playlistauswahl', modus: 'shotless' })
    void playback.end()
    setShotlessLive(false)
    setError(null)
    setScreen('playlists')
  }

  function handleAbort(): void {
    traceGame('runde', { aktion: 'abbruch', phase: phaseRef.current, index: indexRef.current })
    stopRound()
    setScreen('playlists')
  }

  function handlePause(): void {
    if (!runningRef.current || pausedRef.current || phaseRef.current === 'idle') {
      traceGame('runde', { aktion: 'pause-block', phase: phaseRef.current, pause: pausedRef.current })
      return
    }
    setRoundReason('pause')
    remainingMsRef.current = remainingFromDeadline()
    deadlineRef.current = null
    clearGameTimer()
    pausedRef.current = true
    setPaused(true)
    markSnippetReady(false)
    engageQuizMedia(phaseRef.current)
    void playback.pause().finally(enableReplayAfterPause)
  }

  function enableReplayAfterPause(): void {
    if (pausedRef.current) {
      markSnippetReady(true)
    }
  }

  async function handleResume(): Promise<void> {
    if (!runningRef.current || !pausedRef.current) {
      traceGame('runde', { aktion: 'weiter-block', phase: phaseRef.current, pause: pausedRef.current })
      return
    }
    setRoundReason('weiter')
    pausedRef.current = false
    setPaused(false)
    const current = phaseRef.current
    engageQuizMedia(current)
    const remaining = remainingMsRef.current
    if (remaining <= 0) {
      await enterPhase(nextPhase(current, roundTimingsRef.current), 'weiter')
      return
    }
    if (phasePlaysAudio(current)) {
      try {
        await playback.resume()
      } catch (cause) {
        playback.noteFailure(cause, 'restore', currentTrackUri())
        setError(formatSpotifyUserError(cause))
      }
    }
    armPhaseTimer(current, remaining, roundTimingsRef.current)
  }

  const currentTrack = tracks[index] ?? null
  useGameDebugWatch('spiel', {
    screen,
    phase,
    grund: roundReason,
    index,
    anzahl: tracks.length,
    laufend: running,
    pause: paused,
    fehler: error,
    modus: menuGameId,
    shotless: shotlessLive,
    titel: currentTrack?.title ?? null,
    interpret: currentTrack?.artist ?? null,
    uri: currentTrack?.uri ?? null,
    hoerbar: audiblePlay,
    snippet: snippetReady,
  })
  const fullBleed = screen === 'game' || (screen === 'shotless' && shotlessLive)

  return (
    <main className={fullBleed ? 'app app-game' : 'app'}>
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
      {screen === 'menu' ? (
        <MainMenu
          savedTimings={savedTimings}
          onSaveTimings={handleSaveTimings}
          onLogout={handleLogout}
          onSelectGame={handleSelectGame}
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
          onBack={handleBackToMenu}
          onLogout={handleLogout}
        />
      ) : null}
      {screen === 'game' ? (
        <GuessSongScreen
          track={currentTrack}
          phase={phase}
          index={index}
          total={tracks.length}
          running={running}
          paused={paused}
          snippetReady={snippetReady}
          audiblePlay={audiblePlay}
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
          onReplay={() => {
            void restartCurrentSnippet()
          }}
          onReveal={() => {
            void revealCurrentTrack()
          }}
          onSkipNext={() => {
            void skipToNextTrack()
          }}
          onForceSkip={() => {
            void forceSkipTrack()
          }}
          onAbort={handleAbort}
          onLogout={handleLogout}
        />
      ) : null}
      {screen === 'shotless' ? (
        <ShotlessScreen
          tracks={tracks}
          error={error}
          onLogout={handleLogout}
          onLeave={handleLeaveShotless}
          onBackToPlaylists={handleShotlessToPlaylists}
          playback={playback}
          onLiveChange={setShotlessLive}
        />
      ) : null}
      {fullBleed ? null : <AppFooter />}
    </main>
  )
}

