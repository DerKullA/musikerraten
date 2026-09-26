import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createShotlessRound } from '../lib/shotlessRules.ts'
import type { Track } from '../types.ts'
import { ShotlessRoundView, ShotlessScreen } from './ShotlessScreen.tsx'

const secret: Track = {
  uri: 'spotify:track:secret',
  title: 'Geheimer Hit',
  artist: 'Geheimkünstler',
  durationMs: 180_000,
}

function roundView(
  round: ReturnType<typeof createShotlessRound>,
  mode: 'tippen' | 'party' = 'tippen',
  guessTarget: 'title' | 'artist' | 'either' | 'both' = 'title',
) {
  return renderToStaticMarkup(
    createElement(ShotlessRoundView, {
      mode,
      guessTarget,
      track: secret,
      tracks: [secret],
      round,
      players: ['Sam', 'Ada'],
      query: '',
      artistQuery: '',
      suggestions: [],
      artistSuggestions: [],
      error: null,
      onLogout: () => undefined,
      onLeave: () => undefined,
      onQuery: () => undefined,
      onArtistQuery: () => undefined,
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
        onLogout: () => undefined,
        onLeave: () => undefined,
        onPlayClip: () => Promise.resolve(),
        onResumeClip: () => Promise.resolve(),
        onPauseClip: () => Promise.resolve(),
        onPlayback: () => undefined,
      }),
    )

    expect(markup).toContain('Shotless')
    expect(markup).toContain('Tippen')
    expect(markup).toContain('Party')
    expect(markup).toContain('Nur Titel')
    expect(markup).toContain('Nur Interpret')
    expect(markup).toContain('Titel oder Interpret')
    expect(markup).toContain('Titel und Interpret')
    expect(markup).toContain('Runde starten')
    expect(markup).toContain('Menü öffnen')
    expect(markup).toContain('Abmelden')
    expect(markup).toContain('Zurück zum Hauptmenü')
    expect(markup).not.toContain('Einstellungen')
    expect(markup).not.toContain('Vorspiel')
    expect(markup).not.toMatch(/wasser|saft|limo/i)
    expect(markup).not.toContain('Geheimer Hit')
    expect(markup).not.toContain('Geheimkünstler')
  })
})

describe('ShotlessRoundView', () => {
  it('zeigt die Shot-Strafe der ersten Stufe und verbirgt den Titel', () => {
    const markup = roundView(createShotlessRound())

    expect(markup).toContain('Stufe 1 von 4 · 0,5 s')
    expect(markup).toContain('Wenn jetzt erraten wird: Shot')
    expect(markup).toContain('class="shotless-penalty is-shot"')
    expect(markup).toContain('>Shot<')
    expect(markup).toContain('Länger hören')
    expect(markup).toContain('Niemand oder Aufgeben: alle trinken einen Shot.')
    expect(markup).toContain('Tipp abgeben')
    expect(markup).toContain('class="btn ghost">Nochmal anhören')
    expect(markup).toContain('class="btn aufgeben">Aufgeben')
    expect(markup).toContain('class="btn outline">Länger hören')
    expect(markup).not.toContain('btn erraten')
    expect(markup).not.toContain('class="btn primary cta"')
    expect(markup).toContain('Abmelden')
    expect(markup).toContain('Zurück zum Hauptmenü')
    expect(markup).not.toContain('Einstellungen')
    expect(markup).not.toContain('Vorspiel')
    expect(markup).not.toContain('Geheimer Hit')
    expect(markup).not.toContain('Geheimkünstler')
  })

  it('zeigt nach drei Skips einen Schluck und Aufgeben', () => {
    const markup = roundView({ ...createShotlessRound(), stageIndex: 3 })

    expect(markup).toContain('Stufe 4 von 4 · 8 s')
    expect(markup).toContain('class="shotless-penalty is-light"')
    expect(markup).toContain('>1 Schluck<')
    expect(markup).toContain('class="btn aufgeben">Aufgeben')
    expect(markup).not.toContain('class="btn ghost">Aufgeben')
    expect(markup).not.toContain('class="btn outline">Aufgeben')
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
    expect(markup).toContain('Gesucht war der Titel')
    expect(markup).toContain('Alle außer Sam trinken: 3 Schlücke')
    expect(markup).toContain('class="btn skip-next"')
    expect(markup).toContain('class="skip-icon"')
    expect(markup).toContain('Nächster Song')
    expect(markup).not.toContain('class="btn primary cta">Nächster Song')
    expect(markup).not.toContain('btn erraten')
    expect(markup).not.toContain('btn aufgeben')
    expect(markup).toContain('class="meter"')
    expect(markup).toContain('animation-duration:8000ms')
  })

  it('lässt in der Party Erraten rufen und danach die Person wählen', () => {
    const guessing = roundView(createShotlessRound(), 'party')
    const picking = roundView({ ...createShotlessRound(), view: 'pick-player' }, 'party')

    expect(guessing).toContain('class="btn primary cta">Nochmal anhören')
    expect(guessing).toContain('class="btn erraten">Erraten!')
    expect(guessing).not.toContain('class="btn aufgeben">Erraten!')
    expect(guessing).not.toContain('btn aufgeben')
    expect(guessing.indexOf('Nochmal anhören')).toBeLessThan(guessing.indexOf('Erraten!'))
    expect(guessing).not.toContain('class="btn primary cta">Erraten!')
    expect(guessing).toContain('Niemand')
    expect(guessing).not.toContain('Geheimer Hit')
    expect(picking).toContain('Wer hat es erraten?')
    expect(picking).toContain('Sam')
    expect(picking).toContain('Ada')
    expect(picking).toContain('Niemand')
    expect(picking).not.toContain('Geheimer Hit')
  })

  it('hebt bei Nur Interpret den Interpreten hervor', () => {
    const markup = roundView(
      { ...createShotlessRound(), view: 'reveal', revealMessage: 'Alle außer dir trinken: Shot' },
      'tippen',
      'artist',
    )

    expect(markup).toContain('<h2 class="title">Geheimkünstler</h2>')
    expect(markup).toContain('Gesucht war der Interpret')
    expect(markup).toContain('Alle außer dir trinken: Shot')
  })
})
