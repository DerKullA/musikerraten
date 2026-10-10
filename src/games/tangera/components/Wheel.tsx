import { useEffect, useRef, useState } from 'react'
import { pulseReveal } from '@/ui/haptics.ts'
import { pickSegment, segmentAngle, spinTo, wheelLabelLines } from '@/games/tangera/logic/wheel.ts'

interface WheelProps {
  labels: readonly string[]
  /** Beschriftung der Rad-Schaltfläche für Screenreader. */
  spinLabel?: string
  /** Wird einmal aufgerufen, sobald das Rad steht. */
  onResult: (index: number) => void
}

const SPIN_MS = 4200
const CENTER = 100
const RADIUS = 96

/** Punkt auf dem Kreis; Winkel in Grad, von oben im Uhrzeigersinn. */
function polar(angle: number, radius: number): { x: number; y: number } {
  const rad = (angle * Math.PI) / 180
  return { x: CENTER + radius * Math.sin(rad), y: CENTER - radius * Math.cos(rad) }
}

function segmentPath(index: number, count: number): string {
  const seg = segmentAngle(count)
  const from = polar(index * seg, RADIUS)
  const to = polar((index + 1) * seg, RADIUS)
  const large = seg > 180 ? 1 : 0
  return `M ${CENTER} ${CENTER} L ${from.x} ${from.y} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${to.x} ${to.y} Z`
}

export function Wheel({ labels, spinLabel = 'Rad drehen', onResult }: WheelProps) {
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState<number | null>(null)
  const [duration, setDuration] = useState(SPIN_MS)
  const timer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current)
      }
    },
    [],
  )

  const count = labels.length
  const seg = segmentAngle(count)
  const maxChars = count > 8 ? 11 : 13
  const fontSize = count > 8 ? 6.2 : 7.4

  function spin(): void {
    if (spinning || winner !== null || count === 0) {
      return
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const index = pickSegment(count)
    const offset = (Math.random() - 0.5) * 0.7
    const turns = 4 + Math.floor(Math.random() * 3)
    const ms = reduced ? 0 : SPIN_MS
    setDuration(ms)
    setRotation((current) => spinTo(current, index, count, turns, offset))
    setSpinning(true)
    timer.current = window.setTimeout(() => {
      setSpinning(false)
      setWinner(index)
      pulseReveal()
      onResult(index)
    }, ms)
  }

  return (
    <div className="tangera-wheel-area">
      <button
        type="button"
        className={winner !== null ? 'tangera-tap tangera-wheel is-done' : 'tangera-tap tangera-wheel'}
        aria-label={`${spinLabel}, Glücksrad mit ${count} Feldern`}
        onClick={spin}
        disabled={spinning || winner !== null}
      >
        <span className="tangera-wheel-pointer" aria-hidden="true" />
        <span
          className="tangera-wheel-disc"
          style={{ transform: `rotate(${rotation}deg)`, transitionDuration: `${duration}ms` }}
        >
          <svg viewBox="0 0 200 200" aria-hidden="true">
            {labels.map((label, index) => {
              const mid = (index + 0.5) * seg
              const lines = wheelLabelLines(label, maxChars)
              const lineHeight = fontSize * 1.15
              const start = -((lines.length - 1) * lineHeight) / 2
              return (
                <g key={label} className={winner === index ? 'tangera-seg is-win' : 'tangera-seg'}>
                  <path className={`tangera-seg-fill c${index % 4}`} d={segmentPath(index, count)} />
                  <text
                    x={CENTER + 24}
                    y={CENTER}
                    transform={`rotate(${mid - 90} ${CENTER} ${CENTER})`}
                    fontSize={fontSize}
                    textAnchor="start"
                  >
                    {lines.map((line, lineIndex) => (
                      <tspan key={line} x={CENTER + 24} y={CENTER + start + lineIndex * lineHeight + fontSize * 0.35}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                </g>
              )
            })}
            <circle cx={CENTER} cy={CENTER} r="12" className="tangera-wheel-hub" />
          </svg>
        </span>
      </button>
      <p className="tangera-tap-hint">
        {spinning ? 'Das Rad dreht …' : winner !== null ? ' ' : 'Tippe auf das Rad.'}
      </p>
    </div>
  )
}
