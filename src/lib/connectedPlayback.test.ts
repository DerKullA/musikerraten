import { describe, expect, it, vi } from 'vitest'
import { isConfirmedPaused, pauseConnectedPlayback, readSpotifyPaused } from '@/lib/connectedPlayback.ts'

describe('connectedPlayback', () => {
  it('gilt nur true als bestätigte Pause', () => {
    expect(isConfirmedPaused(true)).toBe(true)
    expect(isConfirmedPaused(false)).toBe(false)
    expect(isConfirmedPaused(null)).toBe(false)
  })

  it('pausiert Web-API und SDK parallel und schluckt Fehler', async () => {
    const pauseWeb = vi.fn().mockRejectedValue(new Error('web'))
    const player = { pause: vi.fn().mockRejectedValue(new Error('sdk')) }
    await expect(pauseConnectedPlayback('dev', player, pauseWeb)).resolves.toBeUndefined()
    expect(pauseWeb).toHaveBeenCalledWith('dev')
    expect(player.pause).toHaveBeenCalledTimes(1)
  })

  it('überspringt fehlende Geräte-ID und fehlenden Player', async () => {
    const pauseWeb = vi.fn().mockResolvedValue(undefined)
    await pauseConnectedPlayback(null, null, pauseWeb)
    expect(pauseWeb).not.toHaveBeenCalled()
  })

  it('liest den Pausenstatus aus dem Player-Zustand', async () => {
    expect(await readSpotifyPaused(null)).toBeNull()
    expect(await readSpotifyPaused({})).toBeNull()
    expect(await readSpotifyPaused({ getCurrentState: async () => null })).toBeNull()
    expect(await readSpotifyPaused({ getCurrentState: async () => ({}) })).toBeNull()
    expect(await readSpotifyPaused({ getCurrentState: async () => ({ paused: true }) })).toBe(true)
    expect(await readSpotifyPaused({ getCurrentState: async () => ({ paused: false }) })).toBe(false)
    expect(
      await readSpotifyPaused({
        getCurrentState: async () => {
          throw new Error('boom')
        },
      }),
    ).toBeNull()
  })
})
