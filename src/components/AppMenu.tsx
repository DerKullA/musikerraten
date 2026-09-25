import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type Ref,
} from 'react'
import {
  MAX_PHASE_SECONDS,
  MIN_PHASE_SECONDS,
  phaseTimingDraftFromTimings,
  phaseTimingsFromDraft,
  type PhaseTimingDraft,
  type PhaseTimings,
} from '../lib/phaseTimings.ts'

interface AppMenuProps {
  timings: PhaseTimings
  onSaveTimings: (timings: PhaseTimings) => void
  onLogout: () => void
}

export function AppMenu({ timings, onSaveTimings, onLogout }: AppMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const burgerRef = useRef<HTMLButtonElement>(null)
  const firstItemRef = useRef<HTMLButtonElement>(null)

  const closeSettings = useCallback(() => {
    setSettingsOpen(false)
    burgerRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    if (!menuOpen) {
      return
    }
    const frame = window.requestAnimationFrame(() => {
      firstItemRef.current?.focus({ preventScroll: true })
    })
    function handlePointerDown(event: PointerEvent): void {
      const target = event.target
      if (!(target instanceof Node) || menuRef.current?.contains(target)) {
        return
      }
      setMenuOpen(false)
    }
    function handleEscape(event: globalThis.KeyboardEvent): void {
      if (event.key !== 'Escape') {
        return
      }
      event.preventDefault()
      setMenuOpen(false)
      burgerRef.current?.focus({ preventScroll: true })
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [menuOpen])

  function toggleMenu(): void {
    setMenuOpen((open) => !open)
  }

  function openSettings(): void {
    setMenuOpen(false)
    setSettingsOpen(true)
  }

  function logout(): void {
    setMenuOpen(false)
    onLogout()
  }

  return (
    <div className="app-menu" ref={menuRef}>
      <button
        ref={burgerRef}
        type="button"
        className={`burger-button${menuOpen ? ' is-open' : ''}`}
        aria-label={menuOpen ? 'Menü schließen' : 'Menü öffnen'}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-controls="app-menu-panel"
        onClick={toggleMenu}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>
      <div
        id="app-menu-panel"
        className="menu-popover"
        role="menu"
        aria-label="Spielmenü"
        hidden={!menuOpen}
        aria-hidden={!menuOpen}
        inert={!menuOpen}
        onKeyDown={moveMenuFocus}
      >
        <button
          ref={firstItemRef}
          type="button"
          role="menuitem"
          className="menu-item"
          onClick={openSettings}
        >
          Einstellungen
        </button>
        <button type="button" role="menuitem" className="menu-item menu-item-danger" onClick={logout}>
          Abmelden
        </button>
      </div>
      {settingsOpen ? (
        <SettingsDialog timings={timings} onSave={onSaveTimings} onClose={closeSettings} />
      ) : null}
    </div>
  )
}

function SettingsDialog({
  timings,
  onSave,
  onClose,
}: {
  timings: PhaseTimings
  onSave: (timings: PhaseTimings) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<PhaseTimingDraft>(() => phaseTimingDraftFromTimings(timings))
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
      setFormError(`Bitte ganze Sekunden zwischen ${MIN_PHASE_SECONDS} und ${MAX_PHASE_SECONDS} eintragen.`)
      return
    }
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
          Lege fest, wie lange jede Phase dauert. Erlaubt sind {MIN_PHASE_SECONDS} bis {MAX_PHASE_SECONDS}{' '}
          Sekunden.
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
            description="Der Ton pausiert. Es gibt noch keine Auflösung."
            value={draft.think}
            onChange={(value) => updateDraft('think', value)}
          />
          <TimingField
            id="phase-reveal"
            label="Auflösen"
            description="Interpret, Titel und Gesamtlänge sind sichtbar."
            value={draft.reveal}
            onChange={(value) => updateDraft('reveal', value)}
          />
          {formError ? (
            <p className="banner error" role="alert">
              {formError}
            </p>
          ) : null}
          <p className="settings-note">
            Gilt ab dem nächsten Titel. Die laufende Phase läuft mit der bisherigen Zeit zu Ende. Die
            Werte bleiben nur bis zum Abmelden gespeichert.
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
  inputRef,
  onChange,
}: {
  id: string
  label: string
  description: string
  value: string
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
          min={MIN_PHASE_SECONDS}
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

function moveMenuFocus(event: KeyboardEvent<HTMLDivElement>): void {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') {
    return
  }
  const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
  if (items.length === 0) {
    return
  }
  event.preventDefault()
  const current = items.findIndex((item) => item === document.activeElement)
  if (event.key === 'Home') {
    items[0]?.focus()
    return
  }
  if (event.key === 'End') {
    items[items.length - 1]?.focus()
    return
  }
  const offset = event.key === 'ArrowDown' ? 1 : -1
  const nextIndex = (current + offset + items.length) % items.length
  items[nextIndex]?.focus()
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
