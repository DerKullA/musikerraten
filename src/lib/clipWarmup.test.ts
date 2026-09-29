import { describe, expect, it, vi } from 'vitest'
import {
  AUDIBLE_VOLUME,
  BUFFER_STABLE_POLLS,
  BUFFER_WAIT_LIMIT,
  FOREIGN_RELEASE_POLLS,
  createClipWarmup,
  createColdBufferWatch,
  cueReached,
  noteColdBufferSample,
  playheadEnteredCue,
  firstPlayIsReady,
  playbackHasStarted,
  playbackIsHeld,
  readQueuedTrackUri,
  type ClipCue,
  type ClipWarmupDeps,
  type ColdBufferWatch,
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

describe('firstPlayIsReady', () => {
  const playing: WarmPlaybackState = { paused: false, positionMs: cue.positionMs, uri: cue.uri }

  it('gilt erst, wenn der Playhead nach dem Einsatz weiterläuft', () => {
    const later = { ...playing, positionMs: cue.positionMs + 40 }
    expect(firstPlayIsReady(cue, null, later)).toBe(false)
    expect(firstPlayIsReady(cue, { ...playing, paused: true }, later)).toBe(false)
    expect(firstPlayIsReady(cue, playing, playing)).toBe(false)
    expect(firstPlayIsReady(cue, playing, later)).toBe(true)
    expect(firstPlayIsReady(cue, playing, { ...later, loading: true })).toBe(false)
  })
})

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

describe('readQueuedTrackUri', () => {
  it('liest nur den nächsten Track aus der Warteschlange', () => {
    expect(readQueuedTrackUri({ track_window: { next_tracks: [{ uri: 'spotify:track:b' }] } })).toBe(
      'spotify:track:b',
    )
    expect(readQueuedTrackUri({ track_window: { next_tracks: [{ uri: 'spotify:episode:x' }] } })).toBe(
      null,
    )
    expect(readQueuedTrackUri(null)).toBe(null)
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

  it('bleibt stumm, bis der Puffer nach dem Rücksprung am Einsatz steht', async () => {
    let phase: 'phantom' | 'live' | 'paused' = 'phantom'
    let position = 0
    let volume = AUDIBLE_VOLUME
    let audibleResumes = 0
    const warmup = createClipWarmup(
      warmupDeps({
        getState: async () => {
          if (phase === 'phantom') {
            position += 700
            if (position > cue.positionMs + 2_000) {
              position = cue.positionMs
              phase = 'live'
            }
            return { paused: false, positionMs: position, uri: cue.uri, loading: phase === 'phantom' }
          }
          if (phase === 'live' && position < cue.positionMs + 40) {
            position += 20
          }
          return { paused: phase === 'paused', positionMs: position, uri: cue.uri, loading: false }
        },
        setVolume: async (next) => {
          volume = next
        },
        load: async () => {
          phase = 'phantom'
          position = 0
        },
        pause: async () => {
          phase = 'paused'
        },
        seek: async (positionMs) => {
          position = positionMs
          phase = 'live'
        },
        resume: async () => {
          if (volume > 0) {
            audibleResumes += 1
          }
          if (phase === 'paused') {
            phase = 'live'
          }
        },
      }),
    )

    await warmup.play(cue)
    expect(audibleResumes).toBe(1)
    expect(volume).toBe(AUDIBLE_VOLUME)
    expect(position).toBeGreaterThanOrEqual(cue.positionMs - 180)
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

    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await expect(warmup.play(cue)).rejects.toThrow('Der Song hat nicht gestartet.')
    const line = JSON.stringify(logged.mock.calls)
    expect(line).toContain(cue.uri)
    expect(line).toContain('play')
    expect(line).toContain('buffer')
    logged.mockRestore()
  })

  it('holt die Wiedergabe auf dieses Gerät, bevor der Song lädt', async () => {
    const order: string[] = []
    let phase: 'idle' | 'playing' | 'paused' | 'resumed' = 'idle'
    let position = 0
    const warmup = createClipWarmup(
      warmupDeps({
        claimDevice: async () => {
          order.push('claim')
          return 'local'
        },
        getState: async () => {
          if (phase === 'idle') {
            return null
          }
          if (phase !== 'paused' && position < cue.positionMs + 80) {
            position += 200
          }
          return { paused: phase === 'paused', positionMs: position, uri: cue.uri }
        },
        setVolume: async (next) => {
          order.push(`volume:${next}`)
        },
        load: async () => {
          order.push('load')
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
          phase = 'resumed'
        },
      }),
    )

    await warmup.play(cue)
    const claimAt = order.indexOf('claim')
    const loadAt = order.indexOf('load')
    expect(claimAt).toBeGreaterThanOrEqual(0)
    expect(loadAt).toBeGreaterThan(claimAt)
    expect(order.indexOf('volume:0')).toBeLessThan(loadAt)
  })

  it('lädt neu, wenn das vorgeladene Gerät die Wiedergabe verloren hat', async () => {
    let onDevice = true
    let loaded = false
    const ready = { paused: true, positionMs: cue.positionMs, uri: cue.uri }
    const warmup = createClipWarmup(
      warmupDeps({
        claimDevice: async () => (onDevice ? 'local' : 'transferred'),
        getState: async () => (onDevice ? ready : null),
        load: async () => {
          loaded = true
        },
      }),
    )

    await warmup.prime(cue)
    onDevice = false
    await expect(warmup.play(cue)).rejects.toThrow('Der Song hat nicht gestartet.')
    expect(loaded).toBe(true)
  })

  it('springt zum vorgemerkten Folgesong, ohne ihn neu zu laden', async () => {
    const target = { uri: 'spotify:track:b', positionMs: 0 }
    let handed = false
    let loaded = false
    let queued = false
    const warmup = createClipWarmup(
      warmupDeps({
        getState: async () =>
          handed
            ? { paused: false, positionMs: 20, uri: target.uri }
            : { paused: false, positionMs: 1_000, uri: 'spotify:track:a' },
        handoff: async () => {
          handed = true
          return true
        },
        queueFollowing: async () => {
          queued = true
        },
        load: async () => {
          loaded = true
        },
      }),
    )

    await warmup.play(target)
    expect(handed).toBe(true)
    expect(loaded).toBe(false)
    expect(queued).toBe(true)
  })

  it('lädt neu, wenn kein Folgesong anliegt', async () => {
    const target = { uri: 'spotify:track:b', positionMs: 0 }
    let loaded = false
    let stage: 'before' | 'loading' | 'live' | 'paused' = 'before'
    const warmup = createClipWarmup(
      warmupDeps({
        getState: async () => {
          if (stage === 'before') {
            return { paused: false, positionMs: 400, uri: 'spotify:track:a' }
          }
          if (stage === 'loading') {
            stage = 'live'
            return { paused: false, positionMs: 0, uri: target.uri, loading: true }
          }
          return { paused: stage === 'paused', positionMs: 30, uri: target.uri, loading: false }
        },
        handoff: async () => false,
        load: async () => {
          loaded = true
          stage = 'loading'
        },
        pause: async () => {
          stage = 'paused'
        },
        resume: async () => {
          stage = 'live'
        },
      }),
    )

    await warmup.play(target)
    expect(loaded).toBe(true)
  })

  it('startet den zweiten Song, sobald der Player den ersten Track freigibt', async () => {
    const second = { uri: 'spotify:track:b', positionMs: 12_000 }
    let uri = 'spotify:track:a'
    let position = 4_000
    let paused = false
    let loading = false
    let hold = true
    let seenSecond = 0
    const warmup = createClipWarmup(
      warmupDeps({
        getState: async () => {
          if (uri === second.uri) {
            seenSecond += 1
            if (seenSecond > 3) {
              loading = false
            }
            if (!loading && !paused && position < second.positionMs) {
              position = Math.min(second.positionMs, position + 400)
            }
          }
          return { paused, positionMs: position, uri, loading }
        },
        pause: async () => {
          paused = true
          if (uri === 'spotify:track:a') {
            hold = false
          }
        },
        load: async (next) => {
          if (next.uri === second.uri && hold) {
            return
          }
          uri = next.uri
          position = 0
          paused = false
          loading = true
        },
        resume: async () => {
          paused = false
          if (uri === second.uri) {
            loading = false
          }
        },
        seek: async (positionMs) => {
          position = positionMs
          paused = false
          loading = false
        },
      }),
    )

    await warmup.play(second)
    expect(uri).toBe(second.uri)
    expect(paused).toBe(false)
  })

  it('lässt den Puffer laden, bevor ein pausierter Folgesong fortgesetzt wird', async () => {
    const second = { uri: 'spotify:track:b', positionMs: 12_000 }
    let uri = 'spotify:track:a'
    let position = 2_000
    let paused = true
    let loading = false
    let pollsOnSecond = 0
    let resumesWhileLoading = 0
    let resumes = 0
    const warmup = createClipWarmup(
      warmupDeps({
        getState: async () => {
          if (uri === second.uri) {
            pollsOnSecond += 1
            if (pollsOnSecond > 4) {
              loading = false
            }
            if (!loading && !paused && position < second.positionMs) {
              position = Math.min(second.positionMs, position + 500)
            }
          }
          return { paused, positionMs: position, uri, loading }
        },
        load: async () => {
          uri = second.uri
          position = 0
          paused = true
          loading = true
        },
        resume: async () => {
          if (loading) {
            resumesWhileLoading += 1
            return
          }
          resumes += 1
          paused = false
        },
        pause: async () => {
          paused = true
        },
        seek: async (positionMs) => {
          position = positionMs
          loading = false
          paused = false
        },
      }),
    )

    await warmup.play(second)
    expect(resumesWhileLoading).toBe(0)
    expect(resumes).toBeGreaterThan(0)
    expect(uri).toBe(second.uri)
    expect(paused).toBe(false)
  })

  it('pausiert den gehaltenen Track nur zum Freigeben, nicht in jedem Puffertakt', async () => {
    const target = { uri: 'spotify:track:b', positionMs: 12_000 }
    let polls = 0
    let pauses = 0
    let loaded = false
    let paused = false
    let position = 0
    const switchAfter = 40
    const warmup = createClipWarmup(
      warmupDeps({
        getState: async () => {
          polls += 1
          if (!loaded || polls <= switchAfter) {
            return { paused: false, positionMs: 3_000, uri: 'spotify:track:a', loading: false }
          }
          if (!paused && position < target.positionMs) {
            position = Math.min(target.positionMs, position + 800)
          }
          return { paused, positionMs: position, uri: target.uri, loading: false }
        },
        load: async () => {
          loaded = true
          position = 0
        },
        pause: async () => {
          pauses += 1
          paused = true
        },
        resume: async () => {
          paused = false
        },
        seek: async (positionMs) => {
          position = positionMs
          paused = false
        },
      }),
    )

    await warmup.play(target)
    expect(loaded).toBe(true)
    expect(pauses).toBeLessThan(FOREIGN_RELEASE_POLLS)
  })

  it('wartet den langsamen Folgesong ab, statt ihn neu zu laden', async () => {
    const target = { uri: 'spotify:track:b', positionMs: 0 }
    let polls = 0
    let loaded = false
    let queued = false
    const switchAfter = BUFFER_WAIT_LIMIT + 40
    const warmup = createClipWarmup(
      warmupDeps({
        getState: async () => {
          polls += 1
          const switched = polls > switchAfter
          return {
            paused: false,
            positionMs: switched ? 40 + polls : 5_000,
            uri: switched ? target.uri : 'spotify:track:a',
            loading: false,
          }
        },
        handoff: async () => true,
        load: async () => {
          loaded = true
        },
        queueFollowing: async () => {
          queued = true
        },
      }),
    )

    await warmup.play(target)
    expect(loaded).toBe(false)
    expect(queued).toBe(true)
  })

  it('beginnt die Pufferwarte erst, wenn der neue URI wirklich anliegt', async () => {
    const target = { uri: 'spotify:track:b', positionMs: 12_000 }
    let polls = 0
    let loaded = false
    let paused = false
    let position = 0
    const switchAfter = BUFFER_WAIT_LIMIT + 30
    const warmup = createClipWarmup(
      warmupDeps({
        getState: async () => {
          polls += 1
          if (!loaded || polls <= switchAfter) {
            return { paused: true, positionMs: 8_000, uri: 'spotify:track:a', loading: false }
          }
          if (!paused && position < target.positionMs) {
            position = Math.min(target.positionMs, position + 600)
          }
          return { paused, positionMs: position, uri: target.uri, loading: false }
        },
        load: async () => {
          loaded = true
          position = 0
        },
        pause: async () => {
          paused = true
        },
        resume: async () => {
          paused = false
        },
        seek: async (positionMs) => {
          position = positionMs
          paused = false
        },
      }),
    )

    await warmup.play(target)
    expect(loaded).toBe(true)
    expect(polls).toBeGreaterThan(BUFFER_WAIT_LIMIT)
  })

  it('lädt nach invalidate den nächsten Song, nicht den verworfenen', async () => {
    const first = { uri: 'spotify:track:a', positionMs: 0 }
    const second = { uri: 'spotify:track:b', positionMs: 0 }
    let uri = first.uri
    let position = 0
    let paused = true
    let loads: string[] = []
    const warmup = createClipWarmup(
      warmupDeps({
        getState: async () => ({ paused, positionMs: position, uri, loading: false }),
        load: async (next) => {
          loads.push(next.uri)
          uri = next.uri
          position = next.positionMs
          paused = false
        },
        pause: async () => {
          paused = true
        },
        resume: async () => {
          paused = false
          position += 30
        },
      }),
    )

    await warmup.prime(first)
    warmup.invalidate()
    loads = []
    await warmup.play(second)
    expect(loads).toContain(second.uri)
    expect(uri).toBe(second.uri)
  })
})

describe('noteColdBufferSample', () => {
  function sample(positionMs: number, loading = false, paused = false): WarmPlaybackState {
    return { paused, positionMs, uri: cue.uri, loading }
  }

  function feed(watch: ColdBufferWatch, state: WarmPlaybackState) {
    return noteColdBufferSample(watch, state, cue)
  }

  it('wartet den Positions-Rücksprung ab und gibt den Einsatz dann frei', () => {
    let watch = createColdBufferWatch()
    watch = feed(watch, sample(cue.positionMs + 2_400, true)).watch
    const reset = feed(watch, sample(cue.positionMs, false))
    expect(reset.ready).toBe(true)
  })

  it('gibt frei, sobald das Laden am Einsatz endet', () => {
    let watch = createColdBufferWatch()
    watch = feed(watch, sample(cue.positionMs, true)).watch
    expect(feed(watch, sample(cue.positionMs, false)).ready).toBe(true)
  })

  it('zählt einen kalten Lauf ohne Signal erst nach mehreren Takten', () => {
    let watch = createColdBufferWatch()
    let ready = false
    for (let poll = 0; poll < BUFFER_STABLE_POLLS; poll += 1) {
      const noted = feed(watch, sample(cue.positionMs + poll * 20))
      watch = noted.watch
      ready = noted.ready
    }
    expect(ready).toBe(true)
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

  it('lässt den ersten Play den laufenden Vorlauf beenden', async () => {
    let phase: 'idle' | 'playing' | 'paused' = 'idle'
    let position = 0
    let loads = 0
    let releaseLoad: () => void = () => undefined
    const loadGate = new Promise<void>((resolve) => {
      releaseLoad = resolve
    })
    const warmup = createClipWarmup(
      warmupDeps({
        getState: async () => {
          if (phase === 'idle') {
            return null
          }
          if (phase !== 'paused' && position < cue.positionMs + 80) {
            position += 200
          }
          return { paused: phase === 'paused', positionMs: position, uri: cue.uri }
        },
        load: async () => {
          loads += 1
          await loadGate
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

    const priming = warmup.prime(cue)
    const playing = warmup.play(cue)
    releaseLoad()
    await priming
    await playing
    expect(loads).toBe(1)
    expect(phase).toBe('playing')
  })

  it('startet den ersten Song nach dem Vorlauf erst hörbar am Einsatz', async () => {
    let phase: 'idle' | 'phantom' | 'live' | 'paused' = 'idle'
    let position = 0
    let volume = AUDIBLE_VOLUME
    let loads = 0
    let audibleResumes = 0
    let releaseLoad: () => void = () => undefined
    const loadGate = new Promise<void>((resolve) => {
      releaseLoad = resolve
    })
    const warmup = createClipWarmup(
      warmupDeps({
        getState: async () => {
          if (phase === 'idle') {
            return null
          }
          if (phase === 'phantom') {
            position += 700
            if (position > cue.positionMs + 2_000) {
              position = cue.positionMs
              phase = 'live'
            }
            return {
              paused: false,
              positionMs: position,
              uri: cue.uri,
              loading: phase === 'phantom',
            }
          }
          if (phase === 'live' && position < cue.positionMs + 40) {
            position += 20
          }
          return { paused: phase === 'paused', positionMs: position, uri: cue.uri, loading: false }
        },
        setVolume: async (next) => {
          volume = next
        },
        load: async () => {
          loads += 1
          await loadGate
          phase = 'phantom'
          position = 0
        },
        pause: async () => {
          phase = 'paused'
        },
        seek: async (positionMs) => {
          position = positionMs
          phase = 'live'
        },
        resume: async () => {
          if (volume > 0) {
            audibleResumes += 1
          }
          if (phase === 'paused') {
            phase = 'live'
          }
        },
      }),
    )

    const priming = warmup.prime(cue)
    const playing = warmup.play(cue)
    releaseLoad()
    await priming
    await playing
    expect(loads).toBe(1)
    expect(audibleResumes).toBe(1)
    expect(volume).toBe(AUDIBLE_VOLUME)
    expect(phase).toBe('live')
  })
})
