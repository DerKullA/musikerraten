import { useState } from 'react'
import { EventFrame } from '@/games/tangera/components/EventFrame.tsx'
import { LoserPicker } from '@/games/tangera/components/PlayerGrid.tsx'
import { LOSER_SIPS, RANK_EVENTS } from '@/games/tangera/logic/rules.ts'
import { isPiep, sevenDeathCall } from '@/games/tangera/logic/sevenDeath.ts'
import type { EventProps } from './types.ts'

type Stage = 'play' | 'loser'

export function SevenDeathEvent({ order, onDone }: EventProps) {
  const [stage, setStage] = useState<Stage>('play')
  const [helper, setHelper] = useState(false)
  const [count, setCount] = useState(1)
  const [failed, setFailed] = useState<string | null>(null)
  const event = RANK_EVENTS['7']
  const speaker = order[(count - 1) % order.length] ?? order[0] ?? ''

  if (stage === 'loser') {
    return (
      <EventFrame title={event.title} summary="Wer sich verzählt oder eine Zahl mit 7 gesagt hat, verliert.">
        <LoserPicker
          players={order}
          initial={failed}
          onPick={(loser) => onDone(loser ? { sips: { [loser]: LOSER_SIPS } } : undefined)}
        />
      </EventFrame>
    )
  }

  return (
    <EventFrame title={event.title} summary={event.summary}>
      <ol className="tangera-order" aria-label="Reihenfolge">
        {order.map((name, index) => (
          <li key={name} className={index === 0 ? 'is-first' : undefined}>
            {name}
          </li>
        ))}
      </ol>
      <p className="tangera-prompt">
        {order[0]} beginnt bei 1. Wer eine Zahl mit 7 oder ein Vielfaches von 7 sagt, verliert. Stattdessen heißt es
        „Piep“.
      </p>
      {helper ? (
        <div className="tangera-referee">
          <p className="tangera-referee-who">{speaker} ist dran</p>
          <p className={isPiep(count) ? 'tangera-referee-number is-piep' : 'tangera-referee-number'}>
            {sevenDeathCall(count)}
          </p>
          <p className="tangera-referee-hint">Zahl {count}</p>
          <div className="tangera-referee-actions">
            <button type="button" className="btn primary" onClick={() => setCount((value) => value + 1)}>
              Richtig, weiter
            </button>
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                setFailed(speaker)
                setStage('loser')
              }}
            >
              Fehler
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn ghost" onClick={() => setHelper(true)}>
          Schiedsrichter-Hilfe einblenden
        </button>
      )}
      <div className="tangera-footer">
        <button type="button" className="btn primary cta" onClick={() => setStage('loser')}>
          Jemand hat verloren
        </button>
        <button type="button" className="btn ghost" onClick={() => onDone()}>
          Ohne Verlierer weiter
        </button>
      </div>
    </EventFrame>
  )
}
