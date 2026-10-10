import type { ReactNode } from 'react'

interface EventFrameProps {
  title: string
  summary: string
  children: ReactNode
}

export function EventFrame({ title, summary, children }: EventFrameProps) {
  return (
    <section className="tangera-event" aria-label={title}>
      <h2>{title}</h2>
      <p className="tangera-summary">{summary}</p>
      {children}
    </section>
  )
}
