import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PHASE_TIMINGS,
  MIN_THINK_SECONDS,
  clearSessionPhaseTimings,
  parsePhaseSeconds,
  phaseTimingDraftFromTimings,
  phaseTimingsFromDraft,
  readSessionPhaseTimings,
  timingsAtTrackStart,
  writeSessionPhaseTimings,
  type KeyValueStore,
} from './phaseTimings.ts'

describe('phase timing bounds', () => {
  it('accepts whole seconds from 1 to 30', () => {
    expect(parsePhaseSeconds('1')).toBe(1)
    expect(parsePhaseSeconds(' 30 ')).toBe(30)
    expect(parsePhaseSeconds('08')).toBe(8)
  })

  it('rejects empty, fractional, and out-of-range values', () => {
    expect(parsePhaseSeconds('')).toBeNull()
    expect(parsePhaseSeconds('0')).toBeNull()
    expect(parsePhaseSeconds('31')).toBeNull()
    expect(parsePhaseSeconds('1.5')).toBeNull()
    expect(parsePhaseSeconds('1,5')).toBeNull()
    expect(parsePhaseSeconds('abc')).toBeNull()
  })

  it('allows zero seconds only for Denkzeit', () => {
    expect(MIN_THINK_SECONDS).toBe(0)
    expect(parsePhaseSeconds('0', MIN_THINK_SECONDS)).toBe(0)
    expect(parsePhaseSeconds('30', MIN_THINK_SECONDS)).toBe(30)
    expect(parsePhaseSeconds('31', MIN_THINK_SECONDS)).toBeNull()
    expect(
      phaseTimingsFromDraft({
        play: '11',
        think: '0',
        reveal: '6',
      }),
    ).toEqual({ playMs: 11_000, thinkMs: 0, revealMs: 6_000 })
    expect(phaseTimingsFromDraft({ play: '0', think: '0', reveal: '6' })).toBeNull()
    expect(phaseTimingsFromDraft({ play: '11', think: '0', reveal: '0' })).toBeNull()
  })

  it('builds timings only from a complete valid draft', () => {
    expect(
      phaseTimingsFromDraft({
        play: '5',
        think: '2',
        reveal: '9',
      }),
    ).toEqual({ playMs: 5_000, thinkMs: 2_000, revealMs: 9_000 })
    expect(phaseTimingsFromDraft({ play: '5', think: '', reveal: '9' })).toBeNull()
  })

  it('round-trips the shipped defaults into the settings draft', () => {
    expect(phaseTimingDraftFromTimings(DEFAULT_PHASE_TIMINGS)).toEqual({
      play: '11',
      think: '3',
      reveal: '6',
    })
  })
})

describe('timingsAtTrackStart', () => {
  const roundTimings = { playMs: 11_000, thinkMs: 3_000, revealMs: 6_000 }
  const savedTimings = { playMs: 5_000, thinkMs: 2_000, revealMs: 8_000 }

  it('adopts saved timings when the next track starts', () => {
    expect(timingsAtTrackStart('playing', roundTimings, savedTimings)).toBe(savedTimings)
  })

  it('keeps the current round snapshot through think and reveal', () => {
    expect(timingsAtTrackStart('thinking', roundTimings, savedTimings)).toBe(roundTimings)
    expect(timingsAtTrackStart('reveal', roundTimings, savedTimings)).toBe(roundTimings)
    expect(timingsAtTrackStart('idle', roundTimings, savedTimings)).toBe(roundTimings)
  })
})

describe('session phase timings', () => {
  it('returns the shipped defaults when nothing is stored', () => {
    expect(readSessionPhaseTimings(memoryStore())).toEqual(DEFAULT_PHASE_TIMINGS)
    expect(readSessionPhaseTimings(null)).toEqual(DEFAULT_PHASE_TIMINGS)
  })

  it('persists timings for the session and clears them', () => {
    const store = memoryStore()
    const custom = { playMs: 4_000, thinkMs: 2_000, revealMs: 7_000 }
    expect(writeSessionPhaseTimings(custom, store)).toEqual(custom)
    expect(readSessionPhaseTimings(store)).toEqual(custom)
    clearSessionPhaseTimings(store)
    expect(readSessionPhaseTimings(store)).toEqual(DEFAULT_PHASE_TIMINGS)
  })

  it('ignores corrupt or out-of-range session data', () => {
    const store = memoryStore()
    store.setItem('musikerraten_phase_timings', '{')
    expect(readSessionPhaseTimings(store)).toEqual(DEFAULT_PHASE_TIMINGS)
    store.setItem(
      'musikerraten_phase_timings',
      JSON.stringify({ playMs: 99_000, thinkMs: 3_000, revealMs: 6_000 }),
    )
    expect(readSessionPhaseTimings(store)).toEqual(DEFAULT_PHASE_TIMINGS)
  })

  it('does not persist timings outside 1 to 30 seconds', () => {
    const store = memoryStore()
    writeSessionPhaseTimings({ playMs: 500, thinkMs: 3_000, revealMs: 6_000 }, store)
    expect(readSessionPhaseTimings(store)).toEqual(DEFAULT_PHASE_TIMINGS)
  })

  it('persists a Denkzeit of zero and rejects zero for the other phases', () => {
    const store = memoryStore()
    const skippedThink = { playMs: 11_000, thinkMs: 0, revealMs: 6_000 }
    expect(writeSessionPhaseTimings(skippedThink, store)).toEqual(skippedThink)
    expect(readSessionPhaseTimings(store)).toEqual(skippedThink)
    writeSessionPhaseTimings({ playMs: 0, thinkMs: 0, revealMs: 6_000 }, store)
    expect(readSessionPhaseTimings(store)).toEqual(DEFAULT_PHASE_TIMINGS)
    writeSessionPhaseTimings({ playMs: 11_000, thinkMs: 0, revealMs: 0 }, store)
    expect(readSessionPhaseTimings(store)).toEqual(DEFAULT_PHASE_TIMINGS)
  })
})

function memoryStore(): KeyValueStore {
  const items = new Map<string, string>()
  return {
    getItem(key) {
      return items.get(key) ?? null
    },
    setItem(key, value) {
      items.set(key, value)
    },
    removeItem(key) {
      items.delete(key)
    },
  }
}
