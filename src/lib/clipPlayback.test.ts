import { describe, expect, it } from 'vitest'
import { createCancellableDelay, holdPlaybackThen, runBoundedClip, type DelayClock } from './clipPlayback.ts'

class ManualClock implements DelayClock {
  private nextId = 1
  readonly pending = new Map<number, () => void>()

  setTimeout(callback: () => void): number {
    const id = this.nextId++
    this.pending.set(id, callback)
    return id
  }

  clearTimeout(id: number): void {
    this.pending.delete(id)
  }
}

async function flushMicrotasks(): Promise<void> {
  for (let step = 0; step < 10; step += 1) {
    await Promise.resolve()
  }
}

describe('createCancellableDelay', () => {
  it('löst das Warten auf, wenn der Clip abgebrochen wird', async () => {
    const clock = new ManualClock()
    const delay = createCancellableDelay(clock)
    let settled = false
    const waiting = delay.wait(500).then(() => {
      settled = true
    })

    expect(clock.pending.size).toBe(1)
    delay.cancel()
    await waiting
    expect(settled).toBe(true)
    expect(clock.pending.size).toBe(0)
  })

  it('wartet nicht, wenn keine Dauer übrig ist', async () => {
    const clock = new ManualClock()
    const delay = createCancellableDelay(clock)
    await delay.wait(0)
    expect(clock.pending.size).toBe(0)
  })
})

describe('runBoundedClip', () => {
  it('spielt die Clipdauer und pausiert danach', async () => {
    const events: string[] = []
    let waited = -1
    let release: () => void = () => undefined
    const done = runBoundedClip(
      100,
      {
        play: async () => {
          events.push('play')
        },
        pause: async () => {
          events.push('pause')
        },
        isCancelled: () => false,
        onPlayback: (state) => {
          events.push(state)
        },
        onError: () => {
          events.push('error')
        },
      },
      (delayMs) => {
        waited = delayMs
        return new Promise((resolve) => {
          release = resolve
        })
      },
    )

    await flushMicrotasks()
    expect(events).toEqual(['playing', 'play'])
    expect(waited).toBe(100)
    release()
    await done
    expect(events).toEqual(['playing', 'play', 'paused', 'pause'])
  })

  it('pausiert auch, wenn der Clip während der Dauer abgebrochen wird', async () => {
    const events: string[] = []
    let cancelled = false
    let release: () => void = () => undefined
    const done = runBoundedClip(
      3_000,
      {
        play: async () => {
          events.push('play')
        },
        pause: async () => {
          events.push('pause')
        },
        isCancelled: () => cancelled,
        onPlayback: (state) => {
          events.push(state)
        },
        onError: () => {
          events.push('error')
        },
      },
      () =>
        new Promise((resolve) => {
          release = resolve
        }),
    )

    await flushMicrotasks()
    cancelled = true
    release()
    await done
    expect(events).toEqual(['playing', 'play', 'pause'])
  })

  it('pausiert, wenn das Starten fehlschlägt, damit kein Titel weiterläuft', async () => {
    const events: string[] = []
    let waited = false
    await runBoundedClip(
      8_000,
      {
        play: async () => {
          throw new Error('Player kaputt')
        },
        pause: async () => {
          events.push('pause')
        },
        isCancelled: () => false,
        onPlayback: (state) => {
          events.push(state)
        },
        onError: (message) => {
          events.push(message)
        },
      },
      () => {
        waited = true
        return Promise.resolve()
      },
    )

    expect(waited).toBe(false)
    expect(events).toEqual(['playing', 'paused', 'Player kaputt', 'pause'])
  })
})

describe('holdPlaybackThen', () => {
  it('spielt die Nachspielzeit und startet danach den nächsten Titel', async () => {
    const events: string[] = []
    let release: () => void = () => undefined
    const done = holdPlaybackThen(
      8_000,
      {
        play: async () => {
          events.push('play')
        },
        pause: async () => {
          events.push('pause')
        },
        isCancelled: () => false,
        onPlayback: (state) => {
          events.push(state)
        },
        onError: () => {
          events.push('error')
        },
      },
      () =>
        new Promise((resolve) => {
          release = resolve
        }),
      () => {
        events.push('advance')
      },
    )

    await flushMicrotasks()
    expect(events).toEqual(['playing', 'play'])
    release()
    await done
    expect(events).toEqual(['playing', 'play', 'paused', 'pause', 'advance'])
  })

  it('startet den nächsten Titel nicht, wenn die Nachspielzeit abgebrochen wird', async () => {
    const events: string[] = []
    let cancelled = false
    let release: () => void = () => undefined
    const done = holdPlaybackThen(
      8_000,
      {
        play: async () => {
          events.push('play')
        },
        pause: async () => {
          events.push('pause')
        },
        isCancelled: () => cancelled,
        onPlayback: (state) => {
          events.push(state)
        },
        onError: () => {
          events.push('error')
        },
      },
      () =>
        new Promise((resolve) => {
          release = resolve
        }),
      () => {
        events.push('advance')
      },
    )

    await flushMicrotasks()
    cancelled = true
    release()
    await done
    expect(events).toEqual(['playing', 'play', 'pause'])
    expect(events).not.toContain('advance')
  })
})
