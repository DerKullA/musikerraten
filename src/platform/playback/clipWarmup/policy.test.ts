import { describe, expect, it } from 'vitest'
import {
  BUFFER_STABLE_POLLS,
  CUE_POSITION_TOLERANCE_MS,
  PARK_SLOP_MS,
  PRIME_LEAD_MS,
  chooseWarmStart,
  choosePrimeAction,
  createColdBufferWatch,
  cueIsNear,
  cueReached,
  firstPlayIsReady,
  isBufferReset,
  noteColdBufferSample,
  normalizeCue,
  parkedNearCue,
  playbackHasStarted,
  playbackIsHeld,
  playheadEnteredCue,
  positionedAtCue,
  primeSeekMs,
  readQueuedTrackUri,
  readRequestedTrackUri,
  readWarmPlayback,
  sameClipCue,
  shouldPrimeParkedClip,
  type ClipCue,
  type WarmPlaybackState,
} from './policy.ts'

const CUE: ClipCue = { uri: 'spotify:track:a', positionMs: 10_000 }

function state(overrides: Partial<WarmPlaybackState> = {}): WarmPlaybackState {
  return { paused: false, positionMs: 10_000, uri: CUE.uri, loading: false, ...overrides }
}

describe('clipWarmupPolicy: Cue', () => {
  it('normalisiert Positionen auf nichtnegative ganze Millisekunden', () => {
    expect(normalizeCue({ uri: 'u', positionMs: 1234.9 })).toEqual({ uri: 'u', positionMs: 1234 })
    expect(normalizeCue({ uri: 'u', positionMs: -50 })).toEqual({ uri: 'u', positionMs: 0 })
    expect(normalizeCue({ uri: 'u', positionMs: Number.NaN })).toEqual({ uri: 'u', positionMs: 0 })
    expect(normalizeCue({ uri: 'u', positionMs: Number.POSITIVE_INFINITY })).toEqual({ uri: 'u', positionMs: 0 })
  })

  it('startet das Vorladen mit Vorlauf, aber nie vor 0', () => {
    expect(primeSeekMs(10_000)).toBe(10_000 - PRIME_LEAD_MS)
    expect(primeSeekMs(100)).toBe(0)
    expect(primeSeekMs(10_000, 1_000)).toBe(9_000)
  })

  it('erkennt gleiche Cues innerhalb der Toleranz', () => {
    expect(sameClipCue(CUE, { ...CUE, positionMs: 10_000 + CUE_POSITION_TOLERANCE_MS })).toBe(true)
    expect(sameClipCue(CUE, { ...CUE, positionMs: 10_000 + CUE_POSITION_TOLERANCE_MS + 1 })).toBe(false)
    expect(sameClipCue(CUE, { uri: 'spotify:track:b', positionMs: 10_000 })).toBe(false)
  })
})

describe('clipWarmupPolicy: Entscheidungen', () => {
  it('wählt die Vorlade-Aktion nach Titel und Position', () => {
    expect(choosePrimeAction(CUE, null)).toBe('load')
    expect(choosePrimeAction(CUE, state({ uri: null }))).toBe('load')
    expect(choosePrimeAction(CUE, state({ uri: 'spotify:track:b' }))).toBe('load')
    expect(choosePrimeAction(CUE, state({ positionMs: 10_100 }))).toBe('ready')
    expect(choosePrimeAction(CUE, state({ positionMs: 5_000 }))).toBe('seek')
  })

  it('wählt den Warm-Start nach Titel, Position und Pausenstatus', () => {
    expect(chooseWarmStart(CUE, null)).toBe('load')
    expect(chooseWarmStart(CUE, state({ uri: 'spotify:track:b' }))).toBe('load')
    expect(chooseWarmStart(CUE, state({ positionMs: 0 }))).toBe('seek-resume')
    expect(chooseWarmStart(CUE, state({ paused: true }))).toBe('resume')
    expect(chooseWarmStart(CUE, state({ paused: false }))).toBe('unmute')
  })

  it('erkennt, ob die Wiedergabe des Ziels begonnen hat', () => {
    expect(playbackHasStarted(CUE, state())).toBe(true)
    expect(playbackHasStarted(CUE, state({ paused: true }))).toBe(false)
    expect(playbackHasStarted(CUE, state({ uri: 'x' }))).toBe(false)
    expect(playbackHasStarted(CUE, null)).toBe(false)
  })

  it('shouldPrimeParkedClip verlangt Clip-Modus und aktuellen Token', () => {
    expect(shouldPrimeParkedClip('clip', 3, 3)).toBe(true)
    expect(shouldPrimeParkedClip('clip', 2, 3)).toBe(false)
    expect(shouldPrimeParkedClip('continue', 3, 3)).toBe(false)
  })
})

describe('clipWarmupPolicy: Positionsprüfungen', () => {
  it('firstPlayIsReady braucht zwei laufende, fortschreitende Proben am Cue', () => {
    const before = state({ positionMs: 10_000 })
    expect(firstPlayIsReady(CUE, before, state({ positionMs: 10_300 }))).toBe(true)
    expect(firstPlayIsReady(CUE, before, state({ positionMs: 10_000 }))).toBe(false)
    expect(firstPlayIsReady(CUE, null, state())).toBe(false)
    expect(firstPlayIsReady(CUE, state({ paused: true }), state({ positionMs: 10_300 }))).toBe(false)
    expect(firstPlayIsReady(CUE, before, state({ positionMs: 10_300, loading: true }))).toBe(false)
    expect(firstPlayIsReady(CUE, before, state({ positionMs: 9_000 }))).toBe(false)
    expect(firstPlayIsReady(CUE, before, state({ positionMs: 10_300, uri: 'x' }))).toBe(false)
  })

  it('cueReached und cueIsNear', () => {
    expect(cueReached(CUE, state({ positionMs: 9_820 }))).toBe(true)
    expect(cueReached(CUE, state({ positionMs: 9_819 }))).toBe(false)
    expect(cueReached(CUE, state({ uri: 'x' }))).toBe(false)
    expect(cueIsNear(CUE, state({ positionMs: 10_180 }))).toBe(true)
    expect(cueIsNear(CUE, state({ positionMs: 10_181 }))).toBe(false)
  })

  it('playheadEnteredCue braucht Vorwärtsbewegung bei laufender Wiedergabe', () => {
    expect(playheadEnteredCue(state({ positionMs: 9_900 }), state({ positionMs: 10_000 }), CUE)).toBe(true)
    expect(playheadEnteredCue(state({ positionMs: 10_000 }), state({ positionMs: 10_000 }), CUE)).toBe(false)
    expect(playheadEnteredCue(null, state(), CUE)).toBe(false)
    expect(playheadEnteredCue(state(), state({ paused: true, positionMs: 10_500 }), CUE)).toBe(false)
    expect(playheadEnteredCue(state({ positionMs: 5_000 }), state({ positionMs: 6_000 }), CUE)).toBe(false)
  })

  it('playbackIsHeld erkennt zwei pausierte Proben an derselben Stelle', () => {
    const held = state({ paused: true })
    expect(playbackIsHeld(held, state({ paused: true, positionMs: 10_100 }))).toBe(true)
    expect(playbackIsHeld(held, state({ paused: true, positionMs: 11_000 }))).toBe(false)
    expect(playbackIsHeld(held, state({ paused: false }))).toBe(false)
    expect(playbackIsHeld(null, held)).toBe(false)
    expect(playbackIsHeld(held, state({ paused: true, uri: 'x' }))).toBe(false)
  })

  it('positionedAtCue braucht Nähe am Cue und Pause (Zustand oder aktuell)', () => {
    expect(positionedAtCue(CUE, state({ paused: true }), false)).toBe(true)
    expect(positionedAtCue(CUE, state({ paused: false }), true)).toBe(true)
    expect(positionedAtCue(CUE, state({ paused: false }), false)).toBe(false)
    expect(positionedAtCue(CUE, state({ paused: true, positionMs: 0 }), true)).toBe(false)
    expect(positionedAtCue(CUE, null, true)).toBe(false)
  })

  it('parkedNearCue erlaubt Toleranz davor und PARK_SLOP_MS dahinter', () => {
    expect(parkedNearCue(CUE, state({ positionMs: 10_000 - CUE_POSITION_TOLERANCE_MS }))).toBe(true)
    expect(parkedNearCue(CUE, state({ positionMs: 10_000 - CUE_POSITION_TOLERANCE_MS - 1 }))).toBe(false)
    expect(parkedNearCue(CUE, state({ positionMs: 10_000 + PARK_SLOP_MS }))).toBe(true)
    expect(parkedNearCue(CUE, state({ positionMs: 10_000 + PARK_SLOP_MS + 1 }))).toBe(false)
    expect(parkedNearCue(CUE, state({ uri: 'x' }))).toBe(false)
  })
})

describe('clipWarmupPolicy: Puffer-Beobachtung', () => {
  it('erkennt einen Puffer-Reset ab 350 ms Rücksprung', () => {
    expect(isBufferReset(10_000, 9_650)).toBe(true)
    expect(isBufferReset(10_000, 9_651)).toBe(false)
    expect(isBufferReset(1_000, 2_000)).toBe(false)
  })

  it('setzt bei fremdem Titel oder fehlendem Zustand zurück', () => {
    const watch = { previous: state(), sawReset: true, stablePolls: 5 }
    expect(noteColdBufferSample(watch, null, CUE)).toEqual({ watch: createColdBufferWatch(), ready: false })
    expect(noteColdBufferSample(watch, state({ uri: 'x' }), CUE)).toEqual({ watch: createColdBufferWatch(), ready: false })
  })

  it('wartet bei Pause, Laden oder Position vor dem Cue und zählt dann Ruhe-Proben', () => {
    const start = createColdBufferWatch()
    const paused = noteColdBufferSample(start, state({ paused: true }), CUE)
    expect(paused.ready).toBe(false)
    expect(paused.watch.stablePolls).toBe(0)
    expect(noteColdBufferSample(start, state({ loading: true }), CUE).ready).toBe(false)
    expect(noteColdBufferSample(start, state({ positionMs: 5_000 }), CUE).ready).toBe(false)
  })

  it('wird nach BUFFER_STABLE_POLLS stabilen Proben bereit', () => {
    let watch = createColdBufferWatch()
    let ready = false
    for (let poll = 1; poll <= BUFFER_STABLE_POLLS; poll += 1) {
      const result = noteColdBufferSample(watch, state(), CUE)
      watch = result.watch
      ready = result.ready
      expect(watch.stablePolls).toBe(poll)
      expect(ready).toBe(poll >= BUFFER_STABLE_POLLS)
    }
    expect(ready).toBe(true)
  })

  it('wird sofort bereit nach einem Reset am Cue', () => {
    const first = noteColdBufferSample(createColdBufferWatch(), state({ positionMs: 10_500 }), CUE)
    const second = noteColdBufferSample(first.watch, state({ positionMs: 10_000 }), CUE)
    expect(second.ready).toBe(true)
    expect(second.watch.sawReset).toBe(true)
  })

  it('wird sofort bereit, wenn der vorherige Zustand noch lud', () => {
    const loading = noteColdBufferSample(createColdBufferWatch(), state({ loading: true }), CUE)
    expect(noteColdBufferSample(loading.watch, state(), CUE).ready).toBe(true)
  })
})

describe('clipWarmupPolicy: SDK-Zustand', () => {
  it('bevorzugt die angefragte URI aus linked_from', () => {
    expect(readRequestedTrackUri({ uri: 'spotify:track:regional', linked_from: { uri: 'spotify:track:orig' } })).toBe(
      'spotify:track:orig',
    )
    expect(readRequestedTrackUri({ uri: 'spotify:track:x', linked_from_uri: 'spotify:track:y' })).toBe('spotify:track:y')
    expect(readRequestedTrackUri({ uri: 'spotify:track:x', linked_from: { uri: '' } })).toBe('spotify:track:x')
    expect(readRequestedTrackUri({ uri: '' })).toBeNull()
    expect(readRequestedTrackUri(null)).toBeNull()
    expect(readRequestedTrackUri(undefined)).toBeNull()
  })

  it('liest den nächsten Titel nur, wenn er ein Spotify-Track ist', () => {
    expect(readQueuedTrackUri({ track_window: { next_tracks: [{ uri: 'spotify:track:n' }] } })).toBe('spotify:track:n')
    expect(readQueuedTrackUri({ track_window: { next_tracks: [{ uri: 'spotify:episode:n' }] } })).toBeNull()
    expect(readQueuedTrackUri({ track_window: { next_tracks: [] } })).toBeNull()
    expect(readQueuedTrackUri({ track_window: { next_tracks: null } })).toBeNull()
    expect(readQueuedTrackUri(null)).toBeNull()
  })

  it('wandelt den SDK-Zustand in einen Warm-Zustand um', () => {
    expect(readWarmPlayback(null)).toBeNull()
    expect(readWarmPlayback({ position: 10 })).toBeNull()
    expect(
      readWarmPlayback({
        paused: true,
        position: 1234.6,
        loading: true,
        track_window: { current_track: { uri: 'spotify:track:a' } },
      }),
    ).toEqual({ paused: true, positionMs: 1235, uri: 'spotify:track:a', loading: true })
    expect(readWarmPlayback({ paused: false, position: -5 })).toEqual({
      paused: false,
      positionMs: 0,
      uri: null,
      loading: false,
    })
    expect(readWarmPlayback({ paused: false, position: Number.NaN })?.positionMs).toBe(0)
  })
})
