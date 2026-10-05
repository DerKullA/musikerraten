import { playbackHasStarted, primeSeekMs, choosePrimeAction, chooseWarmStart, CUE_POSITION_TOLERANCE_MS, PLAYBACK_START_LIMIT, PLAYBACK_START_POLL_MS, TRACK_SWITCH_WAIT_LIMIT, positionedAtCue, cueIsNear, parkedNearCue, type ClipCue, type WarmStart } from './clipWarmupPolicy.ts'
import { createWarmBuffer } from './clipWarmupBuffer.ts'
import type { WarmRuntime } from './clipWarmupRuntime.ts'

export function createWarmRun(runtime: WarmRuntime) {
  const {
    pauseUntilHeld,
    waitUntilFirstPlayReady,
    releaseForeignTrack,
    waitUntilCueBuffered,
    catchCue,
    failBufferedStart,
  } = createWarmBuffer(runtime)

  async function runPrime(target: ClipCue, token: number): Promise<boolean> {
    let suspended = false
    let parked = false
    try {
      void runtime.deps.activate().catch(() => undefined)
      const transferred = await runtime.claimPlayback(target)
      if (runtime.abortOf(token) !== 'continue') {
        return false
      }
      const before = await runtime.deps.getState().catch(() => null)
      if (runtime.abortOf(token) !== 'continue') {
        return false
      }
      const action = transferred ? 'load' : choosePrimeAction(target, before)
      if (action === 'ready') {
        if (before && !before.paused) {
          parked = true
          await runtime.deps.pause()
        }
        return positionedAtCue(target, before, parked) && runtime.abortOf(token) === 'continue'
      }
      if (action === 'load') {
        runtime.displacedPositionMs = null
        return await parkIncomingTrack(target, token)
      }
      if (
        before &&
        before.uri === target.uri &&
        Math.abs(before.positionMs - target.positionMs) > CUE_POSITION_TOLERANCE_MS
      ) {
        runtime.displacedPositionMs = before.positionMs
      }
      await runtime.deps.suspendSilence()
      suspended = true
      if (runtime.abortOf(token) !== 'continue') {
        return false
      }
      await runtime.deps.seek(primeSeekMs(target.positionMs))
      if (runtime.abortOf(token) !== 'continue') {
        return false
      }
      parked = true
      await pauseUntilHeld(token)
      if (runtime.request === 'play') {
        await runtime.deps.resume().catch(() => undefined)
        return false
      }
      if (runtime.abortOf(token) !== 'continue') {
        return false
      }
      let after = await runtime.deps.getState().catch(() => null)
      if (
        after &&
        after.uri === target.uri &&
        after.positionMs > target.positionMs + CUE_POSITION_TOLERANCE_MS
      ) {
        await runtime.deps.seek(target.positionMs)
        await pauseUntilHeld(token)
        after = await runtime.deps.getState().catch(() => null)
      }
      return Boolean(after && after.paused && cueIsNear(target, after)) && runtime.abortOf(token) === 'continue'
    } finally {
      if (suspended && runtime.abortOf(token) === 'continue') {
        await runtime.deps.restoreSilence().catch(() => undefined)
      }
      if (runtime.abortOf(token) === 'silence' && parked) {
        await runtime.deps.pause().catch(() => undefined)
      }
    }
  }

  async function runPlay(target: ClipCue, token: number, fast: boolean): Promise<void> {
    if (runtime.generation !== token) {
      return
    }
    void runtime.deps.activate().catch(() => undefined)
    if (fast) {
      const primed = await runtime.deps.getState().catch(() => null)
      if (runtime.generation !== token) {
        return
      }
      const warmStart = chooseWarmStart(target, primed)
      if (warmStart === 'resume' || warmStart === 'unmute') {
        await startWarm(target, token, warmStart)
        if (runtime.generation !== token) {
          return
        }
        await waitUntilFirstPlayReady(target, token)
        return
      }
    }
    const transferred = await runtime.claimPlayback(target)
    if (runtime.generation !== token) {
      return
    }
    const state = transferred ? null : await runtime.deps.getState().catch(() => null)
    if (runtime.generation !== token) {
      return
    }
    await startWarm(target, token, transferred ? 'load' : chooseWarmStart(target, state), transferred)
    if (runtime.generation !== token) {
      return
    }
    await waitUntilFirstPlayReady(target, token)
  }

  async function parkIncomingTrack(target: ClipCue, token: number): Promise<boolean> {
    let suspended = false
    await runtime.deps.setVolume(0)
    try {
      await runtime.claimPlayback(target)
      await runtime.deps.suspendSilence()
      suspended = true
      if (runtime.generation !== token) {
        return false
      }
      await releaseForeignTrack(target, token)
      if (runtime.generation !== token) {
        return false
      }
      await runtime.deps.load(target)
      if (runtime.generation !== token) {
        return false
      }
      await waitUntilCueBuffered(target, token)
      if (runtime.generation !== token) {
        return false
      }
      await pauseUntilHeld(token)
      if (runtime.generation !== token) {
        return false
      }
      let after = await runtime.deps.getState().catch(() => null)
      if (after?.paused && parkedNearCue(target, after) && cueIsNear(target, after)) {
        return runtime.generation === token
      }
      const caught = await catchCue(target, token)
      if (runtime.generation !== token) {
        return false
      }
      after = await runtime.deps.getState().catch(() => null)
      if (after?.paused && parkedNearCue(target, after)) {
        return true
      }
      if (after && after.uri !== target.uri) {
        return false
      }
      return caught
    } finally {
      await runtime.deps.setVolume(runtime.audibleVolume).catch(() => undefined)
      if (suspended && runtime.generation === token) {
        await runtime.deps.suspendSilence().catch(() => undefined)
      }
    }
  }

  async function startQueuedHandoff(target: ClipCue, token: number): Promise<boolean> {
    if (!runtime.deps.handoff || target.positionMs !== 0) {
      return false
    }
    let accepted = false
    try {
      accepted = await runtime.deps.handoff(target)
    } catch {
      return runtime.generation !== token
    }
    if (runtime.generation !== token) {
      return true
    }
    if (!accepted) {
      return false
    }
    await runtime.deps.setVolume(runtime.audibleVolume)
    let foreignPolls = 0
    let localPolls = 0
    while (runtime.generation === token) {
      const state = await runtime.deps.getState().catch(() => null)
      if (playbackHasStarted(target, state)) {
        void runtime.deps.queueFollowing?.(target)?.catch(() => undefined)
        return true
      }
      if (state?.uri === target.uri && state.paused) {
        await runtime.deps.resume().catch(() => undefined)
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
      await runtime.sleep(PLAYBACK_START_POLL_MS)
    }
    return true
  }

  async function startLoadedClip(target: ClipCue, token: number): Promise<void> {
    const parked = await parkIncomingTrack(target, token)
    if (runtime.generation !== token) {
      return
    }
    if (!parked) {
      failBufferedStart()
    }
    await runtime.deps.resume()
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
        if (handedOff || runtime.generation !== token) {
          return
        }
      }
      await startLoadedClip(target, token)
      return
    }
    try {
      await runtime.deps.setVolume(runtime.audibleVolume)
      if (runtime.generation !== token) {
        return
      }
      if (kind === 'unmute') {
        return
      }
      if (kind === 'seek-resume') {
        await runtime.deps.seek(target.positionMs)
        if (runtime.generation !== token) {
          return
        }
      }
      await runtime.deps.resume()
    } catch (cause) {
      if (runtime.generation !== token) {
        throw cause
      }
      await startLoadedClip(target, token)
    }
  }

  async function runRestore(positionMs: number, token: number): Promise<void> {
    if (runtime.generation !== token) {
      return
    }
    void runtime.deps.activate().catch(() => undefined)
    await runtime.claimPlayback(null)
    await runtime.deps.setVolume(runtime.audibleVolume)
    if (runtime.generation !== token) {
      return
    }
    const state = await runtime.deps.getState().catch(() => null)
    if (!state || Math.abs(state.positionMs - positionMs) > CUE_POSITION_TOLERANCE_MS) {
      await runtime.deps.seek(positionMs)
    }
    if (runtime.generation !== token) {
      return
    }
    await runtime.deps.resume()
  }
  return { runPrime, runPlay, runRestore }
}
