import { isTitleHidden, phaseDuration, phaseLabel } from '../lib/gameLoop.ts'
import type { GamePhase, Track } from '../types.ts'
import { SessionExitButton } from './SessionExitButton.tsx'

interface GameScreenProps {
  track: Track | null
  phase: GamePhase
  index: number
  total: number
  demo: boolean
  running: boolean
  error: string | null
  onPlay: () => void
  onStop: () => void
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
  error,
  onPlay,
  onStop,
  onBack,
  onLogout,
}: GameScreenProps) {
  const hidden = isTitleHidden(phase)
  const duration = phaseDuration(phase)

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
      <div className={`vinyl ${phase === 'playing' ? 'spin' : ''}`} aria-hidden="true">
        <span />
      </div>
      <p className={`phase-pill ${phase}`}>{phaseLabel(phase)}</p>
      {duration > 0 ? (
        <div className="meter" key={`${phase}-${index}`}>
          <span style={{ animationDuration: `${duration}ms` }} />
        </div>
      ) : (
        <div className="meter idle" />
      )}
      <div className="reveal-card">
        <p className="artist">{hidden || !track ? '???' : track.artist}</p>
        <h2 className="title">{hidden || !track ? 'Titel verborgen' : track.title}</h2>
        <p className="hint">
          {phase === 'playing'
            ? 'Etwa 5 Sekunden hören – Interpret und Titel bleiben verborgen.'
            : null}
          {phase === 'thinking'
            ? '3 Sekunden nachdenken. Noch keine Auflösung.'
            : null}
          {phase === 'reveal' ? '5 Sekunden Auflösung, dann kommt der nächste Titel.' : null}
          {phase === 'idle' ? 'Startet die Runde. Danach läuft alles automatisch bis zum Stopp.' : null}
        </p>
      </div>
      <div className="actions">
        {running ? (
          <button type="button" className="btn danger" onClick={onStop}>
            Stopp
          </button>
        ) : (
          <>
            <button type="button" className="btn primary" onClick={onPlay} disabled={!track}>
              Abspielen
            </button>
            <button type="button" className="btn ghost" onClick={onBack}>
              Zurück
            </button>
          </>
        )}
      </div>
    </section>
  )
}
