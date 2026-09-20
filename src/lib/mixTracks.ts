import type { Track } from '../types.ts'

export const MAX_CONSECUTIVE_SAME_PLAYLIST = 3

const ARTIST_LOOKAHEAD = 8
const STREAK_COOLDOWN = 2
const UNTAGGED_PLAYLIST = ''

/**
 * Builds a random play queue: fair playlist mix, ≤3 consecutive from one
 * playlist, and spaced artist/playlist repeats. Every input track appears once.
 */
export function shuffleTracks(tracks: Track[], random: () => number = Math.random): Track[] {
  if (tracks.length <= 1) {
    return [...tracks]
  }

  const grouped = groupTracksByPlaylist(tracks)
  if (grouped.size <= 1) {
    return fisherYatesShuffle(tracks, random)
  }

  for (const bucket of grouped.values()) {
    fisherYatesInPlace(bucket, random)
  }

  const mixed = interleaveGroupedTracks(grouped, tracks.length, random)
  return limitConsecutivePlaylistRuns(mixed)
}

interface MixContext {
  grouped: Map<string, Track[]>
  sizes: Map<string, number>
  total: number
  used: Map<string, number>
  lastAt: Map<string, number>
  result: Track[]
  random: () => number
  playlistCount: number
}

function interleaveGroupedTracks(
  grouped: Map<string, Track[]>,
  total: number,
  random: () => number,
): Track[] {
  const sizes = new Map<string, number>()
  for (const [playlistId, bucket] of grouped) {
    sizes.set(playlistId, bucket.length)
  }

  const ctx: MixContext = {
    grouped,
    sizes,
    total,
    used: new Map(),
    lastAt: new Map(),
    result: [],
    random,
    playlistCount: sizes.size,
  }

  const lastMaxStreakAt = new Map<string, number>()
  let lastPlaylist: string | undefined
  let run = 0

  while (ctx.result.length < total) {
    const available = keysWithRemaining(grouped)
    if (available.length === 0) {
      break
    }

    const eligible = eligiblePlaylists({
      available,
      lastPlaylist,
      run,
      resultLength: ctx.result.length,
      lastMaxStreakAt,
    })
    const chosenId = pickPlaylist(eligible, ctx)
    const bucket = grouped.get(chosenId)
    if (!bucket || bucket.length === 0) {
      grouped.delete(chosenId)
      continue
    }

    ctx.result.push(takeTrackAvoidingRepeat(bucket, ctx.result))
    ctx.used.set(chosenId, (ctx.used.get(chosenId) ?? 0) + 1)
    ctx.lastAt.set(chosenId, ctx.result.length - 1)

    if (chosenId === lastPlaylist) {
      run += 1
    } else {
      lastPlaylist = chosenId
      run = 1
    }

    if (run >= MAX_CONSECUTIVE_SAME_PLAYLIST) {
      lastMaxStreakAt.set(chosenId, ctx.result.length - 1)
    }
  }

  for (const bucket of grouped.values()) {
    ctx.result.push(...bucket)
  }
  return ctx.result
}

function eligiblePlaylists(args: {
  available: string[]
  lastPlaylist: string | undefined
  run: number
  resultLength: number
  lastMaxStreakAt: Map<string, number>
}): string[] {
  let pool = args.available
  if (args.lastPlaylist && args.run >= MAX_CONSECUTIVE_SAME_PLAYLIST) {
    const withoutRun = pool.filter((id) => id !== args.lastPlaylist)
    if (withoutRun.length > 0) {
      pool = withoutRun
    }
  }

  const cooled = pool.filter((id) => {
    const streakEnd = args.lastMaxStreakAt.get(id)
    if (streakEnd === undefined) {
      return true
    }
    return args.resultLength - 1 - streakEnd >= STREAK_COOLDOWN
  })
  return cooled.length > 0 ? cooled : pool
}

function pickPlaylist(eligible: string[], ctx: MixContext): string {
  const fallback = eligible[0]
  if (eligible.length <= 1 || fallback === undefined) {
    return fallback ?? keysWithRemaining(ctx.grouped)[0] ?? UNTAGGED_PLAYLIST
  }

  const overdue = eligible.filter((id) => isOverduePlaylist(id, ctx))
  const pool = overdue.length > 0 ? overdue : eligible
  const scored = pool.map((id) => ({ id, score: scorePlaylist(id, ctx) }))
  return pickWeighted(scored, ctx.random)
}

function isOverduePlaylist(playlistId: string, ctx: MixContext): boolean {
  const last = ctx.lastAt.get(playlistId)
  if (last === undefined) {
    return ctx.result.length >= Math.max(1, ctx.playlistCount - 1)
  }
  return ctx.result.length - last >= maxAllowedGap(playlistId, ctx)
}

function maxAllowedGap(playlistId: string, ctx: MixContext): number {
  const size = ctx.sizes.get(playlistId) ?? 1
  const share = size / ctx.total
  const byShare = Math.ceil(1 / Math.max(share, 1 / 12))
  const minGap = ctx.playlistCount
  const maxGap = Math.max(ctx.playlistCount * 3, 8)
  return Math.min(maxGap, Math.max(minGap, byShare))
}

function scorePlaylist(playlistId: string, ctx: MixContext): number {
  const usedCount = ctx.used.get(playlistId) ?? 0
  const size = ctx.sizes.get(playlistId) ?? 1
  const expected = (size / ctx.total) * ctx.result.length
  const deficit = expected - usedCount
  const last = ctx.lastAt.get(playlistId)
  const gap =
    last === undefined ? ctx.result.length + ctx.playlistCount : ctx.result.length - last
  const next = ctx.grouped.get(playlistId)?.[0]
  const artistPenalty = next && hasRecentArtist(ctx.result, next, 1) ? 1 : 0
  const justUsed = last === ctx.result.length - 1 ? 1 : 0

  return (
    (last === undefined ? 10 : 0) +
    Math.min(gap, ctx.playlistCount * 3) * 1.8 +
    deficit * 2.4 +
    ctx.random() * 1.25 -
    justUsed * 7 -
    artistPenalty * 3.5
  )
}

function pickWeighted(
  scored: Array<{ id: string; score: number }>,
  random: () => number,
): string {
  const maxScore = Math.max(...scored.map((item) => item.score))
  const weights = scored.map((item) => Math.exp((item.score - maxScore) / 0.9))
  let dart = unitRandom(random) * weights.reduce((sum, weight) => sum + weight, 0)
  for (let index = 0; index < scored.length; index += 1) {
    dart -= weights[index] ?? 0
    const id = scored[index]?.id
    if (dart <= 0 && id !== undefined) {
      return id
    }
  }
  return scored[scored.length - 1]?.id ?? UNTAGGED_PLAYLIST
}

function takeTrackAvoidingRepeat(bucket: Track[], result: Track[]): Track {
  const avoidArtists = recentNormalizedArtists(result, 2)
  const avoidTitles = recentNormalizedTitles(result, 1)
  const alternate = bucket.findIndex((track) => {
    return (
      !avoidArtists.has(normalizeArtist(track.artist)) &&
      !avoidTitles.has(normalizeTitle(track.title))
    )
  })
  const index = alternate >= 0 && alternate < ARTIST_LOOKAHEAD ? alternate : 0
  const [chosen] = bucket.splice(index, 1)
  if (!chosen) {
    throw new Error('Playlist-Bucket war leer')
  }
  return chosen
}

function recentNormalizedArtists(result: Track[], window: number): Set<string> {
  const artists = new Set<string>()
  for (const track of result.slice(-window)) {
    artists.add(normalizeArtist(track.artist))
  }
  return artists
}

function recentNormalizedTitles(result: Track[], window: number): Set<string> {
  const titles = new Set<string>()
  for (const track of result.slice(-window)) {
    titles.add(normalizeTitle(track.title))
  }
  return titles
}

function hasRecentArtist(result: Track[], track: Track, window: number): boolean {
  const artist = normalizeArtist(track.artist)
  return result.slice(-window).some((item) => normalizeArtist(item.artist) === artist)
}

function normalizeArtist(artist: string): string {
  const primary = artist
    .toLocaleLowerCase()
    .replace(/\s*(feat\.?|ft\.?|featuring)\s+.*/u, '')
    .split(',')[0]
  return primary?.trim() ?? ''
}

function normalizeTitle(title: string): string {
  return title.toLocaleLowerCase().trim()
}

function groupTracksByPlaylist(tracks: Track[]): Map<string, Track[]> {
  const grouped = new Map<string, Track[]>()
  for (const track of tracks) {
    const key = playlistSourceId(track)
    const bucket = grouped.get(key)
    if (bucket) {
      bucket.push(track)
    } else {
      grouped.set(key, [track])
    }
  }
  return grouped
}

function keysWithRemaining(grouped: Map<string, Track[]>): string[] {
  const keys: string[] = []
  for (const [playlistId, bucket] of grouped) {
    if (bucket.length > 0) {
      keys.push(playlistId)
    }
  }
  return keys
}

function playlistSourceId(track: Track): string {
  return track.playlistId ?? UNTAGGED_PLAYLIST
}

function fisherYatesShuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items]
  fisherYatesInPlace(copy, random)
  return copy
}

function fisherYatesInPlace<T>(items: T[], random: () => number): void {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(unitRandom(random) * (index + 1))
    const current = items[index]
    const other = items[swap]
    if (current !== undefined && other !== undefined) {
      items[index] = other
      items[swap] = current
    }
  }
}

function unitRandom(random: () => number): number {
  const value = random()
  if (!Number.isFinite(value) || value <= 0) {
    return 0
  }
  if (value >= 1) {
    return 0.999999999999
  }
  return value
}

/**
 * Walks a shuffled list and takes the next remaining track from another
 * playlist whenever the last `maxRun` songs share a playlistId.
 * Always emits every input track: if no alternate remains, the run may
 * grow past `maxRun` instead of stalling or dropping songs.
 */
export function limitConsecutivePlaylistRuns(
  tracks: Track[],
  maxRun = MAX_CONSECUTIVE_SAME_PLAYLIST,
): Track[] {
  if (maxRun < 1 || tracks.length <= maxRun || !hasMultiplePlaylistSources(tracks)) {
    return [...tracks]
  }

  const remaining = [...tracks]
  const ordered: Track[] = []

  while (remaining.length > 0) {
    const chosen = takeAllowedTrack(remaining, playlistIdToAvoid(ordered, maxRun))
    if (chosen) {
      ordered.push(chosen)
    }
  }

  return ordered
}

function takeAllowedTrack(remaining: Track[], forbiddenId: string | undefined): Track | undefined {
  let pickIndex = 0
  if (forbiddenId !== undefined) {
    const alternate = remaining.findIndex((track) => playlistSourceId(track) !== forbiddenId)
    if (alternate !== -1) {
      pickIndex = alternate
    }
  }
  const [chosen] = remaining.splice(pickIndex, 1)
  return chosen
}

function hasMultiplePlaylistSources(tracks: Track[]): boolean {
  const playlistIds = new Set<string>()
  for (const track of tracks) {
    playlistIds.add(playlistSourceId(track))
  }
  return playlistIds.size >= 2
}

function playlistIdToAvoid(ordered: Track[], maxRun: number): string | undefined {
  if (ordered.length < maxRun) {
    return undefined
  }
  const last = ordered[ordered.length - 1]
  if (!last) {
    return undefined
  }
  const playlistId = playlistSourceId(last)
  for (let offset = 1; offset < maxRun; offset += 1) {
    const previous = ordered[ordered.length - 1 - offset]
    if (!previous || playlistSourceId(previous) !== playlistId) {
      return undefined
    }
  }
  return playlistId
}
