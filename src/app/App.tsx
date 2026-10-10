import { useRef, useState } from 'react'
import { AppFooter } from '@/ui/AppFooter.tsx'
import { GuessSongScreen } from '@/games/guess-song/GuessSongScreen.tsx'
import { LoginScreen } from '@/ui/LoginScreen.tsx'
import { MainMenu } from '@/ui/MainMenu.tsx'
import { PlaylistPicker } from '@/ui/PlaylistPicker.tsx'
import { useNavigation } from '@/app/useNavigation.ts'
import { useSpotifySession } from '@/app/useSpotifySession.ts'
import { nextPhase, phaseDuration, phasePlaysAudio } from '@/games/guess-song/roundLoop.ts'
import { shuffleTracks } from '@/platform/spotify/mixTracks.ts'
import { GAMES } from '@/games/registry.ts'
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
import { fetchTracksForPlaylists } from '@/platform/spotify/spotifyApi.ts'
import { formatSpotifyUserError, getSpotifyClientId } from '@/platform/spotify/spotifyAuth.ts'
import type { GamePhase, Track } from '@/types.ts'

// Nur aus Handlern und Timern aufgerufen, nie im Render; der Wrapper hält die Purity-Lint-Regel ruhig.
function nowMs(): number {
  return Date.now()
}

export default function App() {
  const navigation = useNavigation()
  const { error, setError } = navigation
  const [tracks, setTracks] = useState<Track[]>([])
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<GamePhase>('idle')
  const [running, setRunning] = useState(false)
  const [paused, setPaused] = useState(false)
  const [snippetReady, setSnippetReady] = useState(false)
  const [audiblePlay, setAudiblePlay] = useState(false)
  const [savedTimings, setSavedTimings] = useState<PhaseTimings>(() => readSessionPhaseTimings())
  const [roundTimings, setRoundTimings] = useState<PhaseTimings>(() => readSessionPhaseTimings())
  const [roundReason, setRoundReason] = useState('start')

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
  const playback = usePlaybackEngine({
    // Der Host wird je Render nachgezogen, der Wert ist also nie älter als der letzte Render.
    clipGameActive: () => navigation.clipGame,
    gamePhase: () => phaseRef.current,
    tracks: () => tracksRef.current,
    currentIndex: () => indexRef.current,
    roundPaused: () => pausedRef.current,
  })

  const session = useSpotifySession({
    playback,
    navigation,
    round: {
      resetPhaseTimings,
      stopRound,
      clearTracks: () => {
        tracksRef.current = []
        indexRef.current = 0
        setTracks([])
        setIndex(0)
      },
      clearTimer: clearGameTimer,
    },
  })

  async function handleStartGame(): Promise<void> {
    const epoch = navigation.currentEpoch()
    setError(null)
    navigation.setLoadingTracks(true)
    try {
      const loaded = await fetchTracksForPlaylists(navigation.selectedIds)
      if (epoch !== navigation.currentEpoch()) {
        traceGame('runde', { aktion: 'laden-verworfen', schritt: 'titel' })
        return
      }
      if (loaded.length === 0) {
        throw new Error('Keine abspielbaren Titel gefunden.')
      }
      traceGame('runde', { aktion: 'geladen', anzahl: loaded.length, modus: navigation.gameId })
      await playback.connect()
      if (epoch !== navigation.currentEpoch()) {
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
      navigation.showGame()
      // Song erraten hält die Runde noch in der App (bis Phase 3) und lädt den ersten Titel vor.
      if (navigation.game?.entry.kind === 'hosted') {
        const opening = shuffled[0]
        if (opening) {
          void playback.primeOpening(opening.uri)
        }
      }
    } catch (cause) {
      if (epoch !== navigation.currentEpoch()) {
        traceGame('runde', { aktion: 'laden-verworfen', schritt: 'fehler' })
        return
      }
      const fehler = formatSpotifyUserError(cause)
      traceGame('runde', { aktion: 'laden-fehler', fehler })
      setError(fehler)
    } finally {
      if (epoch === navigation.currentEpoch()) {
        navigation.setLoadingTracks(false)
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
    return Math.max(0, deadlineRef.current - nowMs())
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
    deadlineRef.current = nowMs() + delayMs
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

  function handleLeaveGame(): void {
    setRoundReason('verlassen')
    traceGame('runde', { aktion: 'verlassen', modus: navigation.gameId })
    void playback.end()
    navigation.backToMenu()
  }

  function handleGameToPlaylists(): void {
    setRoundReason('verlassen')
    traceGame('runde', { aktion: 'zur-playlistauswahl', modus: navigation.gameId })
    void playback.end()
    navigation.leaveGameToPlaylists()
  }

  function handleAbort(): void {
    traceGame('runde', { aktion: 'abbruch', phase: phaseRef.current, index: indexRef.current })
    stopRound()
    navigation.showPlaylists()
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
    screen: navigation.debugScreen,
    phase,
    grund: roundReason,
    index,
    anzahl: tracks.length,
    laufend: running,
    pause: paused,
    fehler: error,
    modus: navigation.gameId,
    shotless: navigation.gameLive,
    titel: currentTrack?.title ?? null,
    interpret: currentTrack?.artist ?? null,
    uri: currentTrack?.uri ?? null,
    hoerbar: audiblePlay,
    snippet: snippetReady,
  })
  const { screen, game, fullBleed } = navigation

  function renderGame() {
    if (game?.entry.kind === 'component') {
      const { Screen } = game.entry
      return (
        <Screen
          tracks={tracks}
          error={error}
          playback={playback}
          onLogout={session.logout}
          onLeave={handleLeaveGame}
          onBackToPlaylists={handleGameToPlaylists}
          onLiveChange={navigation.setGameLive}
        />
      )
    }
    if (game?.entry.kind === 'hosted') {
      // Song erraten: Zustandsmaschine liegt noch in der App (Phase 3 macht daraus einen Hook).
      return (
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
          onLogout={session.logout}
        />
      )
    }
    return null
  }

  return (
    <main className={fullBleed ? 'app app-game' : 'app'}>
      <div className="glow" aria-hidden="true" />
      {screen === 'login' ? (
        <LoginScreen
          clientIdPresent={Boolean(getSpotifyClientId())}
          busy={session.busy}
          error={error}
          onSpotifyLogin={() => {
            void session.login()
          }}
        />
      ) : null}
      {screen === 'menu' ? (
        <MainMenu
          games={GAMES}
          savedTimings={savedTimings}
          onSaveTimings={handleSaveTimings}
          onLogout={session.logout}
          onSelectGame={navigation.selectGame}
        />
      ) : null}
      {screen === 'playlists' ? (
        <PlaylistPicker
          playlists={navigation.playlists}
          selectedIds={navigation.selectedIds}
          loading={navigation.loadingPlaylists}
          loadingTracks={navigation.loadingTracks}
          error={error}
          savedTimings={savedTimings}
          onSaveTimings={handleSaveTimings}
          onToggle={navigation.togglePlaylist}
          onToggleAll={navigation.toggleAllPlaylists}
          onStart={() => {
            void handleStartGame()
          }}
          onBack={navigation.backToMenu}
          onLogout={session.logout}
        />
      ) : null}
      {screen === 'game' ? renderGame() : null}
      {fullBleed ? null : <AppFooter />}
    </main>
  )
}
