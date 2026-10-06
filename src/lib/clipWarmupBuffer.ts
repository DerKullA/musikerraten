import { clientError } from './clientLog.ts'
import {
  BUFFER_RETRY_LIMIT,
  BUFFER_STABLE_POLLS,
  BUFFER_WAIT_LIMIT,
  CUE_POSITION_TOLERANCE_MS,
  FOREIGN_RELEASE_POLLS,
  PARK_SLOP_MS,
  PLAYBACK_START_LIMIT,
  PLAYBACK_START_POLL_MS,
  TRACK_SWITCH_WAIT_LIMIT,
  createColdBufferWatch,
  firstPlayIsReady,
  isBufferReset,
  noteColdBufferSample,
  parkedNearCue,
  playbackIsHeld,
  type ClipCue,
  type WarmPlaybackState,
} from './clipWarmupPolicy.ts'
import type { WarmRuntime } from './clipWarmupRuntime.ts'
import { traceGame } from './gameDebug.ts'

export function createWarmBuffer(runtime: WarmRuntime) {
  async function waitUntilFirstPlayReady(target: ClipCue, token: number): Promise<void> {
    let previous: WarmPlaybackState | null = null
    for (let attempt = 0; attempt < PLAYBACK_START_LIMIT; attempt += 1) {
      if (runtime.generation !== token) {
        return
      }
      const state = await runtime.deps.getState().catch(() => null)
      if (firstPlayIsReady(target, previous, state)) {
        return
      }
      previous = state
      await runtime.sleep(PLAYBACK_START_POLL_MS)
    }
  }

  async function pauseUntilHeld(token: number): Promise<void> {
    let previous: WarmPlaybackState | null = null
    for (let attempt = 0; attempt < PLAYBACK_START_LIMIT; attempt += 1) {
      if (runtime.generation !== token) {
        return
      }
      let state = await runtime.deps.getState().catch(() => null)
      if (!state?.paused) {
        await runtime.deps.pause()
        if (runtime.generation !== token) {
          return
        }
        state = await runtime.deps.getState().catch(() => null)
      }
      if (playbackIsHeld(previous, state)) {
        return
      }
      previous = state
      await runtime.sleep(PLAYBACK_START_POLL_MS)
    }
  }

  async function releaseForeignTrack(target: ClipCue, token: number): Promise<void> {
    if (runtime.generation !== token) {
      return
    }
    const state = await runtime.deps.getState().catch(() => null)
    if (!state?.uri || state.uri === target.uri || state.paused) {
      return
    }
    await runtime.deps.pause()
    for (let attempt = 0; attempt < FOREIGN_RELEASE_POLLS; attempt += 1) {
      if (runtime.generation !== token) {
        return
      }
      const next = await runtime.deps.getState().catch(() => null)
      if (!next?.uri || next.uri === target.uri || next.paused) {
        return
      }
      await runtime.sleep(PLAYBACK_START_POLL_MS)
    }
  }

  function failBufferedStart(target: ClipCue, step: string): never {
    const action = runtime.request === 'prime' ? 'prime' : 'play'
    throw clientError('Der Song hat nicht gestartet.', {
      source: 'playback',
      uri: target.uri,
      action,
      phase: runtime.deps.readPhase?.() ?? null,
      step,
    })
  }

  // `quick` gibt früh auf und wirft ohne Meldung, damit der Aufrufer neu lädt.
  async function waitUntilCueBuffered(target: ClipCue, token: number, quick = false): Promise<void> {
    const switchLimit = quick ? BUFFER_RETRY_LIMIT : TRACK_SWITCH_WAIT_LIMIT
    const idleLimit = quick ? BUFFER_RETRY_LIMIT : BUFFER_WAIT_LIMIT
    let last: WarmPlaybackState | null = null
    let grund = 'gesamt'
    let watch = createColdBufferWatch()
    let uncertainPolls = 0
    let loadingPolls = 0
    let idlePolls = 0
    let totalPolls = 0
    while (runtime.generation === token) {
      totalPolls += 1
      if (totalPolls > switchLimit + idleLimit) {
        break
      }
      const state = await runtime.deps.getState().catch(() => null)
      last = state
      if (!state || state.uri !== target.uri) {
        watch = createColdBufferWatch()
        idlePolls = 0
        loadingPolls = 0
        uncertainPolls += 1
        if (uncertainPolls >= switchLimit) {
          grund = state ? 'anderer-song' : 'kein-zustand'
          break
        }
        await runtime.sleep(PLAYBACK_START_POLL_MS)
        continue
      }
      uncertainPolls = 0
      if (state.paused && !state.loading) {
        const atCue = state.positionMs + CUE_POSITION_TOLERANCE_MS >= target.positionMs
        const settled = watch.sawReset || watch.stablePolls >= BUFFER_STABLE_POLLS
        if (atCue && settled) {
          return
        }
        await runtime.deps.resume()
        if (runtime.generation !== token) {
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
        if (loadingPolls >= switchLimit) {
          grund = 'laedt'
          break
        }
      } else {
        loadingPolls = 0
        idlePolls += 1
        if (idlePolls >= idleLimit) {
          grund = state.paused ? 'pausiert' : 'nicht-am-einsatz'
          break
        }
      }
      await runtime.sleep(PLAYBACK_START_POLL_MS)
    }
    if (runtime.generation !== token) {
      return
    }
    traceGame('warmup', {
      aktion: 'puffer-fehler',
      grund,
      erneut: quick,
      ziel: target.positionMs,
      position: last?.positionMs ?? null,
      pausiert: last?.paused ?? null,
      laedt: last?.loading ?? null,
      fremd: last ? last.uri !== target.uri : null,
      aktuell: last?.uri ?? null,
      soll: target.uri,
    })
    if (quick) {
      throw new Error('Puffer steht noch nicht.')
    }
    failBufferedStart(target, 'buffer')
  }

  async function catchCue(target: ClipCue, token: number): Promise<boolean> {
    for (let pass = 0; pass < 2; pass += 1) {
      if (runtime.generation !== token) {
        return false
      }
      await runtime.deps.seek(target.positionMs)
      if (runtime.generation !== token) {
        return false
      }
      await runtime.deps.resume()
      let previous: WarmPlaybackState | null = null
      for (let attempt = 0; attempt < PLAYBACK_START_LIMIT; attempt += 1) {
        if (runtime.generation !== token) {
          return false
        }
        const state = await runtime.deps.getState().catch(() => null)
        const moved =
          state?.uri === target.uri &&
          !state.paused &&
          !state.loading &&
          state.positionMs + CUE_POSITION_TOLERANCE_MS >= target.positionMs &&
          state.positionMs <= target.positionMs + PARK_SLOP_MS &&
          (!previous || !isBufferReset(previous.positionMs, state.positionMs))
        if (moved && state) {
          await pauseUntilHeld(token)
          const parked = await runtime.deps.getState().catch(() => null)
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
        await runtime.sleep(PLAYBACK_START_POLL_MS)
      }
    }
    return false
  }
  return {
    pauseUntilHeld,
    waitUntilFirstPlayReady,
    releaseForeignTrack,
    failBufferedStart,
    waitUntilCueBuffered,
    catchCue,
  }
}
