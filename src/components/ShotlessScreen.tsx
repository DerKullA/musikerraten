import { useState } from 'react'
import type { PhaseTimings } from '../lib/phaseTimings.ts'
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
  penaltyPrompt,
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
import { useShotlessClipPlayback } from './useShotlessClipPlayback.ts'

interface ShotlessScreenProps {
  tracks: Track[]
  error: string | null
  savedTimings: PhaseTimings
  onSaveTimings: (timings: PhaseTimings) => void
  onLogout: () => void
  onLeave: () => void
  onPlayClip: (uri: string, positionMs: number) => Promise<void>
  onPauseClip: () => Promise<void>
  onPlayback: (state: 'playing' | 'paused') => void
  onLiveChange?: (live: boolean) => void
}

export function ShotlessScreen({
  tracks,
  error,
  savedTimings,
  onSaveTimings,
  onLogout,
  onLeave,
  onPlayClip,
  onPauseClip,
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
  const [round, setRound] = useState<ShotlessRound>(() => createShotlessRound())
  const [query, setQuery] = useState('')
  const [artistQuery, setArtistQuery] = useState('')
  const [playbackError, setPlaybackError] = useState<string | null>(null)

  const track = tracks[round.trackIndex] ?? null
  const stage = stageByIndex(round.stageIndex)
  const clipActive = started && round.view === 'guessing' && track !== null

  useShotlessClipPlayback({
    active: clipActive,
    uri: track?.uri ?? null,
    positionMs: track ? clipStartMs(track.durationMs, round.origin) : 0,
    durationMs: stage.durationMs,
    replayNonce: round.replayNonce,
    handlers: {
      onPlayClip,
      onPauseClip,
      onPlayback,
      onError: setPlaybackError,
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

  function startRound(): void {
    if (!canStartShotless(mode, players) || !mode) {
      return
    }
    startSpeakerKeepAlive()
    setPlaybackError(null)
    setQuery('')
    setArtistQuery('')
    setRound(createShotlessRound(pickClipOrigin()))
    rememberSession(mode, players, guessTarget)
    setStarted(true)
    onLiveChange?.(true)
  }

  function clearGuessDraft(): void {
    setQuery('')
    setArtistQuery('')
  }

  function applyRound(next: ShotlessRound): void {
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
        savedTimings={savedTimings}
        onSaveTimings={onSaveTimings}
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
      savedTimings={savedTimings}
      onSaveTimings={onSaveTimings}
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
        applyRound(reduceShotlessRound(round, { type: 'skip' }))
      }}
      onReplay={() => {
        setPlaybackError(null)
        applyRound(reduceShotlessRound(round, { type: 'replay' }))
      }}
      onClaim={() => {
        applyRound(reduceShotlessRound(round, { type: 'claim' }))
      }}
      onAssign={(name) => {
        applyRound(reduceShotlessRound(round, { type: 'assign', name }))
      }}
      onNobody={() => {
        applyRound(reduceShotlessRound(round, { type: 'nobody' }))
      }}
      onNext={() => {
        setPlaybackError(null)
        applyRound(
          reduceShotlessRound(round, {
            type: 'next',
            trackCount: tracks.length,
            origin: pickClipOrigin(),
          }),
        )
      }}
    />
  )
}

interface ShotlessSetupProps {
  mode: ShotlessMode | null
  guessTarget: ShotlessGuessTarget
  players: readonly string[]
  nameDraft: string
  nameError: string | null
  error: string | null
  savedTimings: PhaseTimings
  onSaveTimings: (timings: PhaseTimings) => void
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
  savedTimings,
  onSaveTimings,
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
          <AppMenu
            timings={savedTimings}
            onSaveTimings={onSaveTimings}
            onLogout={onLogout}
            onLeaveRound={onLeave}
          />
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
  savedTimings: PhaseTimings
  onSaveTimings: (timings: PhaseTimings) => void
  onLogout: () => void
  onLeave: () => void
  onQuery: (value: string) => void
  onArtistQuery: (value: string) => void
  onSubmitGuess: () => void
  onPickSuggestion: (suggestion: GuessSuggestion) => void
  onSkip: () => void
  onReplay: () => void
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
  savedTimings,
  onSaveTimings,
  onLogout,
  onLeave,
  onQuery,
  onArtistQuery,
  onSubmitGuess,
  onPickSuggestion,
  onSkip,
  onReplay,
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
          <AppMenu
            timings={savedTimings}
            onSaveTimings={onSaveTimings}
            onLogout={onLogout}
            onLeaveRound={onLeave}
          />
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
            <p className="shotless-prompt">{penaltyPrompt(stage.penalty)}</p>
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
        {round.view !== 'reveal' ? (
          <p className="shotless-rule">Niemand oder Aufgeben: alle trinken einen Shot.</p>
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
        {round.view === 'guessing' && mode === 'party' ? (
          <div className="shotless-actions">
            <button type="button" className="btn primary cta" onClick={onClaim}>
              Erraten!
            </button>
          </div>
        ) : null}
        {round.view === 'pick-player' ? (
          <PlayerPick players={players} onAssign={onAssign} onNobody={onNobody} />
        ) : null}
        {round.view === 'guessing' ? (
          <div className="shotless-actions">
            <button type="button" className="btn ghost" onClick={onReplay}>
              Nochmal hören
            </button>
            <button type="button" className="btn outline" onClick={onSkip}>
              {skipControlLabel(round.stageIndex)}
            </button>
            {mode === 'party' && !lastStage ? (
              <button type="button" className="btn ghost" onClick={onNobody}>
                Niemand
              </button>
            ) : null}
            {mode === 'tippen' && !lastStage ? (
              <button type="button" className="btn ghost" onClick={onNobody}>
                Aufgeben
              </button>
            ) : null}
          </div>
        ) : null}
        {revealed ? (
          <div className="shotless-actions">
            <button type="button" className="btn primary cta" onClick={onNext}>
              Nächster Song
            </button>
          </div>
        ) : null}
      </div>
    </section>
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
      <p className="artist">{artistLead ? track.title : track.artist}</p>
      <h2 className="title">{artistLead ? track.artist : track.title}</h2>
      <p className="shotless-rule">{guessTargetRevealLine(guessTarget)}</p>
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
