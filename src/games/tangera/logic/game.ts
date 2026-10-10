import { createShoe, type Card } from './cards.ts'
import type { ContentKind } from './content.ts'
import { MAX_RULE_LENGTH } from './rules.ts'

export type TangeraPhase = 'turn' | 'bitch' | 'event' | 'finished'

export interface TangeraState {
  players: string[]
  deck: Card[]
  drawn: Card[]
  /** Index des Spielers, der gerade dran ist. */
  turn: number
  phase: TangeraPhase
  /** Aufgedeckte Karte während des Ereignisses. */
  card: Card | null
  quizmaster: string | null
  bitch: string | null
  rules: string[]
  /** Rad-Einträge, die in diesem Spiel schon gedreht wurden, je Inhaltsart. */
  used: Record<ContentKind, string[]>
  /** Felder des zuletzt gedrehten Rads, je Inhaltsart. */
  wheels: Record<ContentKind, string[]>
  sips: Record<string, number>
  shots: Record<string, number>
}

/** Folgen eines Ereignisses; der Reducer wendet sie an. */
export interface Effects {
  sips?: Record<string, number>
  shots?: Record<string, number>
  addRule?: string
  removeRule?: number
  /** Gedrehtes Rad: Der gezogene Eintrag `picked` kommt in diesem Spiel nicht noch einmal aufs Rad, die übrigen Felder bleiben. */
  spin?: { kind: ContentKind; wheel: readonly string[]; picked: string }
}

export type TangeraAction =
  | { type: 'draw' }
  /** Effekte anwenden und das Ereignis (oder den Bitch-Aufruf) beenden. */
  | { type: 'resolve'; effects?: Effects }
  /** Effekte anwenden, ohne den Ablauf weiterzuschalten (z. B. Strafschluck). */
  | { type: 'apply'; effects: Effects }

export interface GameOptions {
  /** Anzahl der Kartenblätter (je 36 Karten). */
  decks?: number
  rng?: () => number
}

export function createGame(players: readonly string[], options: GameOptions = {}): TangeraState {
  return {
    players: [...players],
    deck: createShoe(options.decks ?? 1, options.rng),
    drawn: [],
    turn: 0,
    phase: 'turn',
    card: null,
    quizmaster: null,
    bitch: null,
    rules: [],
    used: { truth: [], dare: [], category: [] },
    wheels: { truth: [], dare: [], category: [] },
    sips: zeroCounts(players),
    shots: zeroCounts(players),
  }
}

export function currentPlayer(state: TangeraState): string {
  return state.players[state.turn] as string
}

export function tangeraReducer(state: TangeraState, action: TangeraAction): TangeraState {
  switch (action.type) {
    case 'draw':
      return draw(state)
    case 'apply':
      return applyEffects(state, action.effects)
    case 'resolve':
      return advance(applyEffects(state, action.effects ?? {}))
  }
}

function draw(state: TangeraState): TangeraState {
  const [card, ...rest] = state.deck
  if (state.phase !== 'turn' || !card) {
    return state
  }
  const player = currentPlayer(state)
  return {
    ...state,
    deck: rest,
    drawn: [...state.drawn, card],
    card,
    phase: 'event',
    quizmaster: card.rank === '8' ? player : state.quizmaster,
    bitch: card.rank === 'D' ? player : state.bitch,
  }
}

function advance(state: TangeraState): TangeraState {
  if (state.phase === 'bitch') {
    return { ...state, phase: 'turn' }
  }
  if (state.phase !== 'event') {
    return state
  }
  if (state.deck.length === 0) {
    return { ...state, phase: 'finished', card: null }
  }
  const turn = (state.turn + 1) % state.players.length
  const next = state.players[turn]
  return { ...state, turn, card: null, phase: next !== undefined && next === state.bitch ? 'bitch' : 'turn' }
}

export function applyEffects(state: TangeraState, effects: Effects): TangeraState {
  let rules = state.rules
  if (effects.removeRule !== undefined) {
    rules = rules.filter((_, index) => index !== effects.removeRule)
  }
  const added = effects.addRule?.trim().replace(/\s+/g, ' ').slice(0, MAX_RULE_LENGTH)
  if (added && !rules.includes(added)) {
    rules = [...rules, added]
  }
  const spin = effects.spin
  const used =
    spin && !state.used[spin.kind].includes(spin.picked)
      ? { ...state.used, [spin.kind]: [...state.used[spin.kind], spin.picked] }
      : state.used
  const wheels = spin ? { ...state.wheels, [spin.kind]: [...spin.wheel] } : state.wheels
  return {
    ...state,
    rules,
    used,
    wheels,
    sips: addCounts(state.sips, effects.sips),
    shots: addCounts(state.shots, effects.shots),
  }
}

export interface RankingEntry {
  player: string
  sips: number
  shots: number
}

/** Meiste Schlücke zuerst, bei Gleichstand mehr Shots, dann Sitzreihenfolge. */
export function ranking(state: TangeraState): RankingEntry[] {
  return state.players
    .map((player) => ({ player, sips: state.sips[player] ?? 0, shots: state.shots[player] ?? 0 }))
    .sort((left, right) => right.sips - left.sips || right.shots - left.shots)
}

/** Alle Karten des Spiels, gezogene und übrige. */
export function totalCards(state: TangeraState): number {
  return state.deck.length + state.drawn.length
}

export function cardsLeft(state: TangeraState): number {
  return state.deck.length
}

function zeroCounts(players: readonly string[]): Record<string, number> {
  return Object.fromEntries(players.map((player) => [player, 0]))
}

function addCounts(
  current: Record<string, number>,
  extra: Record<string, number> | undefined,
): Record<string, number> {
  if (!extra) {
    return current
  }
  const next = { ...current }
  for (const [player, amount] of Object.entries(extra)) {
    if (player in next && amount > 0) {
      next[player] = (next[player] ?? 0) + amount
    }
  }
  return next
}
