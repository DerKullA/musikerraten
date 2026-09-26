import type { KeyValueStore } from './phaseTimings.ts'
import type { ShotlessGuessTarget, ShotlessMode } from './shotlessRules.ts'

const STORAGE_KEY = 'musikerraten_shotless'

export const MIN_SHOTLESS_PLAYERS = 2
export const MAX_SHOTLESS_PLAYERS = 12
export const MAX_PLAYER_NAME_LENGTH = 24

export interface ShotlessSessionSettings {
  mode: ShotlessMode
  players: string[]
  guessTarget: ShotlessGuessTarget
}

export interface PlayerAddResult {
  players: string[]
  error: string | null
}

export function readShotlessSession(
  store: KeyValueStore | null = browserSessionStore(),
): ShotlessSessionSettings | null {
  if (!store) {
    return null
  }
  const raw = store.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }
  return parseShotlessSession(raw)
}

export function writeShotlessSession(
  settings: ShotlessSessionSettings,
  store: KeyValueStore | null = browserSessionStore(),
): void {
  const mode = settings.mode
  const players = collectPlayers(settings.players)
  const guessTarget = readGuessTarget(settings.guessTarget)
  store?.setItem(STORAGE_KEY, JSON.stringify({ mode, players, guessTarget }))
}

export function clearShotlessSession(store: KeyValueStore | null = browserSessionStore()): void {
  store?.removeItem(STORAGE_KEY)
}

export function addShotlessPlayer(players: readonly string[], rawName: string): PlayerAddResult {
  const name = cleanPlayerName(rawName)
  if (!name) {
    return { players: [...players], error: 'Name fehlt.' }
  }
  if (name.length > MAX_PLAYER_NAME_LENGTH) {
    return { players: [...players], error: 'Höchstens 24 Zeichen.' }
  }
  if (isReservedPlayerName(name)) {
    return { players: [...players], error: 'Niemand ist kein Mitspielername.' }
  }
  if (players.some((entry) => samePlayerName(entry, name))) {
    return { players: [...players], error: 'Name ist schon dabei.' }
  }
  if (players.length >= MAX_SHOTLESS_PLAYERS) {
    return { players: [...players], error: 'Höchstens 12 Mitspieler.' }
  }
  return { players: [...players, name], error: null }
}

export function removeShotlessPlayer(players: readonly string[], name: string): string[] {
  return players.filter((entry) => !samePlayerName(entry, name))
}

export function canStartShotless(mode: ShotlessMode | null, players: readonly string[]): boolean {
  if (mode === 'tippen') {
    return true
  }
  if (mode === 'party') {
    return players.length >= MIN_SHOTLESS_PLAYERS && players.length <= MAX_SHOTLESS_PLAYERS
  }
  return false
}

function collectPlayers(value: readonly string[]): string[] {
  let players: string[] = []
  for (const entry of value) {
    const result = addShotlessPlayer(players, entry)
    if (result.error === null) {
      players = result.players
    }
  }
  return players
}

function parseShotlessSession(raw: string): ShotlessSessionSettings | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      return null
    }
    const record = parsed as Record<string, unknown>
    if (!isShotlessMode(record.mode)) {
      return null
    }
    const players = Array.isArray(record.players) ? collectPlayers(record.players.filter(isString)) : []
    return { mode: record.mode, players, guessTarget: readGuessTarget(record.guessTarget) }
  } catch {
    return null
  }
}

function isShotlessMode(value: unknown): value is ShotlessMode {
  return value === 'tippen' || value === 'party'
}

function readGuessTarget(value: unknown): ShotlessGuessTarget {
  if (value === 'title' || value === 'artist' || value === 'either' || value === 'both') {
    return value
  }
  return 'title'
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function cleanPlayerName(rawName: string): string {
  return rawName.trim().replace(/\s+/g, ' ')
}

function samePlayerName(left: string, right: string): boolean {
  return left.localeCompare(right, 'de', { sensitivity: 'accent' }) === 0
}

function isReservedPlayerName(name: string): boolean {
  return samePlayerName(name, 'Niemand')
}

function browserSessionStore(): KeyValueStore | null {
  if (typeof sessionStorage === 'undefined') {
    return null
  }
  return sessionStorage
}
