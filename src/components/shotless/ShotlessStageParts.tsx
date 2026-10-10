import { memo } from 'react'
import type { ShotlessMode } from '@/lib/shotlessRules.ts'

interface ShotlessGuessDockProps {
  meterKey: string
  durationMs: number
  firstPlayReady: boolean
  clipPlaying: boolean
  mode: ShotlessMode
  lastStage: boolean
  skipLabel: string
  onListen: () => void
  onClaim: () => void
  onNobody: () => void
  onSkip: () => void
}

export const ShotlessGuessDock = memo(function ShotlessGuessDock({
  meterKey,
  durationMs,
  firstPlayReady,
  clipPlaying,
  mode,
  lastStage,
  skipLabel,
  onListen,
  onClaim,
  onNobody,
  onSkip,
}: ShotlessGuessDockProps) {
  return (
    <div className="game-dock is-guessing">
      <ClipMeter key={meterKey} durationMs={durationMs} running={firstPlayReady} />
      <button type="button" className="btn primary cta" disabled={clipPlaying} onClick={onListen}>
        Nochmal anhören
      </button>
      {mode === 'party' ? (
        <button type="button" className="btn erraten" disabled={clipPlaying} onClick={onClaim}>
          Erraten!
        </button>
      ) : null}
      <div className="dock-pair">
        {!lastStage ? (
          <button type="button" className="btn outline stage-skip" disabled={clipPlaying} onClick={onSkip}>
            <StageSkipIcon />
            {skipLabel}
          </button>
        ) : null}
        {mode === 'party' && !lastStage ? (
          <button type="button" className="btn ghost" disabled={clipPlaying} onClick={onNobody}>
            Niemand
          </button>
        ) : null}
        {mode === 'tippen' && !lastStage ? (
          <button type="button" className="btn aufgeben" disabled={clipPlaying} onClick={onNobody}>
            Aufgeben
          </button>
        ) : null}
        {lastStage ? (
          <button type="button" className="btn aufgeben stage-skip" disabled={clipPlaying} onClick={onSkip}>
            <StageSkipIcon />
            {skipLabel}
          </button>
        ) : null}
      </div>
    </div>
  )
})

export function PlayerPick({
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

export function ClipMeter({ durationMs, running = true }: { durationMs: number; running?: boolean }) {
  return (
    <div className={`meter${running ? '' : ' idle'}`}>
      {running ? <span style={{ animationDuration: `${durationMs}ms` }} /> : null}
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
