import { describe, expect, it } from 'vitest'
import {
  AUDIBLE_VOLUME,
  choosePrimeAction,
  chooseWarmStart,
  createClipWarmup,
  cueReached,
  normalizeCue,
  primeSeekMs,
  readWarmPlayback,
  sameClipCue,
  shouldPrimeParkedClip,
  volumeIsSilent,
  type ClipCue,
  type WarmPlaybackState,
} from './clipWarmup.ts'

const cue: ClipCue = { uri: 'spotify:track:a', positionMs: 12_000 }

async function flushUntil(events: string[], needle: string): Promise<void> {
  for (let step = 0; step < 30; step += 1) {
    if (events.includes(needle)) {
      return
    }
    await Promise.resolve()
  }
  throw new Error(`Erwartet ${needle}, gesehen: ${events.join(', ')}`)
}

function state(partial: Partial<WarmPlaybackState> & Pick<WarmPlaybackState, 'paused'>): WarmPlaybackState {
  return {
    paused: partial.paused,
    positionMs: partial.positionMs ?? 0,
    uri: partial.uri === undefined ? cue.uri : partial.uri,
  }
}

describe('clip warmup decisions', () => {
  it('normalisiert Suchpositionen und lässt denselben Clip gelten', () => {
    expect(normalizeCue({ uri: cue.uri, positionMs: 10.8 }).positionMs).toBe(10)
    expect(normalizeCue({ uri: cue.uri, positionMs: Number.NaN }).positionMs).toBe(0)
    expect(primeSeekMs(1_000)).toBe(760)
    expect(primeSeekMs(100)).toBe(0)
    expect(sameClipCue(cue, { uri: cue.uri, positionMs: 12_100 })).toBe(true)
    expect(sameClipCue(cue, { uri: 'spotify:track:b', positionMs: 12_000 })).toBe(false)
    expect(cueReached(cue, state({ paused: true, positionMs: 11_900 }))).toBe(true)
    expect(volumeIsSilent(0)).toBe(true)
    expect(volumeIsSilent(0.8)).toBe(false)
    expect(volumeIsSilent(null)).toBe(false)
  })

  it('lädt einen fremden Titel und sucht nur innerhalb desselben Titels', () => {
    expect(choosePrimeAction(cue, null)).toBe('load')
    expect(choosePrimeAction(cue, state({ paused: true, uri: 'spotify:track:b' }))).toBe('load')
    expect(choosePrimeAction(cue, state({ paused: true, positionMs: 12_000 }))).toBe('ready')
    expect(choosePrimeAction(cue, state({ paused: true, positionMs: 4_000 }))).toBe('seek')
    expect(chooseWarmStart(cue, null)).toBe('load')
    expect(chooseWarmStart(cue, state({ paused: true, positionMs: 4_000 }))).toBe('seek-resume')
    expect(chooseWarmStart(cue, state({ paused: true, positionMs: 12_040 }))).toBe('resume')
    expect(chooseWarmStart(cue, state({ paused: false, positionMs: 12_040 }))).toBe('unmute')
  })

  it('parkt nur einen beendeten Clip, nicht das Reveal-Nachspiel', () => {
    expect(shouldPrimeParkedClip('clip', 2, 2)).toBe(true)
    expect(shouldPrimeParkedClip('clip', 2, 3)).toBe(false)
    expect(shouldPrimeParkedClip('continue', 2, 2)).toBe(false)
  })

  it('liest URI und Position aus dem SDK-Zustand', () => {
    expect(readWarmPlayback(null)).toBeNull()
    expect(readWarmPlayback({ paused: true })).toEqual({
      paused: true,
      positionMs: 0,
      uri: null,
    })
    expect(
      readWarmPlayback({
        paused: false,
        position: 1500.2,
        track_window: { current_track: { uri: cue.uri } },
      }),
    ).toEqual({ paused: false, positionMs: 1500, uri: cue.uri })
  })
})

describe('createClipWarmup', () => {
  function harness(initial: WarmPlaybackState | null) {
    const events: string[] = []
    let playback = initial
    let volume = AUDIBLE_VOLUME
    let releaseLoad: (() => void) | null = null
    const warmup = createClipWarmup({
      getState: async () => playback,
      getVolume: async () => volume,
      setVolume: async (next) => {
        volume = next
        events.push(`vol:${next}`)
      },
      seek: async (positionMs) => {
        events.push(`seek:${positionMs}`)
        if (playback) {
          playback = { ...playback, positionMs }
        }
      },
      resume: async () => {
        events.push('resume')
        if (playback) {
          playback = { ...playback, paused: false }
        }
      },
      pause: async () => {
        events.push('pause')
        if (playback) {
          playback = { ...playback, paused: true }
        }
      },
      load: (next) => {
        events.push(`load:${next.positionMs}`)
        return new Promise((resolve) => {
          releaseLoad = () => {
            playback = { paused: false, positionMs: next.positionMs, uri: next.uri }
            resolve()
          }
        })
      },
      activate: async () => {
        events.push('activate')
      },
      suspendSilence: async () => {
        events.push('suspend')
      },
      restoreSilence: async () => {
        events.push('restore')
      },
      sleep: async () => undefined,
    })
    return {
      events,
      warmup,
      releaseLoad: () => {
        releaseLoad?.()
      },
      playback: () => playback,
      volume: () => volume,
    }
  }

  it('setzt einen vorbereiteten Clip ohne neuen Play-Aufruf fort', async () => {
    const player = harness(state({ paused: true, positionMs: 12_000 }))
    await player.warmup.prime(cue)
    expect(player.events).toContain('vol:0')
    expect(player.events).not.toContain('load:12000')
    player.events.length = 0
    await player.warmup.play(cue)
    expect(player.events).toEqual(['activate', 'vol:0.8', 'resume'])
  })

  it('sucht im selben Titel statt neu zu laden', async () => {
    const player = harness(state({ paused: true, positionMs: 4_000 }))
    await player.warmup.play(cue)
    expect(player.events).toEqual(['activate', 'vol:0.8', 'seek:12000', 'resume'])
    expect(player.events.some((event) => event.startsWith('load:'))).toBe(false)
  })

  it('lädt einen anderen Titel und bleibt stumm, wenn die Lautstärke nicht auf null geht', async () => {
    const events: string[] = []
    const warmup = createClipWarmup({
      getState: async () => state({ paused: true, uri: null, positionMs: 0 }),
      getVolume: async () => 0.8,
      setVolume: async (next) => {
        events.push(`vol:${next}`)
      },
      seek: async () => {
        events.push('seek')
      },
      resume: async () => {
        events.push('resume')
      },
      pause: async () => {
        events.push('pause')
      },
      load: async () => {
        events.push('load')
      },
      activate: async () => undefined,
      suspendSilence: async () => {
        events.push('suspend')
      },
      restoreSilence: async () => {
        events.push('restore')
      },
      sleep: async () => undefined,
    })
    await warmup.prime(cue)
    expect(events).not.toContain('load')
    expect(events).not.toContain('suspend')
    expect(events).toContain('vol:0.8')
  })

  it('bricht stummes Vorladen ab und macht den laufenden Clip hörbar', async () => {
    const player = harness(null)
    const priming = player.warmup.prime(cue)
    await flushUntil(player.events, 'load:12000')
    const playing = player.warmup.play(cue)
    player.releaseLoad()
    await priming
    await playing
    expect(player.events).not.toContain('pause')
    expect(player.events).toContain('vol:0.8')
    expect(player.events.filter((event) => event.startsWith('load:'))).toEqual(['load:12000'])
  })

  it('stellt die Position vor dem Vorladen für das Weiterhören wieder her', async () => {
    const player = harness(state({ paused: true, positionMs: 4_200 }))
    await player.warmup.prime({ uri: cue.uri, positionMs: 1_000 })
    player.events.length = 0
    await expect(player.warmup.resumeDisplaced()).resolves.toBe(true)
    expect(player.events).toContain('seek:4200')
    expect(player.events).toContain('resume')
    expect(player.volume()).toBe(AUDIBLE_VOLUME)
  })

  it('verwirft ein Vorladen, wenn die Runde endet', async () => {
    const player = harness(null)
    const priming = player.warmup.prime(cue)
    await flushUntil(player.events, 'load:12000')
    player.warmup.invalidate()
    player.releaseLoad()
    await priming
    expect(player.events).toContain('pause')
    expect(player.volume()).toBe(AUDIBLE_VOLUME)
  })
})
