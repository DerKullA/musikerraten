import type { Card } from '@/games/tangera/logic/cards.ts'
import type { ContentKind } from '@/games/tangera/logic/content.ts'
import type { Effects } from '@/games/tangera/logic/game.ts'

export interface EventProps {
  card: Card
  /** Spieler, der die Karte gezogen hat. */
  player: string
  /** Alle Spieler in Sitzreihenfolge, der Zieher zuerst. */
  order: readonly string[]
  rules: readonly string[]
  /** Rad-Einträge, die in diesem Spiel schon gedreht wurden, je Inhaltsart. */
  used: Readonly<Record<ContentKind, readonly string[]>>
  /** Felder des zuletzt gedrehten Rads, je Inhaltsart. */
  wheels: Readonly<Record<ContentKind, readonly string[]>>
  spicy: boolean
  /** Ereignis beenden, optional mit Folgen (Schlücke, Regeln). */
  onDone: (effects?: Effects) => void
}
