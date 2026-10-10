import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PHASE_TIMINGS,
  MAX_PHASE_SECONDS,
  MIN_THINK_SECONDS,
  POST_REVEAL_PLAY_MS,
  clearSessionPhaseTimings,
  parsePhaseSeconds,
  phaseTimingDraftFromTimings,
  phaseTimingsFromDraft,
  readSessionPhaseTimings,
  samePhaseTimings,
  timingsAtTrackStart,
  writeSessionPhaseTimings,
  type KeyValueStore,
  type PhaseTimings,
} from './phaseTimings.ts'

const STORAGE_KEY = 'musikerraten_phase_timings'

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  }
}

describe('phaseTimings', () => {
  it('hat die bekannten Standardwerte', () => {
    expect(DEFAULT_PHASE_TIMINGS).toEqual({ playMs: 11_000, thinkMs: 3_000, revealMs: 8_000 })
    expect(POST_REVEAL_PLAY_MS).toBe(8_000)
  })

  it('vergleicht Timings feldweise', () => {
    expect(samePhaseTimings(DEFAULT_PHASE_TIMINGS, { ...DEFAULT_PHASE_TIMINGS })).toBe(true)
    expect(samePhaseTimings(DEFAULT_PHASE_TIMINGS, { ...DEFAULT_PHASE_TIMINGS, thinkMs: 0 })).toBe(false)
  })

  it('übernimmt neue Einstellungen erst ab der nächsten Spielphase', () => {
    const round: PhaseTimings = { playMs: 5_000, thinkMs: 1_000, revealMs: 2_000 }
    const saved: PhaseTimings = { playMs: 9_000, thinkMs: 2_000, revealMs: 3_000 }
    expect(timingsAtTrackStart('playing', round, saved)).toBe(saved)
    expect(timingsAtTrackStart('thinking', round, saved)).toBe(round)
    expect(timingsAtTrackStart('reveal', round, saved)).toBe(round)
    expect(timingsAtTrackStart('idle', round, saved)).toBe(round)
  })

  it('parst Sekunden nur als ganze Zahlen im erlaubten Bereich', () => {
    expect(parsePhaseSeconds('5')).toBe(5)
    expect(parsePhaseSeconds(' 12 ')).toBe(12)
    expect(parsePhaseSeconds(String(MAX_PHASE_SECONDS))).toBe(30)
    expect(parsePhaseSeconds('31')).toBeNull()
    expect(parsePhaseSeconds('0')).toBeNull()
    expect(parsePhaseSeconds('0', MIN_THINK_SECONDS)).toBe(0)
    expect(parsePhaseSeconds('1.5')).toBeNull()
    expect(parsePhaseSeconds('-1')).toBeNull()
    expect(parsePhaseSeconds('abc')).toBeNull()
    expect(parsePhaseSeconds('')).toBeNull()
  })

  it('wandelt zwischen Timings und Formularentwurf um', () => {
    expect(phaseTimingDraftFromTimings(DEFAULT_PHASE_TIMINGS)).toEqual({ play: '11', think: '3', reveal: '8' })
    expect(phaseTimingsFromDraft({ play: '4', think: '0', reveal: '6' })).toEqual({
      playMs: 4_000,
      thinkMs: 0,
      revealMs: 6_000,
    })
    expect(phaseTimingsFromDraft({ play: '0', think: '0', reveal: '6' })).toBeNull()
    expect(phaseTimingsFromDraft({ play: '4', think: 'x', reveal: '6' })).toBeNull()
    expect(phaseTimingsFromDraft({ play: '4', think: '1', reveal: '31' })).toBeNull()
  })

  it('liest ohne Speicher oder ohne Eintrag die Standardwerte', () => {
    expect(readSessionPhaseTimings(null)).toBe(DEFAULT_PHASE_TIMINGS)
    expect(readSessionPhaseTimings(memoryStore())).toBe(DEFAULT_PHASE_TIMINGS)
  })

  it('schreibt und liest gültige Timings', () => {
    const store = memoryStore()
    const timings: PhaseTimings = { playMs: 7_000, thinkMs: 0, revealMs: 5_000 }
    expect(writeSessionPhaseTimings(timings, store)).toBe(timings)
    expect(JSON.parse(store.data.get(STORAGE_KEY) ?? 'null')).toEqual(timings)
    expect(readSessionPhaseTimings(store)).toEqual(timings)
  })

  it('speichert ungültige Timings nicht, sondern die Standardwerte', () => {
    const store = memoryStore()
    const result = writeSessionPhaseTimings({ playMs: 500, thinkMs: 0, revealMs: 5_000 }, store)
    expect(result).toBe(DEFAULT_PHASE_TIMINGS)
    expect(readSessionPhaseTimings(store)).toEqual(DEFAULT_PHASE_TIMINGS)
  })

  it('fällt bei kaputten gespeicherten Werten auf die Standardwerte zurück', () => {
    expect(readSessionPhaseTimings(memoryStore({ [STORAGE_KEY]: 'kein json' }))).toBe(DEFAULT_PHASE_TIMINGS)
    expect(readSessionPhaseTimings(memoryStore({ [STORAGE_KEY]: '{"playMs":1500,"thinkMs":0,"revealMs":2000}' }))).toBe(
      DEFAULT_PHASE_TIMINGS,
    )
    expect(readSessionPhaseTimings(memoryStore({ [STORAGE_KEY]: '[]' }))).toBe(DEFAULT_PHASE_TIMINGS)
    expect(readSessionPhaseTimings(memoryStore({ [STORAGE_KEY]: 'null' }))).toBe(DEFAULT_PHASE_TIMINGS)
  })

  it('löscht den gespeicherten Eintrag', () => {
    const store = memoryStore()
    writeSessionPhaseTimings({ playMs: 7_000, thinkMs: 1_000, revealMs: 5_000 }, store)
    clearSessionPhaseTimings(store)
    expect(store.data.has(STORAGE_KEY)).toBe(false)
    expect(() => clearSessionPhaseTimings(null)).not.toThrow()
  })
})
