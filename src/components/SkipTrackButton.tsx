interface SkipTrackButtonProps {
  onSkip: () => void
}

export function SkipTrackButton({ onSkip }: SkipTrackButtonProps) {
  return (
    <button type="button" className="btn skip-next" onClick={onSkip}>
      Nächster Song
    </button>
  )
}
