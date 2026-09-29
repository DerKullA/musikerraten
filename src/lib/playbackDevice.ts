export const PLAYBACK_DEVICE_FRESH_MS = 1_200
export const PLAYBACK_TRANSFER_CONFIRM_POLLS = 12
export const PLAYBACK_TRANSFER_CONFIRM_MS = 250

export type PlaybackClaimResult = 'local' | 'transferred' | 'idle'

export interface ActivePlaybackDevice {
  known: boolean
  deviceId: string | null
}

export interface PlaybackTransferDecision {
  localDeviceId: string
  active: ActivePlaybackDevice
  previousTransferFailed: boolean
}

export function readActiveDeviceId(
  playback: { device?: { id?: string | null } | null } | null | undefined,
): string | null {
  const id = playback?.device?.id
  if (typeof id !== 'string') {
    return null
  }
  const trimmed = id.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function playbackDeviceMatches(activeDeviceId: string | null, localDeviceId: string): boolean {
  return localDeviceId.length > 0 && activeDeviceId === localDeviceId
}

export function playbackTransferStillForeign(activeDeviceId: string | null, localDeviceId: string): boolean {
  return activeDeviceId !== null && activeDeviceId.length > 0 && activeDeviceId !== localDeviceId
}

export function needsPlaybackTransfer(input: PlaybackTransferDecision): boolean {
  if (input.localDeviceId.length === 0) {
    return false
  }
  if (input.previousTransferFailed) {
    return true
  }
  if (!input.active.known) {
    return true
  }
  if (input.active.deviceId === null) {
    return false
  }
  return input.active.deviceId !== input.localDeviceId
}

export function playbackDeviceClaimIsFresh(
  confirmedDeviceId: string | null,
  localDeviceId: string,
  confirmedAtMs: number,
  nowMs: number,
  freshMs = PLAYBACK_DEVICE_FRESH_MS,
): boolean {
  if (!playbackDeviceMatches(confirmedDeviceId, localDeviceId)) {
    return false
  }
  const ageMs = nowMs - confirmedAtMs
  return ageMs >= 0 && ageMs < freshMs
}

export function transferPlaybackBody(deviceId: string): { device_ids: string[]; play: false } {
  return { device_ids: [deviceId], play: false }
}

export function isInactivePlaybackTransfer(message: string): boolean {
  return /no active device|NO_ACTIVE_DEVICE/i.test(message)
}
