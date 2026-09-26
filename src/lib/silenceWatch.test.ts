import { describe, expect, it } from 'vitest'
import {
  createSilenceWatch,
  needsSilencePause,
  SILENCE_BLIND_PAUSE_LIMIT,
  type SilenceClock,
} from './silenceWatch.ts'

class ManualClock implements SilenceClock {
  private nextId = 1
  private readonly timers = new Map<number, { callback: () => void; cleared: boolean }>()

  setTimeout(callback: () => void): number {
    const id = this.nextId++
    this.timers.set(id, { callback, cleared: false })
    return id
  }

  clearTimeout(id: number): void {
    const timer = this.timers.get(id)
    if (timer) {
      timer.cleared = true
    }
  }

  async fire(): Promise<void> {
    for (const [id, timer] of this.timers) {
      if (timer.cleared) {
        continue
      }
      timer.cleared = true
      this.timers.delete(id)
      timer.callback()
      await flushMicrotasks()
      return
    }
  }
}

async function flushMicrotasks(): Promise<void> {
  for (let step = 0; step < 12; step += 1) {
    await Promise.resolve()
  }
}

describe('needsSilencePause', () => {
  it('pausiert hörbare Titel weiter und begrenzt blinde Versuche', () => {
    expect(needsSilencePause(false, SILENCE_BLIND_PAUSE_LIMIT)).toBe(true)
    expect(needsSilencePause(true, 0)).toBe(false)
    expect(needsSilencePause(null, 0)).toBe(true)
    expect(needsSilencePause(null, SILENCE_BLIND_PAUSE_LIMIT)).toBe(false)
  })
})

describe('createSilenceWatch', () => {
  it('pausiert erneut, wenn der Titel nach der Pause wieder hörbar wird', async () => {
    const clock = new ManualClock()
    const pauses: string[] = []
    let paused: boolean | null = true
    const watch = createSilenceWatch(
      {
        pause: async () => {
          pauses.push('pause')
        },
        probe: async () => paused,
      },
      clock,
    )

    await watch.hold()
    await flushMicrotasks()
    expect(pauses).toEqual(['pause'])

    await clock.fire()
    expect(pauses).toEqual(['pause'])

    paused = false
    await clock.fire()
    expect(pauses).toEqual(['pause', 'pause'])
    await watch.release()
  })

  it('lässt einen laufenden Pause-Versuch enden und pausiert danach nicht erneut', async () => {
    const clock = new ManualClock()
    let releasePause: () => void = () => undefined
    const pauses: number[] = []
    const watch = createSilenceWatch(
      {
        pause: () => {
          pauses.push(pauses.length + 1)
          return new Promise((resolve) => {
            releasePause = resolve
          })
        },
        probe: async () => false,
      },
      clock,
    )

    const held = watch.hold()
    await flushMicrotasks()
    expect(pauses).toEqual([1])
    let settled = false
    const released = watch.release().then(() => {
      settled = true
    })
    await flushMicrotasks()
    expect(settled).toBe(false)
    releasePause()
    await released
    await held
    await clock.fire()
    expect(pauses).toEqual([1])
  })

  it('hört auf, blind zu pausieren, und pausiert wieder sobald der Titel hörbar ist', async () => {
    const clock = new ManualClock()
    const pauses: string[] = []
    let paused: boolean | null = null
    const watch = createSilenceWatch(
      {
        pause: async () => {
          pauses.push('pause')
        },
        probe: async () => paused,
      },
      clock,
    )

    await watch.hold()
    for (let step = 0; step < SILENCE_BLIND_PAUSE_LIMIT + 3; step += 1) {
      await clock.fire()
    }
    expect(pauses).toHaveLength(1 + SILENCE_BLIND_PAUSE_LIMIT)

    paused = false
    await clock.fire()
    expect(pauses).toHaveLength(2 + SILENCE_BLIND_PAUSE_LIMIT)
    await watch.release()
  })

  it('ignoriert weitere Pausen, nachdem die Runde beendet wurde', async () => {
    const clock = new ManualClock()
    const pauses: string[] = []
    const watch = createSilenceWatch(
      {
        pause: async () => {
          pauses.push('pause')
        },
        probe: async () => false,
      },
      clock,
    )

    await watch.hold()
    await watch.seal()
    await watch.hold()
    await clock.fire()
    expect(pauses).toEqual(['pause'])

    await watch.release()
    await watch.hold()
    expect(pauses).toEqual(['pause', 'pause'])
    await watch.release()
  })
})
