import { describe, expect, it } from 'vitest'
import {
  correctDrinkMessage,
  createShotlessRound,
  everyoneShotMessage,
  reduceShotlessRound,
  wrongDrinkMessage,
  wrongWinnerMessage,
} from '@/lib/shotlessReducer.ts'
import { EVERYONE_SHOT_MESSAGE, type ShotlessCommand, type ShotlessRound } from '@/lib/shotlessRules.ts'

function guess(text: string, overrides: Partial<Extract<ShotlessCommand, { type: 'submit-guess' }>> = {}): ShotlessCommand {
  return {
    type: 'submit-guess',
    guess: text,
    artistGuess: '',
    title: 'Hello',
    artist: 'Adele',
    target: 'title',
    ...overrides,
  }
}

function round(overrides: Partial<ShotlessRound> = {}): ShotlessRound {
  return { ...createShotlessRound(), ...overrides }
}

describe('shotlessReducer: Start und Texte', () => {
  it('startet in Stufe 0 mit Ursprung "mitte"', () => {
    expect(createShotlessRound()).toEqual({
      trackIndex: 0,
      stageIndex: 0,
      view: 'guessing',
      feedback: null,
      revealMessage: null,
      winner: null,
      replayNonce: 0,
      origin: 'mitte',
    })
    expect(createShotlessRound('drop').origin).toBe('drop')
  })

  it('formuliert die Trinksprüche', () => {
    expect(correctDrinkMessage('Anna', '5 Schlücke')).toBe('Alle außer Anna trinken: 5 Schlücke')
    expect(wrongDrinkMessage('Shot')).toBe('Falsch — du trinkst: Shot')
    expect(wrongWinnerMessage('Anna', '1 Schluck')).toBe('Anna lag falsch — Anna trinkt: 1 Schluck')
    expect(everyoneShotMessage()).toBe(EVERYONE_SHOT_MESSAGE)
    expect(everyoneShotMessage()).toBe('Alle trinken einen Shot')
  })
})

describe('shotlessReducer: Ratephase', () => {
  it('skip geht zur nächsten Stufe und erhöht den Wiederholungszähler', () => {
    const next = reduceShotlessRound(round({ feedback: 'Falsch' }), { type: 'skip' })
    expect(next).toMatchObject({ stageIndex: 1, feedback: null, replayNonce: 1, view: 'guessing' })
  })

  it('skip auf der letzten Stufe löst für alle auf (Shot)', () => {
    const next = reduceShotlessRound(round({ stageIndex: 3 }), { type: 'skip' })
    expect(next).toMatchObject({
      view: 'reveal',
      revealMessage: 'Alle trinken einen Shot',
      winner: null,
      stageIndex: 3,
    })
  })

  it('replay wiederholt die Stufe ohne Stufenwechsel', () => {
    const next = reduceShotlessRound(round({ stageIndex: 1 }), { type: 'replay' })
    expect(next).toMatchObject({ stageIndex: 1, replayNonce: 1 })
  })

  it('nobody löst sofort auf', () => {
    const next = reduceShotlessRound(round({ stageIndex: 1 }), { type: 'nobody' })
    expect(next).toMatchObject({ view: 'reveal', winner: null, revealMessage: 'Alle trinken einen Shot' })
  })

  it('richtiger Tipp gewinnt "dir" mit der Strafe der aktuellen Stufe', () => {
    const next = reduceShotlessRound(round({ stageIndex: 2 }), guess('hello'))
    expect(next).toMatchObject({
      view: 'reveal',
      winner: 'dir',
      revealMessage: 'Alle außer dir trinken: 3 Schlücke',
      feedback: null,
    })
  })

  it('falscher Tipp setzt nur Feedback mit der Strafe der Stufe', () => {
    const next = reduceShotlessRound(round(), guess('nope'))
    expect(next).toMatchObject({ view: 'guessing', stageIndex: 0, feedback: 'Falsch — du trinkst: Shot' })
  })

  it('leerer Tipp ändert nichts', () => {
    const start = round()
    expect(reduceShotlessRound(start, guess('  '))).toBe(start)
  })

  it('claim wechselt zur Spielerwahl und löscht Feedback', () => {
    const next = reduceShotlessRound(round({ feedback: 'x' }), { type: 'claim' })
    expect(next).toMatchObject({ view: 'pick-player', feedback: null })
  })
})

describe('shotlessReducer: Spielerwahl und Auflösung', () => {
  it('assign trimmt den Namen und löst auf', () => {
    const next = reduceShotlessRound(round({ view: 'pick-player', stageIndex: 1 }), { type: 'assign', name: '  Ben ' })
    expect(next).toMatchObject({ view: 'reveal', winner: 'Ben', revealMessage: 'Alle außer Ben trinken: 5 Schlücke' })
  })

  it('assign ignoriert leere Namen und falsche Ansichten', () => {
    const picking = round({ view: 'pick-player' })
    expect(reduceShotlessRound(picking, { type: 'assign', name: '   ' })).toBe(picking)
    const guessing = round()
    expect(reduceShotlessRound(guessing, { type: 'assign', name: 'Ben' })).toBe(guessing)
  })

  it('wrong-winner nimmt den Sieg zurück und nennt die Strafe', () => {
    const revealed = round({ view: 'reveal', winner: 'Ben', stageIndex: 3, revealMessage: 'x' })
    const next = reduceShotlessRound(revealed, { type: 'wrong-winner' })
    expect(next).toMatchObject({ winner: null, revealMessage: 'Ben lag falsch — Ben trinkt: 1 Schluck', view: 'reveal' })
  })

  it('wrong-winner ohne Sieger oder außerhalb der Auflösung ändert nichts', () => {
    const noWinner = round({ view: 'reveal', winner: null })
    expect(reduceShotlessRound(noWinner, { type: 'wrong-winner' })).toBe(noWinner)
    const guessing = round({ winner: 'Ben' })
    expect(reduceShotlessRound(guessing, { type: 'wrong-winner' })).toBe(guessing)
  })

  it('in der Auflösung wirken nur next und wrong-winner', () => {
    const revealed = round({ view: 'reveal', winner: 'Ben' })
    for (const command of [{ type: 'skip' }, { type: 'replay' }, { type: 'nobody' }, { type: 'claim' }, guess('hello')] as const) {
      expect(reduceShotlessRound(revealed, command)).toBe(revealed)
    }
  })

  it('next geht erst aus der Auflösung zum nächsten Titel und läuft zyklisch um', () => {
    const revealed = round({ view: 'reveal', trackIndex: 2, stageIndex: 3, winner: 'Ben', replayNonce: 4 })
    const next = reduceShotlessRound(revealed, { type: 'next', trackCount: 3, origin: 'drop' })
    expect(next).toEqual({
      trackIndex: 0,
      stageIndex: 0,
      view: 'guessing',
      feedback: null,
      revealMessage: null,
      winner: null,
      replayNonce: 5,
      origin: 'drop',
    })
    const guessing = round()
    expect(reduceShotlessRound(guessing, { type: 'next', trackCount: 3, origin: 'drop' })).toBe(guessing)
  })

  it('next rechnet mit mindestens einem Titel', () => {
    const revealed = round({ view: 'reveal', trackIndex: 5 })
    expect(reduceShotlessRound(revealed, { type: 'next', trackCount: 0, origin: 'anfang' }).trackIndex).toBe(0)
    expect(reduceShotlessRound(revealed, { type: 'next', trackCount: 2.9, origin: 'anfang' }).trackIndex).toBe(0)
  })

  it('Kommandos in unpassender Ansicht lassen die Runde unverändert', () => {
    const picking = round({ view: 'pick-player' })
    for (const command of [{ type: 'skip' }, { type: 'replay' }, { type: 'claim' }, guess('hello')] as const) {
      expect(reduceShotlessRound(picking, command)).toBe(picking)
    }
  })
})
