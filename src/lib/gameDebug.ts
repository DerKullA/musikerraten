import { redactSecrets } from './clientLogRedact.ts'
import {
  GAME_DEBUG_MAX_EVENTS,
  readStoredFlag,
  readStoredLog,
  writeDebugClipboard,
  writeStoredFlag,
  writeStoredLog,
} from './gameDebugStorage.ts'

const MAX_TEXT = 180
const DEDUP_MS = 250

export type GameDebugValue = string | number | boolean | null
export type GameDebugDetail = Record<string, GameDebugValue | undefined>

export interface GameDebugEvent {
  at: string
  event: string
  detail: Record<string, GameDebugValue>
}

export interface MusikerratenDebugApi {
  an: () => void
  aus: () => void
  istAn: () => boolean
  ausgabe: () => string
  leeren: () => void
  kopieren: () => Promise<string>
}

type DebugFlag = 'an' | 'aus' | null

const listeners = new Set<() => void>()
let enabled = readStoredFlag()
let events: readonly GameDebugEvent[] = readStoredLog()
let lastKey = ''
let lastAt = 0

declare global {
  interface Window {
    musikerratenDebug?: MusikerratenDebugApi
  }
}

/** Liest, ob das Spiellog gerade mitschreibt. */
export function isGameDebugEnabled(): boolean {
  return enabled
}

/** Schaltet das Spiellog an oder aus und merkt sich die Wahl. */
export function setGameDebugEnabled(next: boolean): void {
  if (next === enabled) {
    return
  }
  if (next) {
    enabled = true
    writeStoredFlag(true)
    appendGameDebug('debug', { aktiv: true })
  } else {
    appendGameDebug('debug', { aktiv: false })
    enabled = false
    writeStoredFlag(false)
  }
  notifyGameDebug()
}

/** Hängt ein Spielereignis an und schreibt es in die Browser-Konsole. */
export function traceGame(event: string, detail: GameDebugDetail = {}, line?: string): void {
  if (appendGameDebug(event, detail, line)) {
    notifyGameDebug()
  }
}

function appendGameDebug(event: string, detail: GameDebugDetail, line?: string): boolean {
  if (!enabled) {
    return false
  }
  const compact = compactDetail(detail)
  const key = `${event}\n${gameDebugKey(compact)}`
  const now = Date.now()
  if (key === lastKey && now - lastAt < DEDUP_MS) {
    return false
  }
  lastKey = key
  lastAt = now
  const entry: GameDebugEvent = {
    at: new Date(now).toISOString(),
    event: event.slice(0, 80),
    detail: compact,
  }
  const next =
    events.length >= GAME_DEBUG_MAX_EVENTS ? events.slice(events.length - GAME_DEBUG_MAX_EVENTS + 1) : events.slice()
  next.push(entry)
  events = next
  writeStoredLog(events)
  mirrorGameDebug(line ?? consoleGameDebugLine(entry))
  return true
}

/** Liefert die bisherigen Ereignisse. Dieselbe Liste, bis etwas Neues dazukommt. */
export function readGameDebugLog(): readonly GameDebugEvent[] {
  return events
}

/** Löscht den Verlauf im Speicher und in der Sitzung. */
export function clearGameDebugLog(): void {
  events = []
  lastKey = ''
  lastAt = 0
  writeStoredLog(events)
  notifyGameDebug()
}

/** Formatiert den Verlauf als Text zum Kopieren. */
export function formatGameDebugLog(): string {
  return events
    .map((entry) => {
      const fields = Object.entries(entry.detail)
        .map(([field, value]) => `${field}=${formatDebugValue(value)}`)
        .join(' ')
      return fields ? `${entry.at} ${entry.event} ${fields}` : `${entry.at} ${entry.event}`
    })
    .join('\n')
}

/** Meldet Änderungen am Verlauf und am Schalter. */
export function subscribeGameDebug(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Vergleicht zwei Spielstände und liefert nur geänderte Felder. */
export function gameDebugChanges(
  previous: Record<string, GameDebugValue> | null,
  next: Record<string, GameDebugValue>,
): Record<string, GameDebugValue> | null {
  if (!previous) {
    return { ...next }
  }
  const changes: Record<string, GameDebugValue> = {}
  for (const key of Object.keys({ ...previous, ...next })) {
    const before = previous[key] ?? null
    const after = next[key] ?? null
    if (before !== after) {
      changes[key] = after
    }
  }
  return Object.keys(changes).length === 0 ? null : changes
}

/** Stabiler Schlüssel für einen Spielstand. */
export function gameDebugKey(detail: Record<string, GameDebugValue>): string {
  const keys = Object.keys(detail).sort()
  return JSON.stringify(keys.map((key) => [key, detail[key] ?? null]))
}

/** Aktiviert das Spiellog über `?debug=1` und legt `musikerratenDebug` ins Fenster. */
export function installGameDebug(search?: string): MusikerratenDebugApi {
  const flag = readDebugFlag(search ?? currentSearch())
  if (flag === 'an') {
    setGameDebugEnabled(true)
  } else if (flag === 'aus') {
    setGameDebugEnabled(false)
  } else if (enabled) {
    traceGame('debug', { aktiv: true, grund: 'gespeichert' })
  }
  const api = createDebugApi()
  if (typeof window !== 'undefined') {
    window.musikerratenDebug = api
  }
  return api
}

/** Setzt Schalter, Verlauf und Deduplizierung zurück. Nur für Tests. */
export function resetGameDebugForTests(): void {
  enabled = false
  events = []
  lastKey = ''
  lastAt = 0
  writeStoredFlag(false)
  writeStoredLog(events)
  if (typeof window !== 'undefined') {
    delete window.musikerratenDebug
  }
  notifyGameDebug()
}

function createDebugApi(): MusikerratenDebugApi {
  return {
    an(): void {
      setGameDebugEnabled(true)
    },
    aus(): void {
      setGameDebugEnabled(false)
    },
    istAn(): boolean {
      return isGameDebugEnabled()
    },
    ausgabe(): string {
      return formatGameDebugLog()
    },
    leeren(): void {
      clearGameDebugLog()
    },
    async kopieren(): Promise<string> {
      const text = formatGameDebugLog()
      await writeDebugClipboard(text)
      return text
    },
  }
}

function compactDetail(detail: GameDebugDetail): Record<string, GameDebugValue> {
  const result: Record<string, GameDebugValue> = {}
  for (const [key, value] of Object.entries(detail)) {
    if (value === undefined || Object.keys(result).length >= 24) {
      continue
    }
    result[key.slice(0, 40)] = sanitizeDebugValue(value)
  }
  return result
}

function sanitizeDebugValue(value: GameDebugValue): GameDebugValue {
  if (typeof value === 'string') {
    return redactSecrets(value).replace(/[\r\n]+/g, ' ').slice(0, MAX_TEXT)
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  return value
}

function formatDebugValue(value: GameDebugValue): string {
  if (typeof value !== 'string') {
    return String(value)
  }
  if (/[\s"=]/.test(value)) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  return value
}

function notifyGameDebug(): void {
  for (const listener of [...listeners]) {
    try {
      listener()
    } catch {
      continue
    }
  }
}

function consoleGameDebugLine(entry: GameDebugEvent): string {
  const fields = Object.entries(entry.detail)
    .map(([field, value]) => `${field}=${formatDebugValue(value)}`)
    .join(' ')
  return fields ? `[spiellog] ${entry.event} ${fields}` : `[spiellog] ${entry.event}`
}

function mirrorGameDebug(line: string): void {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.console.info(line)
  } catch {
    return
  }
}

function readDebugFlag(search: string): DebugFlag {
  const flag = new URLSearchParams(search).get('debug')
  if (flag === '1' || flag === 'an') {
    return 'an'
  }
  if (flag === '0' || flag === 'aus') {
    return 'aus'
  }
  return null
}

function currentSearch(): string {
  if (typeof location === 'undefined') {
    return ''
  }
  return location.search
}
