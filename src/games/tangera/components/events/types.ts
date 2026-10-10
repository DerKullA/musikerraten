import type { Card } from '@/games/tangera/logic/cards.ts'
import type { Effects } from '@/games/tangera/logic/game.ts'

export interface EventProps {
  card: Card
  /** Spieler, der die Karte gezogen hat. */
  player: string
  /** Alle Spieler in Sitzreihenfolge, der Zieher zuerst. */
  order: readonly string[]
  rules: readonly string[]
  spicy: boolean
  /** Ereignis beenden, optional mit Folgen (Schlücke, Regeln). */
  onDone: (effects?: Effects) => void
}
