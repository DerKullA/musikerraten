import { afterEach, describe, expect, it } from 'vitest'
import {
  startSpeakerKeepAlive,
  stopSpeakerKeepAlive,
  watchSpeakerKeepAliveGestures,
} from './speakerKeepAlive.ts'

const SAMPLE_RATE = 48_000
const KEEP_ALIVE_DB = -80

class FakeGestureTarget {
  private readonly listeners = new Map<string, Set<() => void>>()

  addEventListener(type: string, listener: () => void): void {
    const group = this.listeners.get(type) ?? new Set()
    group.add(listener)
    this.listeners.set(type, group)
  }

  removeEventListener(type: string, listener: () => void): void {
    this.listeners.get(type)?.delete(listener)
  }

  dispatch(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener()
    }
  }
}

class FakeNode {
  readonly connections: unknown[] = []

  connect(target: unknown): void {
    this.connections.push(target)
  }

  disconnect(): void {
    this.connections.length = 0
  }
}

class FakeBuffer {
  readonly numberOfChannels: number
  readonly length: number
  readonly sampleRate: number
  readonly duration: number
  private readonly channels: Float32Array[]

  constructor(channels: number, length: number, sampleRate: number) {
    this.numberOfChannels = channels
    this.length = length
    this.sampleRate = sampleRate
    this.duration = length / sampleRate
    this.channels = Array.from({ length: channels }, () => new Float32Array(length))
  }

  getChannelData(channel: number): Float32Array {
    const data = this.channels[channel]
    if (!data) {
      throw new Error(`Kanal ${channel} fehlt.`)
    }
    return data
  }
}

class FakeSource extends FakeNode {
  buffer: FakeBuffer | null = null
  loop = false
  started = false
  stopped = false

  start(): void {
    if (this.started) {
      throw new Error('Source wurde bereits gestartet.')
    }
    this.started = true
  }

  stop(): void {
    if (!this.started || this.stopped) {
      throw new Error('Source kann nicht gestoppt werden.')
    }
    this.stopped = true
  }
}

class FakeGain extends FakeNode {
  readonly gain = { value: 1 }
}

interface FakeContext {
  context: AudioContext
  destination: FakeNode
  buffers: FakeBuffer[]
  sources: FakeSource[]
  gains: FakeGain[]
  resumeCount: () => number
  closeCount: () => number
  state: () => string
}

function createFakeContext(initialState: 'running' | 'suspended' | 'closed' = 'running'): FakeContext {
  let state = initialState
  let resumeCount = 0
  let closeCount = 0
  const destination = new FakeNode()
  const buffers: FakeBuffer[] = []
  const sources: FakeSource[] = []
  const gains: FakeGain[] = []

  const context = {
    sampleRate: SAMPLE_RATE,
    destination,
    get state() {
      return state
    },
    createBuffer(channels: number, length: number, sampleRate: number) {
      const buffer = new FakeBuffer(channels, length, sampleRate)
      buffers.push(buffer)
      return buffer
    },
    createGain() {
      const node = new FakeGain()
      gains.push(node)
      return node
    },
    createBufferSource() {
      const node = new FakeSource()
      sources.push(node)
      return node
    },
    resume() {
      resumeCount += 1
      state = 'running'
      return Promise.resolve()
    },
    close() {
      closeCount += 1
      state = 'closed'
      return Promise.resolve()
    },
  }

  return {
    context: context as unknown as AudioContext,
    destination,
    buffers,
    sources,
    gains,
    resumeCount: () => resumeCount,
    closeCount: () => closeCount,
    state: () => state,
  }
}

function peak(samples: Float32Array): number {
  let max = 0
  for (const sample of samples) {
    max = Math.max(max, Math.abs(sample))
  }
  return max
}

function channelsDiffer(left: Float32Array, right: Float32Array): boolean {
  const length = Math.min(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    if (left[index] !== right[index]) {
      return true
    }
  }
  return false
}

describe('speakerKeepAlive', () => {
  afterEach(() => {
    stopSpeakerKeepAlive()
  })

  it('loops a two-second white-noise buffer at about -80 dB', () => {
    const fake = createFakeContext()
    startSpeakerKeepAlive(() => fake.context)

    expect(fake.buffers).toHaveLength(1)
    expect(fake.sources).toHaveLength(1)
    expect(fake.gains).toHaveLength(1)

    const buffer = fake.buffers[0]
    const source = fake.sources[0]
    const gain = fake.gains[0]
    if (!buffer || !source || !gain) {
      throw new Error('Graph fehlt.')
    }

    expect(buffer.numberOfChannels).toBe(2)
    expect(buffer.sampleRate).toBe(SAMPLE_RATE)
    expect(buffer.length).toBe(SAMPLE_RATE * 2)
    expect(buffer.duration).toBe(2)

    const left = buffer.getChannelData(0)
    const right = buffer.getChannelData(1)
    expect(peak(left)).toBeGreaterThan(0.5)
    expect(peak(right)).toBeGreaterThan(0.5)
    expect(channelsDiffer(left, right)).toBe(true)
    for (const sample of left) {
      expect(sample).toBeGreaterThanOrEqual(-1)
      expect(sample).toBeLessThan(1)
    }

    expect(source.buffer).toBe(buffer)
    expect(source.loop).toBe(true)
    expect(source.started).toBe(true)
    expect(source.connections).toEqual([gain])
    expect(gain.connections).toEqual([fake.destination])
    expect(gain.gain.value).toBeCloseTo(10 ** (KEEP_ALIVE_DB / 20), 12)
    expect(fake.resumeCount()).toBe(0)
  })

  it('keeps the same graph running for the whole session', () => {
    const fake = createFakeContext()
    const createContext = () => fake.context
    startSpeakerKeepAlive(createContext)
    startSpeakerKeepAlive(createContext)

    expect(fake.buffers).toHaveLength(1)
    expect(fake.sources).toHaveLength(1)
    expect(fake.sources[0]?.started).toBe(true)
    expect(fake.sources[0]?.stopped).toBe(false)
  })

  it('resumes a suspended context without rebuilding the noise', () => {
    const fake = createFakeContext('suspended')
    startSpeakerKeepAlive(() => fake.context)
    startSpeakerKeepAlive(() => fake.context)

    expect(fake.buffers).toHaveLength(1)
    expect(fake.sources).toHaveLength(1)
    expect(fake.resumeCount()).toBe(1)
    expect(fake.state()).toBe('running')
    expect(fake.sources[0]?.stopped).toBe(false)
  })

  it('retries resume on the next gesture while the context stays suspended', () => {
    const fake = createFakeContext('suspended')
    const audioContext = fake.context as AudioContext & {
      resume: () => Promise<void>
    }
    let attempts = 0
    audioContext.resume = () => {
      attempts += 1
      return Promise.resolve()
    }

    startSpeakerKeepAlive(() => fake.context)
    startSpeakerKeepAlive(() => fake.context)

    expect(attempts).toBe(2)
    expect(fake.buffers).toHaveLength(1)
    expect(fake.sources[0]?.stopped).toBe(false)
  })

  it('does not throw when resume is rejected', () => {
    const fake = createFakeContext('suspended')
    const context = fake.context as AudioContext & {
      resume: () => Promise<void>
    }
    context.resume = () => Promise.reject(new Error('kein User-Gesture'))

    expect(() => startSpeakerKeepAlive(() => fake.context)).not.toThrow()
    expect(fake.sources[0]?.started).toBe(true)
  })

  it('stops the source and closes the context', () => {
    const fake = createFakeContext()
    startSpeakerKeepAlive(() => fake.context)
    stopSpeakerKeepAlive()

    expect(fake.sources[0]?.stopped).toBe(true)
    expect(fake.sources[0]?.connections).toEqual([])
    expect(fake.gains[0]?.connections).toEqual([])
    expect(fake.closeCount()).toBe(1)
    expect(fake.state()).toBe('closed')
  })

  it('is safe to stop twice and starts a fresh graph afterwards', () => {
    const first = createFakeContext()
    const second = createFakeContext()
    const contexts = [first, second]
    startSpeakerKeepAlive(() => {
      const next = contexts.shift()
      if (!next) {
        throw new Error('Kein weiterer Kontext.')
      }
      return next.context
    })
    stopSpeakerKeepAlive()
    stopSpeakerKeepAlive()
    startSpeakerKeepAlive(() => {
      const next = contexts.shift()
      if (!next) {
        throw new Error('Kein weiterer Kontext.')
      }
      return next.context
    })

    expect(first.sources[0]?.stopped).toBe(true)
    expect(first.closeCount()).toBe(1)
    expect(second.buffers).toHaveLength(1)
    expect(second.sources[0]?.started).toBe(true)
    expect(second.closeCount()).toBe(0)
  })

  it('ignores a missing AudioContext', () => {
    expect(() => startSpeakerKeepAlive()).not.toThrow()
  })

  it('starts on the first pointer or key gesture and stays on one graph', () => {
    const fake = createFakeContext('suspended')
    const target = new FakeGestureTarget()
    const unbind = watchSpeakerKeepAliveGestures(() => {
      startSpeakerKeepAlive(() => fake.context)
    }, target)

    target.dispatch('pointerdown')
    target.dispatch('keydown')
    unbind()
    target.dispatch('pointerdown')

    expect(fake.buffers).toHaveLength(1)
    expect(fake.sources[0]?.loop).toBe(true)
    expect(fake.sources[0]?.started).toBe(true)
    expect(fake.sources[0]?.stopped).toBe(false)
    expect(fake.resumeCount()).toBe(1)
    expect(fake.gains[0]?.gain.value).toBeCloseTo(10 ** (KEEP_ALIVE_DB / 20), 12)
  })

  it('closes a context that fails while the graph is built', () => {
    const fake = createFakeContext()
    const context = fake.context as AudioContext & {
      createBufferSource: () => AudioBufferSourceNode
    }
    context.createBufferSource = () => {
      throw new Error('Source nicht verfügbar.')
    }

    expect(() => startSpeakerKeepAlive(() => fake.context)).not.toThrow()
    expect(fake.closeCount()).toBe(1)
    expect(fake.sources).toHaveLength(0)
  })
})
