import { describe, expect, it } from 'vitest'
import {
  AUDIBLE_VOLUME,
  createClipWarmup,
  cueReached,
  playheadEnteredCue,
  playbackHasStarted,
  playbackIsHeld,
  type ClipCue,
  type ClipWarmupDeps,
  type WarmPlaybackState,
} from './clipWarmup.ts'

const cue: ClipCue = { uri: 'spotify:track:a', positionMs: 12_000 }

function warmupDeps(overrides: Partial<ClipWarmupDeps> = {}): ClipWarmupDeps {
  return {
    getState: async () => null,
    getVolume: async () => null,
    setVolume: async () => undefined,
    seek: async () => undefined,
    resume: async () => undefined,
    pause: async () => undefined,
    load: async () => undefined,
    activate: async () => undefined,
    suspendSilence: async () => undefined,
    restoreSilence: async () => undefined,
    sleep: async () => undefined,
    ...overrides,
  }
}

describe('playbackHasStarted', () => {
  it('erkennt nur den laufenden Zielsong', () => {
    const playing: WarmPlaybackState = { paused: false, positionMs: cue.positionMs, uri: cue.uri }
    const paused: WarmPlaybackState = { ...playing, paused: true }
    expect(playbackHasStarted(cue, playing)).toBe(true)
    expect(playbackHasStarted(cue, paused)).toBe(false)
    expect(playbackHasStarted(cue, { ...playing, uri: 'spotify:track:b' })).toBe(false)
    expect(playbackHasStarted(cue, null)).toBe(false)
  })
})

describe('cueReached', () => {
  it('gilt erst am Einsatz, nicht davor', () => {
    const playing: WarmPlaybackState = { paused: false, positionMs: cue.positionMs, uri: cue.uri }
    expect(cueReached(cue, playing)).toBe(true)
    expect(cueReached(cue, { ...playing, positionMs: cue.positionMs - 1_000 })).toBe(false)
  })
})

describe('playheadEnteredCue', () => {
  it('zählt eine gemeldete Position ohne Bewegung nicht', () => {
    const atCue: WarmPlaybackState = { paused: false, positionMs: cue.positionMs, uri: cue.uri }
    const before: WarmPlaybackState = { ...atCue, positionMs: cue.positionMs - 240 }
    expect(playheadEnteredCue(null, atCue, cue)).toBe(false)
    expect(playheadEnteredCue(atCue, atCue, cue)).toBe(false)
    expect(playheadEnteredCue(before, { ...atCue, positionMs: cue.positionMs + 40 }, cue)).toBe(true)
  })
})

describe('playbackIsHeld', () => {
  it('erkennt zwei gleiche Pausen hintereinander', () => {
    const paused: WarmPlaybackState = { paused: true, positionMs: cue.positionMs, uri: cue.uri }
    const playing: WarmPlaybackState = { ...paused, paused: false }
    expect(playbackIsHeld(paused, paused)).toBe(true)
    expect(playbackIsHeld(playing, paused)).toBe(false)
    expect(playbackIsHeld(paused, { ...paused, positionMs: paused.positionMs + 1_000 })).toBe(false)
  })
})

describe('createClipWarmup play', () => {
  it('legt einen neuen Song stumm an den Einsatz und spielt danach nur einmal an', async () => {
    let phase: 'idle' | 'playing' | 'paused' | 'resumed' = 'idle'
    let position = 0
    let volume = AUDIBLE_VOLUME
    let volumeAtLoad = -1
    let volumeAtResume = -1
    const warmup = createClipWarmup(
      warmupDeps({
        getState: async () => {
          if (phase === 'idle') {
            return null
          }
          if (phase !== 'paused' && position < cue.positionMs + 80) {
            position += 200
          }
          return {
            paused: phase === 'paused',
            positionMs: position,
            uri: cue.uri,
          }
        },
        setVolume: async (next) => {
          volume = next
        },
        load: async () => {
          volumeAtLoad = volume
          phase = 'playing'
          position = 0
        },
        pause: async () => {
          phase = 'paused'
        },
        seek: async (positionMs) => {
          position = positionMs
          phase = 'playing'
        },
        resume: async () => {
          volumeAtResume = volume
          phase = 'resumed'
        },
      }),
    )

    await warmup.play(cue)
    expect(volumeAtLoad).toBe(0)
    expect(volumeAtResume).toBe(AUDIBLE_VOLUME)
    expect(phase).toBe('resumed')
  })

  it('spielt hörbar erst, wenn der Einsatz erreicht ist', async () => {
    let loaded = false
    let paused = true
    let position = 0
    let volume = AUDIBLE_VOLUME
    let audibleStarts = 0
    const warmup = createClipWarmup(
      warmupDeps({
        getState: async () => {
          if (!loaded) {
            return null
          }
          if (!paused && position < cue.positionMs + 80) {
            position += 200
          }
          return { paused, positionMs: position, uri: cue.uri }
        },
        setVolume: async (next) => {
          volume = next
        },
        load: async () => {
          loaded = true
          paused = false
          position = 0
        },
        seek: async (positionMs) => {
          position = positionMs
          paused = false
        },
        resume: async () => {
          paused = false
          if (volume === 0) {
            return
          }
          audibleStarts += 1
        },
        pause: async () => {
          paused = true
        },
      }),
    )

    await warmup.play(cue)
    expect(position).toBeGreaterThanOrEqual(cue.positionMs)
    expect(audibleStarts).toBe(1)
    expect(volume).toBe(AUDIBLE_VOLUME)
  })

  it('setzt einen schon geladenen Song fort, ohne auf den Ladezustand zu warten', async () => {
    let loaded = false
    let resumed = false
    const warmup = createClipWarmup(
      warmupDeps({
        getState: async () => ({ paused: true, positionMs: cue.positionMs, uri: cue.uri }),
        load: async () => {
          loaded = true
        },
        resume: async () => {
          resumed = true
        },
      }),
    )

    await warmup.play(cue)
    expect(resumed).toBe(true)
    expect(loaded).toBe(false)
  })

  it('meldet, wenn der neu geladene Song nicht startet', async () => {
    let loaded = false
    const warmup = createClipWarmup(
      warmupDeps({
        getState: async () =>
          loaded ? { paused: true, positionMs: 0, uri: cue.uri } : null,
        load: async () => {
          loaded = true
        },
      }),
    )

    await expect(warmup.play(cue)).rejects.toThrow('Der Song hat nicht gestartet.')
  })
})

describe('createClipWarmup prime', () => {
  it('parkt einen neuen Song, damit der erste Play nur fortsetzt', async () => {
    let phase: 'idle' | 'playing' | 'paused' = 'idle'
    let position = 0
    let loads = 0
    const warmup = createClipWarmup(
      warmupDeps({
        getState: async () => {
          if (phase === 'idle') {
            return null
          }
          if (phase !== 'paused' && position < cue.positionMs + 80) {
            position += 200
          }
          return {
            paused: phase === 'paused',
            positionMs: position,
            uri: cue.uri,
          }
        },
        load: async () => {
          loads += 1
          phase = 'playing'
          position = 0
        },
        pause: async () => {
          phase = 'paused'
        },
        seek: async (positionMs) => {
          position = positionMs
          phase = 'playing'
        },
        resume: async () => {
          phase = 'playing'
        },
      }),
    )

    await warmup.prime(cue)
    expect(phase).toBe('paused')
    await warmup.play(cue)
    expect(loads).toBe(1)
    expect(phase).toBe('playing')
  })

  it('pausiert erneut, wenn das Zurückspringen den Song startet', async () => {
    let playing = true
    const order: string[] = []
    const warmup = createClipWarmup(
      warmupDeps({
        getState: async () => ({
          paused: !playing,
          positionMs: playing ? cue.positionMs + 2_000 : cue.positionMs,
          uri: cue.uri,
        }),
        seek: async () => {
          order.push('seek')
          playing = true
        },
        pause: async () => {
          order.push('pause')
          playing = false
        },
      }),
    )

    await warmup.prime(cue)
    expect(order.lastIndexOf('pause')).toBeGreaterThan(order.lastIndexOf('seek'))
  })
})
