export type Suit = 'herz' | 'karo' | 'pik' | 'kreuz'
export type Rank = '6' | '7' | '8' | '9' | '10' | 'B' | 'D' | 'K' | 'A'

export interface Card {
  rank: Rank
  suit: Suit
}

export const CARDS_PER_DECK = 36

export const RANKS: readonly Rank[] = ['6', '7', '8', '9', '10', 'B', 'D', 'K', 'A']
export const SUITS: readonly Suit[] = ['herz', 'karo', 'pik', 'kreuz']

export const SUIT_SYMBOL: Record<Suit, string> = {
  herz: '♥',
  karo: '♦',
  pik: '♠',
  kreuz: '♣',
}

export const SUIT_NAME: Record<Suit, string> = {
  herz: 'Herz',
  karo: 'Karo',
  pik: 'Pik',
  kreuz: 'Kreuz',
}

export const RANK_NAME: Record<Rank, string> = {
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  B: 'Bube',
  D: 'Dame',
  K: 'König',
  A: 'Ass',
}

/** Angezeigtes Kürzel auf der Karte (Bube = B, Dame = D). */
export const RANK_SHORT: Record<Rank, string> = {
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  B: 'B',
  D: 'D',
  K: 'K',
  A: 'A',
}

export function isRedSuit(suit: Suit): boolean {
  return suit === 'herz' || suit === 'karo'
}

export function cardLabel(card: Card): string {
  return `${SUIT_NAME[card.suit]} ${RANK_NAME[card.rank]}`
}

/** Skatblatt mit 36 Karten: je Wert vier Karten (eine je Farbe), geordnet. */
export function createDeck(): Card[] {
  const deck: Card[] = []
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push({ rank, suit })
    }
  }
  return deck
}

/** Fisher-Yates, ohne die Eingabe zu verändern. `rng` liefert Werte in [0, 1). */
export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1))
    const held = result[index] as T
    result[index] = result[swap] as T
    result[swap] = held
  }
  return result
}

export function createShuffledDeck(rng: () => number = Math.random): Card[] {
  return shuffle(createDeck(), rng)
}

/** Mehrere Blätter, gemeinsam gemischt. Jede Karte kommt dann `decks`-mal vor. */
export function createShoe(decks: number, rng: () => number = Math.random): Card[] {
  const cards: Card[] = []
  for (let count = 0; count < Math.max(1, decks); count += 1) {
    cards.push(...createDeck())
  }
  return shuffle(cards, rng)
}
