import { memo } from 'react'
import { guessFieldLabel, type GuessSuggestion, type ShotlessGuessTarget } from '../../lib/shotlessRules.ts'

interface GuessComposerProps {
  target: ShotlessGuessTarget
  query: string
  artistQuery: string
  suggestions: readonly GuessSuggestion[]
  artistSuggestions: readonly GuessSuggestion[]
  onQuery: (value: string) => void
  onArtistQuery: (value: string) => void
  onSubmitGuess: () => void
  onPickSuggestion: (suggestion: GuessSuggestion) => void
}

export function GuessComposer({
  target,
  query,
  artistQuery,
  suggestions,
  artistSuggestions,
  onQuery,
  onArtistQuery,
  onSubmitGuess,
  onPickSuggestion,
}: GuessComposerProps) {
  const both = target === 'both'
  const ready = both ? query.trim().length > 0 && artistQuery.trim().length > 0 : query.trim().length > 0
  const fieldLabel = guessFieldLabel(target)

  return (
    <form
      className="guess-field"
      onSubmit={(event) => {
        event.preventDefault()
        if (ready) {
          onSubmitGuess()
        }
      }}
    >
      <label className="sr-only" htmlFor="shotless-guess">
        {both ? 'Songtitel' : fieldLabel}
      </label>
      <input
        id="shotless-guess"
        value={query}
        placeholder={both ? 'Songtitel' : fieldLabel}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        onChange={(event) => onQuery(event.target.value)}
      />
      <GuessSuggestions label="Vorschläge" suggestions={suggestions} onPickSuggestion={onPickSuggestion} />
      {both ? (
        <>
          <label className="sr-only" htmlFor="shotless-artist">
            Interpret
          </label>
          <input
            id="shotless-artist"
            value={artistQuery}
            placeholder="Interpret"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            onChange={(event) => onArtistQuery(event.target.value)}
          />
          <GuessSuggestions
            label="Interpretenvorschläge"
            suggestions={artistSuggestions}
            onPickSuggestion={onPickSuggestion}
          />
        </>
      ) : null}
      <button type="submit" className="btn primary" disabled={!ready}>
        Tipp abgeben
      </button>
    </form>
  )
}

interface GuessSuggestionsProps {
  label: string
  suggestions: readonly GuessSuggestion[]
  onPickSuggestion: (suggestion: GuessSuggestion) => void
}

const GuessSuggestions = memo(function GuessSuggestions({
  label,
  suggestions,
  onPickSuggestion,
}: GuessSuggestionsProps) {
  if (suggestions.length === 0) {
    return null
  }
  return (
    <ul className="suggestions" role="listbox" aria-label={label}>
      {suggestions.map((entry) => (
        <li key={`${entry.field}:${entry.label}`}>
          <button type="button" role="option" onClick={() => onPickSuggestion(entry)}>
            {entry.label}
          </button>
        </li>
      ))}
    </ul>
  )
})
