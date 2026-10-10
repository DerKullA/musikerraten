import { shuffle } from './cards.ts'

/** Zufällige, verschiedene Einträge für ein Rad. Bei zu kleinem Pool kommt der ganze Pool. */
export function pickWheelItems<T>(pool: readonly T[], count: number, rng: () => number = Math.random): T[] {
  return shuffle(pool, rng).slice(0, Math.max(0, count))
}

export function segmentAngle(count: number): number {
  return 360 / count
}

/** Wahl eines Segments: `rng` liefert Werte in [0, 1). */
export function pickSegment(count: number, rng: () => number = Math.random): number {
  return Math.min(count - 1, Math.floor(rng() * count))
}

/**
 * Neuer Drehwinkel (Grad, im Uhrzeigersinn), sodass Segment `index` unter dem Zeiger oben steht.
 * Segment i belegt die Winkel [i, i+1) · Segmentwinkel, gemessen von oben im Uhrzeigersinn.
 * `offset` in (-0.5, 0.5) verschiebt die Landung innerhalb des Segments. `turns` sind volle Umdrehungen.
 */
export function spinTo(rotation: number, index: number, count: number, turns: number, offset = 0): number {
  const seg = segmentAngle(count)
  const wanted = mod(-((index + 0.5 + offset) * seg), 360)
  const current = mod(rotation, 360)
  const delta = mod(wanted - current, 360)
  return rotation + Math.max(0, turns) * 360 + delta
}

/** Welches Segment steht bei diesem Drehwinkel unter dem Zeiger? */
export function indexAtPointer(rotation: number, count: number): number {
  const seg = segmentAngle(count)
  const angle = mod(-rotation, 360)
  return Math.min(count - 1, Math.floor(angle / seg))
}

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

/** Beschriftung auf höchstens zwei Zeilen verteilen, zu Langes mit „…“ kürzen. */
export function wheelLabelLines(label: string, maxChars: number): string[] {
  const words = label.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (next.length <= maxChars || !line) {
      line = next
    } else {
      lines.push(line)
      line = word
    }
  }
  if (line) {
    lines.push(line)
  }
  const kept = lines.slice(0, 2).map((entry) => (entry.length > maxChars ? `${entry.slice(0, maxChars - 1)}…` : entry))
  if (lines.length > 2 && kept[1]) {
    kept[1] = `${kept[1].slice(0, Math.max(1, maxChars - 1))}…`
  }
  return kept
}
