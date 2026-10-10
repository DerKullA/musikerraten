import { primeSeekMs, choosePrimeAction, chooseWarmStart, CUE_POSITION_TOLERANCE_MS, PARK_SETTLE_MS, positionedAtCue, cueIsNear, parkedNearCue, type ClipCue, type WarmStart } from './policy.ts'
import { createWarmBuffer } from './buffer.ts'
import type { WarmRuntime } from './runtime.ts'
import { traceGame } from '@/platform/diagnostics/gameDebug.ts'

type ParkAttempt = 'parked' | 'loose' | 'stalled'

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

  // Der Wechsel bleibt stumm, bis der Puffer am Einsatz steht. Das gilt auch
  // für den Sprung über die Warteschlange, sonst ruckelt der kalte Start hörbar.
  async function parkIncomingTrack(
    target: ClipCue,
    token: number,
    queued = false,
    quick = false,
  ): Promise<boolean> {
    let suspended = false
    let parked = false
    await runtime.deps.setVolume(0)
    try {
      await runtime.claimPlayback(target)
      await runtime.deps.suspendSilence()
      suspended = true
      if (runtime.generation !== token) {
        return false
      }
      if (queued) {
        if (!(await runtime.deps.handoff?.(target))) {
          return false
        }
      } else {
        await releaseForeignTrack(target, token)
        if (runtime.generation !== token) {
          return false
        }
        await runtime.deps.load(target)
      }
      await runtime.deps.setVolume(0).catch(() => undefined)
      if (runtime.generation !== token) {
        return false
      }
      await waitUntilCueBuffered(target, token, quick)
      if (runtime.generation !== token) {
        return false
      }
      if (queued) {
        void runtime.deps.queueFollowing?.(target)?.catch(() => undefined)
      }
      await pauseUntilHeld(token)
      if (runtime.generation !== token) {
        return false
      }
      let after = await runtime.deps.getState().catch(() => null)
      if (after?.paused && parkedNearCue(target, after) && cueIsNear(target, after)) {
        parked = runtime.generation === token
        return parked
      }
      const caught = await catchCue(target, token)
      if (runtime.generation !== token) {
        return false
      }
      after = await runtime.deps.getState().catch(() => null)
      if (after?.paused && parkedNearCue(target, after)) {
        parked = true
        return true
      }
      if (after && after.uri !== target.uri) {
        return false
      }
      parked = caught
      return caught
    } finally {
      // Beim Vorladen darf nichts hörbar weiterlaufen: erst anhalten, dann laut.
      const priming = runtime.abortOf(token) !== 'yield'
      if (priming && !parked) {
        await runtime.deps.pause().catch(() => undefined)
      }
      if (priming) {
        const state = await runtime.deps.getState().catch(() => null)
        traceGame('warmup', {
          aktion: 'vorgeladen',
          geparkt: parked,
          aktuell: runtime.generation === token,
          ziel: target.positionMs,
          position: state?.positionMs ?? null,
          pausiert: state?.paused ?? null,
        })
      }
      await runtime.deps.setVolume(runtime.audibleVolume).catch(() => undefined)
      if (suspended && runtime.generation === token) {
        const settle = runtime.request === 'prime' ? runtime.deps.restoreSilence() : runtime.deps.suspendSilence()
        await settle.catch(() => undefined)
      }
    }
  }

  async function startLoadedClip(target: ClipCue, token: number, queued = false): Promise<void> {
    let attempt: ParkAttempt = 'loose'
    if (queued && runtime.deps.handoff && target.positionMs === 0) {
      attempt = await tryPark(target, token, true)
      if (runtime.generation !== token) {
        return
      }
    }
    if (attempt === 'stalled' || (attempt === 'loose' && !(await isCurrentTrack(target)))) {
      attempt = await tryPark(target, token, false)
      if (runtime.generation !== token) {
        return
      }
      if (attempt === 'stalled') {
        // Zweiter Ladeversuch mit voller Geduld; erst der meldet den Fehler.
        attempt = (await parkIncomingTrack(target, token)) ? 'parked' : 'loose'
        if (runtime.generation !== token) {
          return
        }
      }
    }
    const parked = attempt === 'parked'
    if (!parked) {
      // Der Song ist geladen, steht aber nicht am Einsatz: stumm hinspringen.
      if (!(await isCurrentTrack(target))) {
        failBufferedStart(target, 'park')
      }
      await runtime.deps.setVolume(0)
      try {
        await runtime.deps.seek(target.positionMs)
      } finally {
        await runtime.deps.setVolume(runtime.audibleVolume).catch(() => undefined)
      }
      if (runtime.generation !== token) {
        return
      }
    } else {
      await runtime.sleep(PARK_SETTLE_MS)
      if (runtime.generation !== token) {
        return
      }
    }
    await traceStart(target, parked)
    await runtime.deps.resume()
  }

  async function traceStart(target: ClipCue, parked: boolean): Promise<void> {
    const state = await runtime.deps.getState().catch(() => null)
    traceGame('warmup', {
      aktion: 'start',
      geparkt: parked,
      ziel: target.positionMs,
      position: state?.positionMs ?? null,
      pausiert: state?.paused ?? null,
      laedt: state?.loading ?? null,
    })
  }

  async function tryPark(target: ClipCue, token: number, queued: boolean): Promise<ParkAttempt> {
    try {
      return (await parkIncomingTrack(target, token, queued, true)) ? 'parked' : 'loose'
    } catch {
      return 'stalled'
    }
  }

  async function isCurrentTrack(target: ClipCue): Promise<boolean> {
    const state = await runtime.deps.getState().catch(() => null)
    return state?.uri === target.uri
  }

  async function startWarm(
    target: ClipCue,
    token: number,
    kind: WarmStart,
    fromTransfer = false,
  ): Promise<void> {
    if (kind === 'load') {
      await startLoadedClip(target, token, !fromTransfer)
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
