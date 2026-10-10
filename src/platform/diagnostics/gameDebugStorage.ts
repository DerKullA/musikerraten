import type { GameDebugEvent } from './gameDebug.ts'

const ENABLED_KEY = 'musikerraten.debug'
const LOG_KEY = 'musikerraten.debug.log'

export const GAME_DEBUG_MAX_EVENTS = 400

/** Liest den gemerkten Spiellog-Schalter. */
export function readStoredFlag(): boolean {
  try {
    return globalThis.localStorage?.getItem(ENABLED_KEY) === '1'
  } catch {
    return false
  }
}

/** Merkt sich den Spiellog-Schalter im Browser. */
export function writeStoredFlag(next: boolean): void {
  try {
    if (next) {
      globalThis.localStorage?.setItem(ENABLED_KEY, '1')
      return
    }
    globalThis.localStorage?.removeItem(ENABLED_KEY)
  } catch {
    return
  }
}

/** Stellt den Verlauf der laufenden Sitzung wieder her. */
export function readStoredLog(): readonly GameDebugEvent[] {
  try {
    const raw = globalThis.sessionStorage?.getItem(LOG_KEY)
    if (!raw) {
      return []
    }
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter(isGameDebugEvent).slice(-GAME_DEBUG_MAX_EVENTS)
  } catch {
    return []
  }
}

/** Schreibt den Verlauf in die laufende Sitzung. */
export function writeStoredLog(next: readonly GameDebugEvent[]): void {
  try {
    if (next.length === 0) {
      globalThis.sessionStorage?.removeItem(LOG_KEY)
      return
    }
    globalThis.sessionStorage?.setItem(LOG_KEY, JSON.stringify(next))
  } catch {
    return
  }
}

/** Kopiert den Text in die Zwischenablage, wenn der Browser das kann. */
export async function writeDebugClipboard(text: string): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    return
  }
  await navigator.clipboard.writeText(text)
}

function isGameDebugEvent(value: unknown): value is GameDebugEvent {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  return 'at' in value && 'event' in value && 'detail' in value && typeof value.event === 'string'
}
