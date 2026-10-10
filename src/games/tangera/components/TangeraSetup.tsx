import { AppMenu } from '@/ui/AppMenu.tsx'
import { CARDS_PER_DECK, RANKS, RANK_NAME } from '@/games/tangera/logic/cards.ts'
import { MAX_DECKS, MIN_DECKS, cardCount, estimateMinutes, formatDuration } from '@/games/tangera/logic/duration.ts'
import { MAX_PLAYERS, MIN_PLAYERS, MAX_PLAYER_NAME_LENGTH, canStart } from '@/games/tangera/logic/players.ts'
import { RANK_EVENTS } from '@/games/tangera/logic/rules.ts'

interface TangeraSetupProps {
  players: readonly string[]
  spicy: boolean
  decks: number
  nameDraft: string
  nameError: string | null
  leaveLabel: string
  onLogout?: () => void
  onLeave: () => void
  onNameDraft: (value: string) => void
  onAddName: () => void
  onRemoveName: (name: string) => void
  onSpicy: (value: boolean) => void
  onDecks: (value: number) => void
  onStart: () => void
}

export function TangeraSetup({
  players,
  spicy,
  decks,
  nameDraft,
  nameError,
  leaveLabel,
  onLogout,
  onLeave,
  onNameDraft,
  onAddName,
  onRemoveName,
  onSpicy,
  onDecks,
  onStart,
}: TangeraSetupProps) {
  const ready = canStart(players)
  const deckOptions = Array.from({ length: MAX_DECKS - MIN_DECKS + 1 }, (_, index) => MIN_DECKS + index)
  const duration = formatDuration(estimateMinutes(decks, players.length))

  return (
    <section className="panel with-menu fit-screen tangera">
      <header className="panel-head">
        <div>
          <p className="eyebrow">Trinkspiel</p>
          <h1>Tangera</h1>
        </div>
        <div className="panel-head-meta">
          <AppMenu onLogout={onLogout} onLeaveRound={onLeave} leaveLabel={leaveLabel} />
        </div>
      </header>
      <div className="fit-scroll">
        <p className="lede">
          Ein Stapel aus einem bis vier Skatblättern. Eine Karte nach der anderen wird aufgedeckt und jeder Kartenwert löst ein anderes
          Ereignis aus. Das Gerät geht reihum oder liegt in der Mitte.
        </p>
        <details className="rules">
          <summary>Alle Karten</summary>
          <ul className="tangera-card-rules">
            {RANKS.map((rank) => (
              <li key={rank}>
                <strong>
                  {RANK_NAME[rank]}: {RANK_EVENTS[rank].title}
                </strong>
                <span>{RANK_EVENTS[rank].summary}</span>
              </li>
            ))}
          </ul>
        </details>
        <div className="tangera-roster">
          <p className="muted">
            Mitspieler, {MIN_PLAYERS} bis {MAX_PLAYERS}, in Sitzreihenfolge. Tippen auf einen Namen entfernt ihn.
          </p>
          <form
            className="tangera-name-row"
            onSubmit={(event) => {
              event.preventDefault()
              onAddName()
            }}
          >
            <label className="sr-only" htmlFor="tangera-player">
              Name
            </label>
            <input
              id="tangera-player"
              value={nameDraft}
              placeholder="Name"
              maxLength={MAX_PLAYER_NAME_LENGTH}
              autoComplete="off"
              onChange={(event) => onNameDraft(event.target.value)}
            />
            <button type="submit" className="btn ghost">
              Hinzufügen
            </button>
          </form>
          {nameError ? <p className="banner error">{nameError}</p> : null}
          <ul className="tangera-chips is-players">
            {players.map((name) => (
              <li key={name}>
                <button type="button" onClick={() => onRemoveName(name)} aria-label={`${name} entfernen`}>
                  {name}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="tangera-decks">
          <p className="tangera-decks-label" id="tangera-decks-label">
            Kartendecks
          </p>
          <div className="tangera-deck-options" role="group" aria-labelledby="tangera-decks-label">
            {deckOptions.map((count) => (
              <button
                key={count}
                type="button"
                className={decks === count ? 'tangera-deck is-selected' : 'tangera-deck'}
                aria-pressed={decks === count}
                onClick={() => onDecks(count)}
              >
                {count}
              </button>
            ))}
          </div>
          <p className="tangera-estimate" aria-live="polite">
            <strong>{duration}</strong>
            <span>
              {cardCount(decks)} Karten ({decks} × {CARDS_PER_DECK})
              {players.length < 2 ? ', gerechnet mit 2 Spielern' : `, ${players.length} Spieler`}
            </span>
          </p>
        </div>
        <label className="tangera-switch">
          <input type="checkbox" checked={spicy} onChange={(event) => onSpicy(event.target.checked)} />
          <span>
            <strong>Spicy (18+)</strong>
            <small>Zusätzliche, frechere Fragen, Aufgaben und Kategorien.</small>
          </span>
        </label>
      </div>
      <div className="actions">
        <button type="button" className="btn primary cta" onClick={onStart} disabled={!ready}>
          {ready ? 'Spiel starten' : `Mindestens ${MIN_PLAYERS} Spieler`}
        </button>
      </div>
    </section>
  )
}
