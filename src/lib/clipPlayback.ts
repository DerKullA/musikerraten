export interface DelayClock {
  setTimeout(callback: () => void, delayMs: number): number
  clearTimeout(id: number): void
}

export interface CancellableDelay {
  wait: (delayMs: number) => Promise<void>
  cancel: () => void
}

interface DelayEntry {
  id: number
  finish: () => void
}

export interface BoundedClipHandlers {
  play: () => Promise<void>
  pause: () => Promise<void>
  isCancelled: () => boolean
  onPlayback: (state: 'playing' | 'paused') => void
  onError: (message: string) => void
}

export function createCancellableDelay(clock: DelayClock = browserDelayClock()): CancellableDelay {
  const pending = new Set<DelayEntry>()
  return {
    wait(delayMs: number) {
      if (delayMs <= 0) {
        return Promise.resolve()
      }
      return new Promise((resolve) => {
        const entry: DelayEntry = { id: 0, finish: () => undefined }
        const finish = () => {
          if (!pending.delete(entry)) {
            return
          }
          clock.clearTimeout(entry.id)
          resolve()
        }
        entry.finish = finish
        entry.id = clock.setTimeout(finish, delayMs)
        pending.add(entry)
      })
    },
    cancel() {
      for (const entry of [...pending]) {
        entry.finish()
      }
    },
  }
}

export async function runBoundedClip(
  durationMs: number,
  handlers: BoundedClipHandlers,
  wait: (delayMs: number) => Promise<void>,
): Promise<void> {
  if (durationMs <= 0 || handlers.isCancelled()) {
    return
  }
  handlers.onPlayback('playing')
  try {
    await handlers.play()
  } catch (cause) {
    await stopClip(handlers, cause)
    return
  }
  if (handlers.isCancelled()) {
    await safePause(handlers.pause)
    return
  }
  await wait(durationMs)
  await stopClip(handlers)
}

export async function holdPlaybackThen(
  durationMs: number,
  handlers: BoundedClipHandlers,
  wait: (delayMs: number) => Promise<void>,
  onAdvance: () => void,
): Promise<void> {
  if (durationMs <= 0 || handlers.isCancelled()) {
    return
  }
  handlers.onPlayback('playing')
  try {
    await handlers.play()
  } catch (cause) {
    handlers.onError(clipFailureMessage(cause))
    await releaseAfterReset(handlers)
    return
  }
  if (handlers.isCancelled()) {
    await safePause(handlers.pause)
    return
  }
  await wait(durationMs)
  await releaseAfterReset(handlers)
  if (!handlers.isCancelled()) {
    onAdvance()
  }
}

async function stopClip(handlers: BoundedClipHandlers, cause?: unknown): Promise<void> {
  if (!handlers.isCancelled() && cause !== undefined) {
    handlers.onError(clipFailureMessage(cause))
  }
  await releaseAfterReset(handlers)
}

async function releaseAfterReset(handlers: BoundedClipHandlers): Promise<void> {
  await safePause(handlers.pause)
  if (!handlers.isCancelled()) {
    handlers.onPlayback('paused')
  }
}

async function safePause(pause: () => Promise<void>): Promise<void> {
  try {
    await pause()
  } catch {
    // Ein fehlgeschlagener Pause-Versuch darf den nächsten Clip nicht blockieren.
  }
}

function clipFailureMessage(cause: unknown): string {
  if (cause instanceof Error && cause.message) {
    return cause.message
  }
  return 'Wiedergabe fehlgeschlagen.'
}

function browserDelayClock(): DelayClock {
  return {
    setTimeout(callback, delayMs) {
      return window.setTimeout(callback, delayMs)
    },
    clearTimeout(id) {
      window.clearTimeout(id)
    },
  }
}
