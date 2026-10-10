import type { ComponentType } from 'react'
import type { Rank } from '@/games/tangera/logic/cards.ts'
import { BitchEvent } from './BitchEvent.tsx'
import { CategoryEvent } from './CategoryEvent.tsx'
import { KasperEvent } from './KasperEvent.tsx'
import { QuizmasterEvent } from './QuizmasterEvent.tsx'
import { RuleEvent } from './RuleEvent.tsx'
import { SevenDeathEvent } from './SevenDeathEvent.tsx'
import { TenEvent } from './TenEvent.tsx'
import { TruthOrDareEvent } from './TruthOrDareEvent.tsx'
import { WaterfallEvent } from './WaterfallEvent.tsx'
import type { EventProps } from './types.ts'

const EVENTS: Record<Rank, ComponentType<EventProps>> = {
  '6': TruthOrDareEvent,
  '7': SevenDeathEvent,
  '8': QuizmasterEvent,
  '9': RuleEvent,
  '10': TenEvent,
  B: KasperEvent,
  D: BitchEvent,
  K: CategoryEvent,
  A: WaterfallEvent,
}

/** Wählt das Ereignis zur Karte. */
export function CardEvent(props: EventProps) {
  const Event = EVENTS[props.card.rank]
  return <Event {...props} />
}
