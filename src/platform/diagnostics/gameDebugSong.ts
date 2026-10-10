import { isGameDebugEnabled, traceGame } from './gameDebug.ts'

export interface SongLoad {
  art: 'prime' | 'play'
  titel: string
  interpret: string
  uri: string
  positionMs: number
}

/** Formatiert die Abspielposition als Spielminute und Uhrzeit. */
export function formatPlayMinute(positionMs: number): string {
  const safe = Number.isFinite(positionMs) ? Math.max(0, Math.floor(positionMs)) : 0
  const totalSeconds = Math.floor(safe / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes} (${minutes}:${String(seconds).padStart(2, '0')})`
}

/** Baut die Konsolenzeile für einen geladenen Song. */
export function songLoadLine(input: SongLoad): string {
  const name = songName(input.interpret, input.titel)
  const verb = input.art === 'play' ? 'gestartet' : 'geladen'
  return `[spiellog] Song ${verb}: ${name}, Spielminute ${formatPlayMinute(input.positionMs)}`
}

/** Schreibt Song und Spielminute als eine Zeile in die Browser-Konsole. */
export function traceSongLoad(input: SongLoad): void {
  if (!isGameDebugEnabled()) {
    return
  }
  const spielminute = formatPlayMinute(input.positionMs)
  traceGame(
    'song',
    {
      art: input.art,
      titel: input.titel,
      interpret: input.interpret,
      uri: input.uri,
      spielminute,
      positionMs: input.positionMs,
    },
    songLoadLine(input),
  )
}

function songName(interpret: string, titel: string): string {
  const name = titel.trim() || 'unbekannt'
  const artist = interpret.trim()
  return artist ? `${artist} – ${name}` : name
}
