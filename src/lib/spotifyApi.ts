import type { Playlist, Track } from '../types.ts'
import { pickAlbumImageUrl, type AlbumImage } from './albumArt.ts'
import { getValidAccessToken } from './spotifyAuth.ts'

const API = 'https://api.spotify.com/v1'

interface PlaylistPage {
  items: Array<{
    id: string
    name: string
    owner?: { display_name?: string }
    tracks?: { total?: number }
    items?: { total?: number }
  }>
  total: number
}

interface PlaylistItemPage {
  items: Array<{
    is_local?: boolean
    item?: SpotifyItem | null
    track?: SpotifyItem | null
  }>
  total: number
}

interface SpotifyItem {
  type?: string
  uri?: string
  id?: string | null
  name?: string
  artists?: Array<{ name?: string }>
  duration_ms?: number
  album?: {
    images?: AlbumImage[]
  }
}

export async function spotifyRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getValidAccessToken()
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })
  if (response.status === 204) {
    return undefined as T
  }
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Spotify-Fehler ${response.status}`)
  }
  return (await response.json()) as T
}

export async function fetchUserPlaylists(): Promise<Playlist[]> {
  const playlists: Playlist[] = []
  let offset = 0
  const limit = 50
  while (true) {
    const page = await spotifyRequest<PlaylistPage>(
      `/me/playlists?limit=${limit}&offset=${offset}`,
    )
    for (const item of page.items) {
      playlists.push({
        id: item.id,
        name: item.name,
        trackCount: item.items?.total ?? item.tracks?.total ?? 0,
        ownerName: item.owner?.display_name ?? '',
      })
    }
    offset += page.items.length
    if (page.items.length === 0 || offset >= page.total) {
      break
    }
  }
  return playlists
}

export async function fetchPlaylistTracks(playlistId: string): Promise<Track[]> {
  const tracks: Track[] = []
  let offset = 0
  const limit = 50
  while (true) {
    const page = await fetchPlaylistItemPage(playlistId, offset, limit)
    for (const row of page.items) {
      const track = toPlayableTrack(row, playlistId)
      if (track) {
        tracks.push(track)
      }
    }
    offset += page.items.length
    if (page.items.length === 0 || offset >= page.total) {
      break
    }
  }
  return tracks
}

export async function fetchTracksForPlaylists(playlistIds: string[]): Promise<Track[]> {
  const seen = new Set<string>()
  const tracks: Track[] = []
  let skipped = 0
  for (const id of playlistIds) {
    try {
      const items = await fetchPlaylistTracks(id)
      for (const track of items) {
        if (!track.uri || seen.has(track.uri)) {
          continue
        }
        seen.add(track.uri)
        tracks.push(track)
      }
    } catch {
      skipped += 1
    }
  }
  if (tracks.length === 0 && skipped > 0) {
    throw new Error(
      'Playlists konnten nicht geladen werden. Im Spotify-Entwicklungsmodus sind oft nur eigene oder geteilte Playlists lesbar.',
    )
  }
  return tracks
}

export function playbackRequestBody(
  uri: string,
  positionMs = 0,
): { uris: [string]; position_ms: number } {
  const position = Number.isFinite(positionMs) ? Math.max(0, Math.floor(positionMs)) : 0
  return { uris: [uri], position_ms: position }
}

export async function startPlayback(deviceId: string, uri: string, positionMs = 0): Promise<void> {
  await spotifyRequest<void>(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
    method: 'PUT',
    body: JSON.stringify(playbackRequestBody(uri, positionMs)),
  })
}

export async function pausePlayback(deviceId: string): Promise<void> {
  await spotifyRequest<void>(`/me/player/pause?device_id=${encodeURIComponent(deviceId)}`, {
    method: 'PUT',
  })
}

export async function resumePlayback(deviceId: string): Promise<void> {
  await spotifyRequest<void>(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
    method: 'PUT',
  })
}

async function fetchPlaylistItemPage(
  playlistId: string,
  offset: number,
  limit: number,
): Promise<PlaylistItemPage> {
  try {
    return await spotifyRequest<PlaylistItemPage>(
      `/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}`,
    )
  } catch {
    return await spotifyRequest<PlaylistItemPage>(
      `/playlists/${playlistId}/items?limit=${limit}&offset=${offset}`,
    )
  }
}

function toPlayableTrack(
  row: PlaylistItemPage['items'][number],
  playlistId?: string,
): Track | null {
  if (row.is_local) {
    return null
  }
  const payload = row.item ?? row.track
  if (!payload || payload.type === 'episode' || !payload.id) {
    return null
  }
  if (!payload.uri?.startsWith('spotify:track:')) {
    return null
  }
  const title = payload.name?.trim()
  const artist = (payload.artists ?? [])
    .map((entry) => entry.name?.trim())
    .filter((name): name is string => Boolean(name))
    .join(', ')
  if (!title || !artist) {
    return null
  }
  const durationMs =
    typeof payload.duration_ms === 'number' && Number.isFinite(payload.duration_ms)
      ? Math.max(0, Math.round(payload.duration_ms))
      : 0
  const albumImageUrl = pickAlbumImageUrl(payload.album?.images)
  return {
    uri: payload.uri,
    title,
    artist,
    durationMs,
    ...(playlistId ? { playlistId } : {}),
    ...(albumImageUrl ? { albumImageUrl } : {}),
  }
}
