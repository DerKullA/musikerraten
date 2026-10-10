import { useEffect, useRef } from 'react'
import { useSyncExternalStore } from 'react'
import {
  gameDebugChanges,
  gameDebugKey,
  isGameDebugEnabled,
  subscribeGameDebug,
  traceGame,
  type GameDebugValue,
} from './gameDebug.ts'

/** Liest den Spiellog-Schalter und aktualisiert ihn bei Änderungen. */
function useGameDebugEnabled(): boolean {
  return useSyncExternalStore(subscribeGameDebug, isGameDebugEnabled, () => false)
}

/** Schreibt Änderungen eines Spielstands ins Spiellog. */
export function useGameDebugWatch(scope: string, snapshot: Record<string, GameDebugValue>): void {
  const previous = useRef<Record<string, GameDebugValue> | null>(null)
  const enabled = useGameDebugEnabled()
  const key = gameDebugKey(snapshot)

  useEffect(() => {
    if (!enabled) {
      previous.current = null
      return
    }
    const next = readSnapshot(key)
    const changes = gameDebugChanges(previous.current, next)
    previous.current = next
    if (!changes) {
      return
    }
    traceGame(scope, changes)
  }, [enabled, key, scope])
}

function readSnapshot(key: string): Record<string, GameDebugValue> {
  const result: Record<string, GameDebugValue> = {}
  let parsed: unknown
  try {
    parsed = JSON.parse(key)
  } catch {
    return result
  }
  if (!Array.isArray(parsed)) {
    return result
  }
  for (const entry of parsed) {
    if (!Array.isArray(entry) || typeof entry[0] !== 'string') {
      continue
    }
    const value: unknown = entry[1]
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      result[entry[0]] = value
    }
  }
  return result
}
