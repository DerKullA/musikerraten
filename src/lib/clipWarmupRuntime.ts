import type { ClipCue, ClipWarmupDeps, PrimeAbort, WarmRequest } from './clipWarmupPolicy.ts'

export interface WarmRuntime {
  readonly generation: number
  readonly request: WarmRequest
  readonly deps: ClipWarmupDeps
  sleep: (delayMs: number) => Promise<void>
  audibleVolume: number
  displacedPositionMs: number | null
  claimPlayback: (target: ClipCue | null) => Promise<boolean>
  abortOf: (token: number) => PrimeAbort
}
