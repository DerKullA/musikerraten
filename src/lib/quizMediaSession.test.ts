import { afterEach, describe, expect, it } from 'vitest'
import {
  holdQuizMediaSession,
  isQuizMediaSessionActive,
  QUIZ_MEDIA_ALBUM,
  QUIZ_MEDIA_ARTIST,
  QUIZ_MEDIA_REASSERT_MS,
  QUIZ_MEDIA_TITLE,
  quizMediaToken,
  setQuizMediaSessionHarness,
  startQuizMediaSession,
  stopQuizMediaSession,
  stopQuizMediaSessionIfCurrent,
  syncQuizMediaPlayback,
  watchQuizPlayback,
  type QuizMediaClock,
  type QuizMediaImage,
  type QuizMediaMetadata,
  type QuizMediaPlayback,
  type QuizMediaSessionLike,
} from './quizMediaSession.ts'
const BLANK_ART_SRC =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

function copyMetadata(metadata: QuizMediaMetadata): QuizMediaMetadata {
  return {
    title: metadata.title,
    artist: metadata.artist,
    album: metadata.album,
    artwork: metadata.artwork.map(function copyImage(image) {
      return { src: image.src, sizes: image.sizes, type: image.type }
    }),
  }
}

class ManualClock implements QuizMediaClock {
  interval: (() => void) | null = null
  intervalDelay = 0
  intervalSets = 0
  private nextId = 1
  private readonly timeouts = new Map<number, { callback: () => void; cleared: boolean }>()

  setInterval(callback: () => void, delayMs: number): number {
    this.interval = callback
    this.intervalDelay = delayMs
    this.intervalSets += 1
    return this.nextId++
  }

  clearInterval(): void {
    this.interval = null
  }

  setTimeout(callback: () => void, _delayMs: number): number {
    const id = this.nextId++
    this.timeouts.set(id, { callback, cleared: false })
    return id
  }

  clearTimeout(id: number): void {
    const timeout = this.timeouts.get(id)
    if (timeout) {
      timeout.cleared = true
    }
  }

  fireInterval(): void {
    this.interval?.()
  }

  fireTimeouts(): void {
    for (const timeout of this.timeouts.values()) {
      if (timeout.cleared) {
        continue
      }
      timeout.cleared = true
      timeout.callback()
    }
  }

  pendingTimeouts(): number {
    let pending = 0
    for (const timeout of this.timeouts.values()) {
      if (!timeout.cleared) {
        pending += 1
      }
    }
    return pending
  }
}

class FakeMediaSession implements QuizMediaSessionLike {
  playbackState: QuizMediaPlayback = 'none'
  readonly handlers = new Map<string, (() => void) | null>()
  throwOnAction: string | null = null
  private raw: QuizMediaMetadata | null = null

  get metadata(): QuizMediaMetadata | null {
    return this.raw
  }

  set metadata(value: QuizMediaMetadata | null) {
    this.raw = value
  }

  setActionHandler(action: string, handler: (() => void) | null): void {
    if (this.throwOnAction === action) {
      throw new Error(`Aktion ${action} fehlt.`)
    }
    this.handlers.set(action, handler)
  }

  forceMetadata(value: QuizMediaMetadata | null): void {
    this.raw = value
  }
}

function spoiler(): QuizMediaMetadata {
  const artwork: QuizMediaImage[] = [
    { src: 'https://i.scdn.co/image/real-album', sizes: '300x300', type: 'image/jpeg' },
  ]
  return {
    title: 'Echter Titel',
    artist: 'Echte Band',
    album: 'Echtes Album',
    artwork,
  }
}

function expectNeutral(metadata: QuizMediaMetadata | null): void {
  expect(metadata).not.toBeNull()
  expect(metadata?.title).toBe(QUIZ_MEDIA_TITLE)
  expect(metadata?.artist).toBe(QUIZ_MEDIA_ARTIST)
  expect(metadata?.album).toBe(QUIZ_MEDIA_ALBUM)
  expect(metadata?.artwork.map((image) => image.src)).toEqual([BLANK_ART_SRC])
}

describe('quizMediaSession', () => {
  let clock: ManualClock
  let session: FakeMediaSession

  afterEach(() => {
    stopQuizMediaSession()
    setQuizMediaSessionHarness(null)
  })

  function mount(): void {
    clock = new ManualClock()
    session = new FakeMediaSession()
    setQuizMediaSessionHarness({
      session,
      clock,
      createMetadata: copyMetadata,
    })
  }

  it('shows a generic label and blank artwork for the whole session', () => {
    mount()
    startQuizMediaSession('playing')

    expectNeutral(session.metadata)
    expect(session.playbackState).toBe('playing')
    expect(session.handlers.get('play')).toEqual(expect.any(Function))
    expect(session.handlers.get('nexttrack')).toEqual(expect.any(Function))
    expect(clock.intervalDelay).toBe(QUIZ_MEDIA_REASSERT_MS)
    expect(isQuizMediaSessionActive()).toBe(true)
  })

  it('replaces a real track title as soon as something writes it', () => {
    mount()
    startQuizMediaSession('playing')

    session.metadata = spoiler()

    expectNeutral(session.metadata)
    expect(session.playbackState).toBe('playing')
  })

  it('writes the generic label again on the interval and after playback changes', () => {
    mount()
    startQuizMediaSession('playing')
    session.forceMetadata(spoiler())

    clock.fireInterval()

    expectNeutral(session.metadata)

    syncQuizMediaPlayback('paused')
    session.forceMetadata(spoiler())
    clock.fireTimeouts()

    expectNeutral(session.metadata)
    expect(session.playbackState).toBe('paused')
  })

  it('reasserts when the Spotify player reports a state change', () => {
    mount()
    const player = new FakePlaybackPlayer()
    const unwatch = watchQuizPlayback(player)
    startQuizMediaSession('playing')
    session.forceMetadata(spoiler())

    player.emit('player_state_changed')

    expectNeutral(session.metadata)
    unwatch()
    expect(player.listenerCount('player_state_changed')).toBe(0)
  })

  it('ignores player updates and leaves custom metadata after the session ends', () => {
    mount()
    const player = new FakePlaybackPlayer()
    watchQuizPlayback(player)
    startQuizMediaSession('playing')
    const intervalSets = clock.intervalSets

    stopQuizMediaSession()
    session.metadata = spoiler()
    player.emit('player_state_changed')
    holdQuizMediaSession()

    expect(session.metadata?.title).toBe('Echter Titel')
    expect(session.playbackState).toBe('none')
    expect(session.handlers.get('play')).toBeNull()
    expect(session.handlers.get('pause')).toBeNull()
    expect(clock.interval).toBeNull()
    expect(clock.pendingTimeouts()).toBe(0)
    expect(isQuizMediaSessionActive()).toBe(false)
    expect(intervalSets).toBe(1)
  })

  it('keeps a single interval when playback is only synced', () => {
    mount()
    startQuizMediaSession('paused')
    syncQuizMediaPlayback('playing')
    syncQuizMediaPlayback('paused')

    expect(clock.intervalSets).toBe(1)
    expect(session.playbackState).toBe('paused')
    expectNeutral(session.metadata)
  })

  it('does not let a stale stop clear a newer game session', () => {
    mount()
    startQuizMediaSession('paused')
    const firstToken = quizMediaToken()
    startQuizMediaSession('playing')

    stopQuizMediaSessionIfCurrent(firstToken)

    expect(isQuizMediaSessionActive()).toBe(true)
    expectNeutral(session.metadata)
    expect(session.playbackState).toBe('playing')
  })

  it('survives an unsupported media action and a missing session', () => {
    mount()
    session.throwOnAction = 'skipad'

    expect(() => startQuizMediaSession('playing')).not.toThrow()
    expectNeutral(session.metadata)
    expect(session.handlers.get('play')).toEqual(expect.any(Function))

    stopQuizMediaSession()
    const emptyClock = new ManualClock()
    setQuizMediaSessionHarness({ session: null, clock: emptyClock, createMetadata: copyMetadata })
    expect(() => startQuizMediaSession('playing')).not.toThrow()
    expect(emptyClock.intervalDelay).toBe(QUIZ_MEDIA_REASSERT_MS)
  })
})

class FakePlaybackPlayer {
  private readonly listeners = new Map<string, Set<(payload: SpotifyPlayerEvent) => void>>()

  addListener(event: string, callback: (payload: SpotifyPlayerEvent) => void): void {
    const group = this.listeners.get(event) ?? new Set()
    group.add(callback)
    this.listeners.set(event, group)
  }

  removeListener(event: string, callback: (payload: SpotifyPlayerEvent) => void): void {
    this.listeners.get(event)?.delete(callback)
  }

  emit(event: string): void {
    for (const callback of this.listeners.get(event) ?? []) {
      callback({})
    }
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0
  }
}
