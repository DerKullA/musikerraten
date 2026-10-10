export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 12
export const MAX_PLAYER_NAME_LENGTH = 24

export interface PlayerAddResult {
  players: string[]
  error: string | null
}

export function addPlayer(players: readonly string[], rawName: string): PlayerAddResult {
  const name = rawName.trim().replace(/\s+/g, ' ')
  if (!name) {
    return { players: [...players], error: 'Name fehlt.' }
  }
  if (name.length > MAX_PLAYER_NAME_LENGTH) {
    return { players: [...players], error: `Höchstens ${MAX_PLAYER_NAME_LENGTH} Zeichen.` }
  }
  if (players.some((entry) => samePlayer(entry, name))) {
    return { players: [...players], error: 'Name ist schon dabei.' }
  }
  if (players.length >= MAX_PLAYERS) {
    return { players: [...players], error: `Höchstens ${MAX_PLAYERS} Mitspieler.` }
  }
  return { players: [...players, name], error: null }
}

export function removePlayer(players: readonly string[], name: string): string[] {
  return players.filter((entry) => !samePlayer(entry, name))
}

export function canStart(players: readonly string[]): boolean {
  return players.length >= MIN_PLAYERS && players.length <= MAX_PLAYERS
}

/** Alle anderen Spieler in Sitzreihenfolge, beginnend nach `index`. */
export function othersAfter(players: readonly string[], index: number): string[] {
  const result: string[] = []
  for (let step = 1; step < players.length; step += 1) {
    result.push(players[(index + step) % players.length] as string)
  }
  return result
}

/** Alle Spieler in Sitzreihenfolge, beginnend bei `index`. */
export function roundFrom(players: readonly string[], index: number): string[] {
  return [players[index] as string, ...othersAfter(players, index)]
}

function samePlayer(left: string, right: string): boolean {
  return left.localeCompare(right, 'de', { sensitivity: 'accent' }) === 0
}
