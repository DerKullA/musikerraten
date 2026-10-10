import { describe, expect, it } from 'vitest'
import { CATEGORIES, DARES, RULE_IDEAS, TRUTHS, contentPool } from './content.ts'

const WHEEL_SIZE = 8

describe('Inhalte', () => {
  it('haben ohne Spicy genug Einträge für ein volles Rad', () => {
    expect(contentPool(TRUTHS, false).length).toBeGreaterThanOrEqual(WHEEL_SIZE)
    expect(contentPool(DARES, false).length).toBeGreaterThanOrEqual(WHEEL_SIZE)
    expect(contentPool(CATEGORIES, false).length).toBeGreaterThanOrEqual(WHEEL_SIZE)
  })

  it('Spicy fügt Einträge hinzu, ohne Spicy fehlen sie', () => {
    expect(contentPool(TRUTHS, true).length).toBeGreaterThan(contentPool(TRUTHS, false).length)
    expect(contentPool(DARES, true).length).toBeGreaterThan(contentPool(DARES, false).length)
    expect(contentPool(CATEGORIES, true).length).toBeGreaterThan(contentPool(CATEGORIES, false).length)
    expect(contentPool(TRUTHS, false).some((card) => card.spicy)).toBe(false)
  })

  it('haben eindeutige, kurze Titel und nichtleere Texte', () => {
    for (const cards of [TRUTHS, DARES]) {
      const titles = cards.map((card) => card.title)
      expect(new Set(titles).size).toBe(titles.length)
      for (const card of cards) {
        expect(card.title.length).toBeGreaterThan(0)
        expect(card.title.length).toBeLessThanOrEqual(22)
        expect(card.text.trim().length).toBeGreaterThan(10)
      }
    }
  })

  it('haben eindeutige Kategorien und Regel-Ideen', () => {
    const names = CATEGORIES.map((category) => category.name)
    expect(new Set(names).size).toBe(names.length)
    expect(new Set(RULE_IDEAS).size).toBe(RULE_IDEAS.length)
  })
})
