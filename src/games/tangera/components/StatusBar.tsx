interface StatusBarProps {
  players: readonly string[]
  quizmaster: string | null
  bitch: string | null
  rules: readonly string[]
  sips: Record<string, number>
  shots: Record<string, number>
}

/** Rollen, Regeln und Stand, immer griffbereit und eingeklappt. */
export function StatusBar({ players, quizmaster, bitch, rules, sips, shots }: StatusBarProps) {
  return (
    <div className="tangera-status">
      <ul className="tangera-chips" aria-label="Rollen">
        <li className={quizmaster ? 'is-on' : undefined}>Quizmaster: {quizmaster ?? '–'}</li>
        <li className={bitch ? 'is-on is-bitch' : undefined}>Bitch: {bitch ?? '–'}</li>
        <li className={rules.length > 0 ? 'is-on' : undefined}>Regeln: {rules.length}</li>
      </ul>
      <details className="tangera-details">
        <summary>Regeln und Stand</summary>
        <h3>Regeln</h3>
        {rules.length > 0 ? (
          <ul className="tangera-rules">
            {rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">Noch keine Regeln. Eine 9 bringt die erste.</p>
        )}
        <h3>Stand</h3>
        <p className="muted">Gezählt werden nur Strafen und Zehner, die in der App entschieden wurden.</p>
        <ul className="tangera-rules">
          {players.map((name) => (
            <li key={name}>
              {name}: {sips[name] ?? 0} {sips[name] === 1 ? 'Schluck' : 'Schlücke'}
              {(shots[name] ?? 0) > 0 ? `, ${shots[name]} ${shots[name] === 1 ? 'Shot' : 'Shots'}` : ''}
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}
