import { describe, expect, it } from 'vitest'
import { GUESS_SONG_ID, SHOTLESS_ID, isPlayableMenuGame, listMainMenuGames } from './mainMenuGames.ts'

describe('listMainMenuGames', () => {
  it('öffnet mit Song erraten, Shotless und einem gesperrten Platzhalter', () => {
    const games = listMainMenuGames()
    expect(games.map((game) => game.label)).toEqual(['Song erraten', 'Shotless', 'Bald verfügbar'])
    expect(games.filter((game) => game.available).map((game) => game.id)).toEqual([
      GUESS_SONG_ID,
      SHOTLESS_ID,
    ])
    expect(games.filter((game) => !game.available)).toHaveLength(1)
  })
})

describe('isPlayableMenuGame', () => {
  it('lässt Song erraten und Shotless zu', () => {
    expect(isPlayableMenuGame(GUESS_SONG_ID)).toBe(true)
    expect(isPlayableMenuGame(SHOTLESS_ID)).toBe(true)
    expect(isPlayableMenuGame('placeholder-2')).toBe(false)
  })
})
