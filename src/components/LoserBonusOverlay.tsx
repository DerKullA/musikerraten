import { useEffect, useRef, useState, type MouseEvent, type ReactNode, type SyntheticEvent } from 'react'
import {
  LOSER_PUNISHMENTS,
  describeWheelWedge,
  loserBonusHeadline,
  loserBonusSubline,
  loserBonusVerdict,
  pickPunishmentIndex,
  wheelLabelPlacement,
  wheelStopRotation,
} from '../lib/loserBonus.ts'

const SEGMENT_COLORS = [
  '#d4e157',
  '#e4b15a',
  '#d36b5a',
  '#f3ead8',
  '#b7c96a',
  '#c9954a',
  '#e08b7a',
  '#d8cdb6',
] as const

const WHEEL_RADIUS = 46

interface LoserBonusOverlayProps {
  winner: string
  onDismiss: () => void
}

export function LoserBonusOverlay({ winner, onDismiss }: LoserBonusOverlayProps) {
  const [rotation, setRotation] = useState(0)
  const [landedIndex, setLandedIndex] = useState<number | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [instantSpin, setInstantSpin] = useState(false)
  const punishment = landedIndex === null ? null : LOSER_PUNISHMENTS[landedIndex]

  function spinFortuneWheel(event: MouseEvent<HTMLButtonElement>): void {
    event.currentTarget.blur()
    if (spinning || landedIndex !== null) {
      return
    }
    const index = pickPunishmentIndex(LOSER_PUNISHMENTS.length)
    const instant = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const next = wheelStopRotation(rotation, index, LOSER_PUNISHMENTS.length, instant ? 0 : 5)
    setInstantSpin(instant)
    setLandedIndex(index)
    setRotation(next)
    setSpinning(!instant)
  }

  function finishWheelSpin(): void {
    if (!spinning) {
      return
    }
    setSpinning(false)
  }

  function keepWheelOpen(event: SyntheticEvent<HTMLDialogElement>): void {
    event.preventDefault()
    if (!spinning && punishment) {
      onDismiss()
    }
  }

  return (
    <GameDialog labelledBy="loser-bonus-title" onCancel={keepWheelOpen}>
      <div className="game-dialog-card">
        <p className="eyebrow">Verlierer-Bonus</p>
        <h2 id="loser-bonus-title">{loserBonusHeadline(winner)}</h2>
        <p className="loser-bonus-copy">{loserBonusSubline(winner)}</p>
        <div className="fortune-stage">
          <span className="fortune-pointer" aria-hidden="true" />
          <svg
            className={instantSpin ? 'fortune-wheel is-instant' : 'fortune-wheel'}
            viewBox="-50 -50 100 100"
            style={{ transform: `rotate(${rotation}deg)` }}
            aria-hidden="true"
            onTransitionEnd={(event) => {
              if (event.propertyName === 'transform') {
                finishWheelSpin()
              }
            }}
          >
            {LOSER_PUNISHMENTS.map((entry, index) => (
              <WheelSegment key={entry.id} index={index} title={entry.title} />
            ))}
            <circle className="fortune-core" r="8" />
          </svg>
          <button
            type="button"
            className="fortune-hub btn primary"
            disabled={spinning || punishment !== null}
            onClick={spinFortuneWheel}
          >
            Drehen
          </button>
        </div>
        <p className="loser-bonus-result" role="status">
          {punishment && !spinning ? punishment.detail : 'Dreht das Rad. Die Strafe gilt für die Verlierer.'}
        </p>
        {punishment && !spinning ? (
          <>
            <p className="loser-bonus-verdict">{loserBonusVerdict(winner, punishment.title)}</p>
            <button type="button" className="btn primary loser-bonus-done" onClick={onDismiss}>
              Strafe kassiert
            </button>
          </>
        ) : null}
      </div>
    </GameDialog>
  )
}

function WheelSegment({ index, title }: { index: number; title: string }) {
  const label = wheelLabelPlacement(index, LOSER_PUNISHMENTS.length, 30)
  const color = SEGMENT_COLORS[index % SEGMENT_COLORS.length]
  return (
    <g>
      <path
        d={describeWheelWedge(index, LOSER_PUNISHMENTS.length, WHEEL_RADIUS)}
        fill={color}
        stroke="#10160e"
        strokeWidth="0.5"
      />
      <text
        className="fortune-label"
        x={label.x}
        y={label.y}
        fontSize="3.5"
        textAnchor="middle"
        dominantBaseline="middle"
        transform={`rotate(${label.rotation} ${label.x} ${label.y})`}
      >
        {title}
      </text>
    </g>
  )
}

function GameDialog({
  labelledBy,
  onCancel,
  children,
}: {
  labelledBy: string
  onCancel: (event: SyntheticEvent<HTMLDialogElement>) => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) {
      return
    }
    dialog.showModal()
    return () => {
      dialog.close()
    }
  }, [])

  return (
    <dialog ref={ref} className="game-dialog" aria-labelledby={labelledBy} onCancel={onCancel}>
      {children}
    </dialog>
  )
}
