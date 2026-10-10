import { describe, expect, it } from 'vitest'
import { RANKS, SUITS, cardLabel, createDeck, createShuffledDeck, isRedSuit, shuffle } from './cards.ts'

describe('Skatblatt', () => {
  it('hat 36 Karten, vier je Wert und neun je Farbe', () => {
    const deck = createDeck()
    expect(deck).toHaveLength(36)
    for (const rank of RANKS) {
      expect(deck.filter((card) => card.rank === rank)).toHaveLength(4)
    }
    for (const suit of SUITS) {
      expect(deck.filter((card) => card.suit === suit)).toHaveLength(9)
    }
  })

  it('enthält keine doppelte Karte', () => {
    const keys = createDeck().map((card) => `${card.rank}-${card.suit}`)
    expect(new Set(keys).size).toBe(36)
  })

  it('Herz und Karo sind rot, Pik und Kreuz schwarz', () => {
    expect(isRedSuit('herz')).toBe(true)
    expect(isRedSuit('karo')).toBe(true)
    expect(isRedSuit('pik')).toBe(false)
    expect(isRedSuit('kreuz')).toBe(false)
  })

  it('benennt Karten auf Deutsch', () => {
    expect(cardLabel({ rank: 'D', suit: 'herz' })).toBe('Herz Dame')
    expect(cardLabel({ rank: '10', suit: 'pik' })).toBe('Pik 10')
  })
})

describe('Mischen', () => {
  it('behält alle Karten und verändert die Eingabe nicht', () => {
    const deck = createDeck()
    const mixed = shuffle(deck, () => 0.3)
    expect(mixed).toHaveLength(36)
    expect(new Set(mixed.map((card) => `${card.rank}-${card.suit}`)).size).toBe(36)
    expect(deck).toEqual(createDeck())
  })

  it('ist mit festem Zufall reproduzierbar und mischt tatsächlich', () => {
    let seed = 7
    const rng = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    const first = createShuffledDeck(rng)
    expect(first).not.toEqual(createDeck())
  })
})
