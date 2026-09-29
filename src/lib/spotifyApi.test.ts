import { describe, expect, it } from 'vitest'
import { playbackRequestBody, playlistItemsPath } from './spotifyApi.ts'

describe('playlistItemsPath', () => {
  it('lädt Playlist-Inhalte über den aktuellen Items-Endpunkt', () => {
    expect(playlistItemsPath('playlist-1', 50, 50)).toBe(
      '/playlists/playlist-1/items?limit=50&offset=50',
    )
  })
})

describe('playbackRequestBody', () => {
  it('hängt den Folgesong an, damit er ohne Neustart bereitsteht', () => {
    expect(playbackRequestBody('spotify:track:a', 0, 'spotify:track:b')).toEqual({
      uris: ['spotify:track:a', 'spotify:track:b'],
      position_ms: 0,
    })
  })

  it('spielt einen einzelnen Song, wenn kein anderer folgt', () => {
    expect(playbackRequestBody('spotify:track:a', 1_250)).toEqual({
      uris: ['spotify:track:a'],
      position_ms: 1_250,
    })
    expect(playbackRequestBody('spotify:track:a', 0, 'spotify:track:a').uris).toEqual(['spotify:track:a'])
  })
})
