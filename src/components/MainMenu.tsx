import type { PhaseTimings } from '../lib/phaseTimings.ts'
import { SHOTLESS_ID, listMainMenuGames, type MainMenuGame } from '../lib/mainMenuGames.ts'
import { AppMenu } from './AppMenu.tsx'

interface MainMenuProps {
  savedTimings: PhaseTimings
  onSaveTimings: (timings: PhaseTimings) => void
  onLogout: () => void
  onSelectGame: (gameId: string) => void
}

export function MainMenu({ savedTimings, onSaveTimings, onLogout, onSelectGame }: MainMenuProps) {
  return (
    <section className="panel with-menu">
      <header className="panel-head">
        <div>
          <p className="eyebrow">Musikerraten</p>
          <h1>Hauptmenü</h1>
        </div>
        <div className="panel-head-meta">
          <AppMenu timings={savedTimings} onSaveTimings={onSaveTimings} onLogout={onLogout} />
        </div>
      </header>
      <p className="lede">Wähle ein Spiel. Weitere Modi folgen.</p>
      <div className="game-menu">
        {listMainMenuGames().map((game) => (
          <GameMenuEntry key={game.id} game={game} onSelectGame={onSelectGame} />
        ))}
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
  if (game.id === SHOTLESS_ID) {
    return 'game-entry is-shotless'
  }
  return 'game-entry'
}

function GameMenuLabel({ game }: { game: MainMenuGame }) {
  return (
    <>
      <span className="game-entry-kicker">{game.kicker}</span>
      <span className="game-entry-title">{game.label}</span>
    </>
  )
}
