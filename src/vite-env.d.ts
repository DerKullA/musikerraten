/// <reference types="vite/client" />

declare const __APP_VERSION__: string

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
  enableMediaSession?: boolean
}

interface SpotifyPlaybackState {
  paused: boolean
  position?: number
  loading?: boolean
  track_window?: {
    current_track?: {
      uri?: string
    } | null
    next_tracks?: Array<{ uri?: string } | null> | null
  } | null
}

interface SpotifyPlayer {
  connect: () => Promise<boolean>
  disconnect: () => void
  addListener: (event: string, callback: (payload: SpotifyPlayerEvent) => void) => void
  removeListener: (event: string, callback: (payload: SpotifyPlayerEvent) => void) => void
  activateElement: () => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  seek: (positionMs: number) => Promise<void>
  setVolume: (volume: number) => Promise<void>
  getVolume: () => Promise<number>
  getCurrentState: () => Promise<SpotifyPlaybackState | null>
  nextTrack: () => Promise<void>
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
