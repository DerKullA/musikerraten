import { useEffect, useLayoutEffect, useRef, type MutableRefObject } from 'react'
import { runBackdropPlayback, type BackdropPosition, type BackdropTrack } from '../lib/bonusBackdrop.ts'
import { shouldPrimeParkedClip } from '../lib/clipWarmup.ts'
import { createCancellableDelay, holdPlaybackThen, runBoundedClip } from '../lib/clipPlayback.ts'

interface ClipHandlers {
  onPlayClip: (uri: string, positionMs: number) => Promise<void>
  onResumeClip: () => Promise<void>
  onPauseClip: () => Promise<void>
  onPrimeClip?: (uri: string, positionMs: number) => Promise<void>
  onInvalidateClip?: () => void
  onReadPosition?: () => Promise<BackdropPosition | null>
  onNextBackdropTrack?: (finishedUri: string) => BackdropTrack | null
  onPlayback: (state: 'playing' | 'paused') => void
  onFirstPlayReady?: () => void
  onError: (message: string) => void
  onComplete: () => void
}

interface ShotlessClipInput {
  active: boolean
  uri: string | null
  positionMs: number
  durationMs: number
  replayNonce: number
  playback: 'clip' | 'continue' | 'backdrop'
  releaseRef?: MutableRefObject<() => Promise<void>>
  suppressPauseRef?: MutableRefObject<boolean>
  handlers: ClipHandlers
}

export function useShotlessClipPlayback(input: ShotlessClipInput): void {
  const handlersRef = useRef(input.handlers)
  const chainRef = useRef<Promise<void>>(Promise.resolve())
  const tokenRef = useRef(0)
  const clipUriRef = useRef<string | null>(null)
  const clipWasActiveRef = useRef(false)
  const cancelDelayRef = useRef<() => void>(() => undefined)
  const releaseRef = useRef(input.releaseRef)
  const suppressPauseRef = useRef(input.suppressPauseRef)

  useLayoutEffect(() => {
    releaseRef.current = input.releaseRef
    suppressPauseRef.current = input.suppressPauseRef
  })

  const { active, uri, positionMs, durationMs, replayNonce, playback } = input

  useLayoutEffect(() => {
    handlersRef.current = input.handlers
  })

  useEffect(() => {
    const nextActive = Boolean(active && uri && durationMs > 0)
    if (uri && clipWasActiveRef.current && clipUriRef.current && clipUriRef.current !== uri) {
      handlersRef.current.onInvalidateClip?.()
    }
    if (uri) {
      clipUriRef.current = uri
    }
    clipWasActiveRef.current = nextActive

    function publishRelease(release: () => Promise<void>): void {
      const slot = releaseRef.current
      if (slot) {
        slot.current = release
      }
    }

    if (!active || !uri || durationMs <= 0) {
      publishRelease(async () => undefined)
      return () => {
        cancelDelayRef.current()
      }
    }

    const token = tokenRef.current + 1
    tokenRef.current = token
    const delay = createCancellableDelay()
    cancelDelayRef.current = () => {
      delay.cancel()
    }

    function enqueue(job: () => Promise<void>): Promise<void> {
      const settled = chainRef.current.then(job).catch(() => undefined)
      chainRef.current = settled
      return settled
    }

    async function releaseActivePlayback(): Promise<void> {
      tokenRef.current += 1
      delay.cancel()
      await enqueue(async () => {
        await handlersRef.current.onPauseClip()
      })
    }

    publishRelease(releaseActivePlayback)

    async function parkClipAtCue(clipUri: string, cueMs: number): Promise<void> {
      await handlersRef.current.onPauseClip()
      if (playback !== 'clip' || !shouldPrimeParkedClip('clip', token, tokenRef.current)) {
        return
      }
      await handlersRef.current.onPrimeClip?.(clipUri, cueMs)
    }

    const clipHandlers = {
      play: () =>
        playback === 'continue'
          ? handlersRef.current.onResumeClip()
          : handlersRef.current.onPlayClip(uri, positionMs),
      pause: () => parkClipAtCue(uri, positionMs),
      isCancelled: () => tokenRef.current !== token,
      onPlayback: (state: 'playing' | 'paused') => {
        handlersRef.current.onPlayback(state)
      },
      onFirstPlayReady: () => {
        handlersRef.current.onFirstPlayReady?.()
      },
      onError: (message: string) => {
        handlersRef.current.onError(message)
      },
    }

    enqueue(async () => {
      const wait = (delayMs: number) => delay.wait(delayMs)
      if (playback === 'backdrop') {
        await runBackdropPlayback(
          { uri, durationMs, positionMs, resume: true },
          {
            play: (nextUri, nextPosition) => handlersRef.current.onPlayClip(nextUri, nextPosition),
            resume: () => handlersRef.current.onResumeClip(),
            readPosition: () => handlersRef.current.onReadPosition?.() ?? Promise.resolve(null),
            nextTrack: (finishedUri) => handlersRef.current.onNextBackdropTrack?.(finishedUri) ?? null,
            isCancelled: () => tokenRef.current !== token,
            onPlayback: (state) => {
              handlersRef.current.onPlayback(state)
            },
            onError: (message) => {
              handlersRef.current.onError(message)
            },
          },
          wait,
        )
        return
      }
      if (playback === 'continue') {
        await holdPlaybackThen(durationMs, clipHandlers, wait, () => {
          if (tokenRef.current === token) {
            handlersRef.current.onComplete()
          }
        })
        return
      }
      await runBoundedClip(durationMs, clipHandlers, wait)
    })

    return () => {
      tokenRef.current += 1
      delay.cancel()
      cancelDelayRef.current = () => undefined
      const pauseSlot = suppressPauseRef.current
      if (pauseSlot?.current) {
        pauseSlot.current = false
        return
      }
      enqueue(async () => {
        await handlersRef.current.onPauseClip()
      })
    }
  }, [active, uri, positionMs, durationMs, replayNonce, playback])
}
