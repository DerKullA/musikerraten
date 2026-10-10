import { useState } from 'react'
import { EventFrame } from '@/games/tangera/components/EventFrame.tsx'
import { LoserPicker } from '@/games/tangera/components/PlayerGrid.tsx'
import { LOSER_SIPS, RANK_EVENTS } from '@/games/tangera/logic/rules.ts'
import { isPiep } from '@/games/tangera/logic/sevenDeath.ts'
import { revealResult } from './reveal.ts'
import type { EventProps } from './types.ts'

type Stage = 'play' | 'loser'

const MAX_DIGITS = 4

export function SevenDeathEvent({ order, onDone }: EventProps) {
  const [stage, setStage] = useState<Stage>('play')
  const [helper, setHelper] = useState(false)
  const [entry, setEntry] = useState('')
  const event = RANK_EVENTS['7']
  const number = Number(entry) >= 1 ? Number(entry) : null
  const piep = number !== null && isPiep(number)

  if (stage === 'loser') {
    return (
      <EventFrame title={event.title} summary="Wer sich verzählt oder eine Zahl mit 7 gesagt hat, verliert.">
        <LoserPicker
          players={order}
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
        <div className="tangera-referee" ref={revealResult}>
          <label className="tangera-referee-who" htmlFor="tangera-referee-number">
            Schiedsrichter-Hilfe: Zahl eingeben
          </label>
          <input
            id="tangera-referee-number"
            className="tangera-referee-input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            enterKeyHint="done"
            autoFocus
            placeholder="z. B. 27"
            value={entry}
            onChange={(event) => setEntry(event.target.value.replace(/\D/g, '').slice(0, MAX_DIGITS))}
          />
          <div aria-live="polite">
            {number !== null ? (
              <p className={piep ? 'tangera-referee-number is-piep' : 'tangera-referee-number'}>
                {piep ? 'Piep' : 'Normal'}
              </p>
            ) : null}
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
