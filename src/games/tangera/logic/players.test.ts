import { describe, expect, it } from 'vitest'
import { MAX_PLAYERS, addPlayer, canStart, othersAfter, removePlayer, roundFrom } from './players.ts'

describe('Spielernamen', () => {
  it('fügt bereinigte Namen hinzu', () => {
    expect(addPlayer([], '  Anna   Lena ')).toEqual({ players: ['Anna Lena'], error: null })
  })

  it('lehnt leere, zu lange und doppelte Namen ab', () => {
    expect(addPlayer([], '   ').error).toBe('Name fehlt.')
    expect(addPlayer([], 'x'.repeat(25)).error).toContain('24')
    expect(addPlayer(['Anna'], 'anna').error).toBe('Name ist schon dabei.')
  })

  it('begrenzt auf 12 Spieler', () => {
    let players: string[] = []
    for (let index = 0; index < MAX_PLAYERS; index += 1) {
      players = addPlayer(players, `Spieler ${index}`).players
    }
    expect(players).toHaveLength(MAX_PLAYERS)
    expect(addPlayer(players, 'Zu viel').error).toContain('12')
  })

  it('entfernt Namen', () => {
    expect(removePlayer(['Anna', 'Ben'], 'ben')).toEqual(['Anna'])
  })

  it('braucht 2 bis 12 Spieler zum Start', () => {
    expect(canStart(['Anna'])).toBe(false)
    expect(canStart(['Anna', 'Ben'])).toBe(true)
  })

  it('liefert die Sitzreihenfolge ab einem Spieler', () => {
    const players = ['Anna', 'Ben', 'Cem', 'Dora']
    expect(othersAfter(players, 2)).toEqual(['Dora', 'Anna', 'Ben'])
    expect(roundFrom(players, 3)).toEqual(['Dora', 'Anna', 'Ben', 'Cem'])
  })
})
