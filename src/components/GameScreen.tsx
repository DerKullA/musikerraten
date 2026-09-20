import { formatTrackDuration, gameHint, isTitleHidden, phaseDuration, phaseLabel } from '../lib/gameLoop.ts'
import type { GamePhase, Track } from '../types.ts'
import { SessionExitButton } from './SessionExitButton.tsx'

interface GameScreenProps {
  track: Track | null
  phase: GamePhase
  index: number
  total: number
  demo: boolean
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
  demo,
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
          <p className="eyebrow">{demo ? 'Demo ohne Ton' : 'Spotify-Wiedergabe'}</p>
          <h1>Musikerraten</h1>
        </div>
        <div className="panel-head-meta">
          <p className="counter">
            {total === 0 ? '0 / 0' : `${index + 1} / ${total}`}
          </p>
          {!demo ? (
            <SessionExitButton
              label={running ? 'Beenden & Abmelden' : 'Abmelden'}
              onClick={onLogout}
            />
          ) : null}
        </div>
      </header>
      {error ? <p className="banner error">{error}</p> : null}
      <div
        className={`vinyl ${phase === 'playing' ? 'spin' : ''} ${paused ? 'paused' : ''}`}
        aria-hidden="true"
      >
        <span />
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
        <p className="hint">{gameHint(phase, paused)}</p>
      </div>
      {running ? (
        <div className="game-session-bar">
          <div className="game-controls">
            {paused ? (
              <button type="button" className="btn primary" onClick={onResume}>
                Weiter
              </button>
            ) : (
              <button type="button" className="btn primary" onClick={onPause}>
                Pause
              </button>
            )}
          </div>
          <div className="game-abort">
            <button type="button" className="btn ghost" onClick={onAbort}>
              Abbrechen
            </button>
          </div>
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
    </section>
  )
}
