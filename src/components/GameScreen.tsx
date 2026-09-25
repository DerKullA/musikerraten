import { useEffect, useState } from 'react'
import { revealAlbumArtUrl } from '../lib/albumArt.ts'
import { centerTransportCue, type TransportIconName } from '../lib/centerTransport.ts'
import { formatTrackDuration, isTitleHidden, phaseDuration, phaseLabel } from '../lib/gameLoop.ts'
import type { PhaseTimings } from '../lib/phaseTimings.ts'
import type { GamePhase, Track } from '../types.ts'
import { AppMenu } from './AppMenu.tsx'

interface GameScreenProps {
  track: Track | null
  phase: GamePhase
  index: number
  total: number
  running: boolean
  paused: boolean
  error: string | null
  roundTimings: PhaseTimings
  savedTimings: PhaseTimings
  onSaveTimings: (timings: PhaseTimings) => void
  onPlay: () => void
  onPause: () => void
  onResume: () => void
  onContinue: () => void
  onAbort: () => void
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
  roundTimings,
  savedTimings,
  onSaveTimings,
  onPlay,
  onPause,
  onResume,
  onContinue,
  onAbort,
  onLogout,
}: GameScreenProps) {
  const hidden = isTitleHidden(phase)
  const duration = phaseDuration(phase, roundTimings)
  const showLength = phase === 'reveal' && !hidden && track !== null && track.durationMs > 0
  const cue = centerTransportCue({ running, paused, phase })
  const coverSrc = useLoadedAlbumCover(revealAlbumArtUrl(phase, track?.albumImageUrl))

  function activateTransport(): void {
    if (cue.action === 'start') {
      onPlay()
      return
    }
    if (cue.action === 'resume') {
      onResume()
      return
    }
    if (cue.action === 'reveal') {
      onContinue()
      return
    }
    onPause()
  }

  return (
    <section className="panel game with-menu">
      <header className="panel-head">
        <div>
          <p className="eyebrow">Spotify-Wiedergabe</p>
          <h1>Musikerraten</h1>
        </div>
        <div className="panel-head-meta">
          <AppMenu
            timings={savedTimings}
            onSaveTimings={onSaveTimings}
            onLogout={onLogout}
            onLeaveRound={onAbort}
          />
          <p className="counter">
            {total === 0 ? '0 / 0' : `${index + 1} / ${total}`}
          </p>
        </div>
      </header>
      {error ? <p className="banner error">{error}</p> : null}
      <div className="game-stage">
        <p className={`phase-pill ${paused ? 'paused' : phase}`} aria-live="polite">
          {phaseLabel(phase, paused)}
        </p>
        <div className="game-center-control">
          <button
            type="button"
            className={`center-transport${paused ? ' is-paused' : ' is-live'}${coverSrc ? ' has-cover' : ''}`}
            aria-label={cue.label}
            title={cue.label}
            aria-pressed={running ? paused : undefined}
            disabled={cue.action === 'start' && !track}
            onClick={activateTransport}
          >
            {coverSrc ? (
              <>
                <img className="transport-cover" src={coverSrc} alt="" draggable={false} />
                <span className="transport-scrim" aria-hidden="true" />
              </>
            ) : null}
            <TransportIcon icon={cue.icon} />
          </button>
        </div>
        {duration > 0 ? (
          <div className={`meter ${paused ? 'paused' : ''}`} key={`${phase}-${index}`}>
            <span style={{ animationDuration: `${duration}ms` }} />
          </div>
        ) : (
          <div className="meter idle" />
        )}
      </div>
      <div className={`reveal-card${phase === 'reveal' && !hidden ? ' is-reveal' : ''}`}>
        <p className="artist">{hidden || !track ? '???' : track.artist}</p>
        <h2 className="title">{hidden || !track ? 'Titel verborgen' : track.title}</h2>
        {showLength && track ? (
          <p className="track-duration">Gesamtlänge {formatTrackDuration(track.durationMs)}</p>
        ) : null}
      </div>
    </section>
  )
}

function TransportIcon({ icon }: { icon: TransportIconName }) {
  if (icon === 'pause') {
    return (
      <svg className="transport-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M5.5 4.2h4.4v15.6H5.5zm8.6 0h4.4v15.6h-4.4z" />
      </svg>
    )
  }
  return (
    <svg className="transport-icon is-play" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M8 5.1v13.8l11.4-6.9L8 5.1z" />
    </svg>
  )
}

function useLoadedAlbumCover(src: string | null): string | null {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!src) {
      return
    }
    let active = true
    const image = new Image()
    image.onload = () => {
      if (active) {
        setLoadedSrc(src)
      }
    }
    image.onerror = () => {
      if (active) {
        setLoadedSrc(null)
      }
    }
    image.src = src
    return () => {
      active = false
    }
  }, [src])

  return loadedSrc === src ? loadedSrc : null
}
