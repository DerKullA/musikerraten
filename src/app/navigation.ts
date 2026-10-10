import { findPlayableGame, type GameModule } from '@/games/registry.ts'
import type { AppScreen, Playlist } from '@/types.ts'

// Reine Navigationsregeln; Zustand und Epochen-Logik liegen in useNavigation.

/** Gewähltes Spiel, falls es existiert und spielbar ist (Platzhalter ergeben null). */
export function selectableGameId(id: string, games?: readonly GameModule[]): string | null {
  return findPlayableGame(id, games)?.id ?? null
}

/** Vollbild: Spiele mit fullBleed 'always' immer, 'live'-Spiele nur während der laufenden Runde. */
export function isFullBleedScreen(screen: AppScreen, game: GameModule | null, gameLive: boolean): boolean {
  if (screen !== 'game' || !game) {
    return false
  }
  return game.fullBleed === 'always' || gameLive
}

/** Spielt gerade ein Clip-Spiel (Shotless)? Steuert Phasenname und Medien-Sitzung der Wiedergabe. */
export function isClipGameScreen(screen: AppScreen, game: GameModule | null): boolean {
  return screen === 'game' && Boolean(game?.clipPlayback)
}

/** Bildschirmname für die Debug-Logs: weiterhin 'game' bzw. 'shotless' wie vor der Registry. */
export function debugScreenName(screen: AppScreen, game: GameModule | null): string {
  return screen === 'game' && game ? game.debugScreen : screen
}

export function togglePlaylistId(selected: readonly string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id]
}

export function toggleAllPlaylistIds(selected: readonly string[], playlists: readonly Playlist[]): string[] {
  return selected.length === playlists.length ? [] : playlists.map((playlist) => playlist.id)
}
