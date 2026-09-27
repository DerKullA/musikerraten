// Der nächste Clip wird an die Startposition gelegt und pausiert.
// Die Spotify-Lautstärke bleibt dabei unangetastet.

export const AUDIBLE_VOLUME = 0.8
export const CUE_POSITION_TOLERANCE_MS = 180
export const PRIME_LEAD_MS = 240
export const PLAYBACK_START_POLL_MS = 50
export const PLAYBACK_START_LIMIT = 80

export interface ClipCue {
  uri: string
  positionMs: number
}

export interface WarmPlaybackState {
  paused: boolean
  positionMs: number
  uri: string | null
}

export type WarmStart = 'unmute' | 'resume' | 'seek-resume' | 'load'
export type PrimeAction = 'ready' | 'seek' | 'load'
export type ClipPlaybackMode = 'clip' | 'continue'

interface SdkPlaybackState {
  paused?: boolean
  position?: number
  track_window?: {
    current_track?: {
      uri?: string
    } | null
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

export function shouldPrimeParkedClip(
  playback: ClipPlaybackMode,
  clipToken: number,
  activeToken: number,
): boolean {
  return playback === 'clip' && clipToken === activeToken
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
  }
}

export function createClipWarmup(deps: ClipWarmupDeps): ClipWarmup {
  const audibleVolume = deps.audibleVolume ?? AUDIBLE_VOLUME
  const sleep = deps.sleep ?? delay
  let generation = 0
  let request: WarmRequest = 'drop'
  let primedCue: ClipCue | null = null
  let displacedPositionMs: number | null = null
  let task: Promise<void> = Promise.resolve()

  function begin(next: WarmRequest): number {
    generation += 1
    request = next
    return generation
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
      if (abortOf(token) !== 'continue') {
        return false
      }
      const before = await deps.getState().catch(() => null)
      if (abortOf(token) !== 'continue') {
        return false
      }
      const action = choosePrimeAction(target, before)
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
    if (!fast) {
      const state = await deps.getState().catch(() => null)
      if (generation !== token) {
        return
      }
      await startWarm(target, token, chooseWarmStart(target, state))
      return
    }
    await startWarm(target, token, 'resume')
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
      await deps.suspendSilence()
      suspended = true
      if (generation !== token) {
        return false
      }
      await deps.load(target)
      if (generation !== token) {
        return false
      }
      await rollToCue(target, token)
      if (generation !== token) {
        return false
      }
      await pauseUntilHeld(token)
      if (generation !== token) {
        return false
      }
      await deps.seek(target.positionMs)
      if (generation !== token) {
        return false
      }
      await pauseUntilHeld(token)
      const after = await deps.getState().catch(() => null)
      return Boolean(after && after.paused && cueIsNear(target, after)) && generation === token
    } finally {
      await deps.setVolume(audibleVolume).catch(() => undefined)
      if (suspended && generation === token) {
        await deps.suspendSilence().catch(() => undefined)
      }
    }
  }

  async function rollToCue(target: ClipCue, token: number): Promise<void> {
    let previous: WarmPlaybackState | null = null
    let armed = false
    for (let attempt = 0; attempt < PLAYBACK_START_LIMIT; attempt += 1) {
      if (generation !== token) {
        return
      }
      const state = await deps.getState().catch(() => null)
      if (playheadEnteredCue(previous, state, target)) {
        return
      }
      if (state?.uri === target.uri && !armed) {
        await deps.seek(primeSeekMs(target.positionMs))
        if (generation !== token) {
          return
        }
        await deps.resume()
        armed = true
        previous = null
        await sleep(PLAYBACK_START_POLL_MS)
        continue
      }
      previous = state
      await sleep(PLAYBACK_START_POLL_MS)
    }
    if (generation === token) {
      throw new Error('Der Song hat nicht gestartet.')
    }
  }

  async function startLoadedClip(target: ClipCue, token: number): Promise<void> {
    const parked = await parkIncomingTrack(target, token)
    if (generation !== token) {
      return
    }
    if (!parked) {
      throw new Error('Der Song hat nicht gestartet.')
    }
    await deps.resume()
  }

  async function startWarm(target: ClipCue, token: number, kind: WarmStart): Promise<void> {
    if (kind === 'load') {
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
      const token = begin('prime')
      primedCue = null
      return enqueue(async () => {
        if (generation !== token) {
          return
        }
        const ready = await runPrime(target, token)
        if (generation === token && ready) {
          primedCue = target
        }
      })
    },
    play(cue) {
      const target = normalizeCue(cue)
      const fast = primedCue !== null && sameClipCue(primedCue, target)
      const token = begin('play')
      primedCue = null
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
        return enqueue(() => Promise.resolve()).then(() => false)
      }
      displacedPositionMs = null
      primedCue = null
      const token = begin('restore')
      return enqueue(async () => {
        await runRestore(positionMs, token)
      }).then(() => true)
    },
    invalidate() {
      begin('drop')
      primedCue = null
      displacedPositionMs = null
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

function delay(delayMs: number): Promise<void> {
  if (delayMs <= 0) {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs)
  })
}
