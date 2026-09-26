import { useEffect, useLayoutEffect, useRef } from 'react'

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
  const cancelWaitRef = useRef<() => void>(() => undefined)

  const { active, uri, positionMs, durationMs, replayNonce } = input

  useLayoutEffect(() => {
    handlersRef.current = input.handlers
  })

  useEffect(() => {
    if (!active || !uri || durationMs <= 0) {
      return () => {
        cancelWaitRef.current()
      }
    }

    const token = tokenRef.current + 1
    tokenRef.current = token
    let timer: ReturnType<typeof window.setTimeout> | null = null

    function enqueue(job: () => Promise<void>): void {
      chainRef.current = chainRef.current.then(job).catch(() => undefined)
    }

    function pauseClip(): void {
      enqueue(async () => {
        await handlersRef.current.onPauseClip()
      })
    }

    enqueue(async () => {
      if (tokenRef.current !== token) {
        return
      }
      handlersRef.current.onPlayback('playing')
      try {
        await handlersRef.current.onPlayClip(uri, positionMs)
      } catch (cause) {
        if (tokenRef.current !== token) {
          return
        }
        handlersRef.current.onPlayback('paused')
        handlersRef.current.onError(clipErrorMessage(cause))
        return
      }
      if (tokenRef.current !== token) {
        await handlersRef.current.onPauseClip()
        return
      }
      await waitForClip(durationMs, (nextTimer, cancel) => {
        timer = nextTimer
        cancelWaitRef.current = cancel
      })
      cancelWaitRef.current = () => undefined
      if (timer !== null) {
        window.clearTimeout(timer)
        timer = null
      }
      if (tokenRef.current !== token) {
        return
      }
      handlersRef.current.onPlayback('paused')
      await handlersRef.current.onPauseClip()
    })

    return () => {
      tokenRef.current += 1
      if (timer !== null) {
        window.clearTimeout(timer)
      }
      cancelWaitRef.current()
      cancelWaitRef.current = () => undefined
      handlersRef.current.onPlayback('paused')
      pauseClip()
    }
  }, [active, uri, positionMs, durationMs, replayNonce])
}

function waitForClip(
  durationMs: number,
  remember: (timer: ReturnType<typeof window.setTimeout>, cancel: () => void) => void,
): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, durationMs)
    remember(timer, resolve)
  })
}

function clipErrorMessage(cause: unknown): string {
  if (cause instanceof Error && cause.message) {
    return cause.message
  }
  return 'Wiedergabe fehlgeschlagen.'
}
