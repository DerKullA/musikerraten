interface RoundProgressProps {
  current: number
  total: number
}

export function RoundProgress({ current, total }: RoundProgressProps) {
  const ratio = total > 0 ? Math.min(1, current / total) : 0
  return (
    <div
      className="round-progress"
      role="progressbar"
      aria-label="Fortschritt der Runde"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={current}
    >
      <span style={{ width: `${ratio * 100}%` }} />
    </div>
  )
}
