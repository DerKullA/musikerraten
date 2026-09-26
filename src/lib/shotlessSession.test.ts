import { describe, expect, it } from 'vitest'
import type { KeyValueStore } from './phaseTimings.ts'
import {
  addShotlessPlayer,
  canStartShotless,
  clearShotlessSession,
  readShotlessSession,
  removeShotlessPlayer,
  writeShotlessSession,
} from './shotlessSession.ts'

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

describe('Shotless-Session', () => {
  it('merkt sich Modus und Namen nur für die Sitzung', () => {
    const store = memoryStore()
    expect(readShotlessSession(store)).toBeNull()
    writeShotlessSession({ mode: 'party', players: ['Ada', 'Bea'], guessTarget: 'either' }, store)
    expect(readShotlessSession(store)).toEqual({
      mode: 'party',
      players: ['Ada', 'Bea'],
      guessTarget: 'either',
    })
    clearShotlessSession(store)
    expect(readShotlessSession(store)).toBeNull()
  })

  it('lehnt leere, doppelte und zu viele Namen ab', () => {
    const first = addShotlessPlayer([], '  Ada  ')
    const duplicate = addShotlessPlayer(first.players, 'ada')
    const reserved = addShotlessPlayer(first.players, 'Niemand')
    let players = first.players
    for (let index = 0; index < 11; index += 1) {
      players = addShotlessPlayer(players, `Person ${index}`).players
    }
    const overflow = addShotlessPlayer(players, 'Zu viel')

    expect(first).toEqual({ players: ['Ada'], error: null })
    expect(duplicate.error).toBe('Name ist schon dabei.')
    expect(reserved.error).toBe('Niemand ist kein Mitspielername.')
    expect(overflow.error).toBe('Höchstens 12 Mitspieler.')
    expect(removeShotlessPlayer(['Ada', 'Bea'], 'ada')).toEqual(['Bea'])
  })

  it('verlangt im Party-Modus mindestens zwei Namen', () => {
    expect(canStartShotless(null, [])).toBe(false)
    expect(canStartShotless('tippen', [])).toBe(true)
    expect(canStartShotless('party', ['Ada'])).toBe(false)
    expect(canStartShotless('party', ['Ada', 'Bea'])).toBe(true)
  })

  it('verwirft kaputte Sitzungsdaten', () => {
    const store = memoryStore()
    store.setItem('musikerraten_shotless', '{')
    expect(readShotlessSession(store)).toBeNull()
    store.setItem('musikerraten_shotless', JSON.stringify({ mode: 'karaoke', players: [] }))
    expect(readShotlessSession(store)).toBeNull()
    store.setItem('musikerraten_shotless', JSON.stringify({ mode: 'tippen', players: ['Ada'], guessTarget: 'wasser' }))
    expect(readShotlessSession(store)).toEqual({ mode: 'tippen', players: ['Ada'], guessTarget: 'title' })
  })
})
