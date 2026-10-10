import { describe, expect, it } from 'vitest'
import {
  LOSER_BONUS_STREAK,
  LOSER_PUNISHMENTS,
  WINNER_NAME_LIMIT,
  createWinStreak,
  describeWheelWedge,
  loserBonusHeadline,
  loserBonusSpinHint,
  loserBonusSubline,
  loserBonusVerdict,
  normalizeWinnerName,
  pickPunishmentIndex,
  recordRoundOutcome,
  sameWinnerName,
  wheelLabelPlacement,
  wheelPoint,
  wheelStopRotation,
  type WinStreak,
} from './loserBonus.ts'

describe('loserBonus: Siegesserie', () => {
  it('löst nach drei Siegen derselben Person in Folge aus und setzt zurück', () => {
    let streak: WinStreak = createWinStreak()
    const first = recordRoundOutcome(streak, 'Anna')
    expect(first).toEqual({ streak: { winner: 'Anna', count: 1 }, triggered: false, winner: 'Anna' })
    streak = first.streak
    const second = recordRoundOutcome(streak, 'anna')
    expect(second.streak).toEqual({ winner: 'anna', count: 2 })
    expect(second.triggered).toBe(false)
    const third = recordRoundOutcome(second.streak, ' ANNA ')
    expect(LOSER_BONUS_STREAK).toBe(3)
    expect(third).toEqual({ streak: { winner: null, count: 0 }, triggered: true, winner: 'ANNA' })
  })

  it('beginnt bei einem anderen Sieger wieder bei 1', () => {
    const update = recordRoundOutcome({ winner: 'Anna', count: 2 }, 'Ben')
    expect(update).toEqual({ streak: { winner: 'Ben', count: 1 }, triggered: false, winner: 'Ben' })
  })

  it('setzt die Serie ohne Sieger oder bei ungültigem Namen zurück', () => {
    const reset = { streak: { winner: null, count: 0 }, triggered: false, winner: null }
    expect(recordRoundOutcome({ winner: 'Anna', count: 2 }, null)).toEqual(reset)
    expect(recordRoundOutcome({ winner: 'Anna', count: 2 }, '   ')).toEqual(reset)
    expect(recordRoundOutcome({ winner: 'Anna', count: 2 }, 'x'.repeat(WINNER_NAME_LIMIT + 1))).toEqual(reset)
  })

  it('normalisiert Namen und vergleicht ohne Groß-/Kleinschreibung', () => {
    expect(normalizeWinnerName('  Anna   Maria ')).toBe('Anna Maria')
    expect(normalizeWinnerName('')).toBeNull()
    expect(normalizeWinnerName('x'.repeat(WINNER_NAME_LIMIT))).toBe('x'.repeat(WINNER_NAME_LIMIT))
    expect(sameWinnerName(' ÄNNA', 'änna ')).toBe(true)
    expect(sameWinnerName('Anna', 'Ben')).toBe(false)
  })
})

describe('loserBonus: Texte', () => {
  it('spricht den Tipp-Spieler "dir" direkt an', () => {
    expect(loserBonusHeadline('dir')).toBe('Du hast 3 Mal in Folge gewonnen.')
    expect(loserBonusHeadline('Anna')).toBe('Anna hat 3 Mal in Folge gewonnen.')
    expect(loserBonusSubline('Dir')).toBe('Dein Verlierer-Bonus: eine kleine Strafe für die Siegesserie.')
    expect(loserBonusSubline('Anna')).toBe('Verlierer-Bonus für Anna: eine kleine Strafe für die Siegesserie.')
    expect(loserBonusSpinHint('dir')).toBe('Dreht das Rad. Die kleine Strafe gilt für dich.')
    expect(loserBonusSpinHint('Anna')).toBe('Dreht das Rad. Die kleine Strafe gilt für Anna.')
    expect(loserBonusVerdict('dir', 'Duett')).toBe('Du: Duett')
    expect(loserBonusVerdict('Anna', 'Duett')).toBe('Anna: Duett')
  })

  it('bietet acht eindeutige Strafen', () => {
    expect(LOSER_PUNISHMENTS).toHaveLength(8)
    expect(new Set(LOSER_PUNISHMENTS.map((entry) => entry.id)).size).toBe(8)
  })
})

describe('loserBonus: Glücksrad', () => {
  it('wählt den Strafen-Index aus dem Zufallswert und begrenzt ihn', () => {
    expect(pickPunishmentIndex(8, () => 0)).toBe(0)
    expect(pickPunishmentIndex(8, () => 0.5)).toBe(4)
    expect(pickPunishmentIndex(8, () => 0.999)).toBe(7)
    expect(pickPunishmentIndex(8, () => 1)).toBe(7)
    expect(pickPunishmentIndex(8, () => -1)).toBe(0)
    expect(pickPunishmentIndex(0, () => 0.9)).toBe(0)
  })

  it('berechnet die Endrotation mit Extra-Umdrehungen', () => {
    // Segment 0 von 8: Mitte bei 22,5 Grad, Zeiger oben -> Rad muss auf 337,5 Grad.
    expect(wheelStopRotation(0, 0, 8)).toBe(5 * 360 + 337.5)
    expect(wheelStopRotation(0, 0, 8, 0)).toBe(337.5)
    // Segment 2 von 4: Mitte bei 225 Grad -> Ziel 135 Grad, von 100 Grad aus +35 plus eine Umdrehung.
    expect(wheelStopRotation(100, 2, 4, 1)).toBe(495)
    expect(wheelStopRotation(0, -1, 8, 0)).toBe(wheelStopRotation(0, 7, 8, 0))
    expect(wheelStopRotation(0, 8, 8, 0)).toBe(wheelStopRotation(0, 0, 8, 0))
  })

  it('rechnet Radpunkte mit 0 Grad oben', () => {
    const top = wheelPoint(0, 10)
    expect(top.x).toBeCloseTo(0)
    expect(top.y).toBeCloseTo(-10)
    const right = wheelPoint(Math.PI / 2, 10)
    expect(right.x).toBeCloseTo(10)
    expect(right.y).toBeCloseTo(0)
  })

  it('beschreibt Keilpfade und Beschriftungslage', () => {
    expect(describeWheelWedge(0, 4, 100)).toMatch(/^M 0 0 L 0 -100 A 100 100 0 0 1 100 /)
    expect(describeWheelWedge(0, 1, 100)).toContain(' 0 1 1 ')
    const upright = wheelLabelPlacement(0, 8, 50)
    expect(upright.rotation).toBeCloseTo(22.5)
    const flipped = wheelLabelPlacement(4, 8, 50)
    expect(flipped.rotation).toBeCloseTo(382.5)
  })
})
