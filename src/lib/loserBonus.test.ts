import { describe, expect, it } from 'vitest'
import {
  LOSER_BONUS_STREAK,
  LOSER_PUNISHMENTS,
  createWinStreak,
  describeWheelWedge,
  loserBonusHeadline,
  loserBonusVerdict,
  pickPunishmentIndex,
  recordRoundOutcome,
  wheelStopRotation,
} from './loserBonus.ts'

describe('recordRoundOutcome', () => {
  it('löst den Verlierer-Bonus beim dritten Sieg derselben Person aus und setzt die Serie zurück', () => {
    let streak = createWinStreak()
    streak = recordRoundOutcome(streak, 'Ada').streak
    streak = recordRoundOutcome(streak, 'ada').streak
    const third = recordRoundOutcome(streak, 'Ada')

    expect(third.triggered).toBe(true)
    expect(third.winner).toBe('Ada')
    expect(third.streak).toEqual({ winner: null, count: 0 })
    expect(LOSER_BONUS_STREAK).toBe(3)

    const after = recordRoundOutcome(third.streak, 'Ada')
    expect(after.triggered).toBe(false)
    expect(after.streak).toEqual({ winner: 'Ada', count: 1 })
  })

  it('bricht die Serie, wenn jemand anders gewinnt oder niemand', () => {
    const first = recordRoundOutcome(createWinStreak(), 'Bea')
    const other = recordRoundOutcome(first.streak, 'Cem')
    expect(other.streak).toEqual({ winner: 'Cem', count: 1 })

    const missed = recordRoundOutcome(other.streak, null)
    expect(missed.triggered).toBe(false)
    expect(missed.streak).toEqual({ winner: null, count: 0 })
  })
})

describe('wheelStopRotation', () => {
  it('dreht das gewählte Segment unter den Zeiger', () => {
    for (let index = 0; index < LOSER_PUNISHMENTS.length; index += 1) {
      const rotation = wheelStopRotation(15, index, LOSER_PUNISHMENTS.length, 5)
      expect(segmentAtPointer(rotation, LOSER_PUNISHMENTS.length)).toBe(index)
      expect(rotation).toBeGreaterThan(15 + 5 * 360 - 1)
    }
  })
})

describe('pickPunishmentIndex', () => {
  it('bleibt im Segmentbereich', () => {
    expect(pickPunishmentIndex(8, () => 0.99)).toBe(7)
    expect(pickPunishmentIndex(8, () => 0)).toBe(0)
  })
})

describe('loserBonusHeadline', () => {
  it('spricht die tippende Person direkt an', () => {
    expect(loserBonusHeadline('dir')).toBe('Du hast 3 Mal in Folge gewonnen.')
    expect(loserBonusHeadline('Noa')).toContain('Noa')
  })
})

describe('loserBonusVerdict', () => {
  it('legt die Strafe dem Gewinner auf', () => {
    expect(loserBonusVerdict('Noa', 'Ehrenrunde')).toBe('Noa: Ehrenrunde')
    expect(loserBonusVerdict('dir', 'Duett')).toBe('Du: Duett')
  })
})

describe('describeWheelWedge', () => {
  it('beginnt das erste Segment oben', () => {
    const wedge = describeWheelWedge(0, 8, 40)
    expect(wedge.startsWith('M 0 0 L')).toBe(true)
    expect(wedge).toContain('A 40 40')
  })
})

function segmentAtPointer(rotation: number, count: number): number {
  const segment = 360 / count
  const shifted = ((rotation % 360) + 360) % 360
  const angleAtTop = (360 - shifted) % 360
  return Math.floor(angleAtTop / segment) % count
}
