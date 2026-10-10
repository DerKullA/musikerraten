import { useState } from 'react'
import { LOSER_SIPS, sipsText } from '@/games/tangera/logic/rules.ts'

interface PlayerGridProps {
  players: readonly string[]
  selected?: readonly string[]
  /** Zahl neben dem Namen, z. B. getrunkene Schlücke. */
  badges?: Record<string, number>
  label: string
  onToggle: (player: string) => void
}

export function PlayerGrid({ players, selected = [], badges, label, onToggle }: PlayerGridProps) {
  return (
    <ul className="tangera-players" aria-label={label}>
      {players.map((player) => {
        const on = selected.includes(player)
        const badge = badges?.[player]
        return (
          <li key={player}>
            <button
              type="button"
              className={on ? 'tangera-player is-selected' : 'tangera-player'}
              aria-pressed={on}
              onClick={() => onToggle(player)}
            >
              <span>{player}</span>
              {badge !== undefined ? <small>{badge}</small> : null}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

interface LoserPickerProps {
  players: readonly string[]
  sips?: number
  initial?: string | null
  /** `null` = niemand hat verloren. */
  onPick: (loser: string | null) => void
}

/** Die Gruppe tippt den Verlierer an, die App schreibt die Schlücke gut. */
export function LoserPicker({ players, sips = LOSER_SIPS, initial = null, onPick }: LoserPickerProps) {
  const [selected, setSelected] = useState<string | null>(initial)

  return (
    <>
      <p className="tangera-prompt">Wer hat verloren?</p>
      <PlayerGrid
        players={players}
        selected={selected ? [selected] : []}
        label="Verlierer wählen"
        onToggle={(player) => setSelected((current) => (current === player ? null : player))}
      />
      <div className="tangera-footer">
        <button
          type="button"
          className="btn primary cta"
          disabled={selected === null}
          onClick={() => selected && onPick(selected)}
        >
          {selected ? `${selected} trinkt ${sipsText(sips)}` : 'Verlierer antippen'}
        </button>
        <button type="button" className="btn ghost" onClick={() => onPick(null)}>
          Niemand verliert
        </button>
      </div>
    </>
  )
}
