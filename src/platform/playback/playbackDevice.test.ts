import { describe, expect, it } from 'vitest'
import {
  PLAYBACK_DEVICE_FRESH_MS,
  isInactivePlaybackTransfer,
  needsPlaybackTransfer,
  playbackDeviceClaimIsFresh,
  playbackDeviceMatches,
  playbackTransferStillForeign,
  readActiveDeviceId,
  transferPlaybackBody,
} from './playbackDevice.ts'

describe('playbackDevice', () => {
  it('liest die aktive Geräte-ID getrimmt oder null', () => {
    expect(readActiveDeviceId({ device: { id: ' abc ' } })).toBe('abc')
    expect(readActiveDeviceId({ device: { id: '  ' } })).toBeNull()
    expect(readActiveDeviceId({ device: { id: null } })).toBeNull()
    expect(readActiveDeviceId({ device: null })).toBeNull()
    expect(readActiveDeviceId(null)).toBeNull()
    expect(readActiveDeviceId(undefined)).toBeNull()
  })

  it('vergleicht lokale und aktive Geräte', () => {
    expect(playbackDeviceMatches('a', 'a')).toBe(true)
    expect(playbackDeviceMatches('a', 'b')).toBe(false)
    expect(playbackDeviceMatches(null, 'a')).toBe(false)
    expect(playbackDeviceMatches('', '')).toBe(false)
    expect(playbackTransferStillForeign('b', 'a')).toBe(true)
    expect(playbackTransferStillForeign('a', 'a')).toBe(false)
    expect(playbackTransferStillForeign(null, 'a')).toBe(false)
    expect(playbackTransferStillForeign('', 'a')).toBe(false)
  })

  it('entscheidet, wann ein Gerätewechsel nötig ist', () => {
    const base = { localDeviceId: 'local', active: { known: true, deviceId: 'local' }, previousTransferFailed: false }
    expect(needsPlaybackTransfer(base)).toBe(false)
    expect(needsPlaybackTransfer({ ...base, localDeviceId: '' })).toBe(false)
    expect(needsPlaybackTransfer({ ...base, localDeviceId: '', previousTransferFailed: true })).toBe(false)
    expect(needsPlaybackTransfer({ ...base, previousTransferFailed: true })).toBe(true)
    expect(needsPlaybackTransfer({ ...base, active: { known: false, deviceId: null } })).toBe(true)
    expect(needsPlaybackTransfer({ ...base, active: { known: true, deviceId: null } })).toBe(false)
    expect(needsPlaybackTransfer({ ...base, active: { known: true, deviceId: 'other' } })).toBe(true)
  })

  it('prüft die Frische einer Gerätebestätigung', () => {
    expect(playbackDeviceClaimIsFresh('a', 'a', 1_000, 1_000 + PLAYBACK_DEVICE_FRESH_MS - 1)).toBe(true)
    expect(playbackDeviceClaimIsFresh('a', 'a', 1_000, 1_000 + PLAYBACK_DEVICE_FRESH_MS)).toBe(false)
    expect(playbackDeviceClaimIsFresh('a', 'a', 1_000, 999)).toBe(false)
    expect(playbackDeviceClaimIsFresh('b', 'a', 1_000, 1_001)).toBe(false)
    expect(playbackDeviceClaimIsFresh('a', 'a', 1_000, 1_500, 400)).toBe(false)
  })

  it('baut den Transfer-Body und erkennt "kein aktives Gerät"', () => {
    expect(transferPlaybackBody('dev')).toEqual({ device_ids: ['dev'], play: false })
    expect(transferPlaybackBody('dev', true)).toEqual({ device_ids: ['dev'], play: true })
    expect(isInactivePlaybackTransfer('No active device found')).toBe(true)
    expect(isInactivePlaybackTransfer('NO_ACTIVE_DEVICE')).toBe(true)
    expect(isInactivePlaybackTransfer('Forbidden')).toBe(false)
  })
})
