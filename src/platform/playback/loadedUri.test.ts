import { describe, expect, it, vi } from 'vitest'
import { adoptLoadedUri, type LoadedUri } from './loadedUri.ts'

function loaded(overrides: Partial<LoadedUri> = {}): LoadedUri {
  return { requested: 'spotify:track:wanted', before: 'spotify:track:old', actual: null, settled: false, ...overrides }
}

function state(uri: string | null, positionMs = 1_000) {
  return { paused: false, positionMs, uri }
}

describe('adoptLoadedUri', () => {
  it('reicht den Zustand ohne Ladebefehl oder ohne URI unverändert durch', () => {
    const noUri = state(null)
    expect(adoptLoadedUri(null, state('spotify:track:a'))).toEqual(state('spotify:track:a'))
    expect(adoptLoadedUri(loaded(), noUri)).toBe(noUri)
    expect(adoptLoadedUri(loaded(), null)).toBeNull()
  })

  it('markiert den Ladebefehl als erfüllt, sobald die angefragte URI läuft', () => {
    const entry = loaded()
    const running = state('spotify:track:wanted')
    expect(adoptLoadedUri(entry, running)).toBe(running)
    expect(entry.settled).toBe(true)
    expect(entry.actual).toBeNull()
  })

  it('übernimmt die erste neue fremde URI als geladenen Titel und meldet sie einmal', () => {
    const entry = loaded()
    const onAlias = vi.fn()
    const result = adoptLoadedUri(entry, state('spotify:track:alias', 2_500), onAlias)
    expect(result).toEqual({ paused: false, positionMs: 2_500, uri: 'spotify:track:wanted' })
    expect(entry.actual).toBe('spotify:track:alias')
    expect(onAlias).toHaveBeenCalledWith('spotify:track:wanted', 'spotify:track:alias')
    adoptLoadedUri(entry, state('spotify:track:alias', 3_000), onAlias)
    expect(onAlias).toHaveBeenCalledTimes(1)
  })

  it('übernimmt nicht den Titel, der schon vor dem Ladebefehl lief', () => {
    const entry = loaded()
    const stale = state('spotify:track:old')
    expect(adoptLoadedUri(entry, stale)).toBe(stale)
    expect(entry.actual).toBeNull()
  })

  it('übernimmt nichts mehr, nachdem die angefragte URI gesehen wurde', () => {
    const entry = loaded({ settled: true })
    const other = state('spotify:track:next')
    expect(adoptLoadedUri(entry, other)).toBe(other)
    expect(entry.actual).toBeNull()
  })

  it('bleibt bei einer anderen URI nach der Übernahme bei der ersten', () => {
    const entry = loaded({ actual: 'spotify:track:alias' })
    const other = state('spotify:track:third')
    expect(adoptLoadedUri(entry, other)).toBe(other)
    expect(entry.actual).toBe('spotify:track:alias')
  })
})
