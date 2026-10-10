import { memo, useEffect } from 'react'
import { pulseReveal } from '@/ui/haptics.ts'
import { POST_REVEAL_PLAY_MS } from '@/ui/phaseTimings.ts'
import {
  SHOTLESS_STAGES,
  formatClipLength,
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
} from '@/lib/shotlessRules.ts'
import type { Track } from '@/types.ts'
import { AppMenu } from '@/ui/AppMenu.tsx'
import { RoundProgress } from '@/ui/RoundProgress.tsx'
import { SkipTrackButton } from '@/ui/SkipTrackButton.tsx'
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
  onBackToPlaylists: () => void
  onForceSkip: () => void
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
  onWrongWinner: () => void
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
  onBackToPlaylists,
  onForceSkip,
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
  onWrongWinner,
  onNobody,
  onNext,
}: ShotlessRoundViewProps) {
  const revealed = round.view === 'reveal'
  const lastStage = isLastShotlessStage(round.stageIndex)

  useEffect(() => {
    if (revealed) {
      pulseReveal()
    }
  }, [revealed])

  return (
    <section className="panel game shotless with-menu">
      <header className="game-bar">
        <div className="game-bar-info">
          <span className="game-bar-label">Shotless · {mode === 'party' ? 'Party' : 'Tippen'}</span>
          <p className="counter">{trackCount === 0 ? '0 / 0' : `${round.trackIndex + 1} / ${trackCount}`}</p>
        </div>
        <AppMenu
          onLogout={onLogout}
          onForceSkip={onForceSkip}
          onBackToPlaylists={onBackToPlaylists}
          onLeaveRound={onLeave}
          leaveLabel="Zurück zum Hauptmenü"
        />
      </header>
      <RoundProgress current={trackCount === 0 ? 0 : round.trackIndex + 1} total={trackCount} />
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
            disabled={clipPlaying}
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
          {mode === 'party' && round.winner ? (
            <button type="button" className="btn aufgeben" onClick={onWrongWinner}>
              {round.winner} lag falsch!
            </button>
          ) : null}
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
      <p className="sr-only" aria-live="polite">
        {stageStatusLabel(stage)}
      </p>
      {import.meta.env.DEV ? (
        <p className="sr-only" data-clip-origin={origin} aria-hidden="true">
          {origin}
        </p>
      ) : null}
      <ol className="stage-rail" aria-label="Strafstufen">
        {SHOTLESS_STAGES.map((entry) => (
          <li
            key={entry.index}
            className={
              entry.index === stage.index ? 'is-current' : entry.index < stage.index ? 'is-past' : undefined
            }
            aria-current={entry.index === stage.index ? 'step' : undefined}
          >
            <span>{entry.penalty}</span>
            <small>{formatClipLength(entry.durationMs)}</small>
          </li>
        ))}
      </ol>
      {revealed ? (
        <div className="reveal-card is-reveal">
          {revealMessage ? <p className="shotless-reveal-message">{revealMessage}</p> : null}
          {track.albumImageUrl ? <img className="shotless-cover" src={track.albumImageUrl} alt="" /> : null}
          <p className="shotless-rule">{guessTargetRevealLine(guessTarget)}</p>
          <p className="artist">{artistLead ? track.title : track.artist}</p>
          <h2 className="title">{artistLead ? track.artist : track.title}</h2>
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

