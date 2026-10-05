import { afterEach, describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import {
  clientError,
  installClientLogger,
  reportClientError,
  reportClientWarning,
  resetClientLogForTests,
  setClientLogSenderForTests,
  type ClientLogHost,
} from './clientLog.ts'
import { redactSecrets, redactUrl } from './clientLogRedact.ts'

afterEach(() => {
  resetClientLogForTests()
})

describe('redactSecrets', () => {
  it('schwärzt Bearer und Token-Felder', () => {
    expect(redactSecrets('Authorization: Bearer abc.def')).toBe('Authorization: bearer [redacted]')
    expect(redactSecrets('access_token=geheim&ok=1')).toBe('access_token=[redacted]&ok=1')
    expect(redactSecrets('{"refresh_token":"zzz","id_token":"yyy"}')).toBe(
      '{"refresh_token":"[redacted]","id_token":"[redacted]"}',
    )
    expect(redactSecrets('client_secret: "s3cret"')).toBe('client_secret: "[redacted]"')
  })
})

describe('redactUrl', () => {
  it('schwärzt OAuth-Parameter in der Seiten-URL', () => {
    const page = redactUrl('https://musikerraten.wirsindgeil.com/?code=abc&state=xyz&next=1')
    expect(page).toContain('code=%5Bredacted%5D')
    expect(page).toContain('state=%5Bredacted%5D')
    expect(page).toContain('next=1')
    expect(page).not.toContain('abc')
    expect(page).not.toContain('xyz')
  })
})

describe('client logger', () => {
  it('sendet Fehler einmal und verschluckt einen toten Endpunkt', () => {
    const bodies: string[] = []
    setClientLogSenderForTests((body) => {
      bodies.push(body)
    })
    const error = clientError('Bearer super-token', {
      source: 'playback',
      action: 'play',
      uri: 'spotify:track:1',
      step: 'buffer',
    })
    reportClientError(error.message, { source: 'playback', action: 'play' }, error)
    expect(bodies).toHaveLength(1)
    const payload = JSON.parse(bodies[0] ?? '{}') as {
      level: string
      message: string
      context: { source?: string; action?: string; uri?: string }
    }
    expect(payload.level).toBe('error')
    expect(payload.message).toBe('bearer [redacted]')
    expect(payload.message).not.toContain('super-token')
    expect(payload.context).toEqual({
      source: 'playback',
      action: 'play',
      uri: 'spotify:track:1',
      step: 'buffer',
    })

    setClientLogSenderForTests(() => {
      throw new Error('offline')
    })
    expect(() => reportClientWarning('Hinweis')).not.toThrow()
  })

  it('fängt Konsole und unbehandelte Ablehnung ohne Doppelmeldung', () => {
    const bodies: string[] = []
    setClientLogSenderForTests((body) => {
      bodies.push(body)
    })
    const listeners = new Map<string, (event: Event) => void>()
    const host: ClientLogHost = {
      addEventListener: (type, listener) => {
        listeners.set(type, listener)
      },
      location: { href: 'https://musikerraten.wirsindgeil.com/' },
      navigator: { userAgent: 'test' },
      console: {
        error: () => undefined,
        warn: () => undefined,
      },
    }
    installClientLogger(host)
    installClientLogger(host)
    host.console.error('Wiedergabe fehlgeschlagen')
    host.console.warn('Puffer langsam')
    const rejection = new Event('unhandledrejection')
    Object.assign(rejection, { reason: new Error('Wiedergabe fehlgeschlagen') })
    listeners.get('unhandledrejection')?.(rejection)
    const levels = bodies.map((body) => {
      const parsed = JSON.parse(body) as { level: string; message: string }
      return { level: parsed.level, message: parsed.message }
    })
    expect(levels).toEqual([
      { level: 'error', message: 'Wiedergabe fehlgeschlagen' },
      { level: 'warning', message: 'Puffer langsam' },
    ])
  })

  it('lässt einen fehlgeschlagenen Fetch still durch', () => {
    const original = globalThis.fetch
    globalThis.fetch = () => Promise.reject(new Error('offline'))
    expect(() => clientError('Netz weg')).not.toThrow()
    globalThis.fetch = original
  })
})

describe('playbackLog', () => {
  it('ist entfernt', () => {
    expect(existsSync(new URL('./playbackLog.ts', import.meta.url))).toBe(false)
  })
})
