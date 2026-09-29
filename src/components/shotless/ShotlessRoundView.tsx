import { memo } from 'react'
import { POST_REVEAL_PLAY_MS } from '../../lib/phaseTimings.ts'
import {
  SHOTLESS_STAGES,
  guessTargetRevealLine,
  isLastShotlessStage,
  penaltyTone,
  skipControlLabel,
  stageByIndex,
  stageStatusLabel,
  type GuessSuggestion,
  type ShotlessGuessTarget,
  type ShotlessMode,
  type ShotlessRound,
} from '../../lib/shotlessRules.ts'
import type { Track } from '../../types.ts'
import { AppMenu } from '../AppMenu.tsx'
import { SkipTrackButton } from '../SkipTrackButton.tsx'
import { GuessComposer } from './GuessComposer.tsx'
import { PlayerPick, ShotlessGuessDock, ClipMeter } from './ShotlessStageParts.tsx'

interface ShotlessRoundViewProps {
  mode: ShotlessMode
  guessTarget: ShotlessGuessTarget
  track: Track
  trackCount: number
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
  clipPlaying: boolean
  firstPlayReady: boolean
  onClaim: () => void
  onAssign: (name: string) => void
  onNobody: () => void
  onNext: () => void
}

export function ShotlessRoundView({
  mode,
  guessTarget,
  track,
  trackCount,
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
  clipPlaying,
  firstPlayReady,
  onClaim,
  onAssign,
  onNobody,
  onNext,
}: ShotlessRoundViewProps) {
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
          <p className="counter">{trackCount === 0 ? '0 / 0' : `${round.trackIndex + 1} / ${trackCount}`}</p>
        </div>
      </header>
      {error ? <p className="banner error">{error}</p> : null}
      <div className="game-stage">
        <ShotlessStageBody
          stageIndex={round.stageIndex}
          origin={round.origin}
          revealed={revealed}
          track={track}
          revealMessage={round.revealMessage}
          guessTarget={guessTarget}
          feedback={round.feedback}
        />
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
      </div>
      {round.view === 'guessing' ? (
        <ShotlessGuessDock
          meterKey={`${round.trackIndex}-${round.stageIndex}-${round.replayNonce}`}
          durationMs={stageByIndex(round.stageIndex).durationMs}
          firstPlayReady={firstPlayReady}
          clipPlaying={clipPlaying}
          mode={mode}
          lastStage={lastStage}
          skipLabel={skipControlLabel(round.stageIndex)}
          onListen={onListen}
          onClaim={onClaim}
          onNobody={onNobody}
          onSkip={onSkip}
        />
      ) : null}
      {revealed ? (
        <div className="game-dock">
          <ClipMeter key={`${round.trackIndex}-${round.replayNonce}`} durationMs={POST_REVEAL_PLAY_MS} />
          <SkipTrackButton onSkip={onNext} />
        </div>
      ) : null}
    </section>
  )
}

interface ShotlessStageBodyProps {
  stageIndex: number
  origin: ShotlessRound['origin']
  revealed: boolean
  track: Track
  revealMessage: string | null
  guessTarget: ShotlessGuessTarget
  feedback: string | null
}

const ShotlessStageBody = memo(function ShotlessStageBody({
  stageIndex,
  origin,
  revealed,
  track,
  revealMessage,
  guessTarget,
  feedback,
}: ShotlessStageBodyProps) {
  const stage = stageByIndex(stageIndex)
  const artistLead = guessTarget === 'artist'

  return (
    <>
      <p className="phase-pill playing" aria-live="polite">
        {stageStatusLabel(stage)}
      </p>
      {import.meta.env.DEV ? (
        <p className="sr-only" data-clip-origin={origin} aria-hidden="true">
          {origin}
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
        <div className="reveal-card is-reveal">
          {track.albumImageUrl ? <img className="shotless-cover" src={track.albumImageUrl} alt="" /> : null}
          <p className="shotless-rule">{guessTargetRevealLine(guessTarget)}</p>
          <p className="artist">{artistLead ? track.title : track.artist}</p>
          <h2 className="title">{artistLead ? track.artist : track.title}</h2>
          {revealMessage ? <p className="shotless-reveal-message">{revealMessage}</p> : null}
        </div>
      ) : (
        <div className="shotless-stage">
          <p className="shotless-prompt">Wer nicht errät, dann:</p>
          <p className={`shotless-penalty is-${penaltyTone(stage.penalty)}`} aria-live="assertive">
            {stage.penalty}
          </p>
        </div>
      )}
      {feedback ? (
        <p className="shotless-feedback" role="status">
          {feedback}
        </p>
      ) : null}
    </>
  )
})

