import { useState } from 'react'
import { EventFrame } from '@/games/tangera/components/EventFrame.tsx'
import { Stepper } from '@/games/tangera/components/Stepper.tsx'
import { isRedSuit } from '@/games/tangera/logic/cards.ts'
import { RANK_EVENTS, TEN_SIPS, sipsText } from '@/games/tangera/logic/rules.ts'
import type { EventProps } from './types.ts'

export function TenEvent({ card, player, order, onDone }: EventProps) {
  const event = RANK_EVENTS['10']
  const red = isRedSuit(card.suit)
  const others = order.filter((name) => name !== player)
  const [shares, setShares] = useState<Record<string, number>>({})
  const given = Object.values(shares).reduce((sum, value) => sum + value, 0)
  const left = TEN_SIPS - given

  if (!red) {
    return (
      <EventFrame title={event.title} summary={event.summary}>
        <p className="tangera-big">Schwarze 10: {player} trinkt {sipsText(TEN_SIPS)}.</p>
        <div className="tangera-footer">
          <button type="button" className="btn primary cta" onClick={() => onDone({ sips: { [player]: TEN_SIPS } })}>
            Getrunken
          </button>
        </div>
      </EventFrame>
    )
  }

  return (
    <EventFrame title={event.title} summary={event.summary}>
      <p className="tangera-big">Rote 10: {player} verteilt {sipsText(TEN_SIPS)}.</p>
      <p className="tangera-prompt" aria-live="polite">
        {left === 0 ? 'Alles verteilt.' : `Noch ${sipsText(left)} zu verteilen.`}
      </p>
      <ul className="tangera-share-list">
        {others.map((name) => {
          const value = shares[name] ?? 0
          return (
            <li key={name}>
              <span>{name}</span>
              <Stepper
                label={name}
                value={value}
                max={value + left}
                onChange={(next) => setShares((current) => ({ ...current, [name]: next }))}
              />
            </li>
          )
        })}
      </ul>
      <div className="tangera-footer">
        <button type="button" className="btn primary cta" disabled={left !== 0} onClick={() => onDone({ sips: shares })}>
          Verteilt
        </button>
      </div>
    </EventFrame>
  )
}
