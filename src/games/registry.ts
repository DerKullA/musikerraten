// Stylesheets der Spiele. Die Reihenfolge ist Teil der Kaskade: base.css (main.tsx) zuerst,
// dann Song erraten, dann Shotless, dann Tangera. Neue Spiele hinten anhängen.
import '@/games/guess-song/guess-song.css'
import '@/games/shotless/shotless.css'
import '@/games/tangera/tangera.css'
import type { ComponentType } from 'react'
import { GuessSongGame } from '@/games/guess-song/GuessSongGame.tsx'
import { ShotlessScreen } from '@/games/shotless/ShotlessScreen.tsx'
import { clearShotlessSession } from '@/games/shotless/logic/session.ts'
import { TangeraScreen } from '@/games/tangera/TangeraScreen.tsx'
import type { PlaybackApi } from '@/platform/playback/usePlaybackEngine.ts'
import type { Track } from '@/types.ts'

export const GUESS_SONG_ID = 'guess-song'
export const TANGERA_ID = 'tangera'
export const DEFAULT_GAME_ID = GUESS_SONG_ID

// Gemeinsamer Vertrag: Die App rendert ein Spiel nur über diese Props.
export interface GameScreenProps {
  /** Ist ein Spotify-Konto angemeldet? Ohne Anmeldung laufen nur Spiele ohne Spotify. */
  signedIn: boolean
  tracks: Track[]
  error: string | null
  playback: PlaybackApi
  onLogout: () => void
  /** Spiel verlassen, zurück ins Hauptmenü. */
  onLeave: () => void
  onBackToPlaylists: () => void
  /** Nur Bildschirmwechsel zur Playlist-Auswahl, ohne Fehler oder Live-Zustand zurückzusetzen (Abbruch). */
  onShowPlaylists: () => void
  /** Setzt oder leert die Fehleranzeige der Shell. */
  onError: (message: string | null) => void
  /** Meldet, ob das Spiel gerade im Vollbild-Rundenmodus läuft (siehe GameModule.fullBleed). */
  onLiveChange: (live: boolean) => void
}

export type GameEntry =
  // Das Spiel bringt seinen Screen und seinen Zustand selbst mit.
  | { kind: 'component'; Screen: ComponentType<GameScreenProps> }
  // Platzhalter ohne Spiel.
  | { kind: 'none' }

export interface GameModule {
  id: string
  kicker: string
  label: string
  available: boolean
  /** Braucht das Spiel Spotify (Login, Playlists, Wiedergabe)? Ohne startet es direkt. */
  requiresSpotify: boolean
  entry: GameEntry
  /** Zusätzliche CSS-Klasse des Menüeintrags. */
  menuVariant?: string
  /** Spielt Clips statt Runden-Phasen (Debug-/Warmup-Phasenname 'shotless'). */
  clipPlayback: boolean
  /** Vollbild immer ('always') oder nur, solange das Spiel `onLiveChange(true)` meldet ('live'). */
  fullBleed: 'always' | 'live'
  /** Bildschirmname in den Debug-Logs (frühere AppScreen-Werte). */
  debugScreen: string
  /** Aufräumen der spielspezifischen Sitzungsdaten beim Logout. */
  clearSession?: () => void
}

export const GAMES: readonly GameModule[] = [
  {
    id: GUESS_SONG_ID,
    kicker: 'Spiel',
    label: 'Song erraten',
    available: true,
    requiresSpotify: true,
    entry: { kind: 'component', Screen: GuessSongGame },
    clipPlayback: false,
    fullBleed: 'always',
    debugScreen: 'game',
  },
  {
    id: 'shotless',
    kicker: 'Trinkspiel',
    label: 'Shotless',
    available: true,
    requiresSpotify: true,
    entry: { kind: 'component', Screen: ShotlessScreen },
    menuVariant: 'is-shotless',
    clipPlayback: true,
    fullBleed: 'live',
    debugScreen: 'shotless',
    clearSession: clearShotlessSession,
  },
  {
    id: TANGERA_ID,
    kicker: 'Trinkspiel',
    label: 'Tangera',
    available: true,
    requiresSpotify: false,
    entry: { kind: 'component', Screen: TangeraScreen },
    menuVariant: 'is-tangera',
    clipPlayback: false,
    fullBleed: 'live',
    debugScreen: 'tangera',
  },
  {
    id: 'placeholder-2',
    kicker: 'Platzhalter',
    label: 'Bald verfügbar',
    available: false,
    requiresSpotify: true,
    entry: { kind: 'none' },
    clipPlayback: false,
    fullBleed: 'live',
    debugScreen: 'placeholder-2',
  },
]

export function findGame(id: string, games: readonly GameModule[] = GAMES): GameModule | null {
  return games.find((game) => game.id === id) ?? null
}

export function findPlayableGame(id: string, games: readonly GameModule[] = GAMES): GameModule | null {
  const game = findGame(id, games)
  return game?.available ? game : null
}

export function isPlayableGame(id: string, games: readonly GameModule[] = GAMES): boolean {
  return findPlayableGame(id, games) !== null
}
