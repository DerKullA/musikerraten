import { EventFrame } from '@/games/tangera/components/EventFrame.tsx'
import { RANK_EVENTS } from '@/games/tangera/logic/rules.ts'
import type { EventProps } from './types.ts'

export function BitchEvent({ player, onDone }: EventProps) {
  const event = RANK_EVENTS.D
  return (
    <EventFrame title={event.title} summary={event.summary}>
      <p className="tangera-big">{player} ist jetzt die Bitch.</p>
      <p className="tangera-prompt">
        Wenn {player} das nächste Mal dran ist, ruft die Gruppe „Bitch 1“ bis „Bitch 5“. Die Zahl sind die
        Schlücke. Das gilt bei jedem Zug, bis jemand die nächste Dame zieht.
      </p>
      <div className="tangera-footer">
        <button type="button" className="btn primary cta" onClick={() => onDone()}>
          Verstanden
        </button>
      </div>
    </EventFrame>
  )
}
