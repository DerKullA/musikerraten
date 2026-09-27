import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  pickBackdropTrack,
  prepareGuessHandoff,
  rememberPlayedTrack,
  type BackdropPosition,
  type BackdropTrack,
} from '../lib/bonusBackdrop.ts'
import { POST_REVEAL_PLAY_MS } from '../lib/phaseTimings.ts'
import { startSpeakerKeepAlive } from '../lib/speakerKeepAlive.ts'
import {
  addShotlessPlayer,
  canStartShotless,
  readShotlessSession,
  removeShotlessPlayer,
  writeShotlessSession,
} from '../lib/shotlessSession.ts'
import {
  SHOTLESS_GUESS_TARGETS,
  SHOTLESS_STAGES,
  clipStartMs,
  createShotlessRound,
  guessFieldLabel,
  guessTargetRevealLine,
  isLastShotlessStage,
  penaltyTone,
  pickClipOrigin,
  reduceShotlessRound,
  skipControlLabel,
  stageByIndex,
  stageStatusLabel,
  suggestGuesses,
  type GuessSuggestion,
  type ShotlessGuessTarget,
  type ShotlessMode,
  type ShotlessRound,
} from '../lib/shotlessRules.ts'
import type { Track } from '../types.ts'
import { AppMenu } from './AppMenu.tsx'
import { LoserBonusOverlay } from './LoserBonusOverlay.tsx'
import { SkipTrackButton } from './SkipTrackButton.tsx'
import { useLoserBonus } from './useLoserBonus.ts'
import { useShotlessClipPlayback } from './useShotlessClipPlayback.ts'

function clipListenLabel(heard: boolean): string {
  return heard ? 'Nochmal anhören' : 'Anhören'
}

function clipIdentity(round: ShotlessRound): string {
  return `${round.trackIndex}-${round.stageIndex}`
}

interface ShotlessScreenProps {
  tracks: Track[]
  error: string | null
  onLogout: () => void
  onLeave: () => void
  onPlayClip: (uri: string, positionMs: number) => Promise<void>
  onResumeClip: () => Promise<void>
  onPauseClip: () => Promise<void>
  onPrimeClip?: (uri: string, positionMs: number) => Promise<void>
  onReadPosition?: () => Promise<BackdropPosition | null>
  onReadPaused?: () => Promise<boolean | null>
  onReleaseSilence?: () => Promise<void>
  onPlayback: (state: 'playing' | 'paused') => void
  onLiveChange?: (live: boolean) => void
}

export function ShotlessScreen({
  tracks,
  error,
  onLogout,
  onLeave,
  onPlayClip,
  onResumeClip,
  onPauseClip,
  onPrimeClip,
  onReadPosition,
  onReadPaused,
  onReleaseSilence,
  onPlayback,
  onLiveChange,
}: ShotlessScreenProps) {
  const stored = readShotlessSession()
  const [mode, setMode] = useState<ShotlessMode | null>(stored?.mode ?? null)
  const [guessTarget, setGuessTarget] = useState<ShotlessGuessTarget>(stored?.guessTarget ?? 'title')
  const [players, setPlayers] = useState<string[]>(stored?.players ?? [])
  const [nameDraft, setNameDraft] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [started, setStarted] = useState(false)
  const [openingOrigin] = useState(() => pickClipOrigin())
  const onPrimeClipRef = useRef(onPrimeClip)
  const onPauseClipRef = useRef(onPauseClip)
  const onReadPausedRef = useRef(onReadPaused)
  const onReleaseSilenceRef = useRef(onReleaseSilence)
  const releasePlaybackRef = useRef<() => Promise<void>>(async () => undefined)
  const suppressPauseRef = useRef(false)
  const handoffRef = useRef(false)
  useLayoutEffect(() => {
    onPrimeClipRef.current = onPrimeClip
    onPauseClipRef.current = onPauseClip
    onReadPausedRef.current = onReadPaused
    onReleaseSilenceRef.current = onReleaseSilence
  })
  const [round, setRound] = useState<ShotlessRound>(() => createShotlessRound())
  const [query, setQuery] = useState('')
  const [artistQuery, setArtistQuery] = useState('')
  const [playbackError, setPlaybackError] = useState<string | null>(null)
  const [clipPlaying, setClipPlaying] = useState(false)
  const clipPlayingRef = useRef(false)
  const onPlaybackRef = useRef(onPlayback)
  const blockAdvanceRef = useRef(false)
  const queuedAdvanceRef = useRef(false)
  const playedRef = useRef<BackdropTrack[]>([])
  const revealDeadlineRef = useRef<number | null>(null)
  const [revealHoldMs, setRevealHoldMs] = useState(POST_REVEAL_PLAY_MS)
  const [bonusClosing, setBonusClosing] = useState(false)
  const { bonusWinner, noteLoserBonusOutcome, dismissLoserBonus } = useLoserBonus()

  useLayoutEffect(() => {
    onPlaybackRef.current = onPlayback
  })

  const track = tracks[round.trackIndex] ?? null
  const stage = stageByIndex(round.stageIndex)
  const [heardClip, setHeardClip] = useState<string | null>(null)
  const clipHeard = heardClip === clipIdentity(round)
  const clipActive = started && round.view === 'guessing' && track !== null && clipHeard
  const revealHold = started && round.view === 'reveal' && track !== null

  function advanceAfterReveal(): void {
    if (blockAdvanceRef.current) {
      queuedAdvanceRef.current = true
      return
    }
    setPlaybackError(null)
    setQuery('')
    setArtistQuery('')
    setRound((current) => {
      if (current.view !== 'reveal') {
        return current
      }
      return reduceShotlessRound(current, {
        type: 'next',
        trackCount: tracks.length,
        origin: pickClipOrigin(),
      })
    })
  }

  function waitForGuessPause(delayMs: number): Promise<void> {
    return new Promise((resolve) => {
      window.setTimeout(resolve, delayMs)
    })
  }

  async function dismissBonusAndMaybeAdvance(): Promise<void> {
    if (handoffRef.current) {
      return
    }
    handoffRef.current = true
    setBonusClosing(true)
    const origin = pickClipOrigin()
    const next = reduceShotlessRound(round, {
      type: 'next',
      trackCount: tracks.length,
      origin,
    })
    try {
      await releasePlaybackRef.current()
      await prepareGuessHandoff({
        readPaused: () => onReadPausedRef.current?.() ?? Promise.resolve(null),
        pause: () => onPauseClipRef.current(),
        prime: async () => undefined,
        wait: waitForGuessPause,
      })
    } catch (cause) {
      setPlaybackError(cause instanceof Error && cause.message ? cause.message : 'Wiedergabe fehlgeschlagen.')
    }
    suppressPauseRef.current = true
    try {
      await onReleaseSilenceRef.current?.()
    } catch {
      // Die nächste Clip-Wiedergabe hebt die Stille selbst auf.
    }
    blockAdvanceRef.current = false
    queuedAdvanceRef.current = false
    revealDeadlineRef.current = null
    setQuery('')
    setArtistQuery('')
    setBonusClosing(false)
    dismissLoserBonus()
    setRound((current) => (current.view === 'reveal' ? next : current))
    handoffRef.current = false
  }

  function nextBackdropTrack(finishedUri: string): BackdropTrack | null {
    return pickBackdropTrack(playedRef.current, finishedUri, Math.random)
  }

  useEffect(() => {
    const cueTrack = started ? track : (tracks[0] ?? null)
    if (!cueTrack || (started && (round.view !== 'guessing' || clipHeard))) {
      return
    }
    const origin = started ? round.origin : openingOrigin
    void onPrimeClipRef.current?.(cueTrack.uri, clipStartMs(cueTrack.durationMs, origin))
  }, [started, clipHeard, round.view, round.origin, round.trackIndex, track, tracks, openingOrigin])

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
      onPlayClip,
      onResumeClip,
      onPauseClip,
      onPrimeClip,
      onReadPosition,
      onNextBackdropTrack: nextBackdropTrack,
      onPlayback: reportClipPlayback,
      onError: setPlaybackError,
      onComplete: advanceAfterReveal,
    },
  })

  function rememberSession(
    nextMode: ShotlessMode | null,
    nextPlayers: readonly string[],
    nextTarget: ShotlessGuessTarget,
  ): void {
    if (!nextMode) {
      return
    }
    writeShotlessSession({ mode: nextMode, players: [...nextPlayers], guessTarget: nextTarget })
  }

  function selectMode(next: ShotlessMode): void {
    setMode(next)
    rememberSession(next, players, guessTarget)
  }

  function selectGuessTarget(next: ShotlessGuessTarget): void {
    setGuessTarget(next)
    rememberSession(mode, players, next)
  }

  function addName(): void {
    const result = addShotlessPlayer(players, nameDraft)
    setNameError(result.error)
    if (result.error) {
      return
    }
    setPlayers(result.players)
    setNameDraft('')
    rememberSession(mode, result.players, guessTarget)
  }

  function removeName(name: string): void {
    const next = removeShotlessPlayer(players, name)
    setPlayers(next)
    rememberSession(mode, next, guessTarget)
  }

  function markClipPlaying(playing: boolean): void {
    clipPlayingRef.current = playing
    setClipPlaying(playing)
  }

  function reportClipPlayback(state: 'playing' | 'paused'): void {
    markClipPlaying(state === 'playing')
    onPlaybackRef.current(state)
  }

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
    markClipPlaying(false)
    onPlaybackRef.current('paused')
  }, [started, clipActive, revealHold])

  function startRound(): void {
    if (!canStartShotless(mode, players) || !mode) {
      return
    }
    startSpeakerKeepAlive()
    setPlaybackError(null)
    setQuery('')
    setArtistQuery('')
    setHeardClip(null)
    playedRef.current = []
    setRevealHoldMs(POST_REVEAL_PLAY_MS)
    setRound(createShotlessRound(openingOrigin))
    rememberSession(mode, players, guessTarget)
    setStarted(true)
    onLiveChange?.(true)
  }

  function clearGuessDraft(): void {
    setQuery('')
    setArtistQuery('')
  }

  function commitRound(next: ShotlessRound): void {
    applyRound(next)
  }

  function hearClip(): void {
    if (clipPlayingRef.current || round.view !== 'guessing') {
      return
    }
    setPlaybackError(null)
    if (!clipHeard) {
      markClipPlaying(true)
      setHeardClip(clipIdentity(round))
      return
    }
    markClipPlaying(true)
    commitRound(reduceShotlessRound(round, { type: 'replay' }))
  }

  function applyRound(next: ShotlessRound): void {
    if (round.view !== 'reveal' && next.view === 'reveal') {
      const triggered = noteLoserBonusOutcome(next.winner)
      if (triggered) {
        blockAdvanceRef.current = true
        revealDeadlineRef.current = Date.now() + POST_REVEAL_PLAY_MS
      } else {
        revealDeadlineRef.current = null
        setRevealHoldMs(POST_REVEAL_PLAY_MS)
      }
    }
    if (next.trackIndex !== round.trackIndex || next.stageIndex !== round.stageIndex) {
      clearGuessDraft()
    }
    if (next.view === 'reveal' || next.feedback) {
      clearGuessDraft()
    }
    setRound(next)
  }

  function submitGuess(text: string, artistText: string): void {
    clearGuessDraft()
    applyRound(
      reduceShotlessRound(round, {
        type: 'submit-guess',
        guess: text,
        artistGuess: artistText,
        title: track?.title ?? '',
        artist: track?.artist ?? '',
        target: guessTarget,
      }),
    )
  }

  if (!started || !mode || !track) {
    return (
      <ShotlessSetup
        mode={mode}
        players={players}
        nameDraft={nameDraft}
        nameError={nameError}
        error={error}
        onLogout={onLogout}
        onLeave={onLeave}
        guessTarget={guessTarget}
        onSelectMode={selectMode}
        onSelectGuessTarget={selectGuessTarget}
        onNameDraft={setNameDraft}
        onAddName={addName}
        onRemoveName={removeName}
        onStart={startRound}
      />
    )
  }

  const suggestionField = guessTarget === 'both' || guessTarget === 'title' ? 'title' : guessTarget
  const suggestions = mode === 'tippen' ? suggestGuesses(tracks, query, suggestionField) : []
  const artistSuggestions =
    mode === 'tippen' && guessTarget === 'both' ? suggestGuesses(tracks, artistQuery, 'artist') : []

  return (
    <>
    <ShotlessRoundView
      mode={mode}
      guessTarget={guessTarget}
      track={track}
      tracks={tracks}
      round={round}
      players={players}
      query={query}
      artistQuery={artistQuery}
      suggestions={suggestions}
      artistSuggestions={artistSuggestions}
      error={playbackError ?? error}
      onLogout={onLogout}
      onLeave={onLeave}
      onQuery={setQuery}
      onArtistQuery={setArtistQuery}
      onSubmitGuess={() => {
        submitGuess(query, guessTarget === 'both' ? artistQuery : '')
      }}
      onPickSuggestion={(suggestion) => {
        if (guessTarget === 'both') {
          if (suggestion.field === 'artist') {
            setArtistQuery(suggestion.label)
            return
          }
          setQuery(suggestion.label)
          return
        }
        submitGuess(suggestion.label, '')
      }}
      onSkip={() => {
        commitRound(reduceShotlessRound(round, { type: 'skip' }))
      }}
      onListen={hearClip}
      clipHeard={clipHeard}
      onClaim={() => {
        applyRound(reduceShotlessRound(round, { type: 'claim' }))
      }}
      onAssign={(name) => {
        applyRound(reduceShotlessRound(round, { type: 'assign', name }))
      }}
      onNobody={() => {
        applyRound(reduceShotlessRound(round, { type: 'nobody' }))
      }}
      clipPlaying={clipPlaying}
      onNext={() => {
        setPlaybackError(null)
        commitRound(
          reduceShotlessRound(round, {
            type: 'next',
            trackCount: tracks.length,
            origin: pickClipOrigin(),
          }),
        )
      }}
    />
      {bonusWinner ? (
        <LoserBonusOverlay
          winner={bonusWinner}
          closing={bonusClosing}
          onDismiss={() => {
            void dismissBonusAndMaybeAdvance()
          }}
        />
      ) : null}
    </>
  )
}

interface ShotlessSetupProps {
  mode: ShotlessMode | null
  guessTarget: ShotlessGuessTarget
  players: readonly string[]
  nameDraft: string
  nameError: string | null
  error: string | null
  onLogout: () => void
  onLeave: () => void
  onSelectMode: (mode: ShotlessMode) => void
  onSelectGuessTarget: (target: ShotlessGuessTarget) => void
  onNameDraft: (value: string) => void
  onAddName: () => void
  onRemoveName: (name: string) => void
  onStart: () => void
}

function ShotlessSetup({
  mode,
  guessTarget,
  players,
  nameDraft,
  nameError,
  error,
  onLogout,
  onLeave,
  onSelectMode,
  onSelectGuessTarget,
  onNameDraft,
  onAddName,
  onRemoveName,
  onStart,
}: ShotlessSetupProps) {
  const ready = canStartShotless(mode, players)

  return (
    <section className="panel with-menu">
      <header className="panel-head">
        <div>
          <p className="eyebrow">Trinkspiel</p>
          <h1>Shotless</h1>
        </div>
        <div className="panel-head-meta">
          <AppMenu onLogout={onLogout} onLeaveRound={onLeave} leaveLabel="Zurück zum Hauptmenü" />
        </div>
      </header>
      <p className="lede">
        Kurze Schnipsel, jedes Mal an einer anderen Stelle im Song. Wer länger hören muss, trinkt weniger. Wer
        richtig liegt, lässt die anderen trinken. Niemand oder Aufgeben: alle einen Shot. Nur Ansagen auf dem
        Bildschirm.
      </p>
      {error ? <p className="banner error">{error}</p> : null}
      <div className="shotless-modes">
        <button
          type="button"
          className={mode === 'tippen' ? 'mode-card is-selected' : 'mode-card'}
          aria-pressed={mode === 'tippen'}
          onClick={() => onSelectMode('tippen')}
        >
          <strong>Tippen</strong>
          <span>Eingabe prüfen. Ein Fehlschuss und du trinkst die aktuelle Strafe.</span>
        </button>
        <button
          type="button"
          className={mode === 'party' ? 'mode-card is-selected' : 'mode-card'}
          aria-pressed={mode === 'party'}
          onClick={() => onSelectMode('party')}
        >
          <strong>Party</strong>
          <span>Jemand ruft Erraten. Ihr wählt, wer es wusste — oder niemand.</span>
        </button>
      </div>
      <p className="guess-target-legend" id="shotless-guess-target-label">
        Was gilt als richtig?
      </p>
      <div className="guess-targets" role="group" aria-labelledby="shotless-guess-target-label">
        {SHOTLESS_GUESS_TARGETS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={guessTarget === option.id ? 'guess-target is-selected' : 'guess-target'}
            aria-pressed={guessTarget === option.id}
            onClick={() => onSelectGuessTarget(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="muted">Beim Tippen wird das geprüft. In der Party entscheidet ihr per Zuruf.</p>
      {mode === 'party' ? (
        <PlayerRoster
          players={players}
          nameDraft={nameDraft}
          nameError={nameError}
          onNameDraft={onNameDraft}
          onAddName={onAddName}
          onRemoveName={onRemoveName}
        />
      ) : null}
      <div className="actions">
        <button type="button" className="btn primary cta" onClick={onStart} disabled={!ready}>
          Runde starten
        </button>
      </div>
    </section>
  )
}

interface PlayerRosterProps {
  players: readonly string[]
  nameDraft: string
  nameError: string | null
  onNameDraft: (value: string) => void
  onAddName: () => void
  onRemoveName: (name: string) => void
}

function PlayerRoster({
  players,
  nameDraft,
  nameError,
  onNameDraft,
  onAddName,
  onRemoveName,
}: PlayerRosterProps) {
  return (
    <div className="player-roster">
      <p className="muted">Mitspieler, 2 bis 12. Tippen auf einen Namen entfernt ihn.</p>
      <form
        className="player-row"
        onSubmit={(event) => {
          event.preventDefault()
          onAddName()
        }}
      >
        <label className="sr-only" htmlFor="shotless-player">
          Name
        </label>
        <input
          id="shotless-player"
          value={nameDraft}
          placeholder="Name"
          maxLength={24}
          onChange={(event) => onNameDraft(event.target.value)}
        />
        <button type="submit" className="btn ghost">
          Hinzufügen
        </button>
      </form>
      {nameError ? <p className="banner error">{nameError}</p> : null}
      <ul className="player-chips">
        {players.map((name) => (
          <li key={name}>
            <button type="button" onClick={() => onRemoveName(name)} aria-label={`${name} entfernen`}>
              {name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

interface ShotlessRoundViewProps {
  mode: ShotlessMode
  guessTarget: ShotlessGuessTarget
  track: Track
  tracks: readonly Track[]
  round: ShotlessRound
  players: readonly string[]
  query: string
  artistQuery: string
  suggestions: readonly GuessSuggestion[]
  artistSuggestions: readonly GuessSuggestion[]
  error: string | null
  onLogout: () => void
  onLeave: () => void
  onQuery: (value: string) => void
  onArtistQuery: (value: string) => void
  onSubmitGuess: () => void
  onPickSuggestion: (suggestion: GuessSuggestion) => void
  onSkip: () => void
  onListen: () => void
  clipHeard: boolean
  clipPlaying: boolean
  onClaim: () => void
  onAssign: (name: string) => void
  onNobody: () => void
  onNext: () => void
}

export function ShotlessRoundView({
  mode,
  guessTarget,
  track,
  tracks,
  round,
  players,
  query,
  artistQuery,
  suggestions,
  artistSuggestions,
  error,
  onLogout,
  onLeave,
  onQuery,
  onArtistQuery,
  onSubmitGuess,
  onPickSuggestion,
  onSkip,
  onListen,
  clipHeard,
  clipPlaying,
  onClaim,
  onAssign,
  onNobody,
  onNext,
}: ShotlessRoundViewProps) {
  const stage = stageByIndex(round.stageIndex)
  const revealed = round.view === 'reveal'
  const lastStage = isLastShotlessStage(round.stageIndex)

  return (
    <section className="panel game shotless with-menu">
      <header className="panel-head">
        <div>
          <p className="eyebrow">Shotless</p>
          <h1>{mode === 'party' ? 'Party' : 'Tippen'}</h1>
        </div>
        <div className="panel-head-meta">
          <AppMenu onLogout={onLogout} onLeaveRound={onLeave} leaveLabel="Zurück zum Hauptmenü" />
          <p className="counter">
            {tracks.length === 0 ? '0 / 0' : `${round.trackIndex + 1} / ${tracks.length}`}
          </p>
        </div>
      </header>
      {error ? <p className="banner error">{error}</p> : null}
      <div className="game-stage">
        <p className="phase-pill playing" aria-live="polite">
          {stageStatusLabel(stage)}
        </p>
        {import.meta.env.DEV ? (
          <p className="sr-only" data-clip-origin={round.origin} aria-hidden="true">
            {round.origin}
          </p>
        ) : null}
        <ol className="stage-rail">
          {SHOTLESS_STAGES.map((entry) => (
            <li key={entry.index} className={entry.index === stage.index ? 'is-current' : undefined}>
              <span>{entry.penalty}</span>
            </li>
          ))}
        </ol>
        {revealed ? (
          <RevealCard track={track} message={round.revealMessage} guessTarget={guessTarget} />
        ) : (
          <div className="shotless-stage">
            <p className="shotless-prompt">Wer nicht errät, dann:</p>
            <p className={`shotless-penalty is-${penaltyTone(stage.penalty)}`} aria-live="assertive">
              {stage.penalty}
            </p>
          </div>
        )}
        {round.feedback ? (
          <p className="shotless-feedback" role="status">
            {round.feedback}
          </p>
        ) : null}
        {round.view === 'guessing' ? (
          <div className="shotless-actions">
            {clipHeard ? (
              <ClipMeter
                key={`${round.trackIndex}-${round.stageIndex}-${round.replayNonce}`}
                durationMs={stage.durationMs}
              />
            ) : null}
            <ListenClipButton
              className="btn primary cta"
              disabled={clipPlaying}
              label={clipListenLabel(clipHeard)}
              onListen={onListen}
            />
          </div>
        ) : null}
        {round.view === 'guessing' && mode === 'tippen' ? (
          <GuessComposer
            target={guessTarget}
            query={query}
            artistQuery={artistQuery}
            suggestions={suggestions}
            artistSuggestions={artistSuggestions}
            onQuery={onQuery}
            onArtistQuery={onArtistQuery}
            onSubmitGuess={onSubmitGuess}
            onPickSuggestion={onPickSuggestion}
          />
        ) : null}
        {round.view === 'pick-player' ? (
          <PlayerPick players={players} onAssign={onAssign} onNobody={onNobody} />
        ) : null}
        {round.view === 'guessing' ? (
          <div className="shotless-actions">
            {mode === 'party' ? (
              <button type="button" className="btn erraten" onClick={onClaim}>
                Erraten!
              </button>
            ) : !lastStage ? (
              <button type="button" className="btn aufgeben" onClick={onNobody}>
                Aufgeben
              </button>
            ) : null}
            <button
              type="button"
              className={lastStage ? 'btn aufgeben stage-skip' : 'btn outline stage-skip'}
              onClick={onSkip}
            >
              <StageSkipIcon />
              {skipControlLabel(round.stageIndex)}
            </button>
            {mode === 'party' && !lastStage ? (
              <button type="button" className="btn ghost" onClick={onNobody}>
                Niemand
              </button>
            ) : null}
          </div>
        ) : null}
        {revealed ? (
          <div className="shotless-actions">
            <ClipMeter key={`${round.trackIndex}-${round.replayNonce}`} durationMs={POST_REVEAL_PLAY_MS} />
            <SkipTrackButton onSkip={onNext} />
          </div>
        ) : null}
      </div>
    </section>
  )
}

function ClipMeter({ durationMs }: { durationMs: number }) {
  return (
    <div className="meter">
      <span style={{ animationDuration: `${durationMs}ms` }} />
    </div>
  )
}

function ListenClipButton({
  className,
  disabled,
  label,
  onListen,
}: {
  className: string
  disabled: boolean
  label: string
  onListen: () => void
}) {
  return (
    <button type="button" className={className} disabled={disabled} onClick={onListen}>
      {label}
    </button>
  )
}

function RevealCard({
  track,
  message,
  guessTarget,
}: {
  track: Track
  message: string | null
  guessTarget: ShotlessGuessTarget
}) {
  const artistLead = guessTarget === 'artist'
  return (
    <div className="reveal-card is-reveal">
      {track.albumImageUrl ? <img className="shotless-cover" src={track.albumImageUrl} alt="" /> : null}
      <p className="shotless-rule">{guessTargetRevealLine(guessTarget)}</p>
      <p className="artist">{artistLead ? track.title : track.artist}</p>
      <h2 className="title">{artistLead ? track.artist : track.title}</h2>
      
      {message ? <p className="shotless-reveal-message">{message}</p> : null}
    </div>
  )
}

interface GuessComposerProps {
  target: ShotlessGuessTarget
  query: string
  artistQuery: string
  suggestions: readonly GuessSuggestion[]
  artistSuggestions: readonly GuessSuggestion[]
  onQuery: (value: string) => void
  onArtistQuery: (value: string) => void
  onSubmitGuess: () => void
  onPickSuggestion: (suggestion: GuessSuggestion) => void
}

function GuessComposer({
  target,
  query,
  artistQuery,
  suggestions,
  artistSuggestions,
  onQuery,
  onArtistQuery,
  onSubmitGuess,
  onPickSuggestion,
}: GuessComposerProps) {
  const both = target === 'both'
  const ready = both ? query.trim().length > 0 && artistQuery.trim().length > 0 : query.trim().length > 0
  const fieldLabel = guessFieldLabel(target)

  return (
    <form
      className="guess-field"
      onSubmit={(event) => {
        event.preventDefault()
        if (ready) {
          onSubmitGuess()
        }
      }}
    >
      <label className="sr-only" htmlFor="shotless-guess">
        {both ? 'Songtitel' : fieldLabel}
      </label>
      <input
        id="shotless-guess"
        value={query}
        placeholder={both ? 'Songtitel' : fieldLabel}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        onChange={(event) => onQuery(event.target.value)}
      />
      <GuessSuggestions label="Vorschläge" suggestions={suggestions} onPickSuggestion={onPickSuggestion} />
      {both ? (
        <>
          <label className="sr-only" htmlFor="shotless-artist">
            Interpret
          </label>
          <input
            id="shotless-artist"
            value={artistQuery}
            placeholder="Interpret"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            onChange={(event) => onArtistQuery(event.target.value)}
          />
          <GuessSuggestions
            label="Interpretenvorschläge"
            suggestions={artistSuggestions}
            onPickSuggestion={onPickSuggestion}
          />
        </>
      ) : null}
      <button type="submit" className="btn primary" disabled={!ready}>
        Tipp abgeben
      </button>
    </form>
  )
}

function GuessSuggestions({
  label,
  suggestions,
  onPickSuggestion,
}: {
  label: string
  suggestions: readonly GuessSuggestion[]
  onPickSuggestion: (suggestion: GuessSuggestion) => void
}) {
  if (suggestions.length === 0) {
    return null
  }
  return (
    <ul className="suggestions" role="listbox" aria-label={label}>
      {suggestions.map((entry) => (
        <li key={`${entry.field}:${entry.label}`}>
          <button type="button" role="option" onClick={() => onPickSuggestion(entry)}>
            {entry.label}
          </button>
        </li>
      ))}
    </ul>
  )
}

function PlayerPick({
  players,
  onAssign,
  onNobody,
}: {
  players: readonly string[]
  onAssign: (name: string) => void
  onNobody: () => void
}) {
  return (
    <div className="shotless-actions">
      <p className="shotless-prompt">Wer hat es erraten?</p>
      {players.map((name) => (
        <button key={name} type="button" className="btn primary player-choice" onClick={() => onAssign(name)}>
          {name}
        </button>
      ))}
      <button type="button" className="btn ghost" onClick={onNobody}>
        Niemand
      </button>
    </div>
  )
}

function StageSkipIcon() {
  return (
    <svg className="skip-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M4.2 5.1v13.8L13.2 12 4.2 5.1zm9.2 0v13.8L22.4 12 13.4 5.1z" />
    </svg>
  )
}
