import {
  createScreenWakeLockSession,
  type ScreenWakeLockController,
  type ScreenWakeLockHost,
  type ScreenWakeLockSession,
} from './screenWakeLock.ts'

/** Effekt von useWakeLock: anfordern, solange die Runde läuft, sonst freigeben. */
export function runWakeLockEffect(active: boolean): () => void {
  if (!active) {
    releaseScreenWakeLock()
    return () => undefined
  }
  holdScreenWakeLock()
  return () => {
    releaseScreenWakeLock()
  }
}

/** Fordert den Lock an. Gedacht für den Start-/Play-Klick, noch im Gesten-Aufruf. */
export function holdScreenWakeLock(): void {
  void sharedBrowserSession().acquire()
}

/** Gibt den Lock frei, falls eine Runde ihn zuvor angefordert hat. */
export function releaseScreenWakeLock(): void {
  if (!browserSession) {
    return
  }
  void browserSession.release()
}

/** Setzt die gemeinsame Sitzung zurück. Nur für Tests. */
export function resetScreenWakeLockForTests(): void {
  const current = browserSession
  browserSession = null
  if (current) {
    void current.release()
  }
}

function sharedBrowserSession(): ScreenWakeLockSession {
  browserSession ??= createBrowserWakeLockSession()
  return browserSession
}

let browserSession: ScreenWakeLockSession | null = null

function createBrowserWakeLockSession(): ScreenWakeLockSession {
  if (typeof document === 'undefined' || typeof navigator === 'undefined') {
    return idleWakeLockSession()
  }
  return createScreenWakeLockSession(browserWakeLockHost())
}

function idleWakeLockSession(): ScreenWakeLockSession {
  return {
    acquire() {
      return Promise.resolve()
    },
    release() {
      return Promise.resolve()
    },
  }
}

function browserWakeLockHost(): ScreenWakeLockHost {
  return {
    get visibilityState() {
      return document.visibilityState
    },
    get wakeLock() {
      return readBrowserWakeLock()
    },
    subscribeVisibility(listener) {
      const onChange = () => {
        listener()
      }
      document.addEventListener('visibilitychange', onChange)
      return () => {
        document.removeEventListener('visibilitychange', onChange)
      }
    },
    subscribeGesture(listener) {
      const onPointer = () => {
        listener()
      }
      document.addEventListener('pointerdown', onPointer, true)
      return () => {
        document.removeEventListener('pointerdown', onPointer, true)
      }
    },
  }
}

function readBrowserWakeLock(): ScreenWakeLockController | undefined {
  if (!('wakeLock' in navigator) || !navigator.wakeLock || typeof navigator.wakeLock.request !== 'function') {
    return undefined
  }
  const wakeLock = navigator.wakeLock
  return {
    request(type) {
      return wakeLock.request(type)
    },
  }
}
