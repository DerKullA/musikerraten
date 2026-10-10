import { describe, expect, it } from 'vitest'
import type { KeyValueStore } from '@/ui/phaseTimings.ts'
import { readTangeraSettings, writeTangeraSettings } from './session.ts'

function memoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  }
}

describe('Tangera-Einstellungen', () => {
  it('liefert ohne Speicher oder Inhalt Standardwerte', () => {
    expect(readTangeraSettings(null)).toEqual({ players: [], spicy: false })
    expect(readTangeraSettings(memoryStore())).toEqual({ players: [], spicy: false })
  })

  it('speichert und liest Namen und Spicy', () => {
    const store = memoryStore()
    writeTangeraSettings({ players: ['Anna', 'Ben'], spicy: true }, store)
    expect(readTangeraSettings(store)).toEqual({ players: ['Anna', 'Ben'], spicy: true })
  })

  it('verwirft doppelte Namen und kaputte Daten', () => {
    const store = memoryStore()
    writeTangeraSettings({ players: ['Anna', 'anna', '  '], spicy: false }, store)
    expect(readTangeraSettings(store).players).toEqual(['Anna'])
    expect(readTangeraSettings(memoryStore({ musikerraten_tangera: '{kaputt' }))).toEqual({
      players: [],
      spicy: false,
    })
  })
})
