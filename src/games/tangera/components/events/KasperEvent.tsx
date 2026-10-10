import { EventFrame } from '@/games/tangera/components/EventFrame.tsx'
import { LoserPicker } from '@/games/tangera/components/PlayerGrid.tsx'
import { LOSER_SIPS, RANK_EVENTS } from '@/games/tangera/logic/rules.ts'
import type { EventProps } from './types.ts'

const MOVES = [
  { icon: '🦵', text: '2× auf die Oberschenkel' },
  { icon: '👏', text: '2× in die Hände' },
  { icon: '😳', text: '2× leicht auf die Wangen' },
]

export function KasperEvent({ order, onDone }: EventProps) {
  const event = RANK_EVENTS.B
  return (
    <EventFrame title={event.title} summary="Los! So schnell wie möglich. Der Letzte verliert.">
      <ol className="tangera-moves" aria-label="Bewegungen">
        {MOVES.map((move, index) => (
          <li key={move.text} style={{ animationDelay: `${index * 0.9}s` }}>
            <span aria-hidden="true">{move.icon}</span>
            {move.text}
          </li>
        ))}
      </ol>
      <LoserPicker players={order} onPick={(loser) => onDone(loser ? { sips: { [loser]: LOSER_SIPS } } : undefined)} />
    </EventFrame>
  )
}
