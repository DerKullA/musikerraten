import { describe, expect, it } from 'vitest'
import {
  limitConsecutivePlaylistRuns,
  MAX_CONSECUTIVE_SAME_PLAYLIST,
  shuffleTracks,
} from './mixTracks.ts'
import type { Track } from '../types.ts'

describe('shuffleTracks', () => {
  it('permutes tracks without dropping or adding', () => {
    const tracks = playlistTracks('fixture', 10)
    const result = shuffleTracks(tracks, mulberry32(7))
    expectPermutation(result, tracks)
  })

  it('keeps a single playlist as a shuffle without mixing rules', () => {
    const tracks = playlistTracks('only', 12)
    const result = shuffleTracks(tracks, mulberry32(21))
    expectPermutation(result, tracks)
    expect(result).not.toEqual(tracks)
  })

  it('returns every input track exactly once across mixed playlists', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const tracks = [
        ...playlistTracks('a', 18),
        ...playlistTracks('b', 12),
        ...playlistTracks('c', 7),
      ]
      expectPermutation(shuffleTracks(tracks, mulberry32(seed)), tracks)
    }
  })

  it('never exceeds three consecutive tracks from one playlist while an alternate remains', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const tracks = [
        ...playlistTracks('rock', 28),
        ...playlistTracks('pop', 22),
        ...playlistTracks('jazz', 16),
      ]
      assertConsecutiveCap(shuffleTracks(tracks, mulberry32(seed)))
    }
  })

  it('lets each selected playlist appear in the early window', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const tracks = [
        ...playlistTracks('alpha', 24),
        ...playlistTracks('beta', 18),
        ...playlistTracks('gamma', 9),
      ]
      const mixed = shuffleTracks(tracks, mulberry32(seed))
      const firstIds = mixed.slice(0, 8).map((track) => track.playlistId)
      expect(firstIds).toContain('alpha')
      expect(firstIds).toContain('beta')
      expect(firstIds).toContain('gamma')
    }
  })

  it('does not starve a third playlist while two others bounce', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const tracks = [
        ...playlistTracks('big', 40),
        ...playlistTracks('mid', 25),
        ...playlistTracks('small', 8),
      ]
      const mixed = shuffleTracks(tracks, mulberry32(seed))
      const firstSmall = mixed.findIndex((track) => track.playlistId === 'small')
      expect(firstSmall).toBeGreaterThanOrEqual(0)
      expect(firstSmall).toBeLessThan(12)

      const counts = countPlaylists(mixed.slice(0, 24))
      expect(counts.get('big') ?? 0).toBeGreaterThan(0)
      expect(counts.get('mid') ?? 0).toBeGreaterThan(0)
      expect(counts.get('small') ?? 0).toBeGreaterThan(0)
    }
  })

  it('spaces playlist returns after a max streak more than a plain shuffle+cap', () => {
    const tracks = [
      ...playlistTracks('a', 30),
      ...playlistTracks('b', 30),
      ...playlistTracks('c', 30),
    ]
    let mixedGreedy = 0
    let naiveGreedy = 0
    for (let seed = 1; seed <= 50; seed += 1) {
      mixedGreedy += countGreedyReturns(shuffleTracks(tracks, mulberry32(seed)))
      naiveGreedy += countGreedyReturns(naiveShuffleAndCap(tracks, mulberry32(seed + 1000)))
    }
    expect(mixedGreedy).toBeLessThan(naiveGreedy)
  })

  it('places the same artist back-to-back less often than a plain shuffle+cap', () => {
    const tracks = [
      ...repeatingArtistTracks('left', ['Queen', 'Nena', 'Abba'], 8),
      ...repeatingArtistTracks('right', ['Queen', 'Nena', 'Abba'], 8),
      ...repeatingArtistTracks('extra', ['Queen', 'Nena', 'Abba'], 8),
    ]
    let mixedRepeats = 0
    let naiveRepeats = 0
    for (let seed = 1; seed <= 40; seed += 1) {
      mixedRepeats += countAdjacentArtistRepeats(shuffleTracks(tracks, mulberry32(seed)))
      naiveRepeats += countAdjacentArtistRepeats(
        naiveShuffleAndCap(tracks, mulberry32(seed + 500)),
      )
    }
    expect(mixedRepeats).toBeLessThan(naiveRepeats)
  })

  it('still varies from game to game', () => {
    const tracks = [...playlistTracks('a', 10), ...playlistTracks('b', 10), ...playlistTracks('c', 10)]
    const first = shuffleTracks(tracks)
    const second = shuffleTracks(tracks)
    const third = shuffleTracks(tracks)
    const sameAsFirst = [second, third].filter((queue) => sameUriOrder(queue, first)).length
    expect(sameAsFirst).toBeLessThan(2)
  })
})

describe('limitConsecutivePlaylistRuns', () => {
  it('breaks a run of four when another playlist remains', () => {
    const tracks = [
      ...playlistTracks('a', 4),
      ...playlistTracks('b', 1),
    ]
    const limited = limitConsecutivePlaylistRuns(tracks, 3)
    assertConsecutiveCap(limited)
    expectPermutation(limited, tracks)
  })

  it('allows a long tail when only one playlist remains', () => {
    const tracks = [...playlistTracks('a', 5), ...playlistTracks('b', 1)]
    const limited = limitConsecutivePlaylistRuns(
      [...playlistTracks('b', 1), ...playlistTracks('a', 5)],
      3,
    )
    expectPermutation(limited, tracks)
    const tail = limited.slice(1)
    expect(tail.every((track) => track.playlistId === 'a')).toBe(true)
  })
})

function makeTrack(uri: string, playlistId: string, artist: string, title: string): Track {
  return { uri, title, artist, durationMs: 180_000, playlistId }
}

function playlistTracks(playlistId: string, count: number): Track[] {
  return Array.from({ length: count }, (_, index) =>
    makeTrack(
      `${playlistId}-${index}`,
      playlistId,
      `${playlistId}-artist-${index}`,
      `${playlistId}-title-${index}`,
    ),
  )
}

function repeatingArtistTracks(playlistId: string, artists: string[], each: number): Track[] {
  const tracks: Track[] = []
  for (const artist of artists) {
    for (let index = 0; index < each; index += 1) {
      tracks.push(
        makeTrack(
          `${playlistId}-${artist}-${index}`,
          playlistId,
          artist,
          `${artist} song ${index}`,
        ),
      )
    }
  }
  return tracks
}

function expectPermutation(result: Track[], input: Track[]): void {
  expect(result).toHaveLength(input.length)
  const resultUris = result.map((track) => track.uri).sort()
  const inputUris = input.map((track) => track.uri).sort()
  expect(resultUris).toEqual(inputUris)
  expect(new Set(result.map((track) => track.uri)).size).toBe(input.length)
}

function assertConsecutiveCap(ordered: Track[], maxRun = MAX_CONSECUTIVE_SAME_PLAYLIST): void {
  let run = 1
  for (let index = 1; index < ordered.length; index += 1) {
    const current = ordered[index]
    const previous = ordered[index - 1]
    if (!current || !previous) {
      continue
    }
    if (current.playlistId && current.playlistId === previous.playlistId) {
      run += 1
    } else {
      run = 1
    }
    if (run > maxRun) {
      const remainingHasAlternate = ordered
        .slice(index)
        .some((track) => track.playlistId && track.playlistId !== current.playlistId)
      expect(remainingHasAlternate).toBe(false)
    }
  }
}

function countPlaylists(tracks: Track[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const track of tracks) {
    if (!track.playlistId) {
      continue
    }
    counts.set(track.playlistId, (counts.get(track.playlistId) ?? 0) + 1)
  }
  return counts
}

function countGreedyReturns(tracks: Track[], maxRun = MAX_CONSECUTIVE_SAME_PLAYLIST): number {
  let greedy = 0
  let run = 1
  for (let index = 1; index < tracks.length; index += 1) {
    const current = tracks[index]
    const previous = tracks[index - 1]
    if (!current || !previous) {
      continue
    }
    if (current.playlistId && current.playlistId === previous.playlistId) {
      run += 1
      continue
    }
    if (run >= maxRun) {
      const next = tracks[index + 1]
      if (next?.playlistId && next.playlistId === previous.playlistId) {
        greedy += 1
      }
    }
    run = 1
  }
  return greedy
}

function countAdjacentArtistRepeats(tracks: Track[]): number {
  let repeats = 0
  for (let index = 1; index < tracks.length; index += 1) {
    const current = tracks[index]
    const previous = tracks[index - 1]
    if (current && previous && current.artist === previous.artist) {
      repeats += 1
    }
  }
  return repeats
}

function naiveShuffleAndCap(tracks: Track[], random: () => number): Track[] {
  const copy = [...tracks]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    const current = copy[index]
    const other = copy[swap]
    if (current && other) {
      copy[index] = other
      copy[swap] = current
    }
  }
  return limitConsecutivePlaylistRuns(copy)
}

function sameUriOrder(left: Track[], right: Track[]): boolean {
  return left.every((track, index) => track.uri === right[index]?.uri)
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let next = Math.imul(state ^ (state >>> 15), 1 | state)
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next)
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296
  }
}
