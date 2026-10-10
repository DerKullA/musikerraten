import { AppMenu } from '@/components/AppMenu.tsx'
import { canStartShotless } from '@/lib/shotlessSession.ts'
import { SHOTLESS_GUESS_TARGETS, type ShotlessGuessTarget, type ShotlessMode } from '@/lib/shotlessRules.ts'

interface ShotlessSetupProps {
  mode: ShotlessMode | null
  guessTarget: ShotlessGuessTarget
  players: readonly string[]
  nameDraft: string
  nameError: string | null
  error: string | null
  onLogout: () => void
  onLeave: () => void
  onBackToPlaylists: () => void
  onSelectMode: (mode: ShotlessMode) => void
  onSelectGuessTarget: (target: ShotlessGuessTarget) => void
  onNameDraft: (value: string) => void
  onAddName: () => void
  onRemoveName: (name: string) => void
  onStart: () => void
}

export function ShotlessSetup({
  mode,
  guessTarget,
  players,
  nameDraft,
  nameError,
  error,
  onLogout,
  onLeave,
  onBackToPlaylists,
  onSelectMode,
  onSelectGuessTarget,
  onNameDraft,
  onAddName,
  onRemoveName,
  onStart,
}: ShotlessSetupProps) {
  const ready = canStartShotless(mode, players)

  return (
    <section className="panel with-menu fit-screen">
      <header className="panel-head">
        <div>
          <p className="eyebrow">Trinkspiel</p>
          <h1>Shotless</h1>
        </div>
        <div className="panel-head-meta">
          <AppMenu
            onLogout={onLogout}
            onBackToPlaylists={onBackToPlaylists}
            onLeaveRound={onLeave}
            leaveLabel="Zurück zum Hauptmenü"
          />
        </div>
      </header>
      <div className="fit-scroll">
        <p className="lede">
          Kurze Schnipsel an wechselnden Stellen im Song. Wer länger hören muss, trinkt weniger. Wer richtig
          liegt, lässt die anderen trinken.
        </p>
        <details className="rules">
          <summary>Alle Regeln</summary>
          <p>
            Niemand oder Aufgeben: alle einen Shot. Nur Ansagen auf dem Bildschirm.
          </p>
        </details>
        {error ? <p className="banner error">{error}</p> : null}
        <div className="shotless-modes">
          <button
            type="button"
            className={mode === 'tippen' ? 'mode-card is-selected' : 'mode-card'}
            aria-pressed={mode === 'tippen'}
            onClick={() => onSelectMode('tippen')}
          >
            <strong>Tippen</strong>
            <span>Eingabe prüfen. Ein Fehlschuss und du trinkst die aktuelle Strafe.</span>
          </button>
          <button
            type="button"
            className={mode === 'party' ? 'mode-card is-selected' : 'mode-card'}
            aria-pressed={mode === 'party'}
            onClick={() => onSelectMode('party')}
          >
            <strong>Party</strong>
            <span>Jemand ruft Erraten. Ihr wählt, wer es wusste — oder niemand.</span>
          </button>
        </div>
        <p className="guess-target-legend" id="shotless-guess-target-label">
          Was gilt als richtig?
        </p>
        <div className="guess-targets" role="group" aria-labelledby="shotless-guess-target-label">
          {SHOTLESS_GUESS_TARGETS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={guessTarget === option.id ? 'guess-target is-selected' : 'guess-target'}
              aria-pressed={guessTarget === option.id}
              onClick={() => onSelectGuessTarget(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {mode === 'party' ? (
          <PlayerRoster
            players={players}
            nameDraft={nameDraft}
            nameError={nameError}
            onNameDraft={onNameDraft}
            onAddName={onAddName}
            onRemoveName={onRemoveName}
          />
        ) : null}
      </div>
      <div className="actions">
        <button type="button" className="btn primary cta" onClick={onStart} disabled={!ready}>
          Runde starten
        </button>
      </div>
    </section>
  )
}

interface PlayerRosterProps {
  players: readonly string[]
  nameDraft: string
  nameError: string | null
  onNameDraft: (value: string) => void
  onAddName: () => void
  onRemoveName: (name: string) => void
}

function PlayerRoster({
  players,
  nameDraft,
  nameError,
  onNameDraft,
  onAddName,
  onRemoveName,
}: PlayerRosterProps) {
  return (
    <div className="player-roster">
      <p className="muted">Mitspieler, 2 bis 12. Tippen auf einen Namen entfernt ihn.</p>
      <form
        className="player-row"
        onSubmit={(event) => {
          event.preventDefault()
          onAddName()
        }}
      >
        <label className="sr-only" htmlFor="shotless-player">
          Name
        </label>
        <input
          id="shotless-player"
          value={nameDraft}
          placeholder="Name"
          maxLength={24}
          onChange={(event) => onNameDraft(event.target.value)}
        />
        <button type="submit" className="btn ghost">
          Hinzufügen
        </button>
      </form>
      {nameError ? <p className="banner error">{nameError}</p> : null}
      <ul className="player-chips">
        {players.map((name) => (
          <li key={name}>
            <button type="button" onClick={() => onRemoveName(name)} aria-label={`${name} entfernen`}>
              {name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
