import { memo } from 'react'
import { guessFieldLabel, type GuessSuggestion, type ShotlessGuessTarget } from '../../lib/shotlessRules.ts'

interface GuessComposerProps {
  target: ShotlessGuessTarget
  query: string
  artistQuery: string
  disabled: boolean
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
  disabled,
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

  const inputProps = {
    autoComplete: 'off',
    autoCorrect: 'off',
    autoCapitalize: 'off',
    spellCheck: false,
    enterKeyHint: 'send',
  } as const
  const submit = (
    <button type="submit" className="btn primary" disabled={!ready || disabled}>
      Tipp abgeben
    </button>
  )

  return (
    <form
      className={both ? 'guess-field' : 'guess-field is-single'}
      onSubmit={(event) => {
        event.preventDefault()
        if (ready && !disabled) {
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
        {...inputProps}
        onChange={(event) => onQuery(event.target.value)}
      />
      {both ? null : submit}
      <GuessSuggestions
        label="Vorschläge"
        suggestions={suggestions}
        disabled={disabled && !both}
        onPickSuggestion={onPickSuggestion}
      />
      {both ? (
        <>
          <label className="sr-only" htmlFor="shotless-artist">
            Interpret
          </label>
          <input
            id="shotless-artist"
            value={artistQuery}
            placeholder="Interpret"
            {...inputProps}
            onChange={(event) => onArtistQuery(event.target.value)}
          />
          <GuessSuggestions
            label="Interpretenvorschläge"
            suggestions={artistSuggestions}
            disabled={false}
            onPickSuggestion={onPickSuggestion}
          />
          {submit}
        </>
      ) : null}
    </form>
  )
}

interface GuessSuggestionsProps {
  label: string
  suggestions: readonly GuessSuggestion[]
  disabled: boolean
  onPickSuggestion: (suggestion: GuessSuggestion) => void
}

const GuessSuggestions = memo(function GuessSuggestions({
  label,
  suggestions,
  disabled,
  onPickSuggestion,
}: GuessSuggestionsProps) {
  if (suggestions.length === 0) {
    return null
  }
  return (
    <ul className="suggestions" role="listbox" aria-label={label}>
      {suggestions.map((entry) => (
        <li key={`${entry.field}:${entry.label}`}>
          <button type="button" role="option" disabled={disabled} onClick={() => onPickSuggestion(entry)}>
            {entry.label}
          </button>
        </li>
      ))}
    </ul>
  )
})
