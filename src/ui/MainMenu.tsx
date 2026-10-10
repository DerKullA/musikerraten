import type { PhaseTimings } from './phaseTimings.ts'
import { AppMenu } from './AppMenu.tsx'

export interface MainMenuGame {
  id: string
  kicker: string
  label: string
  available: boolean
  /** Zusätzliche CSS-Klasse des Menüeintrags. */
  menuVariant?: string
}

interface MainMenuProps {
  games: readonly MainMenuGame[]
  savedTimings: PhaseTimings
  onSaveTimings: (timings: PhaseTimings) => void
  onLogout: () => void
  onSelectGame: (gameId: string) => void
}

export function MainMenu({ games, savedTimings, onSaveTimings, onLogout, onSelectGame }: MainMenuProps) {
  return (
    <section className="panel with-menu fit-screen">
      <header className="panel-head">
        <div>
          <p className="eyebrow">Musikerraten</p>
          <h1>Hauptmenü</h1>
        </div>
        <div className="panel-head-meta">
          <AppMenu timings={savedTimings} onSaveTimings={onSaveTimings} onLogout={onLogout} />
        </div>
      </header>
      <div className="fit-scroll">
      <p className="lede">Wähle ein Spiel. Weitere Modi folgen.</p>
      <div className="game-menu">
        {games.map((game) => (
          <GameMenuEntry key={game.id} game={game} onSelectGame={onSelectGame} />
        ))}
      </div>
      </div>
    </section>
  )
}

function GameMenuEntry({ game, onSelectGame }: { game: MainMenuGame; onSelectGame: (gameId: string) => void }) {
  if (!game.available) {
    return (
      <button type="button" className="game-entry is-locked" data-game={game.id} disabled aria-disabled="true">
        <GameMenuLabel game={game} />
      </button>
    )
  }
  return (
    <button
      type="button"
      className={gameEntryClass(game)}
      data-game={game.id}
      onClick={() => onSelectGame(game.id)}
    >
      <GameMenuLabel game={game} />
    </button>
  )
}

function gameEntryClass(game: MainMenuGame): string {
  return game.menuVariant ? `game-entry ${game.menuVariant}` : 'game-entry'
}

function GameMenuLabel({ game }: { game: MainMenuGame }) {
  return (
    <>
      <span className="game-entry-kicker">{game.kicker}</span>
      <span className="game-entry-title">{game.label}</span>
    </>
  )
}
