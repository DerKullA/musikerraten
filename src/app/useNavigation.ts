import { useRef, useState } from 'react'
import {
  debugScreenName,
  isClipGameScreen,
  isFullBleedScreen,
  selectableGameId,
  toggleAllPlaylistIds,
  togglePlaylistId,
} from '@/app/navigation.ts'
import { DEFAULT_GAME_ID, findGame } from '@/games/registry.ts'
import { fetchUserPlaylists } from '@/platform/spotify/spotifyApi.ts'
import { formatSpotifyUserError } from '@/platform/spotify/spotifyAuth.ts'
import type { AppScreen, Playlist } from '@/types.ts'

// Navigationszustand der Shell: Bildschirm, gewähltes Spiel, Fehleranzeige und Playlist-Auswahl.
// Die Epoche verwirft Antworten, die nach einem Zurück/Verlassen eintreffen.
export function useNavigation() {
  const [screen, setScreen] = useState<AppScreen>('login')
  const [gameId, setGameId] = useState(DEFAULT_GAME_ID)
  const [gameLive, setGameLive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loadingPlaylists, setLoadingPlaylists] = useState(false)
  const [loadingTracks, setLoadingTracks] = useState(false)

  const navigationEpochRef = useRef(0)

  const game = findGame(gameId)

  function showMainMenu(): void {
    setError(null)
    setScreen('menu')
  }

  function backToMenu(): void {
    navigationEpochRef.current += 1
    setLoadingPlaylists(false)
    setLoadingTracks(false)
    setGameLive(false)
    showMainMenu()
  }

  function selectGame(id: string): void {
    const selected = selectableGameId(id)
    if (selected === null) {
      return
    }
    setGameId(selected)
    setGameLive(false)
    void openPlaylistScreen()
  }

  async function openPlaylistScreen(): Promise<void> {
    const epoch = navigationEpochRef.current
    setScreen('playlists')
    setError(null)
    setLoadingPlaylists(true)
    try {
      const items = await fetchUserPlaylists()
      if (epoch !== navigationEpochRef.current) {
        return
      }
      setPlaylists(items)
    } catch (cause) {
      if (epoch !== navigationEpochRef.current) {
        return
      }
      setError(formatSpotifyUserError(cause))
    } finally {
      if (epoch === navigationEpochRef.current) {
        setLoadingPlaylists(false)
      }
    }
  }

  /** Zurück zur Playlist-Auswahl, ohne Fehler/Live-Zustand anzufassen (Abbruch in Song erraten). */
  function showPlaylists(): void {
    setScreen('playlists')
  }

  /** Aus einem laufenden Spiel zurück zur Playlist-Auswahl. */
  function leaveGameToPlaylists(): void {
    setGameLive(false)
    setError(null)
    setScreen('playlists')
  }

  /** Runde ist geladen: Spiel-Bildschirm öffnen. */
  function showGame(): void {
    setGameLive(false)
    setScreen('game')
  }

  function togglePlaylist(id: string): void {
    setSelectedIds((current) => togglePlaylistId(current, id))
  }

  function toggleAllPlaylists(): void {
    setSelectedIds((current) => toggleAllPlaylistIds(current, playlists))
  }

  function resetForLogout(): void {
    setGameLive(false)
    setPlaylists([])
    setSelectedIds([])
    setLoadingPlaylists(false)
    setLoadingTracks(false)
    setScreen('login')
    setError(null)
  }

  return {
    screen,
    gameId,
    game,
    gameLive,
    error,
    playlists,
    selectedIds,
    loadingPlaylists,
    loadingTracks,
    fullBleed: isFullBleedScreen(screen, game, gameLive),
    debugScreen: debugScreenName(screen, game),
    setError,
    setGameLive,
    setLoadingTracks,
    currentEpoch: () => navigationEpochRef.current,
    clipGame: isClipGameScreen(screen, game),
    showMainMenu,
    backToMenu,
    selectGame,
    showPlaylists,
    leaveGameToPlaylists,
    showGame,
    togglePlaylist,
    toggleAllPlaylists,
    resetForLogout,
  }
}

export type Navigation = ReturnType<typeof useNavigation>
