import { describe, expect, it, vi } from 'vitest'
import {
  logPlaybackError,
  rememberPlaybackLog,
  reportPlaybackFailure,
  sanitizePlaybackText,
  wasPlaybackLogged,
} from './playbackLog.ts'

describe('sanitizePlaybackText', () => {
  it('entfernt Tokens und behält die Song-URI', () => {
    const raw =
      'Bearer BQAccessToken123 playback access_token=secret-value uri=spotify:track:abc refresh_token: "refresh-secret"'
    const clean = sanitizePlaybackText(raw)
    expect(clean).toContain('spotify:track:abc')
    expect(clean).not.toContain('BQAccessToken123')
    expect(clean).not.toContain('secret-value')
    expect(clean).not.toContain('refresh-secret')
    expect(clean).toContain('bearer [redacted]')
    expect(clean).toContain('[redacted]')
  })
})

describe('logPlaybackError', () => {
  it('schreibt URI, Aktion und Phase ohne Secret', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    logPlaybackError('Der Song hat nicht gestartet. Bearer abc.def.ghi', {
      uri: 'spotify:track:song',
      action: 'play',
      phase: 'playing',
      step: 'buffer',
    })
    const line = JSON.stringify(error.mock.calls)
    expect(line).toContain('spotify:track:song')
    expect(line).toContain('play')
    expect(line).toContain('playing')
    expect(line).toContain('buffer')
    expect(line).not.toContain('abc.def.ghi')
    error.mockRestore()
  })
})

describe('reportPlaybackFailure', () => {
  it('merkt sich den geloggten Fehler für die UI', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const failure = reportPlaybackFailure('SDK kaputt', { action: 'sdk', step: 'connect' })
    expect(failure.message).toBe('SDK kaputt')
    expect(wasPlaybackLogged(failure)).toBe(true)
    rememberPlaybackLog(failure)
    expect(wasPlaybackLogged(new Error('SDK kaputt'))).toBe(false)
    error.mockRestore()
  })
})
