import { describe, expect, it } from 'vitest'
import { phaseDuration, PLAY_MS, REVEAL_MS, THINK_MS } from './gameLoop.ts'

const customTimings = { playMs: 1_000, thinkMs: 4_000, revealMs: 12_000 }

describe('phaseDuration', () => {
  it('keeps the shipped defaults', () => {
    expect(phaseDuration('playing')).toBe(PLAY_MS)
    expect(phaseDuration('thinking')).toBe(THINK_MS)
    expect(phaseDuration('reveal')).toBe(REVEAL_MS)
    expect(PLAY_MS).toBe(11_000)
    expect(THINK_MS).toBe(3_000)
    expect(REVEAL_MS).toBe(6_000)
    expect(phaseDuration('idle')).toBe(0)
  })

  it('uses the timings of the active round', () => {
    expect(phaseDuration('playing', customTimings)).toBe(1_000)
    expect(phaseDuration('thinking', customTimings)).toBe(4_000)
    expect(phaseDuration('reveal', customTimings)).toBe(12_000)
  })
})
