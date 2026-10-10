import { useRef, useState } from 'react'
import { AppFooter } from '@/ui/AppFooter.tsx'
import { LoginScreen } from '@/ui/LoginScreen.tsx'
import { MainMenu } from '@/ui/MainMenu.tsx'
import { PlaylistPicker } from '@/ui/PlaylistPicker.tsx'
import { useNavigation } from '@/app/useNavigation.ts'
import { useSpotifySession } from '@/app/useSpotifySession.ts'
import { GAMES, TANGERA_ID } from '@/games/registry.ts'
import { shuffleTracks } from '@/platform/spotify/mixTracks.ts'
import { usePlaybackEngine } from '@/platform/playback/usePlaybackEngine.ts'
import { traceGame } from '@/platform/diagnostics/gameDebug.ts'
import { useGameDebugWatch } from '@/platform/diagnostics/useGameDebug.ts'
import { fetchTracksForPlaylists } from '@/platform/spotify/spotifyApi.ts'
import { formatSpotifyUserError, getSpotifyClientId } from '@/platform/spotify/spotifyAuth.ts'
import { saveSavedPhaseTimings, useSavedPhaseTimings } from '@/ui/savedPhaseTimings.ts'
import type { PhaseTimings } from '@/ui/phaseTimings.ts'
import type { Track } from '@/types.ts'

function saveTimings(next: PhaseTimings): void {
  saveSavedPhaseTimings(next)
}

export default function App() {
  const navigation = useNavigation()
  const { error, setError } = navigation
  const [tracks, setTracks] = useState<Track[]>([])
  const tracksRef = useRef<Track[]>([])
  const savedTimings = useSavedPhaseTimings()
  const playback = usePlaybackEngine({
    // Der Host wird je Render nachgezogen, der Wert ist also nie älter als der letzte Render.
    clipGameActive: () => navigation.clipGame,
    tracks: () => tracksRef.current,
  })

  const session = useSpotifySession({
    playback,
    navigation,
    clearTracks: () => {
      tracksRef.current = []
      setTracks([])
    },
  })

  // Lädt und mischt die Titel vor dem Screen-Wechsel (Epoche verwirft veraltete Antworten); das Spiel
  // bekommt die fertige Liste als Prop und richtet sich danach selbst ein (z. B. Vorladen des ersten Titels).
  async function handleStartGame(): Promise<void> {
    const epoch = navigation.currentEpoch()
    setError(null)
    navigation.setLoadingTracks(true)
    try {
      const loaded = await fetchTracksForPlaylists(navigation.selectedIds)
      if (epoch !== navigation.currentEpoch()) {
        traceGame('runde', { aktion: 'laden-verworfen', schritt: 'titel' })
        return
      }
      if (loaded.length === 0) {
        throw new Error('Keine abspielbaren Titel gefunden.')
      }
      traceGame('runde', { aktion: 'geladen', anzahl: loaded.length, modus: navigation.gameId })
      await playback.connect()
      if (epoch !== navigation.currentEpoch()) {
        traceGame('runde', { aktion: 'laden-verworfen', schritt: 'player' })
        return
      }
      const shuffled = shuffleTracks(loaded)
      tracksRef.current = shuffled
      setTracks(shuffled)
      // Medien-Sitzung (Sperrbildschirm) bereitstellen, für alle Spiele wie bisher im Ruhezustand.
      playback.beginMedia('paused')
      navigation.showGame()
    } catch (cause) {
      if (epoch !== navigation.currentEpoch()) {
        traceGame('runde', { aktion: 'laden-verworfen', schritt: 'fehler' })
        return
      }
      const fehler = formatSpotifyUserError(cause)
      traceGame('runde', { aktion: 'laden-fehler', fehler })
      setError(fehler)
    } finally {
      if (epoch === navigation.currentEpoch()) {
        navigation.setLoadingTracks(false)
      }
    }
  }

  function handleLeaveGame(): void {
    traceGame('runde', { aktion: 'verlassen', modus: navigation.gameId })
    if (navigation.game?.requiresSpotify) {
      void playback.end()
    }
    navigation.backToMenu()
  }

  function handleGameToPlaylists(): void {
    traceGame('runde', { aktion: 'zur-playlistauswahl', modus: navigation.gameId })
    void playback.end()
    navigation.leaveGameToPlaylists()
  }

  // Die Zeile 'spiel' ergänzt jedes Spiel um seinen eigenen Rundenstand.
  useGameDebugWatch('spiel', {
    screen: navigation.debugScreen,
    fehler: error,
    modus: navigation.gameId,
    shotless: navigation.gameLive,
  })

  const { screen, game, fullBleed } = navigation
  const GameScreen = game?.entry.kind === 'component' ? game.entry.Screen : null

  return (
    <main className={fullBleed ? 'app app-game' : 'app'}>
      <div className="glow" aria-hidden="true" />
      {screen === 'login' ? (
        <LoginScreen
          clientIdPresent={Boolean(getSpotifyClientId())}
          busy={session.busy}
          error={error}
          onSpotifyLogin={() => {
            void session.login()
          }}
          onPlayWithoutSpotify={() => navigation.selectGame(TANGERA_ID)}
        />
      ) : null}
      {screen === 'menu' ? (
        <MainMenu
          games={GAMES}
          savedTimings={savedTimings}
          onSaveTimings={saveTimings}
          onLogout={session.logout}
          onSelectGame={navigation.selectGame}
        />
      ) : null}
      {screen === 'playlists' ? (
        <PlaylistPicker
          playlists={navigation.playlists}
          selectedIds={navigation.selectedIds}
          loading={navigation.loadingPlaylists}
          loadingTracks={navigation.loadingTracks}
          error={error}
          savedTimings={savedTimings}
          onSaveTimings={saveTimings}
          onToggle={navigation.togglePlaylist}
          onToggleAll={navigation.toggleAllPlaylists}
          onStart={() => {
            void handleStartGame()
          }}
          onBack={navigation.backToMenu}
          onLogout={session.logout}
        />
      ) : null}
      {screen === 'game' && GameScreen ? (
        <GameScreen
          signedIn={navigation.signedIn}
          tracks={tracks}
          error={error}
          playback={playback}
          onLogout={session.logout}
          onLeave={handleLeaveGame}
          onBackToPlaylists={handleGameToPlaylists}
          onShowPlaylists={navigation.showPlaylists}
          onError={setError}
          onLiveChange={navigation.setGameLive}
        />
      ) : null}
      {fullBleed ? null : <AppFooter />}
    </main>
  )
}
