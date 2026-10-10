import { useState } from 'react'
import type { GameScreenProps } from '@/games/registry.ts'
import { TangeraRound } from '@/games/tangera/components/TangeraRound.tsx'
import { TangeraSetup } from '@/games/tangera/components/TangeraSetup.tsx'
import { useTangeraLobby } from '@/games/tangera/hooks/useTangeraLobby.ts'
import { canStart } from '@/games/tangera/logic/players.ts'

/** Tangera: Karten-Trinkspiel ohne Spotify. Setup und Runde wechseln sich ab, jede neue Runde mischt neu. */
export function TangeraScreen({ signedIn, onLogout, onLeave }: GameScreenProps) {
  const lobby = useTangeraLobby()
  const [run, setRun] = useState<number | null>(null)
  const leaveLabel = signedIn ? 'Zurück zum Hauptmenü' : 'Zurück zum Start'
  const logout = signedIn ? onLogout : undefined

  if (run !== null) {
    return (
      <TangeraRound
        key={run}
        players={lobby.players}
        spicy={lobby.spicy}
        decks={lobby.decks}
        leaveLabel={leaveLabel}
        onLogout={logout}
        onLeave={onLeave}
        onAgain={() => setRun(run + 1)}
        onSetup={() => setRun(null)}
      />
    )
  }

  return (
    <TangeraSetup
      players={lobby.players}
      spicy={lobby.spicy}
      decks={lobby.decks}
      nameDraft={lobby.nameDraft}
      nameError={lobby.nameError}
      leaveLabel={leaveLabel}
      onLogout={logout}
      onLeave={onLeave}
      onNameDraft={lobby.setNameDraft}
      onAddName={lobby.addName}
      onRemoveName={lobby.removeName}
      onSpicy={lobby.changeSpicy}
      onDecks={lobby.changeDecks}
      onStart={() => {
        if (canStart(lobby.players)) {
          setRun(0)
        }
      }}
    />
  )
}
