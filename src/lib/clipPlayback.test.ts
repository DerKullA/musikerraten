import { describe, expect, it } from 'vitest'
import { runBoundedClip } from './clipPlayback.ts'

describe('runBoundedClip', () => {
  it('zählt die Dauer erst, wenn der erste Play bereit ist', async () => {
    const order: string[] = []
    await runBoundedClip(
      1_000,
      {
        play: async () => {
          order.push('play')
        },
        pause: async () => {
          order.push('pause')
        },
        isCancelled: () => false,
        onFirstPlayReady: () => {
          order.push('ready')
        },
        onPlayback: (state) => {
          order.push(state)
        },
        onError: () => undefined,
      },
      async () => {
        order.push('wait')
      },
    )
    expect(order).toEqual(['playing', 'play', 'ready', 'wait', 'pause', 'paused'])
  })
})
