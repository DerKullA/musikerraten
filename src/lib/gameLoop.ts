import type { GamePhase, Track } from '../types.ts'

export const PLAY_MS = 11_000
export const THINK_MS = 3000
export const REVEAL_MS = 6000

export function formatTrackDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function gameHint(phase: GamePhase, paused: boolean): string {
  if (paused) {
    return 'Pausiert. Timer und Ton stehen. Weiter macht genau hier weiter.'
  }
  if (phase === 'playing') {
    return '11 Sekunden hören – Interpret und Titel bleiben verborgen.'
  }
  if (phase === 'thinking') {
    return '3 Sekunden nachdenken. Der Ton pausiert, noch keine Auflösung.'
  }
  if (phase === 'reveal') {
    return '6 Sekunden Auflösung mit Gesamtlänge, dann kommt der nächste Titel.'
  }
  return 'Startet die Runde. Danach läuft alles automatisch, bis du pausierst oder abbrichst.'
}

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
