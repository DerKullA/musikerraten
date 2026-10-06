import { GameDialog } from './LoserBonusOverlay.tsx'

interface WrongGuessDialogProps {
  name: string
  penalty: string
}

export function WrongGuessDialog({ name, penalty }: WrongGuessDialogProps) {
  return (
    <GameDialog labelledBy="wrong-guess-title" onCancel={(event) => event.preventDefault()}>
      <div className="game-dialog-card">
        <p className="eyebrow">Falsch geraten</p>
        <h2 id="wrong-guess-title">{name} lag falsch!</h2>
        <p className="loser-bonus-verdict" role="status">
          {name} trinkt: {penalty}
        </p>
      </div>
    </GameDialog>
  )
}
