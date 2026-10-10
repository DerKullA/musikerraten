import type { Rank } from './cards.ts'
import { CARDS_PER_DECK, RANKS } from './cards.ts'

export const MIN_DECKS = 1
export const MAX_DECKS = 4

/** Erfahrungswerte in Minuten je Karte: feste Dauer und Dauer je Mitspieler. */
const RANK_MINUTES: Record<Rank, { base: number; perPlayer: number }> = {
  '6': { base: 2.5, perPlayer: 0 },
  '7': { base: 1, perPlayer: 0.25 },
  '8': { base: 0.5, perPlayer: 0 },
  '9': { base: 1.5, perPlayer: 0 },
  '10': { base: 1, perPlayer: 0 },
  B: { base: 1, perPlayer: 0 },
  D: { base: 1, perPlayer: 0 },
  K: { base: 1.5, perPlayer: 0.3 },
  A: { base: 1.5, perPlayer: 0 },
}

/** Zeit für das Weitergeben des Geräts und das Aufdecken je Karte. */
const TURN_MINUTES = 0.3

export function clampDecks(value: number): number {
  if (!Number.isFinite(value)) {
    return MIN_DECKS
  }
  return Math.min(MAX_DECKS, Math.max(MIN_DECKS, Math.round(value)))
}

export function cardCount(decks: number): number {
  return clampDecks(decks) * CARDS_PER_DECK
}

/** Geschätzte Spieldauer in Minuten, gerundet auf 5 Minuten (mindestens 5). */
export function estimateMinutes(decks: number, players: number): number {
  const count = Math.max(2, players)
  const perDeck = RANKS.reduce((sum, rank) => {
    const { base, perPlayer } = RANK_MINUTES[rank]
    return sum + 4 * (base + perPlayer * count + TURN_MINUTES)
  }, 0)
  const total = perDeck * clampDecks(decks)
  return Math.max(5, Math.round(total / 5) * 5)
}

/** „ca. 45 Min.“, „ca. 1 Std.“ oder „ca. 1 Std. 5 Min.“ */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) {
    return `ca. ${rest} Min.`
  }
  return rest === 0 ? `ca. ${hours} Std.` : `ca. ${hours} Std. ${rest} Min.`
}
