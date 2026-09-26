import { describe, expect, it } from 'vitest'
import {
  CLIP_DROP_RATIO,
  CLIP_LEAD_IN_MS,
  CLIP_MIDDLE_RATIO,
  SHOTLESS_STAGES,
  clipStartMs,
  pickClipOrigin,
  correctDrinkMessage,
  createShotlessRound,
  everyoneShotMessage,
  formatClipLength,
  isLastShotlessStage,
  normalizeSongTitle,
  penaltyPrompt,
  reduceShotlessRound,
  skipControlLabel,
  stageByIndex,
  stageStatusLabel,
  suggestSongTitles,
  titlesMatch,
  wrongDrinkMessage,
  type ShotlessRound,
} from './shotlessRules.ts'

const secret = 'Blinding Lights'

function guessingAt(stageIndex: number, extras: Partial<ShotlessRound> = {}): ShotlessRound {
  return {
    ...createShotlessRound(),
    stageIndex,
    ...extras,
  }
}

describe('Shotless-Stufen', () => {
  it('ordnet Clip-Längen den Trinkstrafen zu', () => {
    expect(SHOTLESS_STAGES.map((stage) => [stage.durationMs, stage.penalty])).toEqual([
      [100, 'Shot'],
      [1_000, '5 Schlücke'],
      [3_000, '3 Schlücke'],
      [8_000, '1 Schluck'],
    ])
    expect(stageStatusLabel(stageByIndex(0))).toBe('Stufe 1 von 4 · 0,1 s')
    expect(formatClipLength(100)).toBe('0,1 s')
    expect(formatClipLength(8_000)).toBe('8 s')
    expect(penaltyPrompt('Shot')).toBe('Wenn jetzt erraten wird: Shot')
    expect(skipControlLabel(0)).toBe('Länger hören')
    expect(skipControlLabel(3)).toBe('Aufgeben')
    expect(isLastShotlessStage(2)).toBe(false)
    expect(isLastShotlessStage(3)).toBe(true)
  })
})

describe('clipStartMs', () => {
  it('wechselt pro Runde zwischen Anfang, Mitte und Drop und lässt das längste Clip passen', () => {
    expect(CLIP_LEAD_IN_MS).toBe(2_000)
    expect(CLIP_MIDDLE_RATIO).toBe(0.5)
    expect(CLIP_DROP_RATIO).toBe(0.68)
    expect(pickClipOrigin(() => 0)).toBe('anfang')
    expect(pickClipOrigin(() => 0.34)).toBe('mitte')
    expect(pickClipOrigin(() => 0.67)).toBe('drop')
    expect(pickClipOrigin(() => 0.999)).toBe('drop')

    expect(clipStartMs(0, 'anfang')).toBe(0)
    expect(clipStartMs(5_000, 'mitte')).toBe(0)
    expect(clipStartMs(Number.NaN, 'drop')).toBe(0)

    expect(clipStartMs(180_000, 'anfang')).toBe(2_000)
    expect(clipStartMs(180_000, 'mitte')).toBe(90_000)
    expect(clipStartMs(180_000, 'drop')).toBe(122_400)
    expect(clipStartMs(30_000, 'mitte')).toBe(15_000)
    expect(clipStartMs(30_000, 'drop')).toBe(20_000)
    expect(clipStartMs(20_000, 'anfang')).toBe(2_000)
    expect(clipStartMs(20_000, 'drop')).toBe(10_000)
  })
})

describe('Titelabgleich', () => {
  it('ignoriert Großschreibung, Satzzeichen und Featuring', () => {
    expect(normalizeSongTitle('  Blinding Lights (feat. Someone)! ')).toBe('blinding lights')
    expect(titlesMatch('blinding lights', 'Blinding Lights (feat. Someone)')).toBe(true)
    expect(titlesMatch("Don't Stop", 'Dont Stop!')).toBe(true)
    expect(titlesMatch('Für Elise', 'Fur Elise')).toBe(true)
    expect(titlesMatch('Song - feat. Ada', 'Song')).toBe(true)
    expect(titlesMatch('Song', 'Anderer Song')).toBe(false)
    expect(titlesMatch('   ', secret)).toBe(false)
  })

  it('schlägt Titel aus dem geladenen Pool vor, ohne bei einem Buchstaben zu spoilern', () => {
    const tracks = [
      { title: 'Blinding Lights' },
      { title: 'Blinding Lights (feat. Someone)' },
      { title: 'Yesterday' },
      { title: 'Blue Monday' },
    ]
    expect(suggestSongTitles(tracks, 'b')).toEqual([])
    expect(suggestSongTitles(tracks, 'bli').map((entry) => entry.title)).toEqual(['Blinding Lights'])
    expect(suggestSongTitles(tracks, 'ye')).toEqual([{ title: 'Yesterday' }])
  })
})

describe('Trink-Ansagen', () => {
  it('formuliert richtig, falsch und aufgeben', () => {
    expect(correctDrinkMessage('dir', 'Shot')).toBe('Alle außer dir trinken: Shot')
    expect(correctDrinkMessage('Sam', '3 Schlücke')).toBe('Alle außer Sam trinken: 3 Schlücke')
    expect(wrongDrinkMessage('5 Schlücke')).toBe('Falsch — du trinkst: 5 Schlücke')
    expect(everyoneShotMessage()).toBe('Alle trinken einen Shot')
  })
})

describe('Rundenverlauf', () => {
  it('verlängert den Clip und gibt nach der letzten Stufe einen Shot für alle', () => {
    const first = reduceShotlessRound(createShotlessRound('anfang'), { type: 'skip' })
    const second = reduceShotlessRound(first, { type: 'skip' })
    const third = reduceShotlessRound(second, { type: 'skip' })
    const giveUp = reduceShotlessRound(third, { type: 'skip' })

    expect(first.stageIndex).toBe(1)
    expect(first.origin).toBe('anfang')
    expect(first.view).toBe('guessing')
    expect(stageByIndex(first.stageIndex).penalty).toBe('5 Schlücke')
    expect(second.stageIndex).toBe(2)
    expect(stageByIndex(second.stageIndex).penalty).toBe('3 Schlücke')
    expect(third.stageIndex).toBe(3)
    expect(stageByIndex(third.stageIndex).penalty).toBe('1 Schluck')
    expect(giveUp.view).toBe('reveal')
    expect(giveUp.revealMessage).toBe('Alle trinken einen Shot')
    expect(giveUp.stageIndex).toBe(3)
    expect(giveUp.origin).toBe('anfang')
  })

  it('lässt bei einem richtigen Tipp die anderen die aktuelle Strafe trinken', () => {
    const early = reduceShotlessRound(guessingAt(0), {
      type: 'submit-guess',
      guess: 'blinding lights',
      title: 'Blinding Lights (feat. X)',
    })
    const later = reduceShotlessRound(guessingAt(2), {
      type: 'submit-guess',
      guess: secret,
      title: secret,
    })

    expect(early.view).toBe('reveal')
    expect(early.revealMessage).toBe('Alle außer dir trinken: Shot')
    expect(later.revealMessage).toBe('Alle außer dir trinken: 3 Schlücke')
    expect(later.feedback).toBeNull()
  })

  it('bestraft leere Tipps nicht', () => {
    const round = guessingAt(0)
    expect(reduceShotlessRound(round, { type: 'submit-guess', guess: '   ', title: secret })).toBe(round)
  })

  it('bestraft nur den Tippenden und verrät den Titel nicht', () => {
    const round = guessingAt(1, { replayNonce: 4 })
    const wrong = reduceShotlessRound(round, {
      type: 'submit-guess',
      guess: 'Yesterday',
      title: secret,
    })

    expect(wrong.view).toBe('guessing')
    expect(wrong.stageIndex).toBe(1)
    expect(wrong.revealMessage).toBeNull()
    expect(wrong.feedback).toBe('Falsch — du trinkst: 5 Schlücke')
    expect(wrong.replayNonce).toBe(4)
  })

  it('löst in der Party die aktuelle Strafe für alle außer dem Errater aus', () => {
    const claimed = reduceShotlessRound(guessingAt(3), { type: 'claim' })
    const scored = reduceShotlessRound(claimed, { type: 'assign', name: 'Sam' })
    const nobody = reduceShotlessRound(claimed, { type: 'nobody' })

    expect(claimed.view).toBe('pick-player')
    expect(claimed.revealMessage).toBeNull()
    expect(scored.view).toBe('reveal')
    expect(scored.revealMessage).toBe('Alle außer Sam trinken: 1 Schluck')
    expect(nobody.revealMessage).toBe('Alle trinken einen Shot')
  })

  it('startet nach der Auflösung den nächsten Titel wieder bei Stufe 0', () => {
    const revealed = reduceShotlessRound(guessingAt(2, { trackIndex: 1, origin: 'anfang' }), { type: 'nobody' })
    const next = reduceShotlessRound(revealed, { type: 'next', trackCount: 2, origin: 'drop' })
    const ignored = reduceShotlessRound(guessingAt(1), { type: 'next', trackCount: 4, origin: 'mitte' })

    expect(revealed.origin).toBe('anfang')
    expect(next.trackIndex).toBe(0)
    expect(next.stageIndex).toBe(0)
    expect(next.origin).toBe('drop')
    expect(next.view).toBe('guessing')
    expect(next.revealMessage).toBeNull()
    expect(stageByIndex(next.stageIndex).penalty).toBe('Shot')
    expect(ignored.stageIndex).toBe(1)
    expect(ignored.view).toBe('guessing')
  })
})
