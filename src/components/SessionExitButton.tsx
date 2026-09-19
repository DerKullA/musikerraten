interface SessionExitButtonProps {
  label: string
  onClick: () => void
}

export function SessionExitButton({ label, onClick }: SessionExitButtonProps) {
  return (
    <button type="button" className="btn outline compact" onClick={onClick}>
      {label}
    </button>
  )
}
