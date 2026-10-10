export const LOSER_BONUS_STREAK = 3
export const WINNER_NAME_LIMIT = 24

export const LOSER_PUNISHMENTS = [
  {
    id: 'ehrenrunde',
    title: 'Ehrenrunde',
    detail: 'Aufstehen, einmal im Kreis drehen, einen Schluck trinken.',
  },
  {
    id: 'duett',
    title: 'Duett',
    detail: 'Den Refrain allein singen. Stocken kostet einen Schluck.',
  },
  {
    id: 'linkshand',
    title: 'Linkshand',
    detail: 'Den nächsten Schluck nur mit der ungewohnten Hand.',
  },
  {
    id: 'kompliment',
    title: 'Kompliment',
    detail: 'Der Runde ein Kompliment machen, danach einen Schluck.',
  },
  {
    id: 'funkstille',
    title: 'Funkstille',
    detail: 'Bis zum nächsten Song schweigen. Ein Wort kostet einen Schluck.',
  },
  {
    id: 'service',
    title: 'Service',
    detail: 'Einmal nachschenken und selbst einen Schluck trinken.',
  },
  {
    id: 'taktstock',
    title: 'Taktstock',
    detail: 'Zwei Schlücke, jeder genau auf ein Klatschen.',
  },
  {
    id: 'schutzgeld',
    title: 'Schutzgeld',
    detail: 'Eine Person wählen. Ihr beide trinkt einen Schluck.',
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

export function sameWinnerName(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase('de') === right.trim().toLocaleLowerCase('de')
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
    return 'Dein Verlierer-Bonus: eine kleine Strafe für die Siegesserie.'
  }
  return `Verlierer-Bonus für ${winner}: eine kleine Strafe für die Siegesserie.`
}

export function loserBonusSpinHint(winner: string): string {
  if (sameWinnerName(winner, 'dir')) {
    return 'Dreht das Rad. Die kleine Strafe gilt für dich.'
  }
  return `Dreht das Rad. Die kleine Strafe gilt für ${winner}.`
}

export function loserBonusVerdict(winner: string, title: string): string {
  if (sameWinnerName(winner, 'dir')) {
    return `Du: ${title}`
  }
  return `${winner}: ${title}`
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
