export const GUESS_SONG_ID = 'guess-song'

export interface MainMenuGame {
  id: string
  kicker: string
  label: string
  available: boolean
}

export function listMainMenuGames(): readonly MainMenuGame[] {
  return [
    {
      id: GUESS_SONG_ID,
      kicker: 'Spiel',
      label: 'Song erraten',
      available: true,
    },
    {
      id: 'placeholder-1',
      kicker: 'Platzhalter',
      label: 'Bald verfügbar',
      available: false,
    },
    {
      id: 'placeholder-2',
      kicker: 'Platzhalter',
      label: 'Bald verfügbar',
      available: false,
    },
  ]
}

export function isPlayableMenuGame(id: string): boolean {
  return listMainMenuGames().some((game) => game.id === id && game.available)
}
