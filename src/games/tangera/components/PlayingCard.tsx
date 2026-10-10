import { useEffect } from 'react'
import { pulseReveal } from '@/ui/haptics.ts'
import { RANK_NAME, RANK_SHORT, SUIT_NAME, SUIT_SYMBOL, isRedSuit, type Card } from '@/games/tangera/logic/cards.ts'

interface PlayingCardProps {
  card: Card
  compact?: boolean
}

/** Karte, die beim Erscheinen von der Rückseite auf die Vorderseite dreht. */
export function PlayingCard({ card, compact = false }: PlayingCardProps) {
  useEffect(() => {
    pulseReveal()
  }, [])

  const symbol = SUIT_SYMBOL[card.suit]
  const classes = ['tangera-card', 'is-up']
  if (isRedSuit(card.suit)) {
    classes.push('is-red')
  }
  if (compact) {
    classes.push('is-compact')
  }

  return (
    <div className={classes.join(' ')} role="img" aria-label={`${SUIT_NAME[card.suit]} ${RANK_NAME[card.rank]}`}>
      <div className="tangera-card-inner">
        <div className="tangera-card-back" aria-hidden="true">
          <span>T</span>
        </div>
        <div className="tangera-card-face" aria-hidden="true">
          <span className="tangera-card-corner">
            {RANK_SHORT[card.rank]}
            <small>{symbol}</small>
          </span>
          <span className="tangera-card-pip">{symbol}</span>
          <span className="tangera-card-corner is-bottom">
            {RANK_SHORT[card.rank]}
            <small>{symbol}</small>
          </span>
        </div>
      </div>
    </div>
  )
}

interface CardStackProps {
  remaining: number
  onDraw: () => void
}

/** Verdeckter Stapel mit der Zahl der Restkarten; ein Tipp auf den Stapel deckt die oberste Karte auf. */
export function CardStack({ remaining, onDraw }: CardStackProps) {
  return (
    <div className="tangera-stack">
      <button
        type="button"
        className="tangera-stack-button"
        aria-label={`Karte aufdecken, Stapel mit ${remaining} Karten`}
        onClick={onDraw}
      >
        <span className="tangera-card is-stack">
          <span className="tangera-card-inner">
            <span className="tangera-card-back" aria-hidden="true">
              <span>T</span>
            </span>
          </span>
        </span>
      </button>
      <p className="tangera-stack-count">{remaining} Karten übrig</p>
    </div>
  )
}
