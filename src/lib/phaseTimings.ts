import type { GamePhase } from '../types.ts'

const STORAGE_KEY = 'musikerraten_phase_timings'

export const MIN_PHASE_SECONDS = 1
export const MIN_THINK_SECONDS = 0
export const MAX_PHASE_SECONDS = 30

export const DEFAULT_PHASE_TIMINGS: PhaseTimings = {
  playMs: 11_000,
  thinkMs: 3_000,
  revealMs: 6_000,
}

export interface PhaseTimings {
  playMs: number
  thinkMs: number
  revealMs: number
}

export interface PhaseTimingDraft {
  play: string
  think: string
  reveal: string
}

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function samePhaseTimings(left: PhaseTimings, right: PhaseTimings): boolean {
  return left.playMs === right.playMs && left.thinkMs === right.thinkMs && left.revealMs === right.revealMs
}

export function timingsAtTrackStart(
  phase: GamePhase,
  roundTimings: PhaseTimings,
  savedTimings: PhaseTimings,
): PhaseTimings {
  if (phase === 'playing') {
    return savedTimings
  }
  return roundTimings
}

export function parsePhaseSeconds(raw: string, minSeconds = MIN_PHASE_SECONDS): number | null {
  const trimmed = raw.trim()
  if (!/^\d+$/.test(trimmed)) {
    return null
  }
  const seconds = Number(trimmed)
  if (!isAllowedPhaseSeconds(seconds, minSeconds)) {
    return null
  }
  return seconds
}

export function phaseTimingDraftFromTimings(timings: PhaseTimings): PhaseTimingDraft {
  return {
    play: String(timings.playMs / 1000),
    think: String(timings.thinkMs / 1000),
    reveal: String(timings.revealMs / 1000),
  }
}

export function phaseTimingsFromDraft(draft: PhaseTimingDraft): PhaseTimings | null {
  const play = parsePhaseSeconds(draft.play)
  const think = parsePhaseSeconds(draft.think, MIN_THINK_SECONDS)
  const reveal = parsePhaseSeconds(draft.reveal)
  if (play === null || think === null || reveal === null) {
    return null
  }
  return {
    playMs: play * 1000,
    thinkMs: think * 1000,
    revealMs: reveal * 1000,
  }
}

export function readSessionPhaseTimings(store: KeyValueStore | null = browserSessionStore()): PhaseTimings {
  if (!store) {
    return DEFAULT_PHASE_TIMINGS
  }
  const raw = store.getItem(STORAGE_KEY)
  if (!raw) {
    return DEFAULT_PHASE_TIMINGS
  }
  return parseStoredPhaseTimings(raw) ?? DEFAULT_PHASE_TIMINGS
}

export function writeSessionPhaseTimings(
  timings: PhaseTimings,
  store: KeyValueStore | null = browserSessionStore(),
): PhaseTimings {
  const stored = isPhaseTimings(timings) ? timings : DEFAULT_PHASE_TIMINGS
  store?.setItem(STORAGE_KEY, JSON.stringify(stored))
  return stored
}

export function clearSessionPhaseTimings(store: KeyValueStore | null = browserSessionStore()): void {
  store?.removeItem(STORAGE_KEY)
}

function isAllowedPhaseSeconds(seconds: number, minSeconds: number): boolean {
  return Number.isInteger(seconds) && seconds >= minSeconds && seconds <= MAX_PHASE_SECONDS
}

function isValidPhaseMs(value: unknown, minSeconds: number): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value % 1000 === 0 &&
    value >= minSeconds * 1000 &&
    value <= MAX_PHASE_SECONDS * 1000
  )
}

function isPhaseTimings(value: unknown): value is PhaseTimings {
  if (!value || typeof value !== 'object') {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    isValidPhaseMs(record.playMs, MIN_PHASE_SECONDS) &&
    isValidPhaseMs(record.thinkMs, MIN_THINK_SECONDS) &&
    isValidPhaseMs(record.revealMs, MIN_PHASE_SECONDS)
  )
}

function parseStoredPhaseTimings(raw: string): PhaseTimings | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    return isPhaseTimings(parsed) ? parsed : null
  } catch {
    return null
  }
}

function browserSessionStore(): KeyValueStore | null {
  if (typeof sessionStorage === 'undefined') {
    return null
  }
  return sessionStorage
}
