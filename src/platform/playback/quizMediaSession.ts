export const QUIZ_MEDIA_TITLE = 'Musikerraten'
export const QUIZ_MEDIA_ARTIST = 'Playlist-Quiz'
export const QUIZ_MEDIA_ALBUM = 'Playlist-Quiz'
export const QUIZ_MEDIA_REASSERT_MS = 100

const QUIZ_MEDIA_RETRY_MS = [0, 40, 120, 280] as const

const MEDIA_ACTIONS = [
  'play',
  'pause',
  'stop',
  'seekbackward',
  'seekforward',
  'seekto',
  'previoustrack',
  'nexttrack',
  'skipad',
] as const

const BLANK_ARTWORK: readonly QuizMediaImage[] = [
  {
    src: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    sizes: '1x1',
    type: 'image/gif',
  },
]

export interface QuizMediaImage {
  src: string
  sizes?: string
  type?: string
}

export interface QuizMediaMetadata {
  title: string
  artist: string
  album: string
  artwork: readonly QuizMediaImage[]
}

export type QuizMediaPlayback = 'none' | 'paused' | 'playing'

export interface QuizMediaSessionLike {
  metadata: QuizMediaMetadata | null
  playbackState: QuizMediaPlayback
  setActionHandler(action: string, handler: (() => void) | null): void
}

export interface QuizMediaClock {
  setInterval(callback: () => void, delayMs: number): number
  clearInterval(id: number): void
  setTimeout(callback: () => void, delayMs: number): number
  clearTimeout(id: number): void
}

export interface QuizMediaSessionHarness {
  session: QuizMediaSessionLike | null
  createMetadata?: (metadata: QuizMediaMetadata) => QuizMediaMetadata
  clock?: QuizMediaClock
}

export interface QuizPlaybackPlayer {
  addListener(event: string, callback: (payload: SpotifyPlayerEvent) => void): void
  removeListener(event: string, callback: (payload: SpotifyPlayerEvent) => void): void
}

let harness: QuizMediaSessionHarness | null = null
let epoch = 0
let active = false
let playback: QuizMediaPlayback = 'none'
let actionsBound = false
let intervalId: number | null = null
const pendingTimeouts = new Set<number>()
const trappedSessions = new WeakSet<object>()

export function setQuizMediaSessionHarness(next: QuizMediaSessionHarness | null): void {
  harness = next
}

export function isQuizMediaSessionActive(): boolean {
  return active
}

export function quizMediaToken(): number {
  return epoch
}

export function startQuizMediaSession(nextPlayback: QuizMediaPlayback = 'paused'): void {
  epoch += 1
  active = true
  playback = nextPlayback
  const session = currentSession()
  if (session) {
    ensureMetadataTrap(session)
    bindQuizMediaActions(session, onQuizMediaAction)
    actionsBound = true
  }
  applyQuizMetadata()
  ensureQuizMediaInterval()
  scheduleQuizMediaBurst()
}

export function syncQuizMediaPlayback(nextPlayback: QuizMediaPlayback): void {
  if (!active) {
    return
  }
  playback = nextPlayback
  holdQuizMediaSession()
}

export function holdQuizMediaSession(): void {
  if (!active) {
    return
  }
  applyQuizMetadata()
  scheduleQuizMediaBurst()
}

export function stopQuizMediaSession(): void {
  epoch += 1
  active = false
  playback = 'none'
  clearQuizMediaTimers()
  const session = currentSession()
  if (session && actionsBound) {
    bindQuizMediaActions(session, null)
  }
  actionsBound = false
  if (!session) {
    return
  }
  writeSession(session, null, 'none')
}

function writeSession(
  session: QuizMediaSessionLike,
  metadata: QuizMediaMetadata | null,
  nextPlayback: QuizMediaPlayback,
): void {
  try {
    session.metadata = metadata
    session.playbackState = nextPlayback
  } catch {
    // Die Media Session darf Wiedergabe und Timer nicht abbrechen.
  }
}

export function stopQuizMediaSessionIfCurrent(token: number): void {
  if (token !== epoch) {
    return
  }
  stopQuizMediaSession()
}

export function watchQuizPlayback(player: QuizPlaybackPlayer): () => void {
  function onPlayerStateChanged(): void {
    holdQuizMediaSession()
  }
  player.addListener('player_state_changed', onPlayerStateChanged)
  return function unwatchQuizPlayback(): void {
    player.removeListener('player_state_changed', onPlayerStateChanged)
  }
}

function onQuizMediaAction(): void {}

function quizMetadataTemplate(): QuizMediaMetadata {
  return {
    title: QUIZ_MEDIA_TITLE,
    artist: QUIZ_MEDIA_ARTIST,
    album: QUIZ_MEDIA_ALBUM,
    artwork: BLANK_ARTWORK.map(function copyArtwork(image) {
      return { src: image.src, sizes: image.sizes, type: image.type }
    }),
  }
}

function currentSession(): QuizMediaSessionLike | null {
  if (harness) {
    return harness.session
  }
  return browserMediaSession()
}

function currentClock(): QuizMediaClock {
  if (harness?.clock) {
    return harness.clock
  }
  return browserClock()
}

function createMetadata(metadata: QuizMediaMetadata): QuizMediaMetadata {
  if (harness?.createMetadata) {
    return harness.createMetadata(metadata)
  }
  return createBrowserMetadata(metadata)
}

function browserMediaSession(): QuizMediaSessionLike | null {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !navigator.mediaSession) {
    return null
  }
  return navigator.mediaSession as unknown as QuizMediaSessionLike
}

function createBrowserMetadata(metadata: QuizMediaMetadata): QuizMediaMetadata {
  if (typeof MediaMetadata !== 'function') {
    return quizMetadataTemplate()
  }
  return new MediaMetadata({
    title: metadata.title,
    artist: metadata.artist,
    album: metadata.album,
    artwork: metadata.artwork.map(function copyBrowserArtwork(image) {
      return { src: image.src, sizes: image.sizes, type: image.type }
    }),
  })
}

function browserClock(): QuizMediaClock {
  return {
    setInterval(callback, delayMs) {
      return window.setInterval(callback, delayMs)
    },
    clearInterval(id) {
      window.clearInterval(id)
    },
    setTimeout(callback, delayMs) {
      return window.setTimeout(callback, delayMs)
    },
    clearTimeout(id) {
      window.clearTimeout(id)
    },
  }
}

function applyQuizMetadata(): void {
  const session = currentSession()
  if (!session || !active) {
    return
  }
  ensureMetadataTrap(session)
  writeSession(session, quizMetadataTemplate(), playback)
}

function ensureQuizMediaInterval(): void {
  if (intervalId !== null) {
    return
  }
  intervalId = currentClock().setInterval(reassertQuizMedia, QUIZ_MEDIA_REASSERT_MS)
}

function reassertQuizMedia(): void {
  applyQuizMetadata()
}

function scheduleQuizMediaBurst(): void {
  const token = epoch
  const clock = currentClock()
  for (const delayMs of QUIZ_MEDIA_RETRY_MS) {
    const timeoutId = clock.setTimeout(function retryQuizMedia() {
      pendingTimeouts.delete(timeoutId)
      if (token !== epoch || !active) {
        return
      }
      applyQuizMetadata()
    }, delayMs)
    pendingTimeouts.add(timeoutId)
  }
}

function clearQuizMediaTimers(): void {
  const clock = currentClock()
  if (intervalId !== null) {
    clock.clearInterval(intervalId)
    intervalId = null
  }
  for (const timeoutId of pendingTimeouts) {
    clock.clearTimeout(timeoutId)
  }
  pendingTimeouts.clear()
}

function bindQuizMediaActions(session: QuizMediaSessionLike, handler: (() => void) | null): void {
  if (typeof session.setActionHandler !== 'function') {
    return
  }
  for (const action of MEDIA_ACTIONS) {
    try {
      session.setActionHandler(action, handler)
    } catch {
      // Diese Aktion kennt der Browser nicht.
    }
  }
}

function ensureMetadataTrap(session: QuizMediaSessionLike): void {
  if (trappedSessions.has(session)) {
    return
  }
  try {
    installMetadataTrap(session)
    trappedSessions.add(session)
  } catch {
    // Manche Browser sperren die Eigenschaft. Das Intervall schreibt trotzdem.
  }
}

function installMetadataTrap(session: QuizMediaSessionLike): void {
  const descriptor = findMetadataDescriptor(session)
  if (descriptor?.get && descriptor.set) {
    const read = descriptor.get
    const write = descriptor.set
    Object.defineProperty(session, 'metadata', {
      configurable: true,
      enumerable: descriptor.enumerable ?? true,
      get() {
        return read.call(session) as QuizMediaMetadata | null
      },
      set(value: QuizMediaMetadata | null) {
        write.call(session, active ? createMetadata(quizMetadataTemplate()) : value)
      },
    })
    return
  }

  let stored: QuizMediaMetadata | null = session.metadata
  Object.defineProperty(session, 'metadata', {
    configurable: true,
    enumerable: true,
    get() {
      return stored
    },
    set(value: QuizMediaMetadata | null) {
      stored = active ? createMetadata(quizMetadataTemplate()) : value
    },
  })
}

function findMetadataDescriptor(session: object): PropertyDescriptor | undefined {
  const own = Object.getOwnPropertyDescriptor(session, 'metadata')
  if (own?.get && own.set) {
    return own
  }
  let prototype = Object.getPrototypeOf(session) as object | null
  while (prototype) {
    const inherited = Object.getOwnPropertyDescriptor(prototype, 'metadata')
    if (inherited?.get && inherited.set) {
      return inherited
    }
    prototype = Object.getPrototypeOf(prototype) as object | null
  }
  return own
}
