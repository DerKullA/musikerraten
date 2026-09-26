import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DEFAULT_PHASE_TIMINGS } from '../lib/phaseTimings.ts'
import { MainMenu } from './MainMenu.tsx'
import { PlaylistPicker } from './PlaylistPicker.tsx'

describe('MainMenu', () => {
  it('zeigt Song erraten, Shotless und einen nicht bedienbaren Platzhalter', () => {
    const markup = renderToStaticMarkup(
      createElement(MainMenu, {
        savedTimings: DEFAULT_PHASE_TIMINGS,
        onSaveTimings: () => undefined,
        onLogout: () => undefined,
        onSelectGame: () => undefined,
      }),
    )

    expect(markup).toContain('Hauptmenü')
    expect(markup).toContain('Song erraten')
    expect(markup).toContain('Shotless')
    expect(markup).toContain('data-game="guess-song"')
    expect(markup).toContain('data-game="shotless"')
    expect(markup).toContain('Menü öffnen')
    expect(markup).toContain('Abmelden')
    expect(markup.match(/Bald verfügbar/g)).toHaveLength(1)
    expect(markup.match(/class="game-entry"/g)).toHaveLength(1)
    expect(markup.match(/class="game-entry is-shotless"/g)).toHaveLength(1)
    expect(markup.match(/class="game-entry is-locked"/g)).toHaveLength(1)
    expect(markup.match(/aria-disabled="true"/g)).toHaveLength(1)
    expect(markup).not.toContain('href=')
  })
})

describe('PlaylistPicker', () => {
  it('bietet Zurück zum Hauptmenü neben dem Spielstart', () => {
    const markup = renderToStaticMarkup(
      createElement(PlaylistPicker, {
        playlists: [],
        selectedIds: [],
        loading: false,
        loadingTracks: false,
        error: null,
        savedTimings: DEFAULT_PHASE_TIMINGS,
        onSaveTimings: () => undefined,
        onToggle: () => undefined,
        onToggleAll: () => undefined,
        onStart: () => undefined,
        onBack: () => undefined,
        onLogout: () => undefined,
      }),
    )

    expect(markup).toContain('Spiel starten')
    expect(markup).toContain('Zurück zum Hauptmenü')
    expect(markup).toContain('Menü öffnen')
    expect(markup).toContain('>Zurück<')
  })
})
