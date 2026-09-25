import type { GamePhase } from '../types.ts'
import {
  limitConsecutivePlaylistRuns,
  MAX_CONSECUTIVE_SAME_PLAYLIST,
  shuffleTracks,
} from './mixTracks.ts'
import { DEFAULT_PHASE_TIMINGS, type PhaseTimings } from './phaseTimings.ts'

export { limitConsecutivePlaylistRuns, MAX_CONSECUTIVE_SAME_PLAYLIST, shuffleTracks }

export const PLAY_MS = DEFAULT_PHASE_TIMINGS.playMs
export const THINK_MS = DEFAULT_PHASE_TIMINGS.thinkMs
export const REVEAL_MS = DEFAULT_PHASE_TIMINGS.revealMs

export function formatTrackDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function gameHint(
  phase: GamePhase,
  paused: boolean,
  timings: PhaseTimings = DEFAULT_PHASE_TIMINGS,
): string {
  if (paused) {
    return 'Pausiert. Timer und Ton stehen. Weiter macht genau hier weiter.'
  }
  if (phase === 'playing') {
    return `${formatSecondsPhrase(timings.playMs)} hören – Interpret und Titel bleiben verborgen.`
  }
  if (phase === 'thinking') {
    return `${formatSecondsPhrase(timings.thinkMs)} nachdenken. Der Ton pausiert, noch keine Auflösung.`
  }
  if (phase === 'reveal') {
    return `${formatSecondsPhrase(timings.revealMs)} Auflösung mit Gesamtlänge, dann kommt der nächste Titel.`
  }
  return 'Startet die Runde. Danach läuft alles automatisch, bis du pausierst oder abbrichst.'
}

export function phaseDuration(phase: GamePhase, timings: PhaseTimings = DEFAULT_PHASE_TIMINGS): number {
  if (phase === 'playing') {
    return timings.playMs
  }
  if (phase === 'thinking') {
    return timings.thinkMs
  }
  if (phase === 'reveal') {
    return timings.revealMs
  }
  return 0
}

function formatSecondsPhrase(durationMs: number): string {
  const seconds = Math.max(0, Math.round(durationMs / 1000))
  return seconds === 1 ? '1 Sekunde' : `${seconds} Sekunden`
}

export function nextPhase(phase: GamePhase): GamePhase {
  if (phase === 'playing') {
    return 'thinking'
  }
  if (phase === 'thinking') {
    return 'reveal'
  }
  return 'playing'
}

export function phaseLabel(phase: GamePhase, paused = false): string {
  if (paused) {
    return 'Pausiert'
  }
  if (phase === 'playing') {
    return 'Abspielen'
  }
  if (phase === 'thinking') {
    return 'Nachdenken'
  }
  if (phase === 'reveal') {
    return 'Auflösung'
  }
  return 'Bereit'
}

export function isTitleHidden(phase: GamePhase): boolean {
  return phase === 'playing' || phase === 'thinking' || phase === 'idle'
}

export function phasePlaysAudio(phase: GamePhase): boolean {
  return phase === 'playing' || phase === 'reveal'
}
