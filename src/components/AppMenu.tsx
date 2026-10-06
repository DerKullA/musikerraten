import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { readAppVersionLabel } from '../lib/appVersion.ts'
import type { PhaseTimings } from '../lib/phaseTimings.ts'
import { SettingsDialog } from './SettingsDialog.tsx'

interface AppMenuProps {
  timings?: PhaseTimings
  onSaveTimings?: (timings: PhaseTimings) => void
  onLogout: () => void
  onLeaveRound?: () => void
  onForceSkip?: () => void
  onBackToPlaylists?: () => void
  leaveLabel?: string
}

export function AppMenu({
  timings,
  onSaveTimings,
  onLogout,
  onLeaveRound,
  onForceSkip,
  onBackToPlaylists,
  leaveLabel = 'Zurück',
}: AppMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const burgerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const closeSettings = useCallback(() => {
    setSettingsOpen(false)
    burgerRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    if (!menuOpen) {
      return
    }
    const frame = window.requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus({ preventScroll: true })
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
    if (!timings || !onSaveTimings) {
      return
    }
    setMenuOpen(false)
    setSettingsOpen(true)
  }

  function logout(): void {
    setMenuOpen(false)
    onLogout()
  }

  function forceSkip(): void {
    setMenuOpen(false)
    onForceSkip?.()
  }

  function backToPlaylists(): void {
    setMenuOpen(false)
    onBackToPlaylists?.()
  }

  function leaveRound(): void {
    setMenuOpen(false)
    onLeaveRound?.()
  }

  const showPhaseSettings = timings !== undefined && onSaveTimings !== undefined

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
        ref={panelRef}
        className="menu-popover"
        role="menu"
        aria-label="Spielmenü"
        hidden={!menuOpen}
        aria-hidden={!menuOpen}
        inert={!menuOpen}
        onKeyDown={moveMenuFocus}
      >
        {showPhaseSettings ? (
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={openSettings}
          >
            Einstellungen
          </button>
        ) : null}
        {onForceSkip ? (
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={forceSkip}
          >
            Force-Skip (Song überspringen)
          </button>
        ) : null}
        {onBackToPlaylists ? (
          <button
            type="button"
            role="menuitem"
            className="menu-item menu-item-leave"
            onClick={backToPlaylists}
          >
            Zurück zur Playlistauswahl
          </button>
        ) : null}
        {onLeaveRound ? (
          <button
            type="button"
            role="menuitem"
            className="menu-item menu-item-leave"
            onClick={leaveRound}
          >
            {leaveLabel}
          </button>
        ) : null}
        <button
          type="button"
          role="menuitem"
          className="menu-item menu-item-danger"
          onClick={logout}
        >
          Abmelden
        </button>
        <p className="menu-version">{readAppVersionLabel()}</p>
      </div>
      {settingsOpen && timings && onSaveTimings ? (
        <SettingsDialog timings={timings} onSave={onSaveTimings} onClose={closeSettings} />
      ) : null}
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
