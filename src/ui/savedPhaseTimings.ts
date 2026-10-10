import { useSyncExternalStore } from 'react'
import {
  clearSessionPhaseTimings,
  DEFAULT_PHASE_TIMINGS,
  readSessionPhaseTimings,
  writeSessionPhaseTimings,
  type KeyValueStore,
  type PhaseTimings,
} from '@/ui/phaseTimings.ts'

// Die gespeicherten Phasenzeiten der Sitzung. Menü, Playlist-Auswahl und Song erraten teilen sich
// diesen Stand, obwohl das Spiel nur während der Runde eingehängt ist. Quelle ist weiterhin der
// Session-Speicher; der Wert wird einmal gelesen und danach nur noch über save/reset geändert.

export interface SavedPhaseTimingsStore {
  get: () => PhaseTimings
  /** Speichert (nur gültige Werte, sonst Standard) und liefert den gespeicherten Stand. */
  save: (next: PhaseTimings) => PhaseTimings
  /** Zurück auf den Standard und Session-Eintrag löschen (Login/Logout). */
  reset: () => void
  subscribe: (listener: () => void) => () => void
}

export function createSavedPhaseTimingsStore(storage?: KeyValueStore | null): SavedPhaseTimingsStore {
  let current: PhaseTimings | null = null
  const listeners = new Set<() => void>()

  function emit(): void {
    for (const listener of [...listeners]) {
      listener()
    }
  }

  return {
    get() {
      current ??= readSessionPhaseTimings(storage)
      return current
    },
    save(next) {
      const stored = writeSessionPhaseTimings(next, storage)
      current = stored
      emit()
      return stored
    },
    reset() {
      clearSessionPhaseTimings(storage)
      current = DEFAULT_PHASE_TIMINGS
      emit()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

const sessionStore = createSavedPhaseTimingsStore()

export const getSavedPhaseTimings = sessionStore.get
export const saveSavedPhaseTimings = sessionStore.save
export const resetSavedPhaseTimings = sessionStore.reset

/** Gespeicherte Phasenzeiten; rendert neu, sobald sie gespeichert oder zurückgesetzt werden. */
export function useSavedPhaseTimings(): PhaseTimings {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get, sessionStore.get)
}
