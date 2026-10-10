import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { rememberPlayedTrack, type BackdropPosition, type BackdropTrack } from '@/lib/bonusBackdrop.ts'
import { POST_REVEAL_PLAY_MS } from '@/lib/phaseTimings.ts'
import { suggestGuesses } from '@/lib/guessSuggestions.ts'
import { clipStartMs, createShotlessRound, stageByIndex, type GuessSuggestion, type ShotlessGuessTarget, type ShotlessMode, type ShotlessRound } from '@/lib/shotlessRules.ts'
import type { Track } from '@/types.ts'
import { useLoserBonus } from '@/components/useLoserBonus.ts'
import { useShotlessClipPlayback } from '@/components/useShotlessClipPlayback.ts'
import { useGameDebugWatch } from '@/platform/diagnostics/useGameDebug.ts'
import { shotlessRoundCommands, type WrongPopup } from './shotlessRoundCommands.ts'

const NO_GUESSES: readonly GuessSuggestion[] = []

interface ShotlessRoundInput {
  tracks: Track[]
  started: boolean
  mode: ShotlessMode | null
  guessTarget: ShotlessGuessTarget
  openingOrigin: ShotlessRound['origin']
  onPlayClip: (uri: string, positionMs: number) => Promise<void>
  onResumeClip: () => Promise<void>
  onPauseClip: () => Promise<void>
  onPrimeClip?: (uri: string, positionMs: number) => Promise<void>
  onInvalidateClip?: () => void
  onReadPosition?: () => Promise<BackdropPosition | null>
  onReadPaused?: () => Promise<boolean | null>
  onReleaseSilence?: () => Promise<void>
  onPlayback: (state: 'playing' | 'paused') => void
}

export function useShotlessRound(input: ShotlessRoundInput) {
  const { tracks, started, mode, guessTarget, openingOrigin } = input
  const [round, setRound] = useState<ShotlessRound>(() => createShotlessRound())
  const [query, setQuery] = useState('')
  const [artistQuery, setArtistQuery] = useState('')
  const [playbackError, setPlaybackError] = useState<string | null>(null)
  const [clipPlaying, setClipPlaying] = useState(false)
  const [readyClipKey, setReadyClipKey] = useState<string | null>(null)
  const [revealHoldMs, setRevealHoldMs] = useState(POST_REVEAL_PLAY_MS)
  const [bonusClosing, setBonusClosing] = useState(false)
  const [wrongPopup, setWrongPopup] = useState<WrongPopup | null>(null)
  const { bonusWinner, noteLoserBonusOutcome, dismissLoserBonus, revokeLoserBonusOutcome } = useLoserBonus()

  const onPrimeClipRef = useRef(input.onPrimeClip)
  const onPauseClipRef = useRef(input.onPauseClip)
  const onReadPausedRef = useRef(input.onReadPaused)
  const onReleaseSilenceRef = useRef(input.onReleaseSilence)
  const onPlaybackRef = useRef(input.onPlayback)
  const releasePlaybackRef = useRef<() => Promise<void>>(async () => undefined)
  const suppressPauseRef = useRef(false)
  const handoffRef = useRef(false)
  const clipPlayingRef = useRef(false)
  const blockAdvanceRef = useRef(false)
  const queuedAdvanceRef = useRef(false)
  const playedRef = useRef<BackdropTrack[]>([])
  const revealDeadlineRef = useRef<number | null>(null)
  const roundRef = useRef(round)
  const tracksRef = useRef(tracks)
  const guessTargetRef = useRef(guessTarget)
  const noteOutcomeRef = useRef(noteLoserBonusOutcome)
  const dismissBonusRef = useRef(dismissLoserBonus)
  const revokeOutcomeRef = useRef(revokeLoserBonusOutcome)

  const commandsRef = useRef<ReturnType<typeof shotlessRoundCommands> | null>(null)

  useLayoutEffect(() => {
    roundRef.current = round
    tracksRef.current = tracks
    guessTargetRef.current = guessTarget
    noteOutcomeRef.current = noteLoserBonusOutcome
    dismissBonusRef.current = dismissLoserBonus
    revokeOutcomeRef.current = revokeLoserBonusOutcome
    commandsRef.current = shotlessRoundCommands({
      query,
      artistQuery,
      openingOrigin,
      roundRef,
      tracksRef,
      guessTargetRef,
      clipPlayingRef,
      playedRef,
      blockAdvanceRef,
      queuedAdvanceRef,
      revealDeadlineRef,
      handoffRef,
      suppressPauseRef,
      releasePlaybackRef,
      onPauseClipRef,
      onReadPausedRef,
      onReleaseSilenceRef,
      onPlaybackRef,
      noteOutcomeRef,
      dismissBonusRef,
      revokeOutcomeRef,
      setWrongPopup,
      setRound,
      setQuery,
      setArtistQuery,
      setPlaybackError,
      setClipPlaying,
      setRevealHoldMs,
      setBonusClosing,
    })
    onPrimeClipRef.current = input.onPrimeClip
    onPauseClipRef.current = input.onPauseClip
    onReadPausedRef.current = input.onReadPaused
    onReleaseSilenceRef.current = input.onReleaseSilence
    onPlaybackRef.current = input.onPlayback
  })

  function readyCommands(): ReturnType<typeof shotlessRoundCommands> {
    const commands = commandsRef.current
    if (!commands) {
      throw new Error('Shotless-Runde ist noch nicht bereit.')
    }
    return commands
  }

  const track = tracks[round.trackIndex] ?? null
  const stage = stageByIndex(round.stageIndex)
  const clipKey = `${round.trackIndex}:${round.stageIndex}:${round.replayNonce}:${round.view}`
  const firstPlayReady = readyClipKey === clipKey
  const clipActive = started && round.view === 'guessing' && track !== null
  const revealHold = started && round.view === 'reveal' && track !== null
  const openingTrack = tracks[0]

  useGameDebugWatch('shotless.stand', {
    gestartet: started,
    modus: mode,
    ansicht: round.view,
    stufe: round.stageIndex,
    index: round.trackIndex,
    ursprung: round.origin,
    wiederholung: round.replayNonce,
    sieger: round.winner,
    hinweis: round.feedback,
    aufloesung: round.revealMessage,
    titel: track?.title ?? null,
    interpret: track?.artist ?? null,
    uri: track?.uri ?? null,
    clip: clipPlaying,
    fehler: playbackError,
    bonus: bonusWinner,
    bonusZu: bonusClosing,
    wiedergabe: bonusWinner ? 'backdrop' : revealHold ? 'continue' : clipActive ? 'clip' : 'aus',
  })

  useEffect(() => {
    if (started || !openingTrack) {
      return
    }
    void onPrimeClipRef.current?.(openingTrack.uri, clipStartMs(openingTrack.durationMs, openingOrigin))
  }, [started, openingTrack, openingOrigin])

  useShotlessClipPlayback({
    active: clipActive || revealHold,
    uri: track?.uri ?? null,
    positionMs: track ? clipStartMs(track.durationMs, round.origin) : 0,
    durationMs: bonusWinner ? (track?.durationMs ?? 0) : revealHold ? revealHoldMs : stage.durationMs,
    replayNonce: round.replayNonce,
    playback: bonusWinner ? 'backdrop' : revealHold ? 'continue' : 'clip',
    releaseRef: releasePlaybackRef,
    suppressPauseRef,
    handlers: {
      onPlayClip: input.onPlayClip,
      onResumeClip: input.onResumeClip,
      onPauseClip: input.onPauseClip,
      onPrimeClip: input.onPrimeClip,
      onInvalidateClip: input.onInvalidateClip,
      onReadPosition: input.onReadPosition,
      onNextBackdropTrack: (finishedUri) => readyCommands().nextBackdropTrack(finishedUri),
      onPlayback: (state) => {
        readyCommands().reportClipPlayback(state)
      },
      onFirstPlayReady: () => {
        setReadyClipKey(clipKey)
      },
      onError: setPlaybackError,
      onComplete: () => {
        readyCommands().advanceAfterReveal()
      },
    },
  })

  useEffect(() => {
    if (!started || !track) {
      return
    }
    playedRef.current = rememberPlayedTrack(playedRef.current, {
      uri: track.uri,
      durationMs: track.durationMs,
    })
  }, [started, track])

  useEffect(() => {
    if (!bonusWinner) {
      return
    }
    const deadline = revealDeadlineRef.current ?? Date.now() + POST_REVEAL_PLAY_MS
    const left = Math.max(0, deadline - Date.now())
    const id = window.setTimeout(() => {
      queuedAdvanceRef.current = true
    }, left)
    return () => {
      window.clearTimeout(id)
    }
  }, [bonusWinner])

  useEffect(() => {
    if (!started || clipActive || revealHold) {
      return
    }
    clipPlayingRef.current = false
    setClipPlaying(false)
    onPlaybackRef.current('paused')
  }, [started, clipActive, revealHold])

  const suggestionField = guessTarget === 'both' || guessTarget === 'title' ? 'title' : guessTarget
  const suggestions = useMemo(
    () => (mode === 'tippen' ? suggestGuesses(tracks, query, suggestionField) : NO_GUESSES),
    [mode, tracks, query, suggestionField],
  )
  const artistSuggestions = useMemo(
    () => (mode === 'tippen' && guessTarget === 'both' ? suggestGuesses(tracks, artistQuery, 'artist') : NO_GUESSES),
    [mode, guessTarget, tracks, artistQuery],
  )

  const beginRound = useCallback(() => {
    readyCommands().beginRound()
  }, [])
  const onSkip = useCallback(() => {
    readyCommands().onSkip()
  }, [])
  const onListen = useCallback(() => {
    readyCommands().onListen()
  }, [])
  const onClaim = useCallback(() => {
    readyCommands().onClaim()
  }, [])
  const onNobody = useCallback(() => {
    readyCommands().onNobody()
  }, [])
  const onWrongWinner = useCallback(() => {
    readyCommands().onWrongWinner()
  }, [])
  const onAssign = useCallback((name: string) => {
    readyCommands().onAssign(name)
  }, [])
  const onNext = useCallback(() => {
    readyCommands().onNext()
  }, [])
  const onForceSkip = useCallback(() => {
    readyCommands().onForceSkip()
  }, [])
  const onSubmitGuess = useCallback(() => {
    readyCommands().onSubmitGuess()
  }, [])
  const onPickSuggestion = useCallback((suggestion: GuessSuggestion) => {
    readyCommands().onPickSuggestion(suggestion)
  }, [])
  const onDismissBonus = useCallback(() => {
    void readyCommands().dismissBonusAndMaybeAdvance()
  }, [])

  return {
    track,
    round,
    query,
    artistQuery,
    suggestions,
    artistSuggestions,
    playbackError,
    clipPlaying,
    firstPlayReady,
    bonusWinner,
    bonusClosing,
    wrongPopup,
    setQuery,
    setArtistQuery,
    beginRound,
    onSkip,
    onListen,
    onClaim,
    onNobody,
    onAssign,
    onWrongWinner,
    onNext,
    onForceSkip,
    onSubmitGuess,
    onPickSuggestion,
    onDismissBonus,
  }
}
