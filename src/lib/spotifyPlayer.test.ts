import { describe, expect, it } from 'vitest'
import { spotifyPlayerOptions } from './spotifyPlayer.ts'

describe('spotifyPlayerOptions', () => {
  it('disables the Web Playback media session', () => {
    expect(spotifyPlayerOptions('Musikerraten').enableMediaSession).toBe(false)
  })
})
