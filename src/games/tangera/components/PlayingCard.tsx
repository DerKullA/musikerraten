import { useEffect, useState } from 'react'
import { pulseReveal } from '@/ui/haptics.ts'
import { RANK_NAME, RANK_SHORT, SUIT_NAME, SUIT_SYMBOL, isRedSuit, type Card } from '@/games/tangera/logic/cards.ts'

interface PlayingCardProps {
  card: Card
  compact?: boolean
}

/** Karte, die beim Erscheinen von der Rückseite auf die Vorderseite dreht. */
export function PlayingCard({ card, compact = false }: PlayingCardProps) {
  const [faceUp, setFaceUp] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFaceUp(true)
      pulseReveal()
    }, 80)
    return () => window.clearTimeout(timer)
  }, [])

  const symbol = SUIT_SYMBOL[card.suit]
  const classes = ['tangera-card']
  if (faceUp) {
    classes.push('is-up')
  }
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
}

/** Verdeckter Stapel mit der Zahl der Restkarten. */
export function CardStack({ remaining }: CardStackProps) {
  return (
    <div className="tangera-stack" role="img" aria-label={`Stapel mit ${remaining} Karten`}>
      <div className="tangera-card is-stack">
        <div className="tangera-card-inner">
          <div className="tangera-card-back" aria-hidden="true">
            <span>T</span>
          </div>
        </div>
      </div>
      <p className="tangera-stack-count">{remaining} Karten übrig</p>
    </div>
  )
}
