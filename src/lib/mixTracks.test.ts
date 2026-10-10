import { describe, expect, it } from 'vitest'
import { MAX_CONSECUTIVE_SAME_PLAYLIST, limitConsecutivePlaylistRuns, shuffleTracks } from '@/lib/mixTracks.ts'
import type { Track } from '@/types.ts'

function track(index: number, playlistId?: string, artist = `Artist ${index}`): Track {
  return { uri: `spotify:track:${index}`, title: `Title ${index}`, artist, durationMs: 180_000, playlistId }
}

/** Deterministischer Zufall (mulberry32), damit die Tests reproduzierbar sind. */
function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function longestRun(tracks: Track[]): number {
  let longest = 0
  let current = 0
  let previous: string | undefined
  for (const entry of tracks) {
    current = entry.playlistId === previous ? current + 1 : 1
    previous = entry.playlistId
    longest = Math.max(longest, current)
  }
  return longest
}

describe('mixTracks', () => {
  it('lässt leere und einelementige Listen unverändert (als Kopie)', () => {
    expect(shuffleTracks([])).toEqual([])
    const single = [track(1)]
    const result = shuffleTracks(single)
    expect(result).toEqual(single)
    expect(result).not.toBe(single)
  })

  it('liefert jeden Titel genau einmal, ohne die Eingabe zu verändern', () => {
    const input = Array.from({ length: 30 }, (_, index) => track(index, index % 3 === 0 ? 'a' : index % 3 === 1 ? 'b' : 'c'))
    const snapshot = [...input]
    const result = shuffleTracks(input, seededRandom(1))
    expect(input).toEqual(snapshot)
    expect(result).toHaveLength(input.length)
    expect(new Set(result.map((entry) => entry.uri))).toEqual(new Set(input.map((entry) => entry.uri)))
  })

  it('ist mit gleichem Zufall reproduzierbar', () => {
    const input = Array.from({ length: 20 }, (_, index) => track(index, index < 10 ? 'a' : 'b'))
    expect(shuffleTracks(input, seededRandom(7)).map((entry) => entry.uri)).toEqual(
      shuffleTracks(input, seededRandom(7)).map((entry) => entry.uri),
    )
  })

  it('mischt bei einer einzigen Playlist ohne Lauflängenregel', () => {
    const input = Array.from({ length: 12 }, (_, index) => track(index, 'a'))
    const result = shuffleTracks(input, seededRandom(3))
    expect(result).toHaveLength(12)
    expect(new Set(result.map((entry) => entry.uri)).size).toBe(12)
  })

  it('begrenzt Läufe aus derselben Playlist bei mehreren Playlists', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const input = [
        ...Array.from({ length: 20 }, (_, index) => track(index, 'a')),
        ...Array.from({ length: 20 }, (_, index) => track(100 + index, 'b')),
      ]
      expect(longestRun(shuffleTracks(input, seededRandom(seed)))).toBeLessThanOrEqual(MAX_CONSECUTIVE_SAME_PLAYLIST)
    }
  })

  it('limitConsecutivePlaylistRuns zieht alternative Titel vor, behält alle und lässt Längen zu, wenn nichts übrig ist', () => {
    const run = [track(1, 'a'), track(2, 'a'), track(3, 'a'), track(4, 'a'), track(5, 'b')]
    expect(limitConsecutivePlaylistRuns(run).map((entry) => entry.uri)).toEqual([
      'spotify:track:1',
      'spotify:track:2',
      'spotify:track:3',
      'spotify:track:5',
      'spotify:track:4',
    ])
    const onlyA = [track(1, 'a'), track(2, 'a'), track(3, 'a'), track(4, 'a')]
    expect(limitConsecutivePlaylistRuns(onlyA)).toEqual(onlyA)
    expect(limitConsecutivePlaylistRuns(run, 0)).toEqual(run)
    expect(limitConsecutivePlaylistRuns(run.slice(0, 3))).toEqual(run.slice(0, 3))
  })
})
