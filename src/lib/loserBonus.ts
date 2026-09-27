export const LOSER_BONUS_STREAK = 3
export const WINNER_NAME_LIMIT = 24

export const LOSER_PUNISHMENTS = [
  {
    id: 'ehrenrunde',
    title: 'Ehrenrunde',
    detail: 'Alle Verlierer stehen auf, drehen sich einmal im Kreis und trinken einen Schluck.',
  },
  {
    id: 'duett',
    title: 'Duett',
    detail: 'Die Verlierer singen zusammen den Refrain. Wer aussetzt, trinkt einen Shot.',
  },
  {
    id: 'linkshand',
    title: 'Linkshand',
    detail: 'Der nächste Schluck nur mit der ungewohnten Hand. Danebengekleckert gibt einen extra.',
  },
  {
    id: 'kompliment',
    title: 'Kompliment',
    detail: 'Jeder Verlierer sagt dem Gewinner ein ernst gemeintes Kompliment. Danach zwei Schlücke.',
  },
  {
    id: 'funkstille',
    title: 'Funkstille',
    detail: 'Bis der nächste Song startet: kein Wort. Wer redet, trinkt sofort einen Schluck.',
  },
  {
    id: 'service',
    title: 'Service',
    detail: 'Die Verlierer schenken allen nach und trinken selbst einen Shot.',
  },
  {
    id: 'taktstock',
    title: 'Taktstock',
    detail: 'Drei Schlücke, jeder exakt auf ein Klatschen. Wer aus dem Takt ist, trinkt einen extra.',
  },
  {
    id: 'schutzgeld',
    title: 'Schutzgeld',
    detail: 'Die Verlierer wählen eine Person, die mittrinkt, und nehmen selbst einen Shot.',
  },
] as const

export type LoserPunishment = (typeof LOSER_PUNISHMENTS)[number]

export interface WinStreak {
  winner: string | null
  count: number
}

export interface StreakUpdate {
  streak: WinStreak
  triggered: boolean
  winner: string | null
}

export function createWinStreak(): WinStreak {
  return { winner: null, count: 0 }
}

export function normalizeWinnerName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, ' ')
  if (!name || name.length > WINNER_NAME_LIMIT) {
    return null
  }
  return name
}

export function winnerNameError(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, ' ')
  if (!name) {
    return 'Name fehlt.'
  }
  if (name.length > WINNER_NAME_LIMIT) {
    return 'Höchstens 24 Zeichen.'
  }
  return null
}

export function sameWinnerName(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase('de') === right.trim().toLocaleLowerCase('de')
}

export function rememberWinnerName(names: readonly string[], raw: string): string[] {
  const name = normalizeWinnerName(raw)
  if (!name || names.some((entry) => sameWinnerName(entry, name))) {
    return [...names]
  }
  return [...names, name]
}

export function recordRoundOutcome(streak: WinStreak, rawWinner: string | null): StreakUpdate {
  const winner = rawWinner === null ? null : normalizeWinnerName(rawWinner)
  if (!winner) {
    return { streak: createWinStreak(), triggered: false, winner: null }
  }
  const continued = streak.winner !== null && sameWinnerName(streak.winner, winner)
  const count = continued ? streak.count + 1 : 1
  if (count >= LOSER_BONUS_STREAK) {
    return { streak: createWinStreak(), triggered: true, winner }
  }
  return { streak: { winner, count }, triggered: false, winner }
}

export function loserBonusHeadline(winner: string): string {
  if (sameWinnerName(winner, 'dir')) {
    return 'Du hast 3 Mal in Folge gewonnen.'
  }
  return `${winner} hat 3 Mal in Folge gewonnen.`
}

export function loserBonusSubline(winner: string): string {
  if (sameWinnerName(winner, 'dir')) {
    return 'Verlierer-Bonus für alle anderen.'
  }
  return `Verlierer-Bonus für alle außer ${winner}.`
}

export function loserBonusVerdict(winner: string, title: string): string {
  if (sameWinnerName(winner, 'dir')) {
    return `Alle anderen: ${title}`
  }
  return `Alle außer ${winner}: ${title}`
}

export function pickPunishmentIndex(count: number, random: () => number = Math.random): number {
  const size = Math.max(1, Math.floor(count))
  const index = Math.floor(random() * size)
  return Math.min(size - 1, Math.max(0, index))
}

export function wheelStopRotation(
  currentRotation: number,
  segmentIndex: number,
  segmentCount: number,
  extraTurns = 5,
): number {
  const count = Math.max(1, Math.floor(segmentCount))
  const index = ((Math.floor(segmentIndex) % count) + count) % count
  const segment = 360 / count
  const center = (index + 0.5) * segment
  const desired = (360 - center) % 360
  const current = ((currentRotation % 360) + 360) % 360
  const delta = (desired - current + 360) % 360
  const turns = Math.max(0, Math.floor(extraTurns))
  return currentRotation + turns * 360 + delta
}

export function wheelPoint(angleRad: number, radius: number): { x: number; y: number } {
  return {
    x: Math.sin(angleRad) * radius,
    y: -Math.cos(angleRad) * radius,
  }
}

export function describeWheelWedge(index: number, count: number, radius: number): string {
  const sweep = (Math.PI * 2) / count
  const start = index * sweep
  const end = start + sweep
  const from = wheelPoint(start, radius)
  const to = wheelPoint(end, radius)
  const large = sweep > Math.PI ? 1 : 0
  return `M 0 0 L ${from.x} ${from.y} A ${radius} ${radius} 0 ${large} 1 ${to.x} ${to.y} Z`
}

export function wheelLabelPlacement(
  index: number,
  count: number,
  radius: number,
): { x: number; y: number; rotation: number } {
  const mid = ((index + 0.5) * Math.PI * 2) / count
  const point = wheelPoint(mid, radius)
  const midDeg = ((index + 0.5) * 360) / count
  const normalized = ((midDeg % 360) + 360) % 360
  const rotation = normalized > 90 && normalized < 270 ? midDeg + 180 : midDeg
  return { x: point.x, y: point.y, rotation }
}
