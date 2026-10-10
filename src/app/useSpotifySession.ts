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
import { stopSpeakerKeepAlive, watchSpeakerKeepAliveGestures } from '@/platform/playback/speakerKeepAlive.ts'

// Was die Sitzung vom laufenden Spiel braucht (Song erraten hält seine Runde noch in der App).
export interface SessionRound {
  resetPhaseTimings: () => void
  stopRound: () => void
  /** Titelliste der Runde leeren (Logout). */
  clearTracks: () => void
  /** Spiel-Timer löschen (Unmount). */
  clearTimer: () => void
}

interface SpotifySessionOptions {
  playback: PlaybackApi
  navigation: Navigation
  round: SessionRound
}

export function useSpotifySession({ playback, navigation, round }: SpotifySessionOptions) {
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
        round.resetPhaseTimings()
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
        round.resetPhaseTimings()
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
    round.resetPhaseTimings()
    round.stopRound()
    playback.disconnect()
    clearTokens()
    round.clearTracks()
    navigation.resetForLogout()
    setBusy(false)
  }

  const bootstrap = useEffectEvent(() => {
    void bootstrapAuth()
  })
  const disposeSession = useEffectEvent(() => {
    round.clearTimer()
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
