import { formatTrackDuration, isTitleHidden, phaseDuration, phaseLabel } from '../lib/gameLoop.ts'
import type { GamePhase, Track } from '../types.ts'
import { SessionExitButton } from './SessionExitButton.tsx'

interface GameScreenProps {
  track: Track | null
  phase: GamePhase
  index: number
  total: number
  running: boolean
  paused: boolean
  error: string | null
  onPlay: () => void
  onPause: () => void
  onResume: () => void
  onAbort: () => void
  onBack: () => void
  onLogout: () => void
}

export function GameScreen({
  track,
  phase,
  index,
  total,
  running,
  paused,
  error,
  onPlay,
  onPause,
  onResume,
  onAbort,
  onBack,
  onLogout,
}: GameScreenProps) {
  const hidden = isTitleHidden(phase)
  const duration = phaseDuration(phase)
  const showLength = phase === 'reveal' && !hidden && track !== null && track.durationMs > 0

  return (
    <section className="panel game">
      <header className="panel-head">
        <div>
          <p className="eyebrow">Spotify-Wiedergabe</p>
          <h1>Musikerraten</h1>
        </div>
        <div className="panel-head-meta">
          <p className="counter">
            {total === 0 ? '0 / 0' : `${index + 1} / ${total}`}
          </p>
        </div>
      </header>
      {error ? <p className="banner error">{error}</p> : null}
      <div className="game-center-control">
        {running ? (
          <button
            type="button"
            className={`center-transport ${paused ? 'is-paused' : 'is-live'}`}
            aria-pressed={paused}
            onClick={paused ? onResume : onPause}
          >
            {paused ? 'Weiter' : 'Pause'}
          </button>
        ) : (
          <div className="vinyl" aria-hidden="true">
            <span />
          </div>
        )}
      </div>
      <p className={`phase-pill ${paused ? 'paused' : phase}`} aria-live="polite">
        {phaseLabel(phase, paused)}
      </p>
      {duration > 0 ? (
        <div className={`meter ${paused ? 'paused' : ''}`} key={`${phase}-${index}`}>
          <span style={{ animationDuration: `${duration}ms` }} />
        </div>
      ) : (
        <div className="meter idle" />
      )}
      <div className={`reveal-card${phase === 'reveal' && !hidden ? ' is-reveal' : ''}`}>
        <p className="artist">{hidden || !track ? '???' : track.artist}</p>
        <h2 className="title">{hidden || !track ? 'Titel verborgen' : track.title}</h2>
        {showLength && track ? (
          <p className="track-duration">Gesamtlänge {formatTrackDuration(track.durationMs)}</p>
        ) : null}
      </div>
      {running ? (
        <div className="game-abort">
          <button type="button" className="btn ghost" onClick={onAbort}>
            Abbrechen
          </button>
        </div>
      ) : (
        <div className="actions actions-center">
          <button type="button" className="btn primary" onClick={onPlay} disabled={!track}>
            Abspielen
          </button>
          <button type="button" className="btn ghost" onClick={onBack}>
            Zurück
          </button>
        </div>
      )}
      <SessionExitButton
        label={running ? 'Beenden & Abmelden' : 'Abmelden'}
        onClick={onLogout}
      />
    </section>
  )
}
