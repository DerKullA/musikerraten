import { useRef, useState } from 'react'
import { createWinStreak, recordRoundOutcome, type WinStreak } from '../lib/loserBonus.ts'

export function useLoserBonus(): {
  bonusWinner: string | null
  noteLoserBonusOutcome: (winner: string | null) => boolean
  dismissLoserBonus: () => void
} {
  const streakRef = useRef<WinStreak>(createWinStreak())
  const [bonusWinner, setBonusWinner] = useState<string | null>(null)

  function noteLoserBonusOutcome(winner: string | null): boolean {
    const update = recordRoundOutcome(streakRef.current, winner)
    streakRef.current = update.streak
    if (update.triggered && update.winner) {
      setBonusWinner(update.winner)
      return true
    }
    return false
  }

  function dismissLoserBonus(): void {
    setBonusWinner(null)
  }

  return { bonusWinner, noteLoserBonusOutcome, dismissLoserBonus }
}
