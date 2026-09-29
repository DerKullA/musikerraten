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
  type ActivePlaybackDevice,
} from './playbackDevice.ts'

const localId = 'musikerraten-device'
const phoneId = 'spotify-phone'

function active(deviceId: string | null, known = true): ActivePlaybackDevice {
  return { known, deviceId }
}

describe('readActiveDeviceId', () => {
  it('liest nur eine vorhandene Geräte-ID', () => {
    expect(readActiveDeviceId({ device: { id: phoneId } })).toBe(phoneId)
    expect(readActiveDeviceId({ device: { id: '  ' } })).toBeNull()
    expect(readActiveDeviceId({ device: null })).toBeNull()
    expect(readActiveDeviceId(undefined)).toBeNull()
  })
})

describe('needsPlaybackTransfer', () => {
  it('überträgt, wenn ein anderes Gerät aktiv ist', () => {
    expect(
      needsPlaybackTransfer({
        localDeviceId: localId,
        active: active(phoneId),
        previousTransferFailed: false,
      }),
    ).toBe(true)
  })

  it('lässt das eigene Gerät und eine stille Session in Ruhe', () => {
    expect(
      needsPlaybackTransfer({
        localDeviceId: localId,
        active: active(localId),
        previousTransferFailed: false,
      }),
    ).toBe(false)
    expect(
      needsPlaybackTransfer({
        localDeviceId: localId,
        active: active(null),
        previousTransferFailed: false,
      }),
    ).toBe(false)
  })

  it('holt die Wiedergabe erneut, wenn der letzte Transfer scheiterte oder der Status fehlt', () => {
    expect(
      needsPlaybackTransfer({
        localDeviceId: localId,
        active: active(localId),
        previousTransferFailed: true,
      }),
    ).toBe(true)
    expect(
      needsPlaybackTransfer({
        localDeviceId: localId,
        active: active(null, false),
        previousTransferFailed: false,
      }),
    ).toBe(true)
    expect(
      needsPlaybackTransfer({
        localDeviceId: '',
        active: active(phoneId),
        previousTransferFailed: true,
      }),
    ).toBe(false)
  })
})

describe('playbackDeviceClaimIsFresh', () => {
  it('gilt nur kurz für das bestätigte eigene Gerät', () => {
    expect(playbackDeviceClaimIsFresh(localId, localId, 1_000, 1_000)).toBe(true)
    expect(playbackDeviceClaimIsFresh(localId, localId, 1_000, 1_000 + PLAYBACK_DEVICE_FRESH_MS)).toBe(
      false,
    )
    expect(playbackDeviceClaimIsFresh(phoneId, localId, 1_000, 1_100)).toBe(false)
    expect(playbackDeviceClaimIsFresh(localId, localId, 1_500, 1_000)).toBe(false)
  })
})

describe('transferPlaybackBody', () => {
  it('legt die Wiedergabe auf ein Gerät, ohne sie dort zu starten', () => {
    expect(transferPlaybackBody(localId)).toEqual({
      device_ids: [localId],
      play: false,
    })
  })
})

describe('playbackTransferStillForeign', () => {
  it('erkennt ein fremdes aktives Gerät', () => {
    expect(playbackTransferStillForeign(phoneId, localId)).toBe(true)
    expect(playbackTransferStillForeign(localId, localId)).toBe(false)
    expect(playbackTransferStillForeign(null, localId)).toBe(false)
    expect(playbackDeviceMatches(localId, localId)).toBe(true)
  })
})

describe('isInactivePlaybackTransfer', () => {
  it('erkennt eine Spotify-Session ohne aktives Gerät', () => {
    expect(isInactivePlaybackTransfer('Player command failed: No active device found')).toBe(true)
    expect(isInactivePlaybackTransfer('{"error":{"reason":"NO_ACTIVE_DEVICE"}}')).toBe(true)
    expect(isInactivePlaybackTransfer('Restriction violated')).toBe(false)
  })
})
