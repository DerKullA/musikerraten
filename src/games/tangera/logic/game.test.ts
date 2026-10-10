import { describe, expect, it } from 'vitest'
import { createDeck, type Card } from './cards.ts'
import {
  applyEffects,
  cardsLeft,
  createGame,
  currentPlayer,
  ranking,
  tangeraReducer,
  totalCards,
  type TangeraState,
} from './game.ts'

const PLAYERS = ['Anna', 'Ben', 'Cem']

/** Spiel mit festem Stapel, die erste Karte der Liste wird zuerst gezogen. */
function gameWith(cards: Card[], players: string[] = PLAYERS): TangeraState {
  return { ...createGame(players), deck: cards }
}

const card = (rank: Card['rank'], suit: Card['suit'] = 'herz'): Card => ({ rank, suit })

function drawAndResolve(state: TangeraState): TangeraState {
  return tangeraReducer(tangeraReducer(state, { type: 'draw' }), { type: 'resolve' })
}

describe('Spielstart', () => {
  it('mischt 36 Karten, beginnt beim ersten Spieler und zählt bei null', () => {
    const state = createGame(PLAYERS)
    expect(cardsLeft(state)).toBe(36)
    expect(state.phase).toBe('turn')
    expect(currentPlayer(state)).toBe('Anna')
    expect(state.sips).toEqual({ Anna: 0, Ben: 0, Cem: 0 })
    expect(state.shots).toEqual({ Anna: 0, Ben: 0, Cem: 0 })
    expect(state.deck.length + state.drawn.length).toBe(createDeck().length)
  })
})

describe('Mehrere Decks', () => {
  it('mischt je Deck 36 Karten dazu, jede Karte kommt entsprechend oft vor', () => {
    const state = createGame(PLAYERS, { decks: 3 })
    expect(totalCards(state)).toBe(108)
    expect(state.deck.filter((entry) => entry.rank === 'A' && entry.suit === 'herz')).toHaveLength(3)
  })

  it('nimmt bei ungültiger Zahl mindestens ein Deck', () => {
    expect(totalCards(createGame(PLAYERS, { decks: 0 }))).toBe(36)
  })
})

describe('Ziehen', () => {
  it('deckt die oberste Karte auf und wechselt ins Ereignis', () => {
    const state = tangeraReducer(gameWith([card('6'), card('7')]), { type: 'draw' })
    expect(state.card).toEqual(card('6'))
    expect(state.phase).toBe('event')
    expect(state.drawn).toEqual([card('6')])
    expect(cardsLeft(state)).toBe(1)
  })

  it('zieht nur im eigenen Zug', () => {
    const drawn = tangeraReducer(gameWith([card('6'), card('7')]), { type: 'draw' })
    expect(tangeraReducer(drawn, { type: 'draw' })).toBe(drawn)
  })

  it('macht den Zieher der 8 zum Quizmaster und löst den alten ab', () => {
    let state = gameWith([card('8'), card('6'), card('8', 'karo')])
    state = drawAndResolve(state)
    expect(state.quizmaster).toBe('Anna')
    state = drawAndResolve(state)
    expect(state.quizmaster).toBe('Anna')
    state = drawAndResolve(state)
    expect(state.quizmaster).toBe('Cem')
  })

  it('macht den Zieher der Dame zur Bitch und löst die alte ab', () => {
    let state = gameWith([card('D'), card('D', 'karo'), card('6'), card('6', 'pik')])
    state = drawAndResolve(state)
    expect(state.bitch).toBe('Anna')
    state = drawAndResolve(state)
    expect(state.bitch).toBe('Ben')
  })
})

describe('Ablauf', () => {
  it('geht nach dem Ereignis zum nächsten Spieler und rundherum', () => {
    let state = gameWith([card('6'), card('9'), card('A'), card('K'), card('B')])
    const order: string[] = []
    for (let step = 0; step < 4; step += 1) {
      order.push(currentPlayer(state))
      state = drawAndResolve(state)
    }
    expect(order).toEqual(['Anna', 'Ben', 'Cem', 'Anna'])
  })

  it('lässt die Bitch vor ihrem nächsten Zug erst die Rufe abwarten', () => {
    let state = gameWith([card('D'), card('6'), card('9'), card('A'), card('K')])
    state = drawAndResolve(state)
    expect(state.phase).toBe('turn')
    state = drawAndResolve(state)
    state = drawAndResolve(state)
    expect(currentPlayer(state)).toBe('Anna')
    expect(state.phase).toBe('bitch')
    expect(tangeraReducer(state, { type: 'draw' })).toBe(state)
    state = tangeraReducer(state, { type: 'resolve', effects: { sips: { Anna: 7 } } })
    expect(state.phase).toBe('turn')
    expect(state.turn).toBe(0)
    expect(state.sips.Anna).toBe(7)
  })

  it('ruft die Bitch bei jedem ihrer Züge, solange sie Bitch ist', () => {
    let state = gameWith([card('D'), card('6'), card('9'), card('A'), card('K'), card('B'), card('7')])
    state = drawAndResolve(state)
    state = drawAndResolve(state)
    state = drawAndResolve(state)
    expect(state.phase).toBe('bitch')
    state = tangeraReducer(state, { type: 'resolve' })
    state = drawAndResolve(state)
    state = drawAndResolve(state)
    state = drawAndResolve(state)
    expect(currentPlayer(state)).toBe('Anna')
    expect(state.phase).toBe('bitch')
  })

  it('endet nach der letzten Karte mit der Auswertung', () => {
    let state = gameWith([card('6'), card('7')])
    state = drawAndResolve(state)
    expect(state.phase).toBe('turn')
    state = drawAndResolve(state)
    expect(state.phase).toBe('finished')
    expect(state.card).toBeNull()
    expect(tangeraReducer(state, { type: 'draw' })).toBe(state)
  })

  it('spielt einen ganzen Stapel bis zum Ende durch', () => {
    let state = createGame(PLAYERS)
    let steps = 0
    while (state.phase !== 'finished' && steps < 100) {
      state = state.phase === 'bitch' ? tangeraReducer(state, { type: 'resolve' }) : drawAndResolve(state)
      steps += 1
    }
    expect(state.phase).toBe('finished')
    expect(state.drawn).toHaveLength(36)
  })
})

describe('Effekte', () => {
  it('zählt Schlücke und Shots mit und ignoriert Unbekannte und Nichtpositives', () => {
    const state = applyEffects(createGame(PLAYERS), {
      sips: { Anna: 3, Ben: 2, Niemand: 5, Cem: -4 },
      shots: { Cem: 1 },
    })
    expect(state.sips).toEqual({ Anna: 3, Ben: 2, Cem: 0 })
    expect(state.shots).toEqual({ Anna: 0, Ben: 0, Cem: 1 })
  })

  it('fügt Regeln hinzu, bereinigt sie und ignoriert Leeres und Doppeltes', () => {
    let state = createGame(PLAYERS)
    state = applyEffects(state, { addRule: '  Nicht   fluchen ' })
    state = applyEffects(state, { addRule: 'Nicht fluchen' })
    state = applyEffects(state, { addRule: '   ' })
    expect(state.rules).toEqual(['Nicht fluchen'])
  })

  it('hebt Regeln per Index auf', () => {
    let state = createGame(PLAYERS)
    state = applyEffects(state, { addRule: 'A' })
    state = applyEffects(state, { addRule: 'B' })
    state = applyEffects(state, { removeRule: 0 })
    expect(state.rules).toEqual(['B'])
  })

  it('wendet apply an, ohne den Ablauf zu verändern', () => {
    const drawn = tangeraReducer(gameWith([card('6'), card('7')]), { type: 'draw' })
    const next = tangeraReducer(drawn, { type: 'apply', effects: { sips: { Ben: 1 } } })
    expect(next.phase).toBe('event')
    expect(next.turn).toBe(drawn.turn)
    expect(next.sips.Ben).toBe(1)
  })
})

describe('Auswertung', () => {
  it('sortiert nach Schlücken, dann nach Shots', () => {
    let state = createGame(PLAYERS)
    state = applyEffects(state, { sips: { Anna: 3, Ben: 5, Cem: 5 }, shots: { Cem: 1 } })
    expect(ranking(state).map((entry) => entry.player)).toEqual(['Cem', 'Ben', 'Anna'])
  })
})
