import { useState } from 'react'
import { EventFrame } from '@/games/tangera/components/EventFrame.tsx'
import { RULE_IDEAS } from '@/games/tangera/logic/content.ts'
import { MAX_RULE_LENGTH, RANK_EVENTS } from '@/games/tangera/logic/rules.ts'
import type { EventProps } from './types.ts'

type Mode = 'new' | 'remove'

export function RuleEvent({ rules, onDone }: EventProps) {
  const [mode, setMode] = useState<Mode>('new')
  const [draft, setDraft] = useState('')
  const [removeIndex, setRemoveIndex] = useState<number | null>(null)
  const [ideaStep, setIdeaStep] = useState(0)
  const event = RANK_EVENTS['9']
  const text = draft.trim()
  const known = rules.includes(text)
  const ready = mode === 'new' ? text.length > 0 && !known : removeIndex !== null

  function suggest(): void {
    const next = RULE_IDEAS[ideaStep % RULE_IDEAS.length]
    setDraft(next ?? '')
    setIdeaStep((step) => step + 1)
  }

  return (
    <EventFrame title={event.title} summary={event.summary}>
      <div className="tangera-tabs" role="tablist" aria-label="Regel">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'new'}
          className={mode === 'new' ? 'is-selected' : undefined}
          onClick={() => setMode('new')}
        >
          Neue Regel
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'remove'}
          className={mode === 'remove' ? 'is-selected' : undefined}
          disabled={rules.length === 0}
          onClick={() => setMode('remove')}
        >
          Regel aufheben
        </button>
      </div>
      {mode === 'new' ? (
        <div className="tangera-rule-form">
          <label className="sr-only" htmlFor="tangera-rule">
            Neue Regel
          </label>
          <textarea
            id="tangera-rule"
            value={draft}
            maxLength={MAX_RULE_LENGTH}
            rows={3}
            placeholder="z. B. Wer lacht, trinkt einen Schluck."
            onChange={(entry) => setDraft(entry.target.value)}
          />
          {known ? <p className="banner error">Diese Regel gibt es schon.</p> : null}
          <button type="button" className="btn ghost" onClick={suggest}>
            Idee vorschlagen
          </button>
        </div>
      ) : (
        <ul className="tangera-rule-list" aria-label="Regel auswählen">
          {rules.map((rule, index) => (
            <li key={rule}>
              <button
                type="button"
                className={removeIndex === index ? 'tangera-rule is-selected' : 'tangera-rule'}
                aria-pressed={removeIndex === index}
                onClick={() => setRemoveIndex(index)}
              >
                {rule}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="tangera-footer">
        <button
          type="button"
          className="btn primary cta"
          disabled={!ready}
          onClick={() =>
            onDone(mode === 'new' ? { addRule: text } : removeIndex !== null ? { removeRule: removeIndex } : undefined)
          }
        >
          {mode === 'new' ? 'Regel gilt ab jetzt' : 'Regel aufheben'}
        </button>
        <button type="button" className="btn ghost" onClick={() => onDone()}>
          Überspringen
        </button>
      </div>
    </EventFrame>
  )
}
