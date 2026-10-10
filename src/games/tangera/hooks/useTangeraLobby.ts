import { useState } from 'react'
import { addPlayer, removePlayer } from '@/games/tangera/logic/players.ts'
import { readTangeraSettings, writeTangeraSettings } from '@/games/tangera/logic/session.ts'

/** Setup: Spielernamen und Spicy-Schalter, werden im Browser gemerkt. */
export function useTangeraLobby() {
  const [initial] = useState(() => readTangeraSettings())
  const [players, setPlayers] = useState<string[]>(initial.players)
  const [spicy, setSpicy] = useState(initial.spicy)
  const [nameDraft, setNameDraft] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)

  function remember(nextPlayers: readonly string[], nextSpicy: boolean): void {
    writeTangeraSettings({ players: [...nextPlayers], spicy: nextSpicy })
  }

  function addName(): void {
    const result = addPlayer(players, nameDraft)
    setNameError(result.error)
    if (result.error) {
      return
    }
    setPlayers(result.players)
    setNameDraft('')
    remember(result.players, spicy)
  }

  function removeName(name: string): void {
    const next = removePlayer(players, name)
    setPlayers(next)
    setNameError(null)
    remember(next, spicy)
  }

  function changeSpicy(next: boolean): void {
    setSpicy(next)
    remember(players, next)
  }

  return { players, spicy, nameDraft, nameError, setNameDraft, addName, removeName, changeSpicy }
}
