import { describe, expect, it } from 'vitest'
import { indexAtPointer, pickSegment, pickWheelItems, segmentAngle, spinTo, wheelLabelLines } from './wheel.ts'

describe('Glücksrad', () => {
  it('teilt 360 Grad gleichmäßig auf', () => {
    expect(segmentAngle(8)).toBe(45)
    expect(segmentAngle(12)).toBe(30)
  })

  it('landet bei jedem Segment, jeder Startlage und jedem Versatz unter dem Zeiger', () => {
    for (const count of [2, 5, 8, 12]) {
      for (const start of [0, 37.5, 359, 720, 1234.5]) {
        for (let index = 0; index < count; index += 1) {
          for (const offset of [-0.4, 0, 0.4]) {
            const rotation = spinTo(start, index, count, 5, offset)
            expect(indexAtPointer(rotation, count)).toBe(index)
          }
        }
      }
    }
  })

  it('dreht immer vorwärts, mindestens die gewünschten Umdrehungen', () => {
    const rotation = spinTo(100, 3, 8, 4, 0)
    expect(rotation).toBeGreaterThanOrEqual(100 + 4 * 360)
    expect(rotation).toBeLessThan(100 + 5 * 360)
  })

  it('wählt ein gültiges Segment', () => {
    expect(pickSegment(8, () => 0)).toBe(0)
    expect(pickSegment(8, () => 0.999999)).toBe(7)
    expect(pickSegment(8, () => 0.5)).toBe(4)
  })

  it('zieht verschiedene Einträge für das Rad', () => {
    const pool = Array.from({ length: 20 }, (_, index) => index)
    const picked = pickWheelItems(pool, 8, () => 0.4)
    expect(picked).toHaveLength(8)
    expect(new Set(picked).size).toBe(8)
    expect(pickWheelItems([1, 2, 3], 8)).toHaveLength(3)
  })
})

describe('Radbeschriftung', () => {
  it('lässt Kurzes in einer Zeile', () => {
    expect(wheelLabelLines('Automarken', 13)).toEqual(['Automarken'])
  })

  it('bricht lange Titel an Wortgrenzen in zwei Zeilen', () => {
    expect(wheelLabelLines('Dinge im Badezimmer', 13)).toEqual(['Dinge im', 'Badezimmer'])
  })

  it('kürzt zu lange Wörter und mehr als zwei Zeilen', () => {
    expect(wheelLabelLines('Nachrichtensprecher', 13)).toEqual(['Nachrichtens…'])
    const lines = wheelLabelLines('eins zwei drei vier fünf sechs sieben', 8)
    expect(lines).toHaveLength(2)
    expect(lines[1]?.endsWith('…')).toBe(true)
  })
})
