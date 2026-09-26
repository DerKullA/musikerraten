// Spotify darf einen Play-Befehl nach der Pause ausführen. Solange Stille gilt,
// wird erneut pausiert. Der Speaker-Wachhalter bleibt dabei unberührt.

export const SILENCE_AUDIT_MS = 250
export const SILENCE_BLIND_PAUSE_LIMIT = 8

export interface SilenceClock {
  setTimeout(callback: () => void, delayMs: number): number
  clearTimeout(id: number): void
}

export interface SilenceWatchDeps {
  pause: () => Promise<void>
  probe: () => Promise<boolean | null>
}

export interface SilenceWatch {
  hold: () => Promise<void>
  release: () => Promise<void>
  seal: () => Promise<void>
}

export function needsSilencePause(
  paused: boolean | null,
  blindPauses: number,
  blindLimit = SILENCE_BLIND_PAUSE_LIMIT,
): boolean {
  if (paused === false) {
    return true
  }
  return paused === null && blindPauses < blindLimit
}

export function createSilenceWatch(
  deps: SilenceWatchDeps,
  clock: SilenceClock = browserSilenceClock(),
): SilenceWatch {
  let epoch = 0
  let sealed = false
  let tail: Promise<void> = Promise.resolve()
  const wakers = new Set<() => void>()

  function advance(): number {
    epoch += 1
    wake()
    return epoch
  }

  function wake(): void {
    const pending = [...wakers]
    wakers.clear()
    for (const waker of pending) {
      waker()
    }
  }

  function enqueuePause(token: number): Promise<void> {
    const run = tail.then(async () => {
      if (token !== epoch) {
        return
      }
      await deps.pause()
    })
    tail = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  function sleep(delayMs: number, token: number): Promise<void> {
    if (token !== epoch || delayMs <= 0) {
      return Promise.resolve()
    }
    return new Promise((resolve) => {
      let settled = false
      const finish = () => {
        if (settled) {
          return
        }
        settled = true
        wakers.delete(finish)
        clock.clearTimeout(timer)
        resolve()
      }
      const timer = clock.setTimeout(finish, delayMs)
      wakers.add(finish)
    })
  }

  async function audit(token: number): Promise<void> {
    let blindPauses = 0
    while (token === epoch) {
      await sleep(SILENCE_AUDIT_MS, token)
      if (token !== epoch) {
        return
      }
      const paused = await readPaused()
      if (token !== epoch || !needsSilencePause(paused, blindPauses)) {
        continue
      }
      try {
        await enqueuePause(token)
      } catch {
        // Der nächste Durchgang pausiert erneut.
      }
      if (paused === null) {
        blindPauses += 1
      }
    }
  }

  async function readPaused(): Promise<boolean | null> {
    try {
      return await deps.probe()
    } catch {
      return null
    }
  }

  return {
    hold() {
      if (sealed) {
        return Promise.resolve()
      }
      const token = advance()
      const first = enqueuePause(token).then(
        () => undefined,
        () => undefined,
      )
      void first
        .then(() => {
          if (token === epoch && !sealed) {
            return audit(token)
          }
          return undefined
        })
        .catch(() => undefined)
      return first
    },
    release() {
      sealed = false
      advance()
      return tail
    },
    seal() {
      sealed = true
      advance()
      return tail
    },
  }
}

function browserSilenceClock(): SilenceClock {
  return {
    setTimeout(callback, delayMs) {
      return window.setTimeout(callback, delayMs)
    },
    clearTimeout(id) {
      window.clearTimeout(id)
    },
  }
}
