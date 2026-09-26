import { describe, expect, it } from 'vitest'
import { playbackRequestBody } from './spotifyApi.ts'

describe('playbackRequestBody', () => {
  it('startet standardmäßig am Anfang und übernimmt eine Suchposition', () => {
    expect(playbackRequestBody('spotify:track:1')).toEqual({
      uris: ['spotify:track:1'],
      position_ms: 0,
    })
    expect(playbackRequestBody('spotify:track:1', 54_000.8)).toEqual({
      uris: ['spotify:track:1'],
      position_ms: 54_000,
    })
    expect(playbackRequestBody('spotify:track:1', -20).position_ms).toBe(0)
  })
})
