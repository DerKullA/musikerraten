import { describe, expect, it } from 'vitest'
import { GUESS_SONG_ID, isPlayableMenuGame, listMainMenuGames } from './mainMenuGames.ts'

describe('listMainMenuGames', () => {
  it('öffnet mit Song erraten und zwei gesperrten Platzhaltern', () => {
    const games = listMainMenuGames()
    expect(games.map((game) => game.label)).toEqual([
      'Song erraten',
      'Bald verfügbar',
      'Bald verfügbar',
    ])
    expect(games.filter((game) => game.available).map((game) => game.id)).toEqual([GUESS_SONG_ID])
    expect(games.filter((game) => !game.available)).toHaveLength(2)
  })
})

describe('isPlayableMenuGame', () => {
  it('lässt nur Song erraten zu', () => {
    expect(isPlayableMenuGame(GUESS_SONG_ID)).toBe(true)
    expect(isPlayableMenuGame('placeholder-1')).toBe(false)
    expect(isPlayableMenuGame('placeholder-2')).toBe(false)
  })
})
