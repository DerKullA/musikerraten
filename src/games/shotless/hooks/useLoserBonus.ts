import { useRef, useState } from 'react'
import { createWinStreak, recordRoundOutcome, type WinStreak } from '@/games/shotless/logic/loserBonus.ts'

export function useLoserBonus(): {
  bonusWinner: string | null
  noteLoserBonusOutcome: (winner: string | null) => boolean
  dismissLoserBonus: () => void
  revokeLoserBonusOutcome: () => void
} {
  const streakRef = useRef<WinStreak>(createWinStreak())
  const previousStreakRef = useRef<WinStreak>(createWinStreak())
  const [bonusWinner, setBonusWinner] = useState<string | null>(null)

  function noteLoserBonusOutcome(winner: string | null): boolean {
    previousStreakRef.current = streakRef.current
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

  // Nimmt die zuletzt gewertete Runde zurück, damit sie den Zähler nicht erhöht.
  function revokeLoserBonusOutcome(): void {
    streakRef.current = previousStreakRef.current
  }

  return { bonusWinner, noteLoserBonusOutcome, dismissLoserBonus, revokeLoserBonusOutcome }
}
