import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DEFAULT_PHASE_TIMINGS, POST_REVEAL_PLAY_MS, type PhaseTimings } from '../lib/phaseTimings.ts'
import type { GamePhase, Track } from '../types.ts'
import { GameScreen } from './GameScreen.tsx'

const track: Track = {
  uri: 'spotify:track:hit',
  title: 'Geheimer Hit',
  artist: 'Geheimkünstler',
  durationMs: 180_000,
}

function screen(phase: GamePhase, running: boolean, timings: PhaseTimings = DEFAULT_PHASE_TIMINGS) {
  return renderToStaticMarkup(
    createElement(GameScreen, {
      track,
      phase,
      index: 0,
      total: 4,
      running,
      paused: false,
      error: null,
      roundTimings: timings,
      savedTimings: timings,
      onSaveTimings: () => undefined,
      onPlay: () => undefined,
      onPause: () => undefined,
      onResume: () => undefined,
      onReplay: () => undefined,
      onReveal: () => undefined,
      onSkipNext: () => undefined,
      onAbort: () => undefined,
      onLogout: () => undefined,
    }),
  )
}

describe('GameScreen', () => {
  it('macht Nochmal anhören zum großen Knopf und setzt Erraten nach unten mit grünem Rand', () => {
    const markup = screen('playing', true)

    expect(markup).toContain('class="btn primary cta">Nochmal anhören')
    expect(markup).toContain('class="btn erraten">Erraten')
    expect(markup.indexOf('Nochmal anhören')).toBeLessThan(markup.indexOf('>Erraten<'))
    expect(markup).not.toContain('class="btn primary cta">Erraten')
    expect(markup).toContain('Titel verborgen')
  })

  it('blendet die Rate-Knöpfe aus, solange die Runde nicht läuft', () => {
    const markup = screen('idle', false)

    expect(markup).not.toContain('Nochmal anhören')
    expect(markup).not.toContain('>Erraten<')
    expect(markup).not.toContain('Nächster Song')
  })

  it('zeigt in der Auflösung den Zeitbalken der Auflösungsdauer und keine Rate-Knöpfe', () => {
    const markup = screen('reveal', true)
    const custom = screen('reveal', true, { playMs: 11_000, thinkMs: 3_000, revealMs: 12_000 })

    expect(markup).toContain('class="meter ')
    expect(markup).toContain(`animation-duration:${POST_REVEAL_PLAY_MS}ms`)
    expect(markup).toContain('class="btn skip-next"')
    expect(markup).toContain('class="skip-icon"')
    expect(markup).toContain('Nächster Song')
    expect(markup).not.toContain('btn erraten')
    expect(markup).not.toContain('btn aufgeben')
    expect(markup).toContain('Geheimer Hit')
    expect(markup).not.toContain('Nochmal anhören')
    expect(markup).not.toContain('>Erraten<')
    expect(custom).toContain('animation-duration:12000ms')
  })
})
