interface StepperProps {
  label: string
  value: number
  min?: number
  max: number
  onChange: (value: number) => void
}

/** Zähler mit Minus und Plus, z. B. für Schlücke je Spieler. */
export function Stepper({ label, value, min = 0, max, onChange }: StepperProps) {
  return (
    <div className="tangera-stepper" role="group" aria-label={label}>
      <button
        type="button"
        className="tangera-step"
        aria-label={`${label}: weniger`}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <output className="tangera-step-value" aria-live="polite">
        {value}
      </output>
      <button
        type="button"
        className="tangera-step"
        aria-label={`${label}: mehr`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  )
}
