import { reportClientWarning } from '@/platform/diagnostics/clientLog.ts'

// Kein Video-Fallback: eine stumme Dauerschleife kann Medien-Sitzung und Spotify-Web-Playback
// stören. Fehlt die API (z. B. iOS Safari vor 16.4), bleibt der Bildschirm normal dimmbar.

export interface ScreenWakeLockSentinel {
  readonly released: boolean
  release(): Promise<void>
  addEventListener(type: 'release', listener: () => void): void
  removeEventListener(type: 'release', listener: () => void): void
}

export interface ScreenWakeLockController {
  request(type: 'screen'): Promise<ScreenWakeLockSentinel>
}

export interface ScreenWakeLockHost {
  readonly visibilityState: DocumentVisibilityState
  readonly wakeLock?: ScreenWakeLockController
  subscribeVisibility(listener: () => void): () => void
  subscribeGesture?(listener: () => void): () => void
}

export interface ScreenWakeLockSession {
  acquire(): Promise<void>
  release(): Promise<void>
}

type WakeLockWarn = (message: string, cause?: unknown) => void

/** Text für eine abgelehnte Wake-Lock-Anfrage, ohne die Meldung zu wiederholen. */
export function wakeLockFailureMessage(cause: unknown): string {
  const name = readErrorName(cause)
  if (name.length > 0) {
    return `Bildschirm-Wachhalter abgelehnt (${name})`
  }
  return 'Bildschirm-Wachhalter abgelehnt'
}

/** Schickt eine Wake-Lock-Ablehnung als Warnung an den Client-Logger. */
export function reportWakeLockFailure(message: string, cause?: unknown): void {
  reportClientWarning(message, { source: 'wake-lock', action: 'request', step: 'screen' }, cause)
}

/** Hält höchstens einen Bildschirm-Lock und holt ihn nach dem Aufwachen der Seite neu. */
export function createScreenWakeLockSession(
  host: ScreenWakeLockHost,
  warn: WakeLockWarn = reportWakeLockFailure,
): ScreenWakeLockSession {
  let desired = false
  let warned = false
  let epoch = 0
  let sentinel: ScreenWakeLockSentinel | null = null
  let pending: Promise<void> | null = null
  let unsubscribe: (() => void) | null = null

  function acquire(): Promise<void> {
    desired = true
    if (!host.wakeLock) {
      return Promise.resolve()
    }
    ensureSubscribed()
    return requestLock()
  }

  function release(): Promise<void> {
    desired = false
    epoch += 1
    const current = detachSentinel()
    clearSubscription()
    if (!current) {
      warned = false
      return Promise.resolve()
    }
    return discard(current).finally(() => {
      warned = false
    })
  }

  function requestLock(): Promise<void> {
    if (pending) {
      return pending.then(requestAgain)
    }
    if (!canRequest()) {
      return Promise.resolve()
    }
    const api = host.wakeLock
    if (!api) {
      return Promise.resolve()
    }
    const epochAtStart = epoch
    pending = ask(api, epochAtStart).finally(() => {
      pending = null
    })
    return pending
  }

  function requestAgain(): Promise<void> {
    if (!canRequest()) {
      return Promise.resolve()
    }
    return requestLock()
  }

  async function ask(api: ScreenWakeLockController, epochAtStart: number): Promise<void> {
    try {
      const next = await api.request('screen')
      if (!desired || epochAtStart !== epoch || !isPageVisible(host) || next.released) {
        await discard(next)
        return
      }
      remember(next)
    } catch (cause) {
      if (desired && epochAtStart === epoch) {
        warnOnce(cause)
      }
    }
  }

  function canRequest(): boolean {
    return desired && isPageVisible(host) && host.wakeLock !== undefined && !isHeld()
  }

  function isHeld(): boolean {
    if (!sentinel) {
      return false
    }
    if (!sentinel.released) {
      return true
    }
    forgetSentinel()
    return false
  }

  function remember(next: ScreenWakeLockSentinel): void {
    sentinel = next
    next.addEventListener('release', forgetSentinel)
  }

  function detachSentinel(): ScreenWakeLockSentinel | null {
    const current = sentinel
    sentinel = null
    if (!current) {
      return null
    }
    current.removeEventListener('release', forgetSentinel)
    return current
  }

  function forgetSentinel(): void {
    const current = sentinel
    if (!current) {
      return
    }
    sentinel = null
    current.removeEventListener('release', forgetSentinel)
  }

  async function discard(current: ScreenWakeLockSentinel): Promise<void> {
    current.removeEventListener('release', forgetSentinel)
    if (current.released) {
      return
    }
    try {
      await current.release()
    } catch {
      // Der Browser hat den Lock bereits freigegeben.
    }
  }

  function ensureSubscribed(): void {
    if (unsubscribe) {
      return
    }
    const stopVisibility = host.subscribeVisibility(onVisibility)
    const stopGesture = host.subscribeGesture ? host.subscribeGesture(onGesture) : () => undefined
    unsubscribe = () => {
      stopVisibility()
      stopGesture()
    }
  }

  function clearSubscription(): void {
    unsubscribe?.()
    unsubscribe = null
  }

  function onVisibility(): void {
    if (!desired || !isPageVisible(host)) {
      return
    }
    void requestLock()
  }

  function onGesture(): void {
    if (!desired || isHeld()) {
      return
    }
    void requestLock()
  }

  function warnOnce(cause: unknown): void {
    if (warned) {
      return
    }
    warned = true
    try {
      warn(wakeLockFailureMessage(cause), cause)
    } catch {
      // Der Logger darf die Runde nicht unterbrechen.
    }
  }

  return { acquire, release }
}

function isPageVisible(host: ScreenWakeLockHost): boolean {
  return host.visibilityState === 'visible'
}

function readErrorName(cause: unknown): string {
  if (typeof cause !== 'object' || cause === null || !('name' in cause)) {
    return ''
  }
  return typeof cause.name === 'string' ? cause.name : ''
}
