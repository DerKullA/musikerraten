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
    return '3 Sekunden nachdenken. Noch keine Auflösung.'
  }
  if (phase === 'reveal') {
    return '6 Sekunden Auflösung mit Gesamtlänge, dann kommt der nächste Titel.'
  }
  return 'Startet die Runde. Danach läuft alles automatisch, bis du pausierst oder abbrichst.'
}

export const MAX_CONSECUTIVE_SAME_PLAYLIST = 3

/**
 * Fisher–Yates shuffle, then caps consecutive tracks from one playlist.
 * The cap applies only when at least two playlistIds are present.
 * Demo tracks, a single playlist, or missing playlistIds stay a plain shuffle.
 */
export function shuffleTracks(tracks: Track[]): Track[] {
  return limitConsecutivePlaylistRuns(fisherYatesShuffle(tracks))
}

function fisherYatesShuffle(tracks: Track[]): Track[] {
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

/**
 * Walks a shuffled list and takes the next remaining track from another
 * playlist whenever the last `maxRun` songs share a playlistId.
 * Always emits every input track: if no alternate remains, the run may
 * grow past `maxRun` instead of stalling or dropping songs.
 */
export function limitConsecutivePlaylistRuns(
  tracks: Track[],
  maxRun = MAX_CONSECUTIVE_SAME_PLAYLIST,
): Track[] {
  if (maxRun < 1 || tracks.length <= maxRun || !hasMultiplePlaylistSources(tracks)) {
    return [...tracks]
  }

  const remaining = [...tracks]
  const ordered: Track[] = []

  while (remaining.length > 0) {
    const chosen = takeAllowedTrack(remaining, playlistIdToAvoid(ordered, maxRun))
    if (chosen) {
      ordered.push(chosen)
    }
  }

  return ordered
}

function takeAllowedTrack(remaining: Track[], forbiddenId: string | undefined): Track | undefined {
  let pickIndex = 0
  if (forbiddenId) {
    const alternate = remaining.findIndex((track) => track.playlistId !== forbiddenId)
    if (alternate !== -1) {
      pickIndex = alternate
    }
  }
  const [chosen] = remaining.splice(pickIndex, 1)
  return chosen
}

function hasMultiplePlaylistSources(tracks: Track[]): boolean {
  const playlistIds = new Set<string>()
  for (const track of tracks) {
    if (track.playlistId) {
      playlistIds.add(track.playlistId)
    }
  }
  return playlistIds.size >= 2
}

function playlistIdToAvoid(ordered: Track[], maxRun: number): string | undefined {
  if (ordered.length < maxRun) {
    return undefined
  }
  const playlistId = ordered[ordered.length - 1]?.playlistId
  if (!playlistId) {
    return undefined
  }
  for (let offset = 1; offset < maxRun; offset += 1) {
    if (ordered[ordered.length - 1 - offset]?.playlistId !== playlistId) {
      return undefined
    }
  }
  return playlistId
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
