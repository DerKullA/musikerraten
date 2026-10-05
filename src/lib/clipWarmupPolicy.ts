// Ein neuer Song wird stumm vorgeladen, bis der Puffer am Einsatz steht.
// Hörbar wird danach nur die Lautstärke angehoben und fortgesetzt.

import type { PlaybackClaimResult } from './playbackDevice.ts'

export const AUDIBLE_VOLUME = 0.8
export const CUE_POSITION_TOLERANCE_MS = 180
export const PRIME_LEAD_MS = 240
export const PLAYBACK_START_POLL_MS = 50
export const PLAYBACK_START_LIMIT = 80
export const BUFFER_RESET_MS = 350
export const BUFFER_STABLE_POLLS = 60
export const BUFFER_WAIT_LIMIT = 220
export const TRACK_SWITCH_WAIT_LIMIT = 360
export const FOREIGN_RELEASE_POLLS = 8
export const PARK_SLOP_MS = 480

export interface ClipCue {
  uri: string
  positionMs: number
}

export interface WarmPlaybackState {
  paused: boolean
  positionMs: number
  uri: string | null
  loading?: boolean
}

export type WarmStart = 'unmute' | 'resume' | 'seek-resume' | 'load'
export type PrimeAction = 'ready' | 'seek' | 'load'
export type ClipPlaybackMode = 'clip' | 'continue'

interface SdkPlaybackState {
  paused?: boolean
  position?: number
  loading?: boolean
  track_window?: {
    current_track?: {
      uri?: string
    } | null
    next_tracks?: Array<{ uri?: string } | null> | null
  } | null
}

export interface ClipWarmupDeps {
  getState: () => Promise<WarmPlaybackState | null>
  getVolume: () => Promise<number | null>
  setVolume: (volume: number) => Promise<void>
  seek: (positionMs: number) => Promise<void>
  resume: () => Promise<void>
  pause: () => Promise<void>
  load: (cue: ClipCue) => Promise<void>
  handoff?: (cue: ClipCue) => Promise<boolean>
  queueFollowing?: (cue: ClipCue) => Promise<void>
  claimDevice?: (cue: ClipCue | null) => Promise<PlaybackClaimResult | void>
  activate: () => Promise<void>
  suspendSilence: () => Promise<void>
  restoreSilence: () => Promise<void>
  sleep?: (delayMs: number) => Promise<void>
  audibleVolume?: number
}

export interface ClipWarmup {
  prime: (cue: ClipCue) => Promise<void>
  play: (cue: ClipCue) => Promise<void>
  resumeDisplaced: () => Promise<boolean>
  invalidate: () => void
}

export type WarmRequest = 'prime' | 'play' | 'restore' | 'drop'
export type PrimeAbort = 'continue' | 'yield' | 'silence'

export function normalizeCue(cue: ClipCue): ClipCue {
  const positionMs = Number.isFinite(cue.positionMs) ? Math.max(0, Math.floor(cue.positionMs)) : 0
  return { uri: cue.uri, positionMs }
}

export function primeSeekMs(positionMs: number, leadMs = PRIME_LEAD_MS): number {
  return Math.max(0, positionMs - leadMs)
}

export function sameClipCue(
  left: ClipCue,
  right: ClipCue,
  toleranceMs = CUE_POSITION_TOLERANCE_MS,
): boolean {
  return left.uri === right.uri && Math.abs(left.positionMs - right.positionMs) <= toleranceMs
}

export function choosePrimeAction(
  cue: ClipCue,
  state: WarmPlaybackState | null,
  toleranceMs = CUE_POSITION_TOLERANCE_MS,
): PrimeAction {
  if (!state?.uri || state.uri !== cue.uri) {
    return 'load'
  }
  if (Math.abs(state.positionMs - cue.positionMs) <= toleranceMs) {
    return 'ready'
  }
  return 'seek'
}

export function chooseWarmStart(
  cue: ClipCue,
  state: WarmPlaybackState | null,
  toleranceMs = CUE_POSITION_TOLERANCE_MS,
): WarmStart {
  if (!state?.uri || state.uri !== cue.uri) {
    return 'load'
  }
  if (Math.abs(state.positionMs - cue.positionMs) > toleranceMs) {
    return 'seek-resume'
  }
  return state.paused ? 'resume' : 'unmute'
}

export function playbackHasStarted(target: ClipCue, state: WarmPlaybackState | null): boolean {
  return Boolean(state && state.uri === target.uri && !state.paused)
}

export function firstPlayIsReady(
  cue: ClipCue,
  previous: WarmPlaybackState | null,
  state: WarmPlaybackState | null,
): boolean {
  if (!previous || !state || state.paused || state.loading || previous.paused) {
    return false
  }
  if (previous.uri !== cue.uri || state.uri !== cue.uri) {
    return false
  }
  if (state.positionMs + CUE_POSITION_TOLERANCE_MS < cue.positionMs) {
    return false
  }
  return state.positionMs > previous.positionMs
}

export function cueReached(
  cue: ClipCue,
  state: WarmPlaybackState,
  toleranceMs = CUE_POSITION_TOLERANCE_MS,
): boolean {
  return state.uri === cue.uri && state.positionMs >= cue.positionMs - toleranceMs
}

export function playheadEnteredCue(
  previous: WarmPlaybackState | null,
  state: WarmPlaybackState | null,
  cue: ClipCue,
  toleranceMs = CUE_POSITION_TOLERANCE_MS,
): boolean {
  if (!previous || !state || state.paused || previous.uri !== cue.uri || state.uri !== cue.uri) {
    return false
  }
  if (state.positionMs + toleranceMs < cue.positionMs) {
    return false
  }
  return state.positionMs > previous.positionMs
}

export function playbackIsHeld(
  previous: WarmPlaybackState | null,
  state: WarmPlaybackState | null,
  toleranceMs = CUE_POSITION_TOLERANCE_MS,
): boolean {
  if (!previous?.paused || !state?.paused || previous.uri !== state.uri) {
    return false
  }
  return Math.abs(previous.positionMs - state.positionMs) <= toleranceMs
}

export interface ColdBufferWatch {
  previous: WarmPlaybackState | null
  sawReset: boolean
  stablePolls: number
}

export function createColdBufferWatch(): ColdBufferWatch {
  return { previous: null, sawReset: false, stablePolls: 0 }
}

export function isBufferReset(previousMs: number, nextMs: number, resetMs = BUFFER_RESET_MS): boolean {
  return previousMs - nextMs >= resetMs
}

export function noteColdBufferSample(
  watch: ColdBufferWatch,
  state: WarmPlaybackState | null,
  cue: ClipCue,
): { watch: ColdBufferWatch; ready: boolean } {
  if (!state || state.uri !== cue.uri) {
    return { watch: createColdBufferWatch(), ready: false }
  }
  const previous = watch.previous
  const jumped = Boolean(
    previous &&
      previous.uri === cue.uri &&
      isBufferReset(previous.positionMs, state.positionMs),
  )
  const sawReset = watch.sawReset || jumped
  if (state.paused || state.loading) {
    return { watch: { previous: state, sawReset, stablePolls: 0 }, ready: false }
  }
  const atCue = state.positionMs + CUE_POSITION_TOLERANCE_MS >= cue.positionMs
  if (!atCue) {
    return { watch: { previous: state, sawReset, stablePolls: 0 }, ready: false }
  }
  if (sawReset || previous?.loading === true) {
    return { watch: { previous: state, sawReset: true, stablePolls: 0 }, ready: true }
  }
  const stablePolls = watch.stablePolls + 1
  return {
    watch: { previous: state, sawReset, stablePolls },
    ready: stablePolls >= BUFFER_STABLE_POLLS,
  }
}

export function shouldPrimeParkedClip(
  playback: ClipPlaybackMode,
  clipToken: number,
  activeToken: number,
): boolean {
  return playback === 'clip' && clipToken === activeToken
}

export function readQueuedTrackUri(state: SdkPlaybackState | null): string | null {
  const uri = state?.track_window?.next_tracks?.[0]?.uri
  if (typeof uri !== 'string' || !uri.startsWith('spotify:track:')) {
    return null
  }
  return uri
}

export function readWarmPlayback(state: SdkPlaybackState | null): WarmPlaybackState | null {
  if (!state || typeof state.paused !== 'boolean') {
    return null
  }
  const positionMs =
    typeof state.position === 'number' && Number.isFinite(state.position)
      ? Math.max(0, Math.round(state.position))
      : 0
  const uri = state.track_window?.current_track?.uri
  return {
    paused: state.paused,
    positionMs,
    uri: typeof uri === 'string' && uri.length > 0 ? uri : null,
    loading: state.loading === true,
  }
}

export function positionedAtCue(target: ClipCue, state: WarmPlaybackState | null, pausedNow: boolean): boolean {
  if (!state || !cueIsNear(target, state)) {
    return false
  }
  return state.paused || pausedNow
}

export function cueIsNear(target: ClipCue, state: WarmPlaybackState): boolean {
  return state.uri === target.uri && Math.abs(state.positionMs - target.positionMs) <= CUE_POSITION_TOLERANCE_MS
}

export function parkedNearCue(target: ClipCue, state: WarmPlaybackState): boolean {
  return (
    state.uri === target.uri &&
    state.positionMs + CUE_POSITION_TOLERANCE_MS >= target.positionMs &&
    state.positionMs <= target.positionMs + PARK_SLOP_MS
  )
}
