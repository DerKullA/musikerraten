import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_PHASE_TIMINGS, type KeyValueStore } from '@/ui/phaseTimings.ts'
import { createSavedPhaseTimingsStore } from '@/ui/savedPhaseTimings.ts'

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
    removeItem: (key) => {
      data.delete(key)
    },
  }
}

const CUSTOM = { playMs: 5_000, thinkMs: 0, revealMs: 4_000 }

describe('createSavedPhaseTimingsStore', () => {
  it('startet mit dem Standard, wenn nichts gespeichert ist', () => {
    expect(createSavedPhaseTimingsStore(memoryStore()).get()).toEqual(DEFAULT_PHASE_TIMINGS)
  })

  it('liest einen vorhandenen Session-Eintrag einmal', () => {
    const storage = memoryStore({ musikerraten_phase_timings: JSON.stringify(CUSTOM) })
    const store = createSavedPhaseTimingsStore(storage)
    expect(store.get()).toEqual(CUSTOM)
    storage.data.clear()
    expect(store.get()).toEqual(CUSTOM)
  })

  it('liefert zwischen Änderungen dieselbe Referenz (für useSyncExternalStore)', () => {
    const store = createSavedPhaseTimingsStore(memoryStore())
    expect(store.get()).toBe(store.get())
  })

  it('speichert gültige Werte und benachrichtigt Abonnenten', () => {
    const storage = memoryStore()
    const store = createSavedPhaseTimingsStore(storage)
    const listener = vi.fn()
    store.subscribe(listener)
    expect(store.save(CUSTOM)).toEqual(CUSTOM)
    expect(store.get()).toEqual(CUSTOM)
    expect(JSON.parse(storage.data.get('musikerraten_phase_timings') ?? 'null')).toEqual(CUSTOM)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('ersetzt ungültige Werte durch den Standard', () => {
    const store = createSavedPhaseTimingsStore(memoryStore())
    expect(store.save({ playMs: 500, thinkMs: 0, revealMs: 4_000 })).toEqual(DEFAULT_PHASE_TIMINGS)
  })

  it('reset löscht den Eintrag und setzt den Standard', () => {
    const storage = memoryStore()
    const store = createSavedPhaseTimingsStore(storage)
    const listener = vi.fn()
    store.save(CUSTOM)
    store.subscribe(listener)
    store.reset()
    expect(store.get()).toEqual(DEFAULT_PHASE_TIMINGS)
    expect(storage.data.has('musikerraten_phase_timings')).toBe(false)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('kann Abonnenten wieder abmelden', () => {
    const store = createSavedPhaseTimingsStore(memoryStore())
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    unsubscribe()
    store.save(CUSTOM)
    expect(listener).not.toHaveBeenCalled()
  })

  it('funktioniert ohne Speicher (nur im Arbeitsspeicher)', () => {
    const store = createSavedPhaseTimingsStore(null)
    expect(store.get()).toEqual(DEFAULT_PHASE_TIMINGS)
    expect(store.save(CUSTOM)).toEqual(CUSTOM)
    expect(store.get()).toEqual(CUSTOM)
  })
})
