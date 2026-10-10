export const BACKDROP_POLL_MS = 1_000
export const BACKDROP_END_SLACK_MS = 400
export const BACKDROP_HANDOFF_POLLS = 2
export const GUESS_HANDOFF_PAUSE_ATTEMPTS = 15
export const GUESS_HANDOFF_PAUSE_GAP_MS = 80
const BACKDROP_FRESH_POSITION_MS = 5_000

export interface BackdropTrack {
  uri: string
  durationMs: number
}

export interface BackdropPosition {
  uri: string | null
  positionMs: number
}

export interface BackdropStart {
  uri: string
  durationMs: number
  positionMs: number
  resume: boolean
}

export interface BackdropHandlers {
  play: (uri: string, positionMs: number) => Promise<void>
  resume: () => Promise<void>
  readPosition: () => Promise<BackdropPosition | null>
  nextTrack: (finishedUri: string) => BackdropTrack | null
  isCancelled: () => boolean
  onPlayback: (state: 'playing' | 'paused') => void
  onError: (message: string) => void
}

export function rememberPlayedTrack(
  played: readonly BackdropTrack[],
  track: BackdropTrack,
): BackdropTrack[] {
  if (played.some((item) => item.uri === track.uri)) {
    return [...played]
  }
  return [...played, track]
}

export function pickBackdropTrack(
  played: readonly BackdropTrack[],
  finishedUri: string,
  random: () => number,
): BackdropTrack | null {
  if (played.length === 0) {
    return null
  }
  const others = played.filter((item) => item.uri !== finishedUri)
  const pool = others.length > 0 ? others : played
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)))
  return pool[index] ?? null
}

export function backdropRemainingMs(durationMs: number, positionMs: number): number {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return 0
  }
  const position = Number.isFinite(positionMs) ? Math.min(durationMs, Math.max(0, positionMs)) : 0
  return Math.max(0, durationMs - position)
}

export function backdropWaitMs(remainingMs: number, pollMs = BACKDROP_POLL_MS): number {
  if (remainingMs <= BACKDROP_END_SLACK_MS) {
    return 0
  }
  return Math.min(pollMs, remainingMs - BACKDROP_END_SLACK_MS)
}

export async function waitUntilPlaybackPaused(
  readPaused: () => Promise<boolean | null>,
  wait: (delayMs: number) => Promise<void>,
  attempts = GUESS_HANDOFF_PAUSE_ATTEMPTS,
): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if ((await readPaused()) === true) {
      return true
    }
    await wait(GUESS_HANDOFF_PAUSE_GAP_MS)
  }
  return false
}

export async function prepareGuessHandoff(input: {
  readPaused: () => Promise<boolean | null>
  pause: () => Promise<void>
  prime: () => Promise<void>
  wait: (delayMs: number) => Promise<void>
}): Promise<void> {
  if ((await input.readPaused()) !== true) {
    await input.pause()
    await waitUntilPlaybackPaused(input.readPaused, input.wait)
  }
  await input.prime()
}

export function backdropPositionMs(
  currentUri: string,
  read: BackdropPosition | null,
  assumedMs: number,
): number {
  if (!read || (read.uri !== null && read.uri !== currentUri)) {
    return assumedMs
  }
  return read.positionMs
}

export async function runBackdropPlayback(
  start: BackdropStart,
  handlers: BackdropHandlers,
  wait: (delayMs: number) => Promise<void>,
): Promise<void> {
  if (handlers.isCancelled() || start.durationMs <= 0) {
    return
  }
  let uri = start.uri
  let durationMs = start.durationMs
  let assumedMs = Math.max(0, start.positionMs)
  let handoffPolls = 0
  handlers.onPlayback('playing')
  try {
    if (start.resume) {
      await handlers.resume()
    } else {
      await handlers.play(uri, assumedMs)
    }
  } catch (cause) {
    handlers.onError(backdropFailureMessage(cause))
    handlers.onPlayback('paused')
    return
  }
  while (!handlers.isCancelled()) {
    const read = await handlers.readPosition()
    if (handlers.isCancelled()) {
      return
    }
    const live = read !== null && (read.uri === null || read.uri === uri)
    let positionMs = backdropPositionMs(uri, read, assumedMs)
    if (handoffPolls > 0) {
      const fresh = live && positionMs <= BACKDROP_FRESH_POSITION_MS
      if (fresh || handoffPolls > BACKDROP_HANDOFF_POLLS) {
        handoffPolls = 0
      } else {
        positionMs = 0
        handoffPolls += 1
      }
    }
    assumedMs = positionMs
    const delay = backdropWaitMs(backdropRemainingMs(durationMs, assumedMs))
    if (delay === 0) {
      const next = handlers.nextTrack(uri)
      if (!next || next.durationMs <= 0 || handlers.isCancelled()) {
        return
      }
      uri = next.uri
      durationMs = next.durationMs
      assumedMs = 0
      try {
        await handlers.play(uri, 0)
        handoffPolls = 1
      } catch (cause) {
        handlers.onError(backdropFailureMessage(cause))
        handlers.onPlayback('paused')
        return
      }
      continue
    }
    await wait(delay)
    if (!live) {
      assumedMs += delay
    }
  }
}

function backdropFailureMessage(cause: unknown): string {
  if (cause instanceof Error && cause.message) {
    return cause.message
  }
  return 'Wiedergabe fehlgeschlagen.'
}
