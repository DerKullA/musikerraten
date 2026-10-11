import { afterEach, describe, expect, it } from 'vitest'
import { resetClientLogForTests, setClientLogSenderForTests } from '@/platform/diagnostics/clientLog.ts'
import { holdScreenWakeLock, resetScreenWakeLockForTests, runWakeLockEffect } from './browserWakeLock.ts'
import { createScreenWakeLockSession, reportWakeLockFailure, wakeLockFailureMessage } from './screenWakeLock.ts'
import { useWakeLock } from './useWakeLock.ts'
import {
  createSentinel,
  flushWakeLock,
  hideBrowserGlobals,
  installWakeLockDocument,
  namedError,
  restoreWakeLockDocument,
  type SentinelProbe,
} from './wakeLockFixture.ts'

afterEach(() => {
  resetScreenWakeLockForTests()
  resetClientLogForTests()
  restoreWakeLockDocument()
})

describe('useWakeLock', () => {
  it('exportiert den Hook', () => {
    expect(useWakeLock.name).toBe('useWakeLock')
  })

  it('fordert navigator.wakeLock beim Start an und gibt ihn am Rundenende frei', async () => {
    const seen: string[] = []
    const sentinel = createSentinel()
    installWakeLockDocument({
      request(type) {
        seen.push(type)
        return Promise.resolve(sentinel)
      },
    })

    runWakeLockEffect(false)
    await flushWakeLock()
    expect(seen).toEqual([])

    holdScreenWakeLock()
    const stop = runWakeLockEffect(true)
    await flushWakeLock()
    expect(seen).toEqual(['screen'])

    stop()
    await flushWakeLock()
    expect(sentinel.released).toBe(true)
    expect(sentinel.listenerCount).toBe(0)
  })

  it('holt den Lock nach visibilitychange erneut, wenn die Seite wieder sichtbar ist', async () => {
    const sentinels: SentinelProbe[] = []
    const browser = installWakeLockDocument({
      request() {
        const sentinel = createSentinel()
        sentinels.push(sentinel)
        return Promise.resolve(sentinel)
      },
    })

    holdScreenWakeLock()
    await flushWakeLock()
    sentinels[0]?.browserRelease()
    browser.hide()
    await flushWakeLock()
    expect(sentinels).toHaveLength(1)

    browser.show()
    await flushWakeLock()
    expect(sentinels).toHaveLength(2)
    expect(sentinels[1]?.released).toBe(false)
  })

  it('warnt einmal, wenn die Anfrage scheitert, und versucht es beim nächsten Tipp erneut', async () => {
    const warnings: string[] = []
    const bodies: string[] = []
    setClientLogSenderForTests((body) => {
      bodies.push(body)
    })
    let fail = true
    const browser = installWakeLockDocument({
      request() {
        if (fail) {
          return Promise.reject(namedError('NotAllowedError'))
        }
        return Promise.resolve(createSentinel())
      },
    })

    const session = createScreenWakeLockSession(browser.host, (message) => {
      warnings.push(message)
    })
    await session.acquire()
    browser.show()
    await flushWakeLock()
    expect(warnings).toEqual(['Bildschirm-Wachhalter abgelehnt (NotAllowedError)'])

    fail = false
    browser.tap()
    await flushWakeLock()
    expect(warnings).toHaveLength(1)

    reportWakeLockFailure(wakeLockFailureMessage(namedError('NotAllowedError')))
    const payload = JSON.parse(bodies[0] ?? '{}') as { level: string; message: string }
    expect(payload.level).toBe('warning')
    expect(payload.message).toContain('NotAllowedError')
  })
})

describe('Screen Wake Lock', () => {
  it('bleibt still, wenn der Browser keinen Wake Lock kennt', async () => {
    const warnings: string[] = []
    const session = createScreenWakeLockSession(installWakeLockDocument(undefined).host, (message) => {
      warnings.push(message)
    })
    await expect(session.acquire()).resolves.toBeUndefined()
    await expect(session.release()).resolves.toBeUndefined()
    expect(warnings).toEqual([])
  })

  it('fordert nicht an, solange die Seite verborgen ist', async () => {
    let requests = 0
    const probe = installWakeLockDocument({
      request() {
        requests += 1
        return Promise.resolve(createSentinel())
      },
    })
    probe.hide()
    const session = createScreenWakeLockSession(probe.host, () => undefined)
    await session.acquire()
    expect(requests).toBe(0)
    probe.show()
    await flushWakeLock()
    expect(requests).toBe(1)
  })

  it('verwirft eine Anfrage, die nach dem Freigeben noch eintrifft', async () => {
    const gates: Array<(sentinel: SentinelProbe) => void> = []
    const probe = installWakeLockDocument({
      request() {
        return new Promise((resolve) => {
          gates.push(resolve)
        })
      },
    })
    const session = createScreenWakeLockSession(probe.host, () => undefined)
    const first = session.acquire()
    const stopped = session.release()
    const stale = createSentinel()
    gates[0]?.(stale)
    await first
    await stopped
    expect(stale.released).toBe(true)

    const second = session.acquire()
    const fresh = createSentinel()
    gates[1]?.(fresh)
    await second
    probe.tap()
    await flushWakeLock()
    expect(fresh.released).toBe(false)
    expect(gates).toHaveLength(2)
  })

  it('wirft nicht, wenn release oder der Logger scheitert', async () => {
    let attempt = 0
    const probe = installWakeLockDocument({
      request() {
        attempt += 1
        if (attempt === 1) {
          return Promise.reject(namedError('NotAllowedError'))
        }
        const sentinel = createSentinel()
        sentinel.release = () => Promise.reject(new Error('weg'))
        return Promise.resolve(sentinel)
      },
    })
    const session = createScreenWakeLockSession(probe.host, () => {
      throw new Error('log tot')
    })
    await expect(session.acquire()).resolves.toBeUndefined()
    await expect(session.acquire()).resolves.toBeUndefined()
    await expect(session.release()).resolves.toBeUndefined()
  })

  it('reagiert nach dem Freigeben nicht mehr auf Sichtbarkeit', async () => {
    let requests = 0
    const probe = installWakeLockDocument({
      request() {
        requests += 1
        return Promise.resolve(createSentinel())
      },
    })
    const session = createScreenWakeLockSession(probe.host, () => undefined)
    await session.acquire()
    await session.release()
    probe.show()
    probe.tap()
    await flushWakeLock()
    expect(requests).toBe(1)
  })

  it('macht ohne document nichts', async () => {
    hideBrowserGlobals()
    holdScreenWakeLock()
    const stop = runWakeLockEffect(true)
    await flushWakeLock()
    stop()
    await flushWakeLock()
  })
})
