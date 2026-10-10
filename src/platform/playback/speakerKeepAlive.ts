// Eigener AudioContext, getrennt vom Spotify-Player und seiner Lautstärke.
// Der Buffer bleibt vollausgesteuert; nur dieser Gain dämpft auf etwa −80 dB.

const KEEP_ALIVE_DB = -80
const KEEP_ALIVE_SECONDS = 2
const KEEP_ALIVE_CHANNELS = 2

let context: AudioContext | null = null
let source: AudioBufferSourceNode | null = null
let gain: GainNode | null = null

function createBrowserAudioContext(): AudioContext {
  if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') {
    throw new Error('AudioContext fehlt.')
  }
  return new window.AudioContext()
}

function decibelsToGain(decibels: number): number {
  return 10 ** (decibels / 20)
}

function fillWhiteNoiseChannel(samples: Float32Array): void {
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = Math.random() * 2 - 1
  }
}

function createWhiteNoiseBuffer(audioContext: AudioContext): AudioBuffer {
  const length = Math.max(1, Math.floor(audioContext.sampleRate * KEEP_ALIVE_SECONDS))
  const buffer = audioContext.createBuffer(KEEP_ALIVE_CHANNELS, length, audioContext.sampleRate)
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    fillWhiteNoiseChannel(buffer.getChannelData(channel))
  }
  return buffer
}

function resumeKeepAlive(audioContext: AudioContext): void {
  if (audioContext.state === 'running' || audioContext.state === 'closed') {
    return
  }
  void audioContext.resume().catch(() => undefined)
}

function releaseContext(audioContext: AudioContext): void {
  if (audioContext.state === 'closed') {
    return
  }
  void audioContext.close().catch(() => undefined)
}

export function startSpeakerKeepAlive(
  createContext: () => AudioContext = createBrowserAudioContext,
): void {
  if (context && context.state !== 'closed') {
    resumeKeepAlive(context)
    return
  }

  let created: AudioContext | null = null
  try {
    created = createContext()
    const buffer = createWhiteNoiseBuffer(created)
    const nextGain = created.createGain()
    const nextSource = created.createBufferSource()
    nextGain.gain.value = decibelsToGain(KEEP_ALIVE_DB)
    nextSource.buffer = buffer
    nextSource.loop = true
    nextSource.connect(nextGain)
    nextGain.connect(created.destination)
    nextSource.start()
    context = created
    gain = nextGain
    source = nextSource
    resumeKeepAlive(created)
  } catch {
    if (created && created !== context) {
      releaseContext(created)
    }
  }
}

interface GestureTarget {
  addEventListener(type: string, listener: () => void, capture: boolean): void
  removeEventListener(type: string, listener: () => void, capture: boolean): void
}

function browserGestureTarget(): GestureTarget {
  if (typeof window === 'undefined') {
    return {
      addEventListener() {},
      removeEventListener() {},
    }
  }
  return window
}

export function watchSpeakerKeepAliveGestures(
  onGesture: () => void = startSpeakerKeepAlive,
  target: GestureTarget = browserGestureTarget(),
): () => void {
  const start = () => {
    onGesture()
  }
  target.addEventListener('pointerdown', start, true)
  target.addEventListener('keydown', start, true)
  return () => {
    target.removeEventListener('pointerdown', start, true)
    target.removeEventListener('keydown', start, true)
  }
}

export function stopSpeakerKeepAlive(): void {
  const currentSource = source
  const currentGain = gain
  const currentContext = context
  source = null
  gain = null
  context = null

  if (currentSource) {
    try {
      currentSource.stop()
    } catch {
      // Quelle war noch nicht gestartet oder bereits gestoppt.
    }
    currentSource.disconnect()
  }
  currentGain?.disconnect()
  if (currentContext) {
    releaseContext(currentContext)
  }
}
