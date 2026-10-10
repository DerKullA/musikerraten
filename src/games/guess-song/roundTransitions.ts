import type { GamePhase } from '@/types.ts'
import type { PhaseTimings } from '@/ui/phaseTimings.ts'
import { nextPhase, phaseDuration, phasePlaysAudio } from './roundLoop.ts'

// Reine Übergangs- und Berechnungsregeln der Song-erraten-Runde. Der Hook useGuessSongRound
// hält Zustand, Refs und Timer; hier steht nur, was daraus folgt (ohne React, ohne Uhr).

export type RoundAction =
  | 'play'
  | 'restart'
  | 'skip-next'
  | 'force-skip'
  | 'reveal'
  | 'pause'
  | 'resume'
  | 'enter-phase'

export interface RoundState {
  running: boolean
  paused: boolean
  phase: GamePhase
  trackCount: number
}

const GUESSING_PHASES: readonly GamePhase[] = ['playing', 'thinking']

/** Ist die Aktion im aktuellen Rundenzustand erlaubt? (Sonst meldet der Hook "…-block".) */
export function isActionAllowed(action: RoundAction, state: RoundState): boolean {
  const { running, paused, phase, trackCount } = state
  switch (action) {
    case 'play':
      return trackCount > 0
    case 'restart':
      return running && trackCount > 0 && GUESSING_PHASES.includes(phase)
    case 'skip-next':
      return running && phase === 'reveal'
    case 'force-skip':
      return running
    case 'reveal':
      return running && GUESSING_PHASES.includes(phase)
    case 'pause':
      return running && !paused && phase !== 'idle'
    case 'resume':
      return running && paused
    case 'enter-phase':
      return running && !paused
  }
}

/** Nächster Titelindex; nach dem letzten Titel geht es wieder bei 0 los. */
export function nextTrackIndex(index: number, trackCount: number): number {
  return index >= trackCount - 1 ? 0 : index + 1
}

// Timer-Uhr: Deadline (absolute Zeit) oder, solange pausiert, die gemerkte Restzeit.
export interface PhaseClock {
  remainingMs: number
  deadline: number | null
}

export const CLOCK_CLEARED: PhaseClock = { remainingMs: 0, deadline: null }

/** Restzeit aus der Deadline; ohne Deadline (pausiert) die gemerkte Restzeit. */
export function remainingFromDeadline(clock: PhaseClock, now: number): number {
  if (clock.deadline === null) {
    return clock.remainingMs
  }
  return Math.max(0, clock.deadline - now)
}

/** Uhr für einen neu gesetzten Phasen-Timer. */
export function armClock(delayMs: number, now: number): PhaseClock {
  return { remainingMs: delayMs, deadline: now + delayMs }
}

/** Uhr beim Pausieren: Restzeit festhalten, Deadline verwerfen. */
export function freezeClock(clock: PhaseClock, now: number): PhaseClock {
  return { remainingMs: remainingFromDeadline(clock, now), deadline: null }
}

export interface PhaseTimerPlan {
  next: GamePhase
  delayMs: number
}

/** Timer nach dem Betreten einer Phase: Dauer der Phase und die Phase danach. */
export function followingPhasePlan(current: GamePhase, timings: PhaseTimings): PhaseTimerPlan {
  return { next: nextPhase(current, timings), delayMs: phaseDuration(current, timings) }
}

/** Timer mit vorgegebener (Rest-)Zeit, z. B. nach dem Fortsetzen. */
export function phaseTimerPlan(current: GamePhase, delayMs: number, timings: PhaseTimings): PhaseTimerPlan {
  return { next: nextPhase(current, timings), delayMs }
}

export type ResumePlan =
  | { kind: 'advance'; next: GamePhase }
  | { kind: 'continue'; resumeAudio: boolean; remainingMs: number }

/** Weiter nach Pause: ohne Restzeit sofort in die nächste Phase, sonst Timer mit Restzeit fortsetzen. */
export function resumePlan(current: GamePhase, remainingMs: number, timings: PhaseTimings): ResumePlan {
  if (remainingMs <= 0) {
    return { kind: 'advance', next: nextPhase(current, timings) }
  }
  return { kind: 'continue', resumeAudio: phasePlaysAudio(current), remainingMs }
}

export interface PhaseEntryPlan {
  /** Nächster Titel wird gewählt (nur beim Eintritt in 'playing'). */
  advanceTrack: boolean
  clearSnippetReady: boolean
  clearAudiblePlay: boolean
}

export function phaseEntryPlan(next: GamePhase): PhaseEntryPlan {
  return {
    advanceTrack: next === 'playing',
    clearSnippetReady: next === 'playing' || next === 'thinking',
    clearAudiblePlay: next === 'playing',
  }
}

export type PhaseAudioStep = 'pause' | 'play-current' | 'resume'

/** Welche Wiedergabeaktion gehört zum Betreten der Phase? Pausiert/Bereit/Nachdenken: anhalten. */
export function phaseAudioStep(next: GamePhase, paused: boolean): PhaseAudioStep {
  if (paused || next === 'idle' || next === 'thinking') {
    return 'pause'
  }
  if (next === 'playing') {
    return 'play-current'
  }
  return 'resume'
}

export interface PhaseEntryMarks {
  audiblePlay: boolean
  snippetReady: boolean
}

/** Anzeige-Marker nach dem Audio-Schritt, nur wenn die Phase inzwischen nicht gewechselt hat. */
export function phaseEntryMarks(next: GamePhase, currentPhase: GamePhase, playbackStarted: boolean): PhaseEntryMarks {
  return {
    audiblePlay: playbackStarted && currentPhase === next && next === 'playing',
    snippetReady: currentPhase === next && next === 'thinking',
  }
}

/** Marker "hörbar" nach (Neu-)Start des Ausschnitts (handlePlay/Nochmal). */
export function snippetAudible(playbackStarted: boolean, currentPhase: GamePhase): boolean {
  return playbackStarted && currentPhase === 'playing'
}

/** Zustand der Medien-Sitzung (Sperrbildschirm) zur Phase. */
export function mediaPlaybackFor(phase: GamePhase, paused: boolean): 'playing' | 'paused' {
  if (paused || !phasePlaysAudio(phase)) {
    return 'paused'
  }
  return 'playing'
}
