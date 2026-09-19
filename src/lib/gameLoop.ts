import type { GamePhase, Track } from '../types.ts'

export const PLAY_MS = 5000
export const THINK_MS = 3000
export const REVEAL_MS = 5000

export function shuffleTracks(tracks: Track[]): Track[] {
  const copy = [...tracks]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    const current = copy[index]
    const other = copy[swap]
    if (current && other) {
      copy[index] = other
      copy[swap] = current
    }
  }
  return copy
}

export function phaseDuration(phase: GamePhase): number {
  if (phase === 'playing') {
    return PLAY_MS
  }
  if (phase === 'thinking') {
    return THINK_MS
  }
  if (phase === 'reveal') {
    return REVEAL_MS
  }
  return 0
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

export function phaseLabel(phase: GamePhase): string {
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
