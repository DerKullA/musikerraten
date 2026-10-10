import { EventFrame } from '@/games/tangera/components/EventFrame.tsx'

interface BitchCallsProps {
  bitch: string
  onDone: () => void
}

/** Vor dem Zug der Bitch: Die Gruppe ruft laut „Bitch 1“ bis „Bitch 5“, die Schlücke regelt sie selbst. */
export function BitchCalls({ bitch, onDone }: BitchCallsProps) {
  return (
    <EventFrame title="Bitch-Runde" summary={`${bitch} ist die Bitch und wieder dran.`}>
      <p className="tangera-big">Bitch 1 bis Bitch 5!</p>
      <p className="tangera-prompt">
        Jeder andere darf jetzt „Bitch“ mit einer Zahl von 1 bis 5 rufen, zum Beispiel „Bitch 3“. So viele Schlücke
        trinkt {bitch}.
      </p>
      <div className="tangera-footer">
        <button type="button" className="btn primary cta" onClick={onDone}>
          Weiter zur Karte
        </button>
      </div>
    </EventFrame>
  )
}
