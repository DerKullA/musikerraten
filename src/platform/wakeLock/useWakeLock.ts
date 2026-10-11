import { useLayoutEffect } from 'react'
import { runWakeLockEffect } from './browserWakeLock.ts'

/**
 * Hält den Bildschirm wach, solange `active` true ist.
 * Der Wechsel auf true soll im Start-/Play-Klick liegen, damit die Anfrage zur Geste gehört.
 * useLayoutEffect läuft noch in demselben Klick, bevor der Browser die Geste verwirft.
 */
export function useWakeLock(active: boolean): void {
  useLayoutEffect(() => runWakeLockEffect(active), [active])
}
