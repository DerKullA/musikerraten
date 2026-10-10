import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { reportClientWarning } from '@/platform/diagnostics/clientLog.ts'
import { holdScreenWakeLock } from '@/platform/wakeLock/browserWakeLock.ts'
import { formatGameDebugLog, traceGame } from '@/platform/diagnostics/gameDebug.ts'
import { useGameDebugWatch } from '@/platform/diagnostics/useGameDebug.ts'
import type { PlaybackApi } from '@/platform/playback/usePlaybackEngine.ts'
import { formatSpotifyUserError } from '@/platform/spotify/spotifyAuth.ts'
import {
  getSavedPhaseTimings,
  saveSavedPhaseTimings,
  useSavedPhaseTimings,
} from '@/ui/savedPhaseTimings.ts'
import { samePhaseTimings, timingsAtTrackStart, type PhaseTimings } from '@/ui/phaseTimings.ts'
import type { GamePhase, Track } from '@/types.ts'
import {
  CLOCK_CLEARED,
  armClock,
  followingPhasePlan,
  freezeClock,
  isActionAllowed,
  mediaPlaybackFor,
  nextTrackIndex,
  phaseAudioStep,
  phaseEntryMarks,
  phaseEntryPlan,
  phaseTimerPlan,
  resumePlan,
  snippetAudible,
  type PhaseTimerPlan,
  type RoundState,
} from './roundTransitions.ts'

// Nur aus Handlern und Timern aufgerufen, nie im Render; der Wrapper hält die Purity-Lint-Regel ruhig.
function nowMs(): number {
  return Date.now()
}

type EntryReason = 'timer' | 'naechster' | 'aufloesen' | 'weiter'

interface GuessSongRoundOptions {
  /** Geladene und gemischte Titel der Runde (die Shell lädt vor dem Screen-Wechsel). */
  tracks: Track[]
  /** Fehleranzeige der Shell, nur zum Mitloggen beim Force-Skip. */
  error: string | null
  playback: PlaybackApi
  /** Setzt oder leert die Fehleranzeige der Shell. */
  onError: (message: string | null) => void
}

// Zustandsmaschine von Song erraten: Phasen, Timer/Deadline, Pause/Weiter und die Aktionen
// Nochmal, Auflösen, Nächster, Force-Skip, Stopp. Zustand und Zeitgeber liegen hier, die
// Regeln dahinter in roundTransitions.ts. Timer-Callbacks greifen nur über Refs und stabile
// Setter auf den Stand zu; deshalb ist die beim Planen erfasste Funktion nie veraltet.
export function useGuessSongRound({ tracks, error, playback, onError }: GuessSongRoundOptions) {
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<GamePhase>('idle')
  const [running, setRunning] = useState(false)
  const [paused, setPaused] = useState(false)
  const [snippetReady, setSnippetReady] = useState(false)
  const [audiblePlay, setAudiblePlay] = useState(false)
  const savedTimings = useSavedPhaseTimings()
  const [roundTimings, setRoundTimings] = useState<PhaseTimings>(() => getSavedPhaseTimings())
  const [roundReason, setRoundReason] = useState('bereit')

  const phaseEntryRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const runningRef = useRef(false)
  const pausedRef = useRef(false)
  const remainingMsRef = useRef(0)
  const deadlineRef = useRef<number | null>(null)
  const indexRef = useRef(0)
  const tracksRef = useRef(tracks)
  const phaseRef = useRef<GamePhase>('idle')
  const roundTimingsRef = useRef(roundTimings)
  const onErrorRef = useRef(onError)
  const openedRef = useRef(false)

  useLayoutEffect(() => {
    onErrorRef.current = onError
  })

  // Die Wiedergabe liest Phase, Index und Pause über diese Getter (Refs, nie ein Render-Stand).
  useLayoutEffect(() => {
    playback.bindRound({
      gamePhase: () => phaseRef.current,
      currentIndex: () => indexRef.current,
      roundPaused: () => pausedRef.current,
    })
    return () => {
      playback.bindRound(null)
    }
  }, [playback])

  // Früher in der App beim Laden der Runde: ersten Titel vorladen (die Medien-Sitzung startet die
  // Shell beim Laden). Der Guard hält StrictMode (Mount, Cleanup, Mount) davon ab, es doppelt zu tun.
  useEffect(() => {
    if (openedRef.current) {
      return
    }
    openedRef.current = true
    const opening = tracksRef.current[0]
    if (opening) {
      void playback.primeOpening(opening.uri)
    }
  }, [playback])

  // Verlässt der Screen die Runde unerwartet, darf kein Timer weiterlaufen.
  useEffect(() => {
    return () => {
      clearGameTimer()
      runningRef.current = false
    }
  }, [])

  function reportError(message: string | null): void {
    onErrorRef.current(message)
  }

  function roundState(): RoundState {
    return {
      running: runningRef.current,
      paused: pausedRef.current,
      phase: phaseRef.current,
      trackCount: tracksRef.current.length,
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

  function resetPauseState(): void {
    pausedRef.current = false
    remainingMsRef.current = CLOCK_CLEARED.remainingMs
    deadlineRef.current = CLOCK_CLEARED.deadline
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

  function armPhaseTimer(plan: PhaseTimerPlan): void {
    const clock = armClock(plan.delayMs, nowMs())
    remainingMsRef.current = clock.remainingMs
    deadlineRef.current = clock.deadline
    schedulePhase(plan.next, plan.delayMs)
  }

  function scheduleFollowingPhase(current: GamePhase, timings: PhaseTimings): void {
    armPhaseTimer(followingPhasePlan(current, timings))
  }

  function capturePhaseTimings(target: GamePhase): PhaseTimings {
    const nextTimings = timingsAtTrackStart(target, roundTimingsRef.current, getSavedPhaseTimings())
    if (!samePhaseTimings(roundTimingsRef.current, nextTimings)) {
      setRoundTimings(nextTimings)
    }
    roundTimingsRef.current = nextTimings
    return nextTimings
  }

  function handleSaveTimings(next: PhaseTimings): void {
    saveSavedPhaseTimings(next)
  }

  async function enterPhase(next: GamePhase, grund: EntryReason = 'timer'): Promise<void> {
    if (!isActionAllowed('enter-phase', roundState())) {
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
    const plan = phaseEntryPlan(next)
    if (plan.advanceTrack) {
      playback.invalidate()
      const upcoming = nextTrackIndex(indexRef.current, tracksRef.current.length)
      indexRef.current = upcoming
      setIndex(upcoming)
    }
    const timings = capturePhaseTimings(next)
    phaseRef.current = next
    setPhase(next)
    if (plan.clearSnippetReady) {
      markSnippetReady(false)
    }
    if (plan.clearAudiblePlay) {
      markAudiblePlay(false)
    }
    let playbackStarted = false
    try {
      await applyPhaseAudio(next)
      playbackStarted = true
    } catch (cause) {
      playback.noteFailure(cause, 'play', currentTrackUri())
      reportError(formatSpotifyUserError(cause))
    }
    const marks = phaseEntryMarks(next, phaseRef.current, playbackStarted)
    if (marks.audiblePlay) {
      markAudiblePlay(true)
    }
    if (marks.snippetReady) {
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
    const step = phaseAudioStep(next, pausedRef.current)
    if (step === 'pause') {
      await playback.pause()
      return
    }
    if (step === 'play-current') {
      await playback.playCurrent()
      return
    }
    await playback.resume()
  }

  async function handlePlay(): Promise<void> {
    if (!isActionAllowed('play', roundState())) {
      traceGame('runde', { aktion: 'starten-leer' })
      return
    }
    holdScreenWakeLock()
    setRoundReason('starten')
    reportError(null)
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
      reportError(formatSpotifyUserError(cause))
    }
    if (snippetAudible(playbackStarted, phaseRef.current)) {
      markAudiblePlay(true)
    }
    scheduleFollowingPhase('playing', timings)
  }

  async function restartCurrentSnippet(): Promise<void> {
    if (!isActionAllowed('restart', roundState())) {
      traceGame('runde', { aktion: 'nochmal-block', phase: phaseRef.current })
      return
    }
    setRoundReason('nochmal')
    reportError(null)
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
      reportError(formatSpotifyUserError(cause))
    }
    if (snippetAudible(playbackStarted, phaseRef.current)) {
      markAudiblePlay(true)
    }
    scheduleFollowingPhase('playing', timings)
  }

  async function skipToNextTrack(): Promise<void> {
    if (!isActionAllowed('skip-next', roundState())) {
      traceGame('runde', { aktion: 'naechster-block', phase: phaseRef.current })
      return
    }
    pausedRef.current = false
    setPaused(false)
    await enterPhase('playing', 'naechster')
  }

  async function forceSkipTrack(): Promise<void> {
    if (!isActionAllowed('force-skip', roundState())) {
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
    reportError(null)
    await enterPhase('playing', 'naechster')
  }

  async function revealCurrentTrack(): Promise<void> {
    if (!isActionAllowed('reveal', roundState())) {
      traceGame('runde', { aktion: 'aufloesen-block', phase: phaseRef.current })
      return
    }
    pausedRef.current = false
    setPaused(false)
    await enterPhase('reveal', 'aufloesen')
  }

  // Rundenzustand zurücksetzen, ohne die Wiedergabe zu beenden (Logout beendet sie in der Shell).
  function haltRound(): void {
    setRoundReason('stopp')
    runningRef.current = false
    setRunning(false)
    resetPauseState()
    clearGameTimer()
    phaseRef.current = 'idle'
    setPhase('idle')
  }

  function stopRound(): void {
    haltRound()
    void playback.end()
  }

  function engageQuizMedia(target: GamePhase): void {
    playback.engageMedia(mediaPlaybackFor(target, pausedRef.current))
  }

  function handleAbort(): void {
    traceGame('runde', { aktion: 'abbruch', phase: phaseRef.current, index: indexRef.current })
    stopRound()
  }

  function handlePause(): void {
    if (!isActionAllowed('pause', roundState())) {
      traceGame('runde', { aktion: 'pause-block', phase: phaseRef.current, pause: pausedRef.current })
      return
    }
    setRoundReason('pause')
    const clock = freezeClock({ remainingMs: remainingMsRef.current, deadline: deadlineRef.current }, nowMs())
    remainingMsRef.current = clock.remainingMs
    deadlineRef.current = clock.deadline
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
    if (!isActionAllowed('resume', roundState())) {
      traceGame('runde', { aktion: 'weiter-block', phase: phaseRef.current, pause: pausedRef.current })
      return
    }
    setRoundReason('weiter')
    pausedRef.current = false
    setPaused(false)
    const current = phaseRef.current
    engageQuizMedia(current)
    const plan = resumePlan(current, remainingMsRef.current, roundTimingsRef.current)
    if (plan.kind === 'advance') {
      await enterPhase(plan.next, 'weiter')
      return
    }
    if (plan.resumeAudio) {
      try {
        await playback.resume()
      } catch (cause) {
        playback.noteFailure(cause, 'restore', currentTrackUri())
        reportError(formatSpotifyUserError(cause))
      }
    }
    armPhaseTimer(phaseTimerPlan(current, plan.remainingMs, roundTimingsRef.current))
  }

  // Wie bisher in der App: die Zeile 'spiel' trägt den Rundenstand, Screen/Modus/Fehler kommen aus der Shell.
  const currentTrack = tracks[index] ?? null
  useGameDebugWatch('spiel', {
    phase,
    grund: roundReason,
    index,
    anzahl: tracks.length,
    laufend: running,
    pause: paused,
    titel: currentTrack?.title ?? null,
    interpret: currentTrack?.artist ?? null,
    uri: currentTrack?.uri ?? null,
    hoerbar: audiblePlay,
    snippet: snippetReady,
  })

  return {
    track: currentTrack,
    phase,
    index,
    total: tracks.length,
    running,
    paused,
    snippetReady,
    audiblePlay,
    roundTimings,
    savedTimings,
    onSaveTimings: handleSaveTimings,
    onPlay: () => {
      void handlePlay()
    },
    onPause: handlePause,
    onResume: () => {
      void handleResume()
    },
    onReplay: () => {
      void restartCurrentSnippet()
    },
    onReveal: () => {
      void revealCurrentTrack()
    },
    onSkipNext: () => {
      void skipToNextTrack()
    },
    onForceSkip: () => {
      void forceSkipTrack()
    },
    /** Abbruch: Runde stoppen und Wiedergabe beenden (die Shell wechselt danach den Screen). */
    onAbort: handleAbort,
    /** Vor dem Logout: Rundenzustand zurücksetzen; die Shell beendet die Wiedergabe selbst. */
    haltForLogout: haltRound,
  }
}
