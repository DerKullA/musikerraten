import { describe, expect, it } from 'vitest'
import { MAX_DECKS, cardCount, clampDecks, estimateMinutes, formatDuration } from './duration.ts'

describe('Deckzahl', () => {
  it('bleibt zwischen 1 und 4', () => {
    expect(clampDecks(0)).toBe(1)
    expect(clampDecks(2)).toBe(2)
    expect(clampDecks(99)).toBe(MAX_DECKS)
    expect(clampDecks(Number.NaN)).toBe(1)
    expect(clampDecks(2.6)).toBe(3)
  })

  it('zählt 36 Karten je Deck', () => {
    expect(cardCount(1)).toBe(36)
    expect(cardCount(3)).toBe(108)
  })
})

describe('Spielzeit', () => {
  it('liegt für ein Deck mit vier Spielern bei etwa einer Stunde, auf 5 Minuten gerundet', () => {
    const minutes = estimateMinutes(1, 4)
    expect(minutes).toBeGreaterThanOrEqual(45)
    expect(minutes).toBeLessThanOrEqual(80)
    expect(minutes % 5).toBe(0)
  })

  it('wächst mit Decks und Spielern', () => {
    expect(estimateMinutes(2, 4)).toBeGreaterThan(estimateMinutes(1, 4))
    expect(estimateMinutes(2, 4)).toBeCloseTo(estimateMinutes(1, 4) * 2, -1)
    expect(estimateMinutes(1, 8)).toBeGreaterThan(estimateMinutes(1, 3))
  })

  it('rechnet mit mindestens zwei Spielern', () => {
    expect(estimateMinutes(1, 0)).toBe(estimateMinutes(1, 2))
  })

  it('formatiert Minuten und Stunden', () => {
    expect(formatDuration(45)).toBe('ca. 45 Min.')
    expect(formatDuration(60)).toBe('ca. 1 Std.')
    expect(formatDuration(65)).toBe('ca. 1 Std. 5 Min.')
    expect(formatDuration(120)).toBe('ca. 2 Std.')
  })
})
