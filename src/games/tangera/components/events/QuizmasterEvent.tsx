import { EventFrame } from '@/games/tangera/components/EventFrame.tsx'
import { RANK_EVENTS } from '@/games/tangera/logic/rules.ts'
import type { EventProps } from './types.ts'

export function QuizmasterEvent({ player, onDone }: EventProps) {
  const event = RANK_EVENTS['8']
  return (
    <EventFrame title={event.title} summary={event.summary}>
      <p className="tangera-big">{player} ist jetzt Quizmaster.</p>
      <p className="tangera-prompt">
        Niemand beantwortet die Fragen von {player}. Wer es trotzdem tut, trinkt einen Schluck (das regelt die
        Gruppe). Der Titel bleibt, bis jemand die nächste 8 zieht.
      </p>
      <div className="tangera-footer">
        <button type="button" className="btn primary cta" onClick={() => onDone()}>
          Verstanden
        </button>
      </div>
    </EventFrame>
  )
}
