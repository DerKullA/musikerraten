import { useEffect, useState } from 'react'
import { EventFrame } from '@/games/tangera/components/EventFrame.tsx'
import { PlayerGrid } from '@/games/tangera/components/PlayerGrid.tsx'
import { RANK_EVENTS } from '@/games/tangera/logic/rules.ts'
import type { EventProps } from './types.ts'

type Stage = 'drink' | 'fouls'

export function WaterfallEvent({ player, order, onDone }: EventProps) {
  const [stage, setStage] = useState<Stage>('drink')
  const [seconds, setSeconds] = useState(0)
  const [early, setEarly] = useState<string[]>([])
  const event = RANK_EVENTS.A
  const others = order.filter((name) => name !== player)

  useEffect(() => {
    if (stage !== 'drink') {
      return
    }
    const started = Date.now()
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 250)
    return () => window.clearInterval(timer)
  }, [stage])

  if (stage === 'fouls') {
    return (
      <EventFrame title={event.title} summary="Wer abgesetzt hat, obwohl sein Glas nicht leer war, trinkt einen Shot.">
        <p className="tangera-prompt">Wer hat zu früh abgesetzt?</p>
        <PlayerGrid
          players={others}
          selected={early}
          label="Zu früh abgesetzt"
          onToggle={(name) =>
            setEarly((current) => (current.includes(name) ? current.filter((entry) => entry !== name) : [...current, name]))
          }
        />
        <div className="tangera-footer">
          <button
            type="button"
            className="btn primary cta"
            disabled={early.length === 0}
            onClick={() => onDone({ shots: Object.fromEntries(early.map((name) => [name, 1])) })}
          >
            {early.length === 1 ? '1 Shot vergeben' : `${early.length} Shots vergeben`}
          </button>
          <button type="button" className="btn ghost" onClick={() => onDone()}>
            Niemand, alles sauber
          </button>
        </div>
      </EventFrame>
    )
  }

  return (
    <EventFrame title={event.title} summary={event.summary}>
      <div className="tangera-fall" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <p className="tangera-big">Alle trinken!</p>
      <p className="tangera-prompt">
        Gläser an den Mund. {player} hört zuerst auf, alle anderen trinken weiter, bis ihr Glas leer ist. Wer früher
        absetzt, trinkt einen Shot.
      </p>
      <p className="tangera-timer" aria-label="Dauer">
        {seconds} s
      </p>
      <div className="tangera-footer">
        <button type="button" className="btn primary cta" onClick={() => setStage('fouls')}>
          Wasserfall vorbei
        </button>
      </div>
    </EventFrame>
  )
}
