import type { KeyValueStore } from '@/ui/phaseTimings.ts'
import { clampDecks } from './duration.ts'
import { addPlayer } from './players.ts'

const STORAGE_KEY = 'musikerraten_tangera'

export interface TangeraSettings {
  players: string[]
  spicy: boolean
  decks: number
}

export function readTangeraSettings(store: KeyValueStore | null = browserStore()): TangeraSettings {
  const fallback: TangeraSettings = { players: [], spicy: false, decks: 1 }
  const raw = store?.getItem(STORAGE_KEY)
  if (!raw) {
    return fallback
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      return fallback
    }
    const record = parsed as Record<string, unknown>
    const names = Array.isArray(record.players) ? record.players.filter(isString) : []
    return {
      players: collectPlayers(names),
      spicy: record.spicy === true,
      decks: typeof record.decks === 'number' ? clampDecks(record.decks) : 1,
    }
  } catch {
    return fallback
  }
}

export function writeTangeraSettings(
  settings: TangeraSettings,
  store: KeyValueStore | null = browserStore(),
): void {
  try {
    store?.setItem(
      STORAGE_KEY,
      JSON.stringify({
        players: collectPlayers(settings.players),
        spicy: settings.spicy,
        decks: clampDecks(settings.decks),
      }),
    )
  } catch {
    // Speicher voll oder gesperrt: die Einstellungen gelten dann nur für diese Sitzung.
  }
}

function collectPlayers(names: readonly string[]): string[] {
  let players: string[] = []
  for (const name of names) {
    const result = addPlayer(players, name)
    if (result.error === null) {
      players = result.players
    }
  }
  return players
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function browserStore(): KeyValueStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    // Zugriff gesperrt (z. B. privates Fenster).
    return null
  }
}
