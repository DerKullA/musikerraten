// Ein neuer Song wird stumm vorgeladen, bis der Puffer am Einsatz steht.
// Hörbar wird danach nur die Lautstärke angehoben und fortgesetzt.

import type { PlaybackClaimResult } from './playbackDevice.ts'
import {
  logPlaybackError,
  rememberPlaybackLog,
  type PlaybackLogAction,
} from './playbackLog.ts'

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
  readPhase?: () => string
}

export interface ClipWarmup {
  prime: (cue: ClipCue) => Promise<void>
  play: (cue: ClipCue) => Promise<void>
  resumeDisplaced: () => Promise<boolean>
  invalidate: () => void
}

type WarmRequest = 'prime' | 'play' | 'restore' | 'drop'
type PrimeAbort = 'continue' | 'yield' | 'silence'

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

export function createClipWarmup(deps: ClipWarmupDeps): ClipWarmup {
  const audibleVolume = deps.audibleVolume ?? AUDIBLE_VOLUME
  const sleep = deps.sleep ?? delay
  let generation = 0
  let request: WarmRequest = 'drop'
  let primedCue: ClipCue | null = null
  let primingCue: ClipCue | null = null
  let displacedPositionMs: number | null = null
  let armedUri: string | null = null
  let task: Promise<void> = Promise.resolve()

  function begin(next: WarmRequest): number {
    generation += 1
    request = next
    return generation
  }

  function adoptCue(target: ClipCue): void {
    if (armedUri !== null && armedUri !== target.uri) {
      primedCue = null
      primingCue = null
      displacedPositionMs = null
    }
    armedUri = target.uri
  }

  function abortOf(token: number): PrimeAbort {
    if (generation === token && request === 'prime') {
      return 'continue'
    }
    if (request === 'play' || request === 'restore') {
      return 'yield'
    }
    return 'silence'
  }

  async function claimPlayback(target: ClipCue | null): Promise<boolean> {
    if (!deps.claimDevice) {
      return false
    }
    try {
      return (await deps.claimDevice(target)) === 'transferred'
    } catch {
      return false
    }
  }

  function enqueue(work: () => Promise<void>): Promise<void> {
    const run = task.then(work, work)
    task = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  async function runPrime(target: ClipCue, token: number): Promise<boolean> {
    let suspended = false
    let parked = false
    try {
      void deps.activate().catch(() => undefined)
      const transferred = await claimPlayback(target)
      if (abortOf(token) !== 'continue') {
        return false
      }
      const before = await deps.getState().catch(() => null)
      if (abortOf(token) !== 'continue') {
        return false
      }
      const action = transferred ? 'load' : choosePrimeAction(target, before)
      if (action === 'ready') {
        if (before && !before.paused) {
          parked = true
          await deps.pause()
        }
        return positionedAtCue(target, before, parked) && abortOf(token) === 'continue'
      }
      if (action === 'load') {
        displacedPositionMs = null
        return await parkIncomingTrack(target, token)
      }
      if (
        before &&
        before.uri === target.uri &&
        Math.abs(before.positionMs - target.positionMs) > CUE_POSITION_TOLERANCE_MS
      ) {
        displacedPositionMs = before.positionMs
      }
      await deps.suspendSilence()
      suspended = true
      if (abortOf(token) !== 'continue') {
        return false
      }
      await deps.seek(primeSeekMs(target.positionMs))
      if (abortOf(token) !== 'continue') {
        return false
      }
      parked = true
      await pauseUntilHeld(token)
      if (request === 'play') {
        await deps.resume().catch(() => undefined)
        return false
      }
      if (abortOf(token) !== 'continue') {
        return false
      }
      let after = await deps.getState().catch(() => null)
      if (
        after &&
        after.uri === target.uri &&
        after.positionMs > target.positionMs + CUE_POSITION_TOLERANCE_MS
      ) {
        await deps.seek(target.positionMs)
        await pauseUntilHeld(token)
        after = await deps.getState().catch(() => null)
      }
      return Boolean(after && after.paused && cueIsNear(target, after)) && abortOf(token) === 'continue'
    } finally {
      if (suspended && abortOf(token) === 'continue') {
        await deps.restoreSilence().catch(() => undefined)
      }
      if (abortOf(token) === 'silence' && parked) {
        await deps.pause().catch(() => undefined)
      }
    }
  }

  async function runPlay(target: ClipCue, token: number, fast: boolean): Promise<void> {
    if (generation !== token) {
      return
    }
    void deps.activate().catch(() => undefined)
    if (fast) {
      const primed = await deps.getState().catch(() => null)
      if (generation !== token) {
        return
      }
      const warmStart = chooseWarmStart(target, primed)
      if (warmStart === 'resume' || warmStart === 'unmute') {
        await startWarm(target, token, warmStart)
        if (generation !== token) {
          return
        }
        await waitUntilFirstPlayReady(target, token)
        return
      }
    }
    const transferred = await claimPlayback(target)
    if (generation !== token) {
      return
    }
    const state = transferred ? null : await deps.getState().catch(() => null)
    if (generation !== token) {
      return
    }
    await startWarm(target, token, transferred ? 'load' : chooseWarmStart(target, state), transferred)
    if (generation !== token) {
      return
    }
    await waitUntilFirstPlayReady(target, token)
  }

  async function waitUntilFirstPlayReady(target: ClipCue, token: number): Promise<void> {
    let previous: WarmPlaybackState | null = null
    for (let attempt = 0; attempt < PLAYBACK_START_LIMIT; attempt += 1) {
      if (generation !== token) {
        return
      }
      const state = await deps.getState().catch(() => null)
      if (firstPlayIsReady(target, previous, state)) {
        return
      }
      previous = state
      await sleep(PLAYBACK_START_POLL_MS)
    }
  }

  async function pauseUntilHeld(token: number): Promise<void> {
    let previous: WarmPlaybackState | null = null
    for (let attempt = 0; attempt < PLAYBACK_START_LIMIT; attempt += 1) {
      if (generation !== token) {
        return
      }
      await deps.pause()
      const state = await deps.getState().catch(() => null)
      if (playbackIsHeld(previous, state)) {
        return
      }
      previous = state
      await sleep(PLAYBACK_START_POLL_MS)
    }
  }

  async function parkIncomingTrack(target: ClipCue, token: number): Promise<boolean> {
    let suspended = false
    await deps.setVolume(0)
    try {
      await claimPlayback(target)
      await deps.suspendSilence()
      suspended = true
      if (generation !== token) {
        return false
      }
      await releaseForeignTrack(target, token)
      if (generation !== token) {
        return false
      }
      await deps.load(target)
      if (generation !== token) {
        return false
      }
      await waitUntilCueBuffered(target, token)
      if (generation !== token) {
        return false
      }
      await pauseUntilHeld(token)
      if (generation !== token) {
        return false
      }
      let after = await deps.getState().catch(() => null)
      if (after?.paused && parkedNearCue(target, after) && cueIsNear(target, after)) {
        return generation === token
      }
      const caught = await catchCue(target, token)
      if (generation !== token) {
        return false
      }
      after = await deps.getState().catch(() => null)
      if (after?.paused && parkedNearCue(target, after)) {
        return true
      }
      if (after && after.uri !== target.uri) {
        return false
      }
      return caught
    } finally {
      await deps.setVolume(audibleVolume).catch(() => undefined)
      if (suspended && generation === token) {
        await deps.suspendSilence().catch(() => undefined)
      }
    }
  }

  async function releaseForeignTrack(target: ClipCue, token: number): Promise<void> {
    if (generation !== token) {
      return
    }
    const state = await deps.getState().catch(() => null)
    if (!state?.uri || state.uri === target.uri || state.paused) {
      return
    }
    await deps.pause()
    for (let attempt = 0; attempt < FOREIGN_RELEASE_POLLS; attempt += 1) {
      if (generation !== token) {
        return
      }
      const next = await deps.getState().catch(() => null)
      if (!next?.uri || next.uri === target.uri || next.paused) {
        return
      }
      await sleep(PLAYBACK_START_POLL_MS)
    }
  }

  function failBufferedStart(target: ClipCue, step: string): never {
    const action: PlaybackLogAction = request === 'prime' ? 'prime' : 'play'
    const error = new Error('Der Song hat nicht gestartet.')
    logPlaybackError(error.message, {
      uri: target.uri,
      action,
      phase: deps.readPhase?.(),
      step,
    })
    rememberPlaybackLog(error)
    throw error
  }

  async function waitUntilCueBuffered(target: ClipCue, token: number): Promise<void> {
    let watch = createColdBufferWatch()
    let uncertainPolls = 0
    let loadingPolls = 0
    let idlePolls = 0
    let totalPolls = 0
    while (generation === token) {
      totalPolls += 1
      if (totalPolls > TRACK_SWITCH_WAIT_LIMIT + BUFFER_WAIT_LIMIT) {
        break
      }
      const state = await deps.getState().catch(() => null)
      if (!state || state.uri !== target.uri) {
        watch = createColdBufferWatch()
        idlePolls = 0
        loadingPolls = 0
        uncertainPolls += 1
        if (uncertainPolls >= TRACK_SWITCH_WAIT_LIMIT) {
          break
        }
        await sleep(PLAYBACK_START_POLL_MS)
        continue
      }
      uncertainPolls = 0
      if (state.paused && !state.loading) {
        const atCue = state.positionMs + CUE_POSITION_TOLERANCE_MS >= target.positionMs
        const settled = watch.sawReset || watch.stablePolls >= BUFFER_STABLE_POLLS
        if (atCue && settled) {
          return
        }
        await deps.resume()
        if (generation !== token) {
          return
        }
      }
      const noted = noteColdBufferSample(watch, state, target)
      watch = noted.watch
      if (noted.ready) {
        return
      }
      if (state.loading) {
        idlePolls = 0
        loadingPolls += 1
        if (loadingPolls >= TRACK_SWITCH_WAIT_LIMIT) {
          break
        }
      } else {
        loadingPolls = 0
        idlePolls += 1
        if (idlePolls >= BUFFER_WAIT_LIMIT) {
          break
        }
      }
      await sleep(PLAYBACK_START_POLL_MS)
    }
    if (generation === token) {
      failBufferedStart(target, 'buffer')
    }
  }

  async function catchCue(target: ClipCue, token: number): Promise<boolean> {
    for (let pass = 0; pass < 2; pass += 1) {
      if (generation !== token) {
        return false
      }
      await deps.seek(target.positionMs)
      if (generation !== token) {
        return false
      }
      await deps.resume()
      let previous: WarmPlaybackState | null = null
      for (let attempt = 0; attempt < PLAYBACK_START_LIMIT; attempt += 1) {
        if (generation !== token) {
          return false
        }
        const state = await deps.getState().catch(() => null)
        const moved =
          state?.uri === target.uri &&
          !state.paused &&
          !state.loading &&
          state.positionMs + CUE_POSITION_TOLERANCE_MS >= target.positionMs &&
          state.positionMs <= target.positionMs + PARK_SLOP_MS &&
          (!previous || !isBufferReset(previous.positionMs, state.positionMs))
        if (moved && state) {
          await pauseUntilHeld(token)
          const parked = await deps.getState().catch(() => null)
          if (parked?.paused && parkedNearCue(target, parked)) {
            return true
          }
        }
        if (
          state &&
          state.uri === target.uri &&
          !state.paused &&
          state.positionMs > target.positionMs + PARK_SLOP_MS
        ) {
          break
        }
        previous = state
        await sleep(PLAYBACK_START_POLL_MS)
      }
    }
    return false
  }

  async function startQueuedHandoff(target: ClipCue, token: number): Promise<boolean> {
    if (!deps.handoff || target.positionMs !== 0) {
      return false
    }
    let accepted = false
    try {
      accepted = await deps.handoff(target)
    } catch {
      return generation !== token
    }
    if (generation !== token) {
      return true
    }
    if (!accepted) {
      return false
    }
    await deps.setVolume(audibleVolume)
    let foreignPolls = 0
    let localPolls = 0
    while (generation === token) {
      const state = await deps.getState().catch(() => null)
      if (playbackHasStarted(target, state)) {
        void deps.queueFollowing?.(target)?.catch(() => undefined)
        return true
      }
      if (state?.uri === target.uri && state.paused) {
        await deps.resume().catch(() => undefined)
      }
      if (!state || state.uri !== target.uri) {
        foreignPolls += 1
        if (foreignPolls >= TRACK_SWITCH_WAIT_LIMIT) {
          return false
        }
      } else {
        foreignPolls = 0
        localPolls += 1
        if (localPolls >= PLAYBACK_START_LIMIT) {
          return false
        }
      }
      await sleep(PLAYBACK_START_POLL_MS)
    }
    return true
  }

  async function startLoadedClip(target: ClipCue, token: number): Promise<void> {
    const parked = await parkIncomingTrack(target, token)
    if (generation !== token) {
      return
    }
    if (!parked) {
      failBufferedStart(target, 'park')
    }
    await deps.resume()
  }

  async function startWarm(
    target: ClipCue,
    token: number,
    kind: WarmStart,
    fromTransfer = false,
  ): Promise<void> {
    if (kind === 'load') {
      if (!fromTransfer) {
        const handedOff = await startQueuedHandoff(target, token)
        if (handedOff || generation !== token) {
          return
        }
      }
      await startLoadedClip(target, token)
      return
    }
    try {
      await deps.setVolume(audibleVolume)
      if (generation !== token) {
        return
      }
      if (kind === 'unmute') {
        return
      }
      if (kind === 'seek-resume') {
        await deps.seek(target.positionMs)
        if (generation !== token) {
          return
        }
      }
      await deps.resume()
    } catch (cause) {
      if (generation !== token) {
        throw cause
      }
      await startLoadedClip(target, token)
    }
  }

  async function runRestore(positionMs: number, token: number): Promise<void> {
    if (generation !== token) {
      return
    }
    void deps.activate().catch(() => undefined)
    await claimPlayback(null)
    await deps.setVolume(audibleVolume)
    if (generation !== token) {
      return
    }
    const state = await deps.getState().catch(() => null)
    if (!state || Math.abs(state.positionMs - positionMs) > CUE_POSITION_TOLERANCE_MS) {
      await deps.seek(positionMs)
    }
    if (generation !== token) {
      return
    }
    await deps.resume()
  }

  return {
    prime(cue) {
      const target = normalizeCue(cue)
      adoptCue(target)
      if (request === 'prime' && primingCue && sameClipCue(primingCue, target)) {
        return task
      }
      if (primedCue && sameClipCue(primedCue, target) && request !== 'play' && request !== 'restore') {
        return Promise.resolve()
      }
      const token = begin('prime')
      primedCue = null
      primingCue = target
      return enqueue(async () => {
        try {
          if (generation !== token) {
            return
          }
          const ready = await runPrime(target, token)
          if (generation === token && ready) {
            primedCue = target
            armedUri = target.uri
          }
        } finally {
          if (generation === token) {
            primingCue = null
          }
        }
      })
    },
    play(cue) {
      const target = normalizeCue(cue)
      void deps.activate().catch(() => undefined)
      adoptCue(target)
      if (request === 'prime' && primingCue && sameClipCue(primingCue, target)) {
        return enqueue(async () => {
          const fast = primedCue !== null && sameClipCue(primedCue, target)
          const token = begin('play')
          primedCue = null
          primingCue = null
          displacedPositionMs = null
          await runPlay(target, token, fast)
        })
      }
      const fast = primedCue !== null && sameClipCue(primedCue, target)
      const token = begin('play')
      primedCue = null
      primingCue = null
      displacedPositionMs = null
      return enqueue(async () => {
        displacedPositionMs = null
        await runPlay(target, token, fast)
      })
    },
    resumeDisplaced() {
      const positionMs = displacedPositionMs
      if (positionMs === null) {
        if (request !== 'prime') {
          return Promise.resolve(false)
        }
        begin('drop')
        primedCue = null
        primingCue = null
        return enqueue(() => Promise.resolve()).then(() => false)
      }
      displacedPositionMs = null
      primedCue = null
      primingCue = null
      const token = begin('restore')
      return enqueue(async () => {
        await runRestore(positionMs, token)
      }).then(() => true)
    },
    invalidate() {
      begin('drop')
      primedCue = null
      primingCue = null
      displacedPositionMs = null
      armedUri = null
    },
  }
}

function positionedAtCue(target: ClipCue, state: WarmPlaybackState | null, pausedNow: boolean): boolean {
  if (!state || !cueIsNear(target, state)) {
    return false
  }
  return state.paused || pausedNow
}

function cueIsNear(target: ClipCue, state: WarmPlaybackState): boolean {
  return state.uri === target.uri && Math.abs(state.positionMs - target.positionMs) <= CUE_POSITION_TOLERANCE_MS
}

function parkedNearCue(target: ClipCue, state: WarmPlaybackState): boolean {
  return (
    state.uri === target.uri &&
    state.positionMs + CUE_POSITION_TOLERANCE_MS >= target.positionMs &&
    state.positionMs <= target.positionMs + PARK_SLOP_MS
  )
}

function delay(delayMs: number): Promise<void> {
  if (delayMs <= 0) {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs)
  })
}
