import { useState } from 'react'
import { EventFrame } from '@/games/tangera/components/EventFrame.tsx'
import { LoserPicker } from '@/games/tangera/components/PlayerGrid.tsx'
import { Wheel } from '@/games/tangera/components/Wheel.tsx'
import { CATEGORIES, contentPool, type Category } from '@/games/tangera/logic/content.ts'
import { LOSER_SIPS, RANK_EVENTS } from '@/games/tangera/logic/rules.ts'
import { refillWheel } from '@/games/tangera/logic/wheel.ts'
import { revealResult } from './reveal.ts'
import type { EventProps } from './types.ts'

export function CategoryEvent({ order, spicy, used, wheels, onDone }: EventProps) {
  const [items] = useState<Category[]>(() =>
    refillWheel(contentPool(CATEGORIES, spicy), wheels.category, used.category, (item) => item.name),
  )
  const [picked, setPicked] = useState<Category | null>(null)
  const [losing, setLosing] = useState(false)
  const event = RANK_EVENTS.K
  const spin = picked
    ? ({ kind: 'category', wheel: items.map((item) => item.name), picked: picked.name } as const)
    : undefined

  return (
    <EventFrame title={event.title} summary={event.summary}>
      <Wheel labels={items.map((item) => item.name)} spinLabel="Kategorie drehen" onResult={(i) => setPicked(items[i] ?? null)} />
      {picked ? (
        <>
          <p className="tangera-big" aria-live="polite" ref={revealResult}>
            {picked.name}
          </p>
          <p className="tangera-prompt">
            Reihum nennen, {order[0]} beginnt. Wer nichts mehr weiß, etwas Falsches oder etwas schon Genanntes sagt,
            trinkt.
          </p>
          <ol className="tangera-order" aria-label="Reihenfolge">
            {order.map((name, index) => (
              <li key={name} className={index === 0 ? 'is-first' : undefined}>
                {name}
              </li>
            ))}
          </ol>
          {losing ? (
            <LoserPicker players={order} onPick={(loser) => onDone({ spin, ...(loser ? { sips: { [loser]: LOSER_SIPS } } : {}) })} />
          ) : (
            <div className="tangera-footer">
              <button type="button" className="btn primary cta" onClick={() => setLosing(true)}>
                Jemand hat verloren
              </button>
              <button type="button" className="btn ghost" onClick={() => onDone({ spin })}>
                Ohne Verlierer weiter
              </button>
            </div>
          )}
        </>
      ) : null}
    </EventFrame>
  )
}
