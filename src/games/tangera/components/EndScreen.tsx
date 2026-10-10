import { AppMenu } from '@/ui/AppMenu.tsx'
import type { RankingEntry } from '@/games/tangera/logic/game.ts'
import { sipsText } from '@/games/tangera/logic/rules.ts'

interface EndScreenProps {
  ranking: readonly RankingEntry[]
  leaveLabel: string
  onLogout?: () => void
  onLeave: () => void
  onAgain: () => void
  onSetup: () => void
}

export function EndScreen({ ranking, leaveLabel, onLogout, onLeave, onAgain, onSetup }: EndScreenProps) {
  const top = ranking[0]
  const max = Math.max(1, top?.sips ?? 0)
  const champion = top && top.sips > 0 ? top.player : null

  return (
    <section className="panel with-menu fit-screen tangera">
      <header className="panel-head">
        <div>
          <p className="eyebrow">Tangera · Stapel leer</p>
          <h1>{champion ? `${champion} hat am meisten getrunken` : 'Alle sind nüchtern geblieben'}</h1>
        </div>
        <div className="panel-head-meta">
          <AppMenu onLogout={onLogout} onLeaveRound={onLeave} leaveLabel={leaveLabel} />
        </div>
      </header>
      <div className="fit-scroll">
        <ol className="tangera-ranking" aria-label="Auswertung">
          {ranking.map((entry) => (
            <li key={entry.player}>
              <div className="tangera-ranking-row">
                <strong>{entry.player}</strong>
                <span>
                  {sipsText(entry.sips)}
                  {entry.shots > 0 ? ` · ${entry.shots} ${entry.shots === 1 ? 'Shot' : 'Shots'}` : ''}
                </span>
              </div>
              <div className="tangera-bar" aria-hidden="true">
                <span style={{ width: `${(entry.sips / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div className="actions">
        <button type="button" className="btn primary cta" onClick={onAgain}>
          Nochmal mit dieser Runde
        </button>
        <button type="button" className="btn ghost" onClick={onSetup}>
          Spieler ändern
        </button>
      </div>
    </section>
  )
}
