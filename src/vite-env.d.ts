/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SPOTIFY_CLIENT_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface SpotifyPlayerOptions {
  name: string
  getOAuthToken: (callback: (token: string) => void) => void
  volume?: number
}

interface SpotifyPlayer {
  connect: () => Promise<boolean>
  disconnect: () => void
  addListener: (event: string, callback: (payload: SpotifyPlayerEvent) => void) => void
  activateElement: () => Promise<void>
  pause: () => Promise<void>
}

interface SpotifyPlayerEvent {
  device_id?: string
  message?: string
}

interface Window {
  onSpotifyWebPlaybackSDKReady?: () => void
  Spotify?: {
    Player: new (options: SpotifyPlayerOptions) => SpotifyPlayer
  }
}
