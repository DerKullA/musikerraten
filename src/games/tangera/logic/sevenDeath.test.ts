import { describe, expect, it } from 'vitest'
import { isPiep, sevenDeathCall } from './sevenDeath.ts'

describe('Sieben Tod', () => {
  it('ersetzt Vielfache von 7 durch Piep', () => {
    for (const value of [7, 14, 21, 28, 35, 42, 49, 56, 63, 84, 98]) {
      expect(isPiep(value)).toBe(true)
    }
  })

  it('ersetzt Zahlen mit einer 7 durch Piep', () => {
    for (const value of [17, 27, 37, 70, 71, 79, 97, 107, 170]) {
      expect(isPiep(value)).toBe(true)
    }
  })

  it('lässt alle anderen Zahlen stehen', () => {
    for (const value of [1, 2, 6, 8, 13, 15, 16, 18, 20, 30, 100]) {
      expect(isPiep(value)).toBe(false)
    }
  })

  it('liefert, was gesagt werden muss', () => {
    expect(sevenDeathCall(6)).toBe('6')
    expect(sevenDeathCall(7)).toBe('Piep')
    expect(sevenDeathCall(16)).toBe('16')
    expect(sevenDeathCall(17)).toBe('Piep')
  })

  it('ignoriert ungültige Eingaben', () => {
    expect(isPiep(0)).toBe(false)
    expect(isPiep(-7)).toBe(false)
    expect(isPiep(1.5)).toBe(false)
  })
})
