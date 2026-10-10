import type { ScreenWakeLockController, ScreenWakeLockHost, ScreenWakeLockSentinel } from './screenWakeLock.ts'

export interface SentinelProbe extends Omit<ScreenWakeLockSentinel, 'release'> {
  listenerCount: number
  release: () => Promise<void>
  browserRelease(): void
}

export interface HostProbe {
  host: ScreenWakeLockHost
  hide(): void
  show(): void
  tap(): void
}

interface GlobalSnapshot {
  hadDocument: boolean
  hadNavigator: boolean
  document: unknown
  navigator: unknown
}

const snapshots: GlobalSnapshot[] = []

/** Setzt document und navigator für einen Wake-Lock-Test und merkt den vorigen Stand. */
export function installWakeLockDocument(wakeLock: ScreenWakeLockController | undefined): HostProbe {
  snapshots.push(captureGlobals())
  let visibilityState: DocumentVisibilityState = 'visible'
  const visibility = new Set<() => void>()
  const pointer = new Set<() => void>()
  defineGlobal('document', {
    get visibilityState() {
      return visibilityState
    },
    addEventListener(type: string, listener: () => void) {
      if (type === 'visibilitychange') {
        visibility.add(listener)
      }
      if (type === 'pointerdown') {
        pointer.add(listener)
      }
    },
    removeEventListener(type: string, listener: () => void) {
      if (type === 'visibilitychange') {
        visibility.delete(listener)
      }
      if (type === 'pointerdown') {
        pointer.delete(listener)
      }
    },
  })
  defineGlobal('navigator', wakeLock ? { wakeLock } : {})
  const host: ScreenWakeLockHost = {
    get visibilityState() {
      return visibilityState
    },
    wakeLock,
    subscribeVisibility(listener) {
      visibility.add(listener)
      return () => {
        visibility.delete(listener)
      }
    },
    subscribeGesture(listener) {
      pointer.add(listener)
      return () => {
        pointer.delete(listener)
      }
    },
  }
  return {
    host,
    hide() {
      visibilityState = 'hidden'
      notify(visibility)
    },
    show() {
      visibilityState = 'visible'
      notify(visibility)
    },
    tap() {
      notify(pointer)
    },
  }
}

/** Entfernt document und navigator, als liefe der Code ohne Browser. */
export function hideBrowserGlobals(): void {
  snapshots.push(captureGlobals())
  defineGlobal('document', undefined)
  defineGlobal('navigator', undefined)
}

/** Stellt document und navigator nach einem Test wieder her. */
export function restoreWakeLockDocument(): void {
  const snapshot = snapshots.pop()
  if (!snapshot) {
    return
  }
  writeGlobal('document', snapshot.hadDocument, snapshot.document)
  writeGlobal('navigator', snapshot.hadNavigator, snapshot.navigator)
}

/** Baut einen Sentinel, dessen release-Event die Hörer synchron erreicht. */
export function createSentinel(): SentinelProbe {
  let released = false
  const listeners = new Set<() => void>()
  return {
    get released() {
      return released
    },
    get listenerCount() {
      return listeners.size
    },
    release() {
      released = true
      notify(listeners)
      return Promise.resolve()
    },
    addEventListener(_type, listener) {
      listeners.add(listener)
    },
    removeEventListener(_type, listener) {
      listeners.delete(listener)
    },
    browserRelease() {
      if (released) {
        return
      }
      released = true
      notify(listeners)
    },
  }
}

/** Fehler mit festem Namen, analog zu DOMException. */
export function namedError(name: string): Error {
  const error = new Error('blocked')
  error.name = name
  return error
}

/** Lässt angefangene Wake-Lock-Promises durch. */
export async function flushWakeLock(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

function notify(listeners: Set<() => void>): void {
  for (const listener of listeners) {
    listener()
  }
}

function captureGlobals(): GlobalSnapshot {
  return {
    hadDocument: 'document' in globalThis,
    hadNavigator: 'navigator' in globalThis,
    document: globalThis.document,
    navigator: globalThis.navigator,
  }
}

function defineGlobal(key: 'document' | 'navigator', value: unknown): void {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
}

function writeGlobal(key: 'document' | 'navigator', had: boolean, value: unknown): void {
  if (!had) {
    delete (globalThis as { document?: unknown; navigator?: unknown })[key]
    return
  }
  defineGlobal(key, value)
}
