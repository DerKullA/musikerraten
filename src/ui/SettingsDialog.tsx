import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type Ref } from 'react'
import { isGameDebugEnabled, setGameDebugEnabled } from '@/platform/diagnostics/gameDebug.ts'
import {
  MAX_PHASE_SECONDS,
  MIN_PHASE_SECONDS,
  MIN_THINK_SECONDS,
  phaseTimingDraftFromTimings,
  phaseTimingsFromDraft,
  type PhaseTimingDraft,
  type PhaseTimings,
} from './phaseTimings.ts'

interface SettingsDialogProps {
  timings: PhaseTimings
  onSave: (timings: PhaseTimings) => void
  onClose: () => void
}

export function SettingsDialog({ timings, onSave, onClose }: SettingsDialogProps) {
  const [draft, setDraft] = useState<PhaseTimingDraft>(() => phaseTimingDraftFromTimings(timings))
  const [debugEnabled, setDebugEnabled] = useState(() => isGameDebugEnabled())
  const [formError, setFormError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const playInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    playInputRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleEscape(event: globalThis.KeyboardEvent): void {
      if (event.key !== 'Escape') {
        return
      }
      event.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  function saveDraft(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const parsed = phaseTimingsFromDraft(draft)
    if (!parsed) {
      setFormError(
        `Bitte ganze Sekunden eintragen: Vorspiel und Auflösung von ${MIN_PHASE_SECONDS} bis ${MAX_PHASE_SECONDS}, Denkzeit von ${MIN_THINK_SECONDS} bis ${MAX_PHASE_SECONDS}.`,
      )
      return
    }
    setGameDebugEnabled(debugEnabled)
    onSave(parsed)
    onClose()
  }

  function updateDraft(field: keyof PhaseTimingDraft, value: string): void {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  return (
    <div className="settings-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="phase-settings-title"
        aria-describedby="phase-settings-note"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => keepDialogFocus(event, dialogRef.current)}
      >
        <p className="eyebrow">Spiel</p>
        <h2 id="phase-settings-title">Einstellungen</h2>
        <p id="phase-settings-note" className="lede">
          Lege fest, wie lange jede Phase dauert. Vorspiel und Auflösung: {MIN_PHASE_SECONDS} bis{' '}
          {MAX_PHASE_SECONDS} Sekunden. Denkzeit: {MIN_THINK_SECONDS} bis {MAX_PHASE_SECONDS} Sekunden.
        </p>
        <form onSubmit={saveDraft}>
          <TimingField
            id="phase-play"
            label="Abspielen / Vorspiel"
            description="Der Titel läuft, Interpret und Titel bleiben verborgen."
            value={draft.play}
            inputRef={playInputRef}
            onChange={(value) => updateDraft('play', value)}
          />
          <TimingField
            id="phase-think"
            label="Erratezeit / Denkzeit"
            description="0 überspringt die Denkzeit: nach dem Vorspiel folgt direkt die Auflösung. Sonst pausiert der Ton, ohne die Auflösung zu zeigen."
            value={draft.think}
            minSeconds={MIN_THINK_SECONDS}
            onChange={(value) => updateDraft('think', value)}
          />
          <TimingField
            id="phase-reveal"
            label="Auflösen"
            description="Interpret und Titel sind sichtbar, der Song spielt weiter. Danach startet automatisch der nächste Titel."
            value={draft.reveal}
            onChange={(value) => updateDraft('reveal', value)}
          />
          <DebugField checked={debugEnabled} onChange={setDebugEnabled} />
          {formError ? (
            <p className="banner error" role="alert">
              {formError}
            </p>
          ) : null}
          <p className="settings-note">
            Die Phasenzeiten gelten ab dem nächsten Titel. Die laufende Phase läuft mit der bisherigen
            Zeit zu Ende. Sie bleiben nur bis zum Abmelden gespeichert.
          </p>
          <div className="actions">
            <button type="submit" className="btn primary">
              Speichern
            </button>
            <button type="button" className="btn ghost" onClick={onClose}>
              Abbrechen
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TimingField({
  id,
  label,
  description,
  value,
  minSeconds = MIN_PHASE_SECONDS,
  inputRef,
  onChange,
}: {
  id: string
  label: string
  description: string
  value: string
  minSeconds?: number
  inputRef?: Ref<HTMLInputElement>
  onChange: (value: string) => void
}) {
  const hintId = `${id}-hint`
  return (
    <div className="timing-field">
      <label htmlFor={id}>{label}</label>
      <p id={hintId}>{description}</p>
      <div className="timing-input">
        <input
          ref={inputRef}
          id={id}
          type="number"
          inputMode="numeric"
          min={minSeconds}
          max={MAX_PHASE_SECONDS}
          step={1}
          value={value}
          aria-describedby={hintId}
          onChange={(event) => onChange(event.target.value)}
        />
        <span>Sekunden</span>
      </div>
    </div>
  )
}

function DebugField({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (next: boolean) => void
}) {
  const hintId = 'debug-mode-hint'
  return (
    <div className="debug-field">
      <label htmlFor="debug-mode">
        <input
          id="debug-mode"
          type="checkbox"
          checked={checked}
          aria-describedby={hintId}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>Debug-Modus</span>
      </label>
      <p id={hintId}>
        Schreibt Spielereignisse in die Browser-Konsole. Die Wahl bleibt in diesem Browser gespeichert,
        auch nach dem Abmelden.
      </p>
    </div>
  )
}

function keepDialogFocus(event: KeyboardEvent<HTMLDivElement>, root: HTMLElement | null): void {
  if (event.key !== 'Tab' || !root) {
    return
  }
  const items = Array.from(
    root.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)'),
  )
  const first = items[0]
  const last = items[items.length - 1]
  if (!first || !last) {
    return
  }
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
    return
  }
  if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}
