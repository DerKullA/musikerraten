import type { Playlist, Track } from '../types.ts'
import { pickAlbumImageUrl, type AlbumImage } from './albumArt.ts'
import {
  PLAYBACK_TRANSFER_CONFIRM_MS,
  PLAYBACK_TRANSFER_CONFIRM_POLLS,
  isInactivePlaybackTransfer,
  needsPlaybackTransfer,
  playbackDeviceClaimIsFresh,
  playbackDeviceMatches,
  playbackTransferStillForeign,
  readActiveDeviceId,
  transferPlaybackBody,
  type ActivePlaybackDevice,
  type PlaybackClaimResult,
} from './playbackDevice.ts'
import { clientError, reportClientError, type ClientLogContext } from './clientLog.ts'
import { getValidAccessToken } from './spotifyAuth.ts'

const API = 'https://api.spotify.com/v1'

interface PlaylistPage {
  items: Array<{
    id: string
    name: string
    owner?: { display_name?: string }
    images?: AlbumImage[] | null
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
    const message = text || `Spotify-Fehler ${response.status}`
    throw new Error(message)
  }
  const body = await response.text()
  if (isPlayerCommand(init) && !looksLikeJson(body)) {
    // Spotify bestätigt Player-Befehle mit 200 und einer Kennung statt JSON.
    return undefined as T
  }
  return JSON.parse(body) as T
}

function isPlayerCommand(init: RequestInit): boolean {
  const method = init.method?.toUpperCase() ?? 'GET'
  return method !== 'GET'
}

function looksLikeJson(body: string): boolean {
  const first = body.trimStart().charAt(0)
  return first === '{' || first === '['
}

/** Meldet einen fehlgeschlagenen Player-Aufruf und wirft ihn weiter. */
function playerRequest<T>(path: string, init: RequestInit, context: ClientLogContext): Promise<T> {
  return spotifyRequest<T>(path, init).catch((cause: unknown) => {
    const message = cause instanceof Error && cause.message ? cause.message : 'Spotify-Fehler'
    throw clientError(message, { ...context, source: 'playback' })
  })
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
        imageUrl: pickAlbumImageUrl(item.images ?? undefined),
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

export function playlistItemsPath(playlistId: string, offset: number, limit: number): string {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  })
  return `/playlists/${encodeURIComponent(playlistId)}/items?${params.toString()}`
}

export function playbackRequestBody(
  uri: string,
  positionMs = 0,
  followingUri?: string,
): { uris: string[]; position_ms: number } {
  const position = Number.isFinite(positionMs) ? Math.max(0, Math.floor(positionMs)) : 0
  const uris = followingUri && followingUri !== uri ? [uri, followingUri] : [uri]
  return { uris, position_ms: position }
}

export async function startPlayback(
  deviceId: string,
  uri: string,
  positionMs = 0,
  followingUri?: string,
): Promise<void> {
  await playerRequest<void>(
    `/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
    {
      method: 'PUT',
      body: JSON.stringify(playbackRequestBody(uri, positionMs, followingUri)),
    },
    { action: 'api', step: '/me/player/play', uri },
  )
  void ensureLinearPlayback(deviceId)
}

export interface PlaybackDeviceClaimContext {
  uri?: string | null
  phase?: string
  mute?: () => Promise<void>
  nowMs?: number
  sleep?: (delayMs: number) => Promise<void>
}

let playbackTransferFailed = false
let confirmedPlaybackDeviceId: string | null = null
let confirmedPlaybackDeviceAtMs = 0

interface SpotifyPlayerPayload {
  device?: {
    id?: string | null
  } | null
}

function rememberConfirmedPlaybackDevice(deviceId: string): void {
  playbackTransferFailed = false
  confirmedPlaybackDeviceId = deviceId
  confirmedPlaybackDeviceAtMs = Date.now()
}

function clearConfirmedPlaybackDevice(): void {
  confirmedPlaybackDeviceId = null
  confirmedPlaybackDeviceAtMs = 0
}

async function readActivePlaybackDevice(): Promise<ActivePlaybackDevice> {
  try {
    const playback = await spotifyRequest<SpotifyPlayerPayload | undefined>('/me/player')
    return { known: true, deviceId: readActiveDeviceId(playback) }
  } catch {
    return { known: false, deviceId: null }
  }
}

async function pauseForeignPlayback(deviceId: string): Promise<void> {
  await spotifyRequest<void>(`/me/player/pause?device_id=${encodeURIComponent(deviceId)}`, { method: 'PUT' })
}

export async function ensurePlaybackOnDevice(
  deviceId: string,
  context: PlaybackDeviceClaimContext = {},
): Promise<PlaybackClaimResult> {
  const nowMs = context.nowMs ?? Date.now()
  if (
    !playbackTransferFailed &&
    playbackDeviceClaimIsFresh(confirmedPlaybackDeviceId, deviceId, confirmedPlaybackDeviceAtMs, nowMs)
  ) {
    return 'local'
  }

  const active = await readActivePlaybackDevice()
  if (
    !needsPlaybackTransfer({
      localDeviceId: deviceId,
      active,
      previousTransferFailed: playbackTransferFailed,
    })
  ) {
    if (playbackDeviceMatches(active.deviceId, deviceId)) {
      rememberConfirmedPlaybackDevice(deviceId)
      return 'local'
    }
    return 'idle'
  }

  await context.mute?.().catch(() => undefined)
  if (active.deviceId && playbackTransferStillForeign(active.deviceId, deviceId)) {
    await pauseForeignPlayback(active.deviceId).catch(() => undefined)
  }

  try {
    await playerRequest<void>(
      '/me/player',
      {
        method: 'PUT',
        body: JSON.stringify(transferPlaybackBody(deviceId)),
      },
      { action: 'transfer', step: 'transfer', uri: context.uri, phase: context.phase },
    )
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : ''
    playbackTransferFailed = !isInactivePlaybackTransfer(message)
    if (playbackTransferFailed) {
      clearConfirmedPlaybackDevice()
    }
    return 'transferred'
  }

  const sleep = context.sleep ?? wait
  let seenDeviceId: string | null = null
  for (let attempt = 0; attempt < PLAYBACK_TRANSFER_CONFIRM_POLLS; attempt += 1) {
    const snapshot = await readActivePlaybackDevice()
    seenDeviceId = snapshot.deviceId
    if (playbackDeviceMatches(snapshot.deviceId, deviceId)) {
      rememberConfirmedPlaybackDevice(deviceId)
      return 'transferred'
    }
    if (attempt < PLAYBACK_TRANSFER_CONFIRM_POLLS - 1) {
      await sleep(PLAYBACK_TRANSFER_CONFIRM_MS)
    }
  }

  if (playbackTransferStillForeign(seenDeviceId, deviceId)) {
    playbackTransferFailed = true
    clearConfirmedPlaybackDevice()
    reportClientError('Die Wiedergabe liegt noch auf einem anderen Gerät.', {
      source: 'playback',
      action: 'transfer',
      step: 'transfer',
      uri: context.uri,
      phase: context.phase,
    })
    return 'transferred'
  }

  playbackTransferFailed = false
  return 'transferred'
}

function wait(delayMs: number): Promise<void> {
  if (delayMs <= 0) {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs)
  })
}

export async function queuePlayback(deviceId: string, uri: string): Promise<void> {
  const params = new URLSearchParams({
    uri,
    device_id: deviceId,
  })
  await playerRequest<void>(
    `/me/player/queue?${params.toString()}`,
    { method: 'POST' },
    { action: 'api', step: '/me/player/queue', uri },
  )
}

export async function pausePlayback(deviceId: string): Promise<void> {
  await playerRequest<void>(
    `/me/player/pause?device_id=${encodeURIComponent(deviceId)}`,
    { method: 'PUT' },
    { action: 'api', step: '/me/player/pause' },
  )
}

export async function resumePlayback(deviceId: string): Promise<void> {
  await playerRequest<void>(
    `/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
    { method: 'PUT' },
    { action: 'api', step: '/me/player/play' },
  )
}

async function fetchPlaylistItemPage(
  playlistId: string,
  offset: number,
  limit: number,
): Promise<PlaylistItemPage> {
  return await spotifyRequest<PlaylistItemPage>(playlistItemsPath(playlistId, offset, limit))
}

let linearPlaybackReady = false

async function ensureLinearPlayback(deviceId: string): Promise<void> {
  if (linearPlaybackReady) {
    return
  }
  linearPlaybackReady = true
  const device = encodeURIComponent(deviceId)
  try {
    await playerRequest<void>(
      `/me/player/shuffle?state=false&device_id=${device}`,
      { method: 'PUT' },
      { action: 'api', step: '/me/player/shuffle' },
    )
    await playerRequest<void>(
      `/me/player/repeat?state=off&device_id=${device}`,
      { method: 'PUT' },
      { action: 'api', step: '/me/player/repeat' },
    )
  } catch {
    // Ein fehlgeschlagener Moduswechsel darf den nächsten Song nicht blockieren.
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
