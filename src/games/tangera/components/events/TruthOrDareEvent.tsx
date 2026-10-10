import { useState } from 'react'
import { Coin, type CoinSide } from '@/games/tangera/components/Coin.tsx'
import { EventFrame } from '@/games/tangera/components/EventFrame.tsx'
import { Wheel } from '@/games/tangera/components/Wheel.tsx'
import { DARES, TRUTHS, contentPool, type WheelCard } from '@/games/tangera/logic/content.ts'
import { LOSER_SIPS, RANK_EVENTS, sipsText } from '@/games/tangera/logic/rules.ts'
import { pickWheelItems } from '@/games/tangera/logic/wheel.ts'
import type { EventProps } from './types.ts'

const WHEEL_SIZE = 8

export function TruthOrDareEvent({ player, spicy, onDone }: EventProps) {
  const [side, setSide] = useState<CoinSide | null>(null)
  const [items, setItems] = useState<WheelCard[]>([])
  const [picked, setPicked] = useState<WheelCard | null>(null)
  const event = RANK_EVENTS['6']

  function chooseSide(result: CoinSide): void {
    setSide(result)
    setItems(pickWheelItems(contentPool(result === 'wahrheit' ? TRUTHS : DARES, spicy), WHEEL_SIZE))
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
              <p className="tangera-result" aria-live="polite">
                <strong>{picked.title}</strong>
                {picked.text}
              </p>
              <div className="tangera-footer">
                <button type="button" className="btn primary cta" onClick={() => onDone()}>
                  Erledigt
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => onDone({ sips: { [player]: LOSER_SIPS } })}
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
