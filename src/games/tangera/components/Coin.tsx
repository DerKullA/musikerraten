import { useEffect, useRef, useState } from 'react'
import { pulseReveal } from '@/ui/haptics.ts'

export type CoinSide = 'wahrheit' | 'pflicht'

interface CoinProps {
  onResult: (side: CoinSide) => void
}

const FLIP_MS = 1600
const SHOW_MS = 900

/** Münze: Wahrheit (Vorderseite) oder Pflicht (Rückseite). Das Ergebnis liegt beim Werfen fest. */
export function Coin({ onResult }: CoinProps) {
  const [rotation, setRotation] = useState(0)
  const [side, setSide] = useState<CoinSide | null>(null)
  const [flipping, setFlipping] = useState(false)
  const timers = useRef<number[]>([])

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((timer) => window.clearTimeout(timer))
  }, [])

  function flip(): void {
    if (flipping || side) {
      return
    }
    const result: CoinSide = Math.random() < 0.5 ? 'wahrheit' : 'pflicht'
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setFlipping(true)
    setRotation(5 * 360 + (result === 'pflicht' ? 180 : 0))
    timers.current.push(
      window.setTimeout(
        () => {
          setSide(result)
          setFlipping(false)
          pulseReveal()
          timers.current.push(window.setTimeout(() => onResult(result), reduced ? 0 : SHOW_MS))
        },
        reduced ? 0 : FLIP_MS,
      ),
    )
  }

  return (
    <div className="tangera-coin-area">
      <div className="tangera-coin" style={{ transform: `rotateY(${rotation}deg)` }} aria-hidden="true">
        <span className="tangera-coin-side is-front">Wahrheit</span>
        <span className="tangera-coin-side is-back">Pflicht</span>
      </div>
      <p className="tangera-coin-result" aria-live="polite">
        {side === 'wahrheit' ? 'Wahrheit!' : side === 'pflicht' ? 'Pflicht!' : ' '}
      </p>
      <div className="tangera-footer">
        <button type="button" className="btn primary cta" onClick={flip} disabled={flipping || side !== null}>
          {flipping ? 'Die Münze fliegt …' : 'Münze werfen'}
        </button>
      </div>
    </div>
  )
}
