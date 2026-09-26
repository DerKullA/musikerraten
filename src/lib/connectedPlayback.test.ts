import { describe, expect, it } from 'vitest'
import { isConfirmedPaused, pauseConnectedPlayback, readSpotifyPaused } from './connectedPlayback.ts'

describe('pauseConnectedPlayback', () => {
  it('pausiert Web-API und SDK, auch wenn die Web-API scheitert', async () => {
    const calls: string[] = []
    await pauseConnectedPlayback(
      'device',
      {
        pause: async () => {
          calls.push('sdk')
        },
      },
      async () => {
        calls.push('web')
        throw new Error('403')
      },
    )
    expect(calls).toEqual(['web', 'sdk'])
  })

  it('pausiert nur den SDK-Player, wenn keine Device-ID da ist', async () => {
    const calls: string[] = []
    await pauseConnectedPlayback(
      null,
      {
        pause: async () => {
          calls.push('sdk')
        },
      },
      async () => {
        calls.push('web')
      },
    )
    expect(calls).toEqual(['sdk'])
  })
})

describe('isConfirmedPaused', () => {
  it('erkennt nur eine bestätigte Pause', () => {
    expect(isConfirmedPaused(true)).toBe(true)
    expect(isConfirmedPaused(false)).toBe(false)
    expect(isConfirmedPaused(null)).toBe(false)
  })
})

describe('readSpotifyPaused', () => {
  it('liest paused und behandelt fehlenden Zustand als unbekannt', async () => {
    expect(await readSpotifyPaused(null)).toBeNull()
    expect(await readSpotifyPaused({})).toBeNull()
    expect(await readSpotifyPaused({ getCurrentState: async () => ({ paused: true }) })).toBe(true)
    expect(await readSpotifyPaused({ getCurrentState: async () => ({ paused: false }) })).toBe(false)
    expect(await readSpotifyPaused({ getCurrentState: async () => null })).toBeNull()
    expect(await readSpotifyPaused({ getCurrentState: async () => ({}) })).toBeNull()
    expect(
      await readSpotifyPaused({
        getCurrentState: async () => {
          throw new Error('weg')
        },
      }),
    ).toBeNull()
  })
})