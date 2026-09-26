import { useEffect, useLayoutEffect, useRef } from 'react'
import { createCancellableDelay, runBoundedClip } from '../lib/clipPlayback.ts'

interface ClipHandlers {
  onPlayClip: (uri: string, positionMs: number) => Promise<void>
  onPauseClip: () => Promise<void>
  onPlayback: (state: 'playing' | 'paused') => void
  onError: (message: string) => void
}

interface ShotlessClipInput {
  active: boolean
  uri: string | null
  positionMs: number
  durationMs: number
  replayNonce: number
  handlers: ClipHandlers
}

export function useShotlessClipPlayback(input: ShotlessClipInput): void {
  const handlersRef = useRef(input.handlers)
  const chainRef = useRef<Promise<void>>(Promise.resolve())
  const tokenRef = useRef(0)
  const cancelDelayRef = useRef<() => void>(() => undefined)

  const { active, uri, positionMs, durationMs, replayNonce } = input

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

    enqueue(async () => {
      await runBoundedClip(
        durationMs,
        {
          play: () => handlersRef.current.onPlayClip(uri, positionMs),
          pause: () => handlersRef.current.onPauseClip(),
          isCancelled: () => tokenRef.current !== token,
          onPlayback: (state) => {
            handlersRef.current.onPlayback(state)
          },
          onError: (message) => {
            handlersRef.current.onError(message)
          },
        },
        (delayMs) => delay.wait(delayMs),
      )
    })

    return () => {
      tokenRef.current += 1
      delay.cancel()
      cancelDelayRef.current = () => undefined
      handlersRef.current.onPlayback('paused')
      enqueue(async () => {
        await handlersRef.current.onPauseClip()
      })
    }
  }, [active, uri, positionMs, durationMs, replayNonce])
}
