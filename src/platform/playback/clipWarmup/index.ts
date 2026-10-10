import { createWarmRun } from './run.ts'
import type { WarmRuntime } from './runtime.ts'
import {
  AUDIBLE_VOLUME,
  normalizeCue,
  sameClipCue,
  type ClipCue,
  type ClipWarmup,
  type ClipWarmupDeps,
  type PrimeAbort,
  type WarmRequest,
} from './policy.ts'

export {
  AUDIBLE_VOLUME,
  CUE_POSITION_TOLERANCE_MS,
  PRIME_LEAD_MS,
  PLAYBACK_START_POLL_MS,
  PLAYBACK_START_LIMIT,
  BUFFER_RESET_MS,
  BUFFER_STABLE_POLLS,
  BUFFER_WAIT_LIMIT,
  TRACK_SWITCH_WAIT_LIMIT,
  FOREIGN_RELEASE_POLLS,
  PARK_SLOP_MS,
  normalizeCue,
  primeSeekMs,
  sameClipCue,
  choosePrimeAction,
  chooseWarmStart,
  playbackHasStarted,
  firstPlayIsReady,
  cueReached,
  playheadEnteredCue,
  playbackIsHeld,
  createColdBufferWatch,
  isBufferReset,
  noteColdBufferSample,
  shouldPrimeParkedClip,
  readQueuedTrackUri,
  readWarmPlayback,
  type ClipCue,
  type WarmPlaybackState,
  type WarmStart,
  type PrimeAction,
  type ClipPlaybackMode,
  type ClipWarmupDeps,
  type ClipWarmup,
  type ColdBufferWatch,
} from './policy.ts'

export function createClipWarmup(deps: ClipWarmupDeps): ClipWarmup {
  const audibleVolume = deps.audibleVolume ?? AUDIBLE_VOLUME
  const sleep = deps.sleep ?? delay
  let generation = 0
  let request: WarmRequest = 'drop'
  let primedCue: ClipCue | null = null
  let primingCue: ClipCue | null = null
  let armedUri: string | null = null
  let task: Promise<void> = Promise.resolve()
  let claimedToken = -1
  let claimedKey = ''
  let claimedTransferred = false

  function begin(next: WarmRequest): number {
    generation += 1
    request = next
    claimedToken = -1
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

  async function claimPlayback(target: ClipCue | null): Promise<boolean> {
    if (!deps.claimDevice) {
      return false
    }
    const key = target ? `${target.uri}@${target.positionMs}` : '*'
    if (claimedToken === generation && claimedKey === key) {
      return claimedTransferred
    }
    const token = generation
    try {
      const transferred = (await deps.claimDevice(target)) === 'transferred'
      if (generation === token) {
        claimedToken = token
        claimedKey = key
        claimedTransferred = transferred
      }
      return transferred
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

  const runtime: WarmRuntime = {
    get generation() {
      return generation
    },
    get request() {
      return request
    },
    deps,
    sleep,
    audibleVolume,
    displacedPositionMs: null,
    claimPlayback,
    abortOf,
  }

  function adoptCue(target: ClipCue): void {
    if (armedUri !== null && armedUri !== target.uri) {
      primedCue = null
      primingCue = null
      runtime.displacedPositionMs = null
    }
    armedUri = target.uri
  }

  const { runPrime, runPlay, runRestore } = createWarmRun(runtime)

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
          runtime.displacedPositionMs = null
          await runPlay(target, token, fast)
        })
      }
      const fast = primedCue !== null && sameClipCue(primedCue, target)
      const token = begin('play')
      primedCue = null
      primingCue = null
      runtime.displacedPositionMs = null
      return enqueue(async () => {
        runtime.displacedPositionMs = null
        await runPlay(target, token, fast)
      })
    },
    resumeDisplaced() {
      const positionMs = runtime.displacedPositionMs
      if (positionMs === null) {
        if (request !== 'prime') {
          return Promise.resolve(false)
        }
        begin('drop')
        primedCue = null
        primingCue = null
        return enqueue(() => Promise.resolve()).then(() => false)
      }
      runtime.displacedPositionMs = null
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
      runtime.displacedPositionMs = null
      armedUri = null
    },
  }
}

function delay(delayMs: number): Promise<void> {
  if (delayMs <= 0) {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs)
  })
}
