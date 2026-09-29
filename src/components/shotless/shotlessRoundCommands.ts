import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { prepareGuessHandoff, pickBackdropTrack, type BackdropTrack } from '../../lib/bonusBackdrop.ts'
import { POST_REVEAL_PLAY_MS } from '../../lib/phaseTimings.ts'
import {
  createShotlessRound,
  pickClipOrigin,
  reduceShotlessRound,
  type GuessSuggestion,
  type ShotlessGuessTarget,
  type ShotlessRound,
} from '../../lib/shotlessRules.ts'
import type { Track } from '../../types.ts'

export interface ShotlessCommandContext {
  query: string
  artistQuery: string
  openingOrigin: ShotlessRound['origin']
  roundRef: MutableRefObject<ShotlessRound>
  tracksRef: MutableRefObject<Track[]>
  guessTargetRef: MutableRefObject<ShotlessGuessTarget>
  clipPlayingRef: MutableRefObject<boolean>
  playedRef: MutableRefObject<BackdropTrack[]>
  blockAdvanceRef: MutableRefObject<boolean>
  queuedAdvanceRef: MutableRefObject<boolean>
  revealDeadlineRef: MutableRefObject<number | null>
  handoffRef: MutableRefObject<boolean>
  suppressPauseRef: MutableRefObject<boolean>
  releasePlaybackRef: MutableRefObject<() => Promise<void>>
  onPauseClipRef: MutableRefObject<() => Promise<void>>
  onReadPausedRef: MutableRefObject<(() => Promise<boolean | null>) | undefined>
  onReleaseSilenceRef: MutableRefObject<(() => Promise<void>) | undefined>
  onPlaybackRef: MutableRefObject<(state: 'playing' | 'paused') => void>
  noteOutcomeRef: MutableRefObject<(winner: string | null) => boolean>
  dismissBonusRef: MutableRefObject<() => void>
  setRound: Dispatch<SetStateAction<ShotlessRound>>
  setQuery: Dispatch<SetStateAction<string>>
  setArtistQuery: Dispatch<SetStateAction<string>>
  setPlaybackError: Dispatch<SetStateAction<string | null>>
  setClipPlaying: Dispatch<SetStateAction<boolean>>
  setRevealHoldMs: Dispatch<SetStateAction<number>>
  setBonusClosing: Dispatch<SetStateAction<boolean>>
}

function restartsGuessingClip(current: ShotlessRound, next: ShotlessRound): boolean {
  if (next.view !== 'guessing') {
    return false
  }
  return (
    next.replayNonce !== current.replayNonce ||
    next.stageIndex !== current.stageIndex ||
    next.trackIndex !== current.trackIndex
  )
}

function clearGuessDraft(ctx: ShotlessCommandContext): void {
  ctx.setQuery('')
  ctx.setArtistQuery('')
}

function markClipPlaying(ctx: ShotlessCommandContext, playing: boolean): void {
  ctx.clipPlayingRef.current = playing
  ctx.setClipPlaying(playing)
}

function applyRound(ctx: ShotlessCommandContext, next: ShotlessRound): void {
  const current = ctx.roundRef.current
  if (current.view !== 'reveal' && next.view === 'reveal') {
    const triggered = ctx.noteOutcomeRef.current(next.winner)
    if (triggered) {
      ctx.blockAdvanceRef.current = true
      ctx.revealDeadlineRef.current = Date.now() + POST_REVEAL_PLAY_MS
    } else {
      ctx.revealDeadlineRef.current = null
      ctx.setRevealHoldMs(POST_REVEAL_PLAY_MS)
    }
  }
  if (next.trackIndex !== current.trackIndex || next.stageIndex !== current.stageIndex) {
    clearGuessDraft(ctx)
  }
  if (next.view === 'reveal' || next.feedback) {
    clearGuessDraft(ctx)
  }
  ctx.setRound(next)
}

function commitRound(ctx: ShotlessCommandContext, next: ShotlessRound): void {
  if (restartsGuessingClip(ctx.roundRef.current, next)) {
    markClipPlaying(ctx, true)
  }
  applyRound(ctx, next)
}

function waitForGuessPause(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, delayMs)
  })
}

export function shotlessRoundCommands(ctx: ShotlessCommandContext) {
  return {
    reportClipPlayback(state: 'playing' | 'paused'): void {
      markClipPlaying(ctx, state === 'playing')
      ctx.onPlaybackRef.current(state)
    },
    advanceAfterReveal(): void {
      if (ctx.blockAdvanceRef.current) {
        ctx.queuedAdvanceRef.current = true
        return
      }
      ctx.setPlaybackError(null)
      clearGuessDraft(ctx)
      ctx.setRound((current) => {
        if (current.view !== 'reveal') {
          return current
        }
        return reduceShotlessRound(current, {
          type: 'next',
          trackCount: ctx.tracksRef.current.length,
          origin: pickClipOrigin(),
        })
      })
    },
    async dismissBonusAndMaybeAdvance(): Promise<void> {
      if (ctx.handoffRef.current) {
        return
      }
      ctx.handoffRef.current = true
      ctx.setBonusClosing(true)
      const origin = pickClipOrigin()
      const current = ctx.roundRef.current
      const next = reduceShotlessRound(current, {
        type: 'next',
        trackCount: ctx.tracksRef.current.length,
        origin,
      })
      try {
        await ctx.releasePlaybackRef.current()
        await prepareGuessHandoff({
          readPaused: () => ctx.onReadPausedRef.current?.() ?? Promise.resolve(null),
          pause: () => ctx.onPauseClipRef.current(),
          prime: async () => undefined,
          wait: waitForGuessPause,
        })
      } catch (cause) {
        ctx.setPlaybackError(cause instanceof Error && cause.message ? cause.message : 'Wiedergabe fehlgeschlagen.')
      }
      ctx.suppressPauseRef.current = true
      try {
        await ctx.onReleaseSilenceRef.current?.()
      } catch {
        // Die nächste Clip-Wiedergabe hebt die Stille selbst auf.
      }
      ctx.blockAdvanceRef.current = false
      ctx.queuedAdvanceRef.current = false
      ctx.revealDeadlineRef.current = null
      clearGuessDraft(ctx)
      ctx.setBonusClosing(false)
      ctx.dismissBonusRef.current()
      if (restartsGuessingClip(current, next)) {
        markClipPlaying(ctx, true)
      }
      ctx.setRound((latest) => (latest.view === 'reveal' ? next : latest))
      ctx.handoffRef.current = false
    },
    nextBackdropTrack(finishedUri: string): BackdropTrack | null {
      return pickBackdropTrack(ctx.playedRef.current, finishedUri, Math.random)
    },
    beginRound(): void {
      ctx.setPlaybackError(null)
      clearGuessDraft(ctx)
      markClipPlaying(ctx, true)
      ctx.playedRef.current = []
      ctx.setRevealHoldMs(POST_REVEAL_PLAY_MS)
      ctx.setRound(createShotlessRound(ctx.openingOrigin))
    },
    onSkip(): void {
      commitRound(ctx, reduceShotlessRound(ctx.roundRef.current, { type: 'skip' }))
    },
    onListen(): void {
      if (ctx.clipPlayingRef.current || ctx.roundRef.current.view !== 'guessing') {
        return
      }
      ctx.setPlaybackError(null)
      commitRound(ctx, reduceShotlessRound(ctx.roundRef.current, { type: 'replay' }))
    },
    onClaim(): void {
      applyRound(ctx, reduceShotlessRound(ctx.roundRef.current, { type: 'claim' }))
    },
    onNobody(): void {
      applyRound(ctx, reduceShotlessRound(ctx.roundRef.current, { type: 'nobody' }))
    },
    onAssign(name: string): void {
      applyRound(ctx, reduceShotlessRound(ctx.roundRef.current, { type: 'assign', name }))
    },
    onNext(): void {
      ctx.setPlaybackError(null)
      commitRound(
        ctx,
        reduceShotlessRound(ctx.roundRef.current, {
          type: 'next',
          trackCount: ctx.tracksRef.current.length,
          origin: pickClipOrigin(),
        }),
      )
    },
    onSubmitGuess(): void {
      const current = ctx.roundRef.current
      const currentTrack = ctx.tracksRef.current[current.trackIndex] ?? null
      const target = ctx.guessTargetRef.current
      clearGuessDraft(ctx)
      applyRound(
        ctx,
        reduceShotlessRound(current, {
          type: 'submit-guess',
          guess: ctx.query,
          artistGuess: target === 'both' ? ctx.artistQuery : '',
          title: currentTrack?.title ?? '',
          artist: currentTrack?.artist ?? '',
          target,
        }),
      )
    },
    onPickSuggestion(suggestion: GuessSuggestion): void {
      const target = ctx.guessTargetRef.current
      if (target === 'both') {
        if (suggestion.field === 'artist') {
          ctx.setArtistQuery(suggestion.label)
          return
        }
        ctx.setQuery(suggestion.label)
        return
      }
      const current = ctx.roundRef.current
      const currentTrack = ctx.tracksRef.current[current.trackIndex] ?? null
      clearGuessDraft(ctx)
      applyRound(
        ctx,
        reduceShotlessRound(current, {
          type: 'submit-guess',
          guess: suggestion.label,
          artistGuess: '',
          title: currentTrack?.title ?? '',
          artist: currentTrack?.artist ?? '',
          target,
        }),
      )
    },
  }
}
