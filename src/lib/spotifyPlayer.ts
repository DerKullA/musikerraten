import { AUDIBLE_VOLUME } from './clipWarmup.ts'
import { reportPlaybackFailure } from './playbackLog.ts'
import { getValidAccessToken } from './spotifyAuth.ts'
import { watchQuizPlayback } from './quizMediaSession.ts'

const SDK_SRC = 'https://sdk.scdn.co/spotify-player.js'
const READY_TIMEOUT_MS = 15_000

let sdkPromise: Promise<void> | null = null

export function loadSpotifySdk(): Promise<void> {
  if (window.Spotify?.Player) {
    return Promise.resolve()
  }
  if (sdkPromise) {
    return sdkPromise
  }
  sdkPromise = new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      sdkPromise = null
      reject(reportPlaybackFailure('Spotify Web Playback SDK konnte nicht geladen werden.', { action: 'sdk', step: 'load' }))
    }, READY_TIMEOUT_MS)

    const finish = () => {
      window.clearTimeout(timeout)
      if (window.Spotify?.Player) {
        resolve()
        return
      }
      sdkPromise = null
      reject(reportPlaybackFailure('Spotify Web Playback SDK konnte nicht geladen werden.', { action: 'sdk', step: 'load' }))
    }

    window.onSpotifyWebPlaybackSDKReady = finish
    if (window.Spotify?.Player) {
      finish()
      return
    }

    const existing = document.querySelector(`script[src="${SDK_SRC}"]`)
    if (existing) {
      return
    }

    const script = document.createElement('script')
    script.src = SDK_SRC
    script.async = true
    script.onerror = () => {
      window.clearTimeout(timeout)
      sdkPromise = null
      reject(reportPlaybackFailure('Spotify SDK-Skript blockiert oder nicht erreichbar.', { action: 'sdk', step: 'load' }))
    }
    document.body.appendChild(script)
  })
  return sdkPromise
}

export function spotifyPlayerOptions(name: string): SpotifyPlayerOptions {
  return {
    name,
    getOAuthToken: (callback) => {
      void getValidAccessToken()
        .then(callback)
        .catch(() => callback(''))
    },
    volume: AUDIBLE_VOLUME,
    enableMediaSession: false,
  }
}

export async function connectSpotifyPlayer(
  name: string,
): Promise<{ player: SpotifyPlayer; deviceId: string }> {
  await loadSpotifySdk()
  const PlayerCtor = window.Spotify?.Player
  if (!PlayerCtor) {
    throw reportPlaybackFailure('Spotify Player ist nicht verfügbar.', { action: 'sdk', step: 'connect' })
  }

  const player = new PlayerCtor(spotifyPlayerOptions(name))
  watchQuizPlayback(player)

  return await new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      player.disconnect()
      reject(reportPlaybackFailure('Spotify-Player antwortet nicht. Premium-Konto und HTTPS prüfen.', { action: 'sdk', step: 'connect' }))
    }, READY_TIMEOUT_MS)

    player.addListener('ready', (event) => {
      if (!event.device_id) {
        return
      }
      window.clearTimeout(timer)
      resolve({ player, deviceId: event.device_id })
    })
    player.addListener('account_error', (event) => {
      window.clearTimeout(timer)
      player.disconnect()
      reject(reportPlaybackFailure(event.message || 'Spotify Premium ist für die Wiedergabe erforderlich.', { action: 'sdk', step: 'account' }))
    })
    player.addListener('authentication_error', (event) => {
      window.clearTimeout(timer)
      player.disconnect()
      reject(reportPlaybackFailure(event.message || 'Spotify-Anmeldung ungültig.', { action: 'sdk', step: 'auth' }))
    })
    player.addListener('initialization_error', (event) => {
      window.clearTimeout(timer)
      player.disconnect()
      reject(reportPlaybackFailure(event.message || 'Spotify-Player konnte nicht initialisiert werden.', { action: 'sdk', step: 'init' }))
    })

    void player.connect().then((ok) => {
      if (!ok) {
        window.clearTimeout(timer)
        reject(reportPlaybackFailure('Verbindung zum Spotify-Player fehlgeschlagen.', { action: 'sdk', step: 'connect' }))
      }
    })
  })
}
