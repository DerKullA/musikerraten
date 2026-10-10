import { useState } from 'react'
import { Coin, type CoinSide } from '@/games/tangera/components/Coin.tsx'
import { EventFrame } from '@/games/tangera/components/EventFrame.tsx'
import { Wheel } from '@/games/tangera/components/Wheel.tsx'
import { DARES, TRUTHS, contentPool, type ContentKind, type WheelCard } from '@/games/tangera/logic/content.ts'
import { LOSER_SIPS, RANK_EVENTS, sipsText } from '@/games/tangera/logic/rules.ts'
import { refillWheel } from '@/games/tangera/logic/wheel.ts'
import { revealResult } from './reveal.ts'
import type { EventProps } from './types.ts'

export function TruthOrDareEvent({ player, spicy, used, wheels, onDone }: EventProps) {
  const [side, setSide] = useState<CoinSide | null>(null)
  const [items, setItems] = useState<WheelCard[]>([])
  const [picked, setPicked] = useState<WheelCard | null>(null)
  const event = RANK_EVENTS['6']
  const kind: ContentKind = side === 'wahrheit' ? 'truth' : 'dare'
  const spin = picked ? { kind, wheel: items.map((item) => item.title), picked: picked.title } : undefined

  function chooseSide(result: CoinSide): void {
    setSide(result)
    const pool = contentPool(result === 'wahrheit' ? TRUTHS : DARES, spicy)
    const drawn = result === 'wahrheit' ? 'truth' : 'dare'
    setItems(refillWheel(pool, wheels[drawn], used[drawn], (item) => item.title))
  }

  return (
    <EventFrame title={event.title} summary={event.summary}>
      {side === null ? (
        <>
          <p className="tangera-prompt">{player}, wirf die Münze.</p>
          <Coin onResult={chooseSide} />
        </>
      ) : (
        <>
          <p className="tangera-prompt">{side === 'wahrheit' ? 'Wahrheit' : 'Pflicht'} für {player}</p>
          <Wheel
            labels={items.map((item) => item.title)}
            spinLabel={side === 'wahrheit' ? 'Frage ziehen' : 'Aufgabe ziehen'}
            onResult={(index) => setPicked(items[index] ?? null)}
          />
          {picked ? (
            <>
              <p className="tangera-result" aria-live="polite" ref={revealResult}>
                <strong>{picked.title}</strong>
                {picked.text}
              </p>
              <div className="tangera-footer">
                <button type="button" className="btn primary cta" onClick={() => onDone({ spin })}>
                  Erledigt
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => onDone({ spin, sips: { [player]: LOSER_SIPS } })}
                >
                  Verweigert: {sipsText(LOSER_SIPS)}
                </button>
              </div>
            </>
          ) : null}
        </>
      )}
    </EventFrame>
  )
}
