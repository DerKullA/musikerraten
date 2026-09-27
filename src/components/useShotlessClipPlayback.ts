import { useEffect, useLayoutEffect, useRef } from 'react'
import { shouldPrimeParkedClip } from '../lib/clipWarmup.ts'
import { createCancellableDelay, holdPlaybackThen, runBoundedClip } from '../lib/clipPlayback.ts'

interface ClipHandlers {
  onPlayClip: (uri: string, positionMs: number) => Promise<void>
  onResumeClip: () => Promise<void>
  onPauseClip: () => Promise<void>
  onPrimeClip?: (uri: string, positionMs: number) => Promise<void>
  onPlayback: (state: 'playing' | 'paused') => void
  onError: (message: string) => void
  onComplete: () => void
}

interface ShotlessClipInput {
  active: boolean
  uri: string | null
  positionMs: number
  durationMs: number
  replayNonce: number
  playback: 'clip' | 'continue'
  handlers: ClipHandlers
}

export function useShotlessClipPlayback(input: ShotlessClipInput): void {
  const handlersRef = useRef(input.handlers)
  const chainRef = useRef<Promise<void>>(Promise.resolve())
  const tokenRef = useRef(0)
  const cancelDelayRef = useRef<() => void>(() => undefined)

  const { active, uri, positionMs, durationMs, replayNonce, playback } = input

  useLayoutEffect(() => {
    handlersRef.current = input.handlers
  })

  useEffect(() => {
    if (!active || !uri || durationMs <= 0) {
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

    function enqueue(job: () => Promise<void>): void {
      chainRef.current = chainRef.current.then(job).catch(() => undefined)
    }

    async function parkClipAtCue(clipUri: string, cueMs: number): Promise<void> {
      await handlersRef.current.onPauseClip()
      if (!shouldPrimeParkedClip(playback, token, tokenRef.current)) {
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
      onError: (message: string) => {
        handlersRef.current.onError(message)
      },
    }

    enqueue(async () => {
      const wait = (delayMs: number) => delay.wait(delayMs)
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
      enqueue(async () => {
        await handlersRef.current.onPauseClip()
      })
    }
  }, [active, uri, positionMs, durationMs, replayNonce, playback])
}
