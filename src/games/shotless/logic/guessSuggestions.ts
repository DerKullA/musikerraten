import { normalizeSongTitle, type GuessSuggestion, type TitleSuggestion } from './rules.ts'

interface CatalogArtistPart {
  label: string
  key: string
}

interface CatalogTrack {
  title: string
  titleKey: string
  artistFull: string
  artistFullKey: string
  artistParts: CatalogArtistPart[]
}

const catalogs = new WeakMap<readonly { title: string; artist?: string }[], readonly CatalogTrack[]>()
const NO_GUESSES: GuessSuggestion[] = []

function artistParts(artist: string): CatalogArtistPart[] {
  return artist
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((label) => ({ label, key: normalizeSongTitle(label) }))
}

function buildCatalog(tracks: readonly { title: string; artist?: string }[]): readonly CatalogTrack[] {
  return tracks.map((track) => {
    const artist = track.artist ?? ''
    return {
      title: track.title,
      titleKey: normalizeSongTitle(track.title),
      artistFull: artist.trim(),
      artistFullKey: normalizeSongTitle(artist),
      artistParts: artistParts(artist),
    }
  })
}

function catalogFor(tracks: readonly { title: string; artist?: string }[]): readonly CatalogTrack[] {
  const cached = catalogs.get(tracks)
  if (cached) {
    return cached
  }
  const built = buildCatalog(tracks)
  catalogs.set(tracks, built)
  return built
}

function artistLabels(track: CatalogTrack, needle: string): readonly CatalogArtistPart[] {
  const matched = track.artistParts.filter((part) => part.key.includes(needle))
  if (matched.length > 0) {
    return matched
  }
  if (track.artistFullKey.includes(needle)) {
    return [{ label: track.artistFull, key: track.artistFullKey }]
  }
  return []
}

export function suggestGuesses(
  tracks: readonly { title: string; artist?: string }[],
  query: string,
  field: 'title' | 'artist' | 'either',
  limit = 6,
): GuessSuggestion[] {
  const needle = normalizeSongTitle(query)
  if (needle.length < 2) {
    return NO_GUESSES
  }
  const matches: GuessSuggestion[] = []
  const seen = new Set<string>()
  function pushMatch(label: string, key: string, suggestionField: 'title' | 'artist'): void {
    const seenKey = `${suggestionField}:${key}`
    if (!key.includes(needle) || seen.has(seenKey) || matches.length >= limit) {
      return
    }
    seen.add(seenKey)
    matches.push({ label, field: suggestionField })
  }
  const catalog = catalogFor(tracks)
  if (field !== 'artist') {
    for (const track of catalog) {
      pushMatch(track.title, track.titleKey, 'title')
    }
  }
  if (field !== 'title') {
    for (const track of catalog) {
      for (const part of artistLabels(track, needle)) {
        pushMatch(part.label, part.key, 'artist')
      }
    }
  }
  return matches
}

export function suggestSongTitles(
  tracks: readonly { title: string }[],
  query: string,
  limit = 6,
): TitleSuggestion[] {
  return suggestGuesses(tracks, query, 'title', limit).map((entry) => ({ title: entry.label }))
}
