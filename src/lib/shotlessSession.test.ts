import { describe, expect, it } from 'vitest'
import {
  MAX_SHOTLESS_PLAYERS,
  addShotlessPlayer,
  canStartShotless,
  clearShotlessSession,
  readShotlessSession,
  removeShotlessPlayer,
  writeShotlessSession,
} from './shotlessSession.ts'
import type { KeyValueStore } from '@/ui/phaseTimings.ts'

const STORAGE_KEY = 'musikerraten_shotless'

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  }
}

describe('shotlessSession: Mitspieler', () => {
  it('fügt Namen getrimmt und mit zusammengezogenen Leerzeichen hinzu', () => {
    expect(addShotlessPlayer([], '  Anna   Maria ')).toEqual({ players: ['Anna Maria'], error: null })
  })

  it('lehnt leere, zu lange, reservierte und doppelte Namen ab', () => {
    expect(addShotlessPlayer(['Anna'], '   ')).toEqual({ players: ['Anna'], error: 'Name fehlt.' })
    expect(addShotlessPlayer([], 'x'.repeat(25))).toEqual({ players: [], error: 'Höchstens 24 Zeichen.' })
    expect(addShotlessPlayer([], 'niemand').error).toBe('Niemand ist kein Mitspielername.')
    expect(addShotlessPlayer(['Anna'], 'anna').error).toBe('Name ist schon dabei.')
    expect(addShotlessPlayer(['Anna'], 'ANNA').error).toBe('Name ist schon dabei.')
  })

  it('unterscheidet Namen mit Akzent von Namen ohne', () => {
    expect(addShotlessPlayer(['Jose'], 'José').error).toBeNull()
  })

  it('begrenzt die Mitspielerzahl', () => {
    const players = Array.from({ length: MAX_SHOTLESS_PLAYERS }, (_, index) => `Spieler${index}`)
    expect(addShotlessPlayer(players, 'Noch einer')).toEqual({ players, error: 'Höchstens 12 Mitspieler.' })
  })

  it('entfernt Namen ohne Beachtung der Groß-/Kleinschreibung', () => {
    expect(removeShotlessPlayer(['Anna', 'Ben'], 'anna')).toEqual(['Ben'])
    expect(removeShotlessPlayer(['Anna'], 'Zoe')).toEqual(['Anna'])
  })

  it('prüft die Startbedingungen je Modus', () => {
    expect(canStartShotless('tippen', [])).toBe(true)
    expect(canStartShotless('party', ['A'])).toBe(false)
    expect(canStartShotless('party', ['A', 'B'])).toBe(true)
    expect(canStartShotless('party', Array.from({ length: 13 }, (_, index) => `S${index}`))).toBe(false)
    expect(canStartShotless(null, ['A', 'B'])).toBe(false)
  })
})

describe('shotlessSession: Speicher', () => {
  it('liefert ohne Speicher oder Eintrag null', () => {
    expect(readShotlessSession(null)).toBeNull()
    expect(readShotlessSession(memoryStore())).toBeNull()
  })

  it('schreibt bereinigte Einstellungen und liest sie zurück', () => {
    const store = memoryStore()
    writeShotlessSession({ mode: 'party', players: ['Anna', 'anna', ' Ben ', 'Niemand', ''], guessTarget: 'both' }, store)
    expect(JSON.parse(store.data.get(STORAGE_KEY) ?? 'null')).toEqual({
      mode: 'party',
      players: ['Anna', 'Ben'],
      guessTarget: 'both',
    })
    expect(readShotlessSession(store)).toEqual({ mode: 'party', players: ['Anna', 'Ben'], guessTarget: 'both' })
  })

  it('fällt bei unbekanntem Rateziel auf "title" zurück', () => {
    const store = memoryStore({ [STORAGE_KEY]: JSON.stringify({ mode: 'tippen', players: [], guessTarget: 'foo' }) })
    expect(readShotlessSession(store)).toEqual({ mode: 'tippen', players: [], guessTarget: 'title' })
  })

  it('verwirft kaputte oder unvollständige Einträge', () => {
    expect(readShotlessSession(memoryStore({ [STORAGE_KEY]: 'kein json' }))).toBeNull()
    expect(readShotlessSession(memoryStore({ [STORAGE_KEY]: '[]' }))).toBeNull()
    expect(readShotlessSession(memoryStore({ [STORAGE_KEY]: '{"mode":"quatsch"}' }))).toBeNull()
    expect(readShotlessSession(memoryStore({ [STORAGE_KEY]: '{"mode":"tippen","players":"x"}' }))).toEqual({
      mode: 'tippen',
      players: [],
      guessTarget: 'title',
    })
  })

  it('löscht den Eintrag', () => {
    const store = memoryStore()
    writeShotlessSession({ mode: 'tippen', players: [], guessTarget: 'title' }, store)
    clearShotlessSession(store)
    expect(store.data.has(STORAGE_KEY)).toBe(false)
    expect(() => clearShotlessSession(null)).not.toThrow()
  })
})
