import { useReducer } from 'react'
import { AppMenu } from '@/ui/AppMenu.tsx'
import { BitchCalls } from '@/games/tangera/components/events/BitchCalls.tsx'
import { CardEvent } from '@/games/tangera/components/events/CardEvent.tsx'
import { EndScreen } from '@/games/tangera/components/EndScreen.tsx'
import { CardStack, PlayingCard } from '@/games/tangera/components/PlayingCard.tsx'
import { StatusBar } from '@/games/tangera/components/StatusBar.tsx'
import { createGame, currentPlayer, ranking, tangeraReducer, totalCards } from '@/games/tangera/logic/game.ts'
import { roundFrom } from '@/games/tangera/logic/players.ts'

interface TangeraRoundProps {
  players: readonly string[]
  spicy: boolean
  decks: number
  leaveLabel: string
  onLogout?: () => void
  onLeave: () => void
  onAgain: () => void
  onSetup: () => void
}

export function TangeraRound({ players, spicy, decks, leaveLabel, onLogout, onLeave, onAgain, onSetup }: TangeraRoundProps) {
  const [state, dispatch] = useReducer(tangeraReducer, players, (names) => createGame(names, { decks }))

  if (state.phase === 'finished') {
    return (
      <EndScreen
        ranking={ranking(state)}
        leaveLabel={leaveLabel}
        onLogout={onLogout}
        onLeave={onLeave}
        onAgain={onAgain}
        onSetup={onSetup}
      />
    )
  }

  const player = currentPlayer(state)
  const order = roundFrom(state.players, state.turn)
  const total = totalCards(state)
  const cardNumber = state.drawn.length + (state.phase === 'event' ? 0 : 1)

  return (
    <section className="panel with-menu fit-screen tangera">
      <header className="panel-head">
        <div>
          <p className="eyebrow">
            Tangera · Karte {Math.min(cardNumber, total)} von {total}
          </p>
          <h1>{player}</h1>
        </div>
        <div className="panel-head-meta">
          <AppMenu onLogout={onLogout} onLeaveRound={onLeave} leaveLabel={leaveLabel} />
        </div>
      </header>
      <div className="fit-scroll">
        <StatusBar
          players={state.players}
          quizmaster={state.quizmaster}
          bitch={state.bitch}
          rules={state.rules}
          sips={state.sips}
          shots={state.shots}
        />
        {state.phase === 'turn' ? (
          <div className="tangera-stage">
            <CardStack remaining={state.deck.length} />
            <p className="tangera-prompt">{player} ist dran.</p>
            <div className="tangera-footer">
              <button type="button" className="btn primary cta" onClick={() => dispatch({ type: 'draw' })}>
                Karte aufdecken
              </button>
            </div>
          </div>
        ) : null}
        {state.phase === 'bitch' ? (
          <BitchCalls
            key={`bitch-${state.drawn.length}`}
            bitch={player}
            onDone={() => dispatch({ type: 'resolve' })}
          />
        ) : null}
        {state.phase === 'event' && state.card ? (
          <div className="tangera-stage">
            <PlayingCard key={`card-${state.drawn.length}`} card={state.card} compact />
            <CardEvent
              key={`event-${state.drawn.length}`}
              card={state.card}
              player={player}
              order={order}
              rules={state.rules}
              spicy={spicy}
              onDone={(effects) => dispatch({ type: 'resolve', effects })}
            />
          </div>
        ) : null}
      </div>
    </section>
  )
}
