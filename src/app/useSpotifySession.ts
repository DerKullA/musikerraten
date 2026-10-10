import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { Navigation } from '@/app/useNavigation.ts'
import { GAMES } from '@/games/registry.ts'
import type { PlaybackApi } from '@/platform/playback/usePlaybackEngine.ts'
import {
  clearAuthCallbackFromUrl,
  clearTokens,
  exchangeAuthorizationCode,
  formatSpotifyUserError,
  getValidAccessToken,
  readAuthCallback,
  readStoredTokens,
  startSpotifyLogin,
} from '@/platform/spotify/spotifyAuth.ts'
import { resetSavedPhaseTimings } from '@/ui/savedPhaseTimings.ts'
import { stopSpeakerKeepAlive, watchSpeakerKeepAliveGestures } from '@/platform/playback/speakerKeepAlive.ts'

interface SpotifySessionOptions {
  playback: PlaybackApi
  navigation: Navigation
  /** Geladene Titelliste der Runde leeren (Logout). */
  clearTracks: () => void
}

export function useSpotifySession({ playback, navigation, clearTracks }: SpotifySessionOptions) {
  const [busy, setBusy] = useState(false)
  const bootstrapped = useRef(false)

  async function bootstrapAuth(): Promise<void> {
    const callback = readAuthCallback()
    if (callback.error) {
      clearAuthCallbackFromUrl()
      navigation.setError(callback.error === 'access_denied' ? 'Anmeldung abgebrochen.' : callback.error)
      return
    }
    if (callback.code) {
      setBusy(true)
      try {
        await exchangeAuthorizationCode(callback.code, callback.state)
        clearAuthCallbackFromUrl()
        resetSavedPhaseTimings()
        navigation.showMainMenu()
      } catch (cause) {
        navigation.setError(formatSpotifyUserError(cause))
      } finally {
        setBusy(false)
      }
      return
    }
    if (readStoredTokens()) {
      try {
        await getValidAccessToken()
        navigation.showMainMenu()
      } catch {
        clearTokens()
        resetSavedPhaseTimings()
      }
    }
  }

  async function login(): Promise<void> {
    navigation.setError(null)
    setBusy(true)
    try {
      await startSpotifyLogin()
    } catch (cause) {
      setBusy(false)
      navigation.setError(formatSpotifyUserError(cause))
    }
  }

  function logout(): void {
    stopSpeakerKeepAlive()
    for (const game of GAMES) {
      game.clearSession?.()
    }
    resetSavedPhaseTimings()
    // Ein offenes Spiel hat seine Runde vor dem Logout selbst angehalten; hier endet die Wiedergabe.
    void playback.end()
    playback.disconnect()
    clearTokens()
    clearTracks()
    navigation.resetForLogout()
    setBusy(false)
  }

  const bootstrap = useEffectEvent(() => {
    void bootstrapAuth()
  })
  const disposeSession = useEffectEvent(() => {
    playback.dispose()
  })

  useEffect(() => {
    if (bootstrapped.current) {
      return
    }
    bootstrapped.current = true
    const unbindKeepAlive = watchSpeakerKeepAliveGestures()
    bootstrap()
    return () => {
      disposeSession()
      unbindKeepAlive()
      stopSpeakerKeepAlive()
    }
  }, [playback])

  return { busy, login, logout }
}
