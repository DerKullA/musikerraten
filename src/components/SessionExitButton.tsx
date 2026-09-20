interface SessionExitButtonProps {
  label: string
  onClick: () => void
}

export function SessionExitButton({ label, onClick }: SessionExitButtonProps) {
  return (
    <div className="session-exit">
      <button type="button" className="btn danger" onClick={onClick}>
        {label}
      </button>
    </div>
  )
}
