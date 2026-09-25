import type { PhaseTimings } from '../lib/phaseTimings.ts'
import { listMainMenuGames, type MainMenuGame } from '../lib/mainMenuGames.ts'
import { AppMenu } from './AppMenu.tsx'

interface MainMenuProps {
  savedTimings: PhaseTimings
  onSaveTimings: (timings: PhaseTimings) => void
  onLogout: () => void
  onGuessSong: () => void
}

export function MainMenu({ savedTimings, onSaveTimings, onLogout, onGuessSong }: MainMenuProps) {
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
          <GameMenuEntry key={game.id} game={game} onGuessSong={onGuessSong} />
        ))}
      </div>
    </section>
  )
}

function GameMenuEntry({ game, onGuessSong }: { game: MainMenuGame; onGuessSong: () => void }) {
  if (!game.available) {
    return (
      <button type="button" className="game-entry is-locked" disabled aria-disabled="true">
        <GameMenuLabel game={game} />
      </button>
    )
  }
  return (
    <button type="button" className="game-entry" onClick={onGuessSong}>
      <GameMenuLabel game={game} />
    </button>
  )
}

function GameMenuLabel({ game }: { game: MainMenuGame }) {
  return (
    <>
      <span className="game-entry-kicker">{game.kicker}</span>
      <span className="game-entry-title">{game.label}</span>
    </>
  )
}
