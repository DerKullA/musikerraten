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
      reject(new Error('Spotify Web Playback SDK konnte nicht geladen werden.'))
    }, READY_TIMEOUT_MS)

    const finish = () => {
      window.clearTimeout(timeout)
      if (window.Spotify?.Player) {
        resolve()
        return
      }
      sdkPromise = null
      reject(new Error('Spotify Web Playback SDK konnte nicht geladen werden.'))
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
      reject(new Error('Spotify SDK-Skript blockiert oder nicht erreichbar.'))
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
    volume: 0.8,
    enableMediaSession: false,
  }
}

export async function connectSpotifyPlayer(
  name: string,
): Promise<{ player: SpotifyPlayer; deviceId: string }> {
  await loadSpotifySdk()
  const PlayerCtor = window.Spotify?.Player
  if (!PlayerCtor) {
    throw new Error('Spotify Player ist nicht verfügbar.')
  }

  const player = new PlayerCtor(spotifyPlayerOptions(name))
  watchQuizPlayback(player)

  return await new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      player.disconnect()
      reject(new Error('Spotify-Player antwortet nicht. Premium-Konto und HTTPS prüfen.'))
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
      reject(new Error(event.message || 'Spotify Premium ist für die Wiedergabe erforderlich.'))
    })
    player.addListener('authentication_error', (event) => {
      window.clearTimeout(timer)
      player.disconnect()
      reject(new Error(event.message || 'Spotify-Anmeldung ungültig.'))
    })
    player.addListener('initialization_error', (event) => {
      window.clearTimeout(timer)
      player.disconnect()
      reject(new Error(event.message || 'Spotify-Player konnte nicht initialisiert werden.'))
    })

    void player.connect().then((ok) => {
      if (!ok) {
        window.clearTimeout(timer)
        reject(new Error('Verbindung zum Spotify-Player fehlgeschlagen.'))
      }
    })
  })
}
