import { describe, expect, it } from 'vitest'
import { DEFAULT_GAME_ID, GAMES, findGame, findPlayableGame, isPlayableGame, type GameModule } from './registry.ts'

describe('Spiele-Registry', () => {
  it('führt Song erraten, Shotless und den Platzhalter in Menüreihenfolge', () => {
    expect(GAMES.map((game) => game.id)).toEqual(['guess-song', 'shotless', 'placeholder-2'])
    expect(GAMES.map((game) => game.label)).toEqual(['Song erraten', 'Shotless', 'Bald verfügbar'])
    expect(GAMES.map((game) => game.kicker)).toEqual(['Spiel', 'Trinkspiel', 'Platzhalter'])
  })

  it('hat eindeutige Ids und ein spielbares Standardspiel', () => {
    expect(new Set(GAMES.map((game) => game.id)).size).toBe(GAMES.length)
    expect(isPlayableGame(DEFAULT_GAME_ID)).toBe(true)
  })

  it('verfügbar heißt: hat einen Screen-Einstieg; der Platzhalter hat keinen', () => {
    for (const game of GAMES) {
      expect(game.available).toBe(game.entry.kind !== 'none')
    }
    expect(findGame('placeholder-2')?.available).toBe(false)
  })

  it('findet Spiele per Id und liefert für Unbekanntes null', () => {
    expect(findGame('shotless')?.label).toBe('Shotless')
    expect(findGame('gibt-es-nicht')).toBeNull()
  })

  it('macht nur verfügbare Spiele spielbar', () => {
    expect(isPlayableGame('guess-song')).toBe(true)
    expect(isPlayableGame('shotless')).toBe(true)
    expect(isPlayableGame('placeholder-2')).toBe(false)
    expect(isPlayableGame('gibt-es-nicht')).toBe(false)
    expect(findPlayableGame('placeholder-2')).toBeNull()
  })

  it('akzeptiert eine eigene Spieleliste', () => {
    const only: GameModule[] = [{ ...GAMES[0]!, id: 'x' }, { ...GAMES[2]!, id: 'y' }]
    expect(isPlayableGame('x', only)).toBe(true)
    expect(isPlayableGame('y', only)).toBe(false)
    expect(isPlayableGame('shotless', only)).toBe(false)
  })

  it('bildet die früheren Screens und Vollbild-/Wiedergabemodi ab', () => {
    const song = findGame('guess-song')
    const shotless = findGame('shotless')
    expect(song).toMatchObject({ debugScreen: 'game', fullBleed: 'always', clipPlayback: false })
    expect(shotless).toMatchObject({ debugScreen: 'shotless', fullBleed: 'live', clipPlayback: true })
    expect(shotless?.menuVariant).toBe('is-shotless')
    expect(song?.menuVariant).toBeUndefined()
  })
})
