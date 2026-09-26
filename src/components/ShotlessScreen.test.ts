import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DEFAULT_PHASE_TIMINGS } from '../lib/phaseTimings.ts'
import { createShotlessRound } from '../lib/shotlessRules.ts'
import type { Track } from '../types.ts'
import { ShotlessRoundView, ShotlessScreen } from './ShotlessScreen.tsx'

const secret: Track = {
  uri: 'spotify:track:secret',
  title: 'Geheimer Hit',
  artist: 'Geheimkünstler',
  durationMs: 180_000,
}

const timings = DEFAULT_PHASE_TIMINGS

function roundView(
  round: ReturnType<typeof createShotlessRound>,
  mode: 'tippen' | 'party' = 'tippen',
) {
  return renderToStaticMarkup(
    createElement(ShotlessRoundView, {
      mode,
      track: secret,
      tracks: [secret],
      round,
      players: ['Sam', 'Ada'],
      query: '',
      suggestions: [],
      error: null,
      savedTimings: timings,
      onSaveTimings: () => undefined,
      onLogout: () => undefined,
      onLeave: () => undefined,
      onQuery: () => undefined,
      onSubmitGuess: () => undefined,
      onPickSuggestion: () => undefined,
      onSkip: () => undefined,
      onReplay: () => undefined,
      onClaim: () => undefined,
      onAssign: () => undefined,
      onNobody: () => undefined,
      onNext: () => undefined,
    }),
  )
}

describe('ShotlessScreen', () => {
  it('bietet vor der ersten Runde Tippen und Party an', () => {
    const markup = renderToStaticMarkup(
      createElement(ShotlessScreen, {
        tracks: [secret],
        error: null,
        savedTimings: timings,
        onSaveTimings: () => undefined,
        onLogout: () => undefined,
        onLeave: () => undefined,
        onPlayClip: () => Promise.resolve(),
        onPauseClip: () => Promise.resolve(),
        onPlayback: () => undefined,
      }),
    )

    expect(markup).toContain('Shotless')
    expect(markup).toContain('Tippen')
    expect(markup).toContain('Party')
    expect(markup).toContain('Runde starten')
    expect(markup).not.toContain('Geheimer Hit')
    expect(markup).not.toContain('Geheimkünstler')
  })
})

describe('ShotlessRoundView', () => {
  it('zeigt die Shot-Strafe der ersten Stufe und verbirgt den Titel', () => {
    const markup = roundView(createShotlessRound())

    expect(markup).toContain('Stufe 1 von 4 · 0,1 s')
    expect(markup).toContain('Wenn jetzt erraten wird: Shot')
    expect(markup).toContain('class="shotless-penalty is-shot"')
    expect(markup).toContain('>Shot<')
    expect(markup).toContain('Länger hören')
    expect(markup).toContain('Niemand oder Aufgeben: alle trinken einen Shot.')
    expect(markup).toContain('Tipp abgeben')
    expect(markup).not.toContain('Geheimer Hit')
    expect(markup).not.toContain('Geheimkünstler')
  })

  it('zeigt nach drei Skips einen Schluck und Aufgeben', () => {
    const markup = roundView({ ...createShotlessRound(), stageIndex: 3 })

    expect(markup).toContain('Stufe 4 von 4 · 8 s')
    expect(markup).toContain('class="shotless-penalty is-light"')
    expect(markup).toContain('>1 Schluck<')
    expect(markup).toContain('Aufgeben')
    expect(markup).not.toContain('Länger hören')
  })

  it('zeigt einen Fehlschuss ohne Auflösung', () => {
    const markup = roundView({
      ...createShotlessRound(),
      stageIndex: 1,
      feedback: 'Falsch — du trinkst: 5 Schlücke',
    })

    expect(markup).toContain('Falsch — du trinkst: 5 Schlücke')
    expect(markup).toContain('>5 Schlücke<')
    expect(markup).not.toContain('Geheimer Hit')
  })

  it('löst auf und sagt, wer nichts trinkt', () => {
    const markup = roundView(
      {
        ...createShotlessRound(),
        view: 'reveal',
        revealMessage: 'Alle außer Sam trinken: 3 Schlücke',
      },
      'party',
    )

    expect(markup).toContain('Geheimer Hit')
    expect(markup).toContain('Geheimkünstler')
    expect(markup).toContain('Alle außer Sam trinken: 3 Schlücke')
    expect(markup).toContain('Nächster Song')
  })

  it('lässt in der Party Erraten rufen und danach die Person wählen', () => {
    const guessing = roundView(createShotlessRound(), 'party')
    const picking = roundView({ ...createShotlessRound(), view: 'pick-player' }, 'party')

    expect(guessing).toContain('Erraten!')
    expect(guessing).toContain('Niemand')
    expect(guessing).not.toContain('Geheimer Hit')
    expect(picking).toContain('Wer hat es erraten?')
    expect(picking).toContain('Sam')
    expect(picking).toContain('Ada')
    expect(picking).toContain('Niemand')
    expect(picking).not.toContain('Geheimer Hit')
  })
})
