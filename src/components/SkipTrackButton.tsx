interface SkipTrackButtonProps {
  onSkip: () => void
}

export function SkipTrackButton({ onSkip }: SkipTrackButtonProps) {
  return (
    <button type="button" className="btn skip-next" onClick={onSkip}>
      <SkipForwardIcon />
      Nächster Song
    </button>
  )
}

function SkipForwardIcon() {
  return (
    <svg className="skip-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M4.2 5.1v13.8L13.2 12 4.2 5.1zm9.2 0v13.8L22.4 12 13.4 5.1z" />
    </svg>
  )
}
