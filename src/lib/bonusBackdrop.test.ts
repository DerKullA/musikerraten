import { describe, expect, it, vi } from 'vitest'
import {
  BACKDROP_END_SLACK_MS,
  BACKDROP_POLL_MS,
  backdropPositionMs,
  backdropRemainingMs,
  backdropWaitMs,
  pickBackdropTrack,
  prepareGuessHandoff,
  rememberPlayedTrack,
  waitUntilPlaybackPaused,
  type BackdropTrack,
} from '@/lib/bonusBackdrop.ts'

const A: BackdropTrack = { uri: 'a', durationMs: 100_000 }
const B: BackdropTrack = { uri: 'b', durationMs: 200_000 }

describe('bonusBackdrop', () => {
  it('merkt gespielte Titel ohne Duplikate und ohne die Eingabe zu ändern', () => {
    const played = [A]
    expect(rememberPlayedTrack(played, B)).toEqual([A, B])
    expect(rememberPlayedTrack(played, A)).toEqual([A])
    expect(played).toEqual([A])
  })

  it('wählt einen anderen Titel als den eben beendeten, sonst den einzigen', () => {
    expect(pickBackdropTrack([], 'a', () => 0)).toBeNull()
    expect(pickBackdropTrack([A, B], 'a', () => 0)).toBe(B)
    expect(pickBackdropTrack([A], 'a', () => 0.9)).toBe(A)
    expect(pickBackdropTrack([A, B, { uri: 'c', durationMs: 1 }], 'a', () => 0.99)?.uri).toBe('c')
    expect(pickBackdropTrack([A, B], 'x', () => 5)).toBe(B)
  })

  it('berechnet die Restdauer begrenzt auf 0..Dauer', () => {
    expect(backdropRemainingMs(100_000, 30_000)).toBe(70_000)
    expect(backdropRemainingMs(100_000, 150_000)).toBe(0)
    expect(backdropRemainingMs(100_000, -5)).toBe(100_000)
    expect(backdropRemainingMs(100_000, Number.NaN)).toBe(100_000)
    expect(backdropRemainingMs(0, 10)).toBe(0)
    expect(backdropRemainingMs(Number.NaN, 10)).toBe(0)
  })

  it('wartet höchstens einen Poll, am Ende gar nicht', () => {
    expect(backdropWaitMs(10_000)).toBe(BACKDROP_POLL_MS)
    expect(backdropWaitMs(BACKDROP_END_SLACK_MS + 300)).toBe(300)
    expect(backdropWaitMs(BACKDROP_END_SLACK_MS)).toBe(0)
    expect(backdropWaitMs(0)).toBe(0)
  })

  it('liest die Position nur vom aktuellen Titel, sonst gilt die Annahme', () => {
    expect(backdropPositionMs('a', null, 500)).toBe(500)
    expect(backdropPositionMs('a', { uri: 'b', positionMs: 9_000 }, 500)).toBe(500)
    expect(backdropPositionMs('a', { uri: 'a', positionMs: 9_000 }, 500)).toBe(9_000)
    expect(backdropPositionMs('a', { uri: null, positionMs: 9_000 }, 500)).toBe(9_000)
  })

  it('wartet auf bestätigte Pause mit begrenzten Versuchen', async () => {
    const wait = vi.fn().mockResolvedValue(undefined)
    const answers = [false, null, true]
    const readPaused = vi.fn(async () => answers.shift() ?? null)
    expect(await waitUntilPlaybackPaused(readPaused, wait)).toBe(true)
    expect(wait).toHaveBeenCalledTimes(2)
    expect(wait).toHaveBeenCalledWith(80)
    const never = vi.fn(async () => false)
    expect(await waitUntilPlaybackPaused(never, wait, 3)).toBe(false)
    expect(never).toHaveBeenCalledTimes(3)
  })

  it('pausiert vor dem Vorladen nur, wenn die Wiedergabe nicht schon pausiert ist', async () => {
    const calls: string[] = []
    const wait = async () => {}
    await prepareGuessHandoff({
      readPaused: async () => true,
      pause: async () => void calls.push('pause'),
      prime: async () => void calls.push('prime'),
      wait,
    })
    expect(calls).toEqual(['prime'])
    calls.length = 0
    const states = [false, true]
    await prepareGuessHandoff({
      readPaused: async () => states.shift() ?? true,
      pause: async () => void calls.push('pause'),
      prime: async () => void calls.push('prime'),
      wait,
    })
    expect(calls).toEqual(['pause', 'prime'])
  })
})
