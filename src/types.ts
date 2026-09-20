export type GamePhase = 'idle' | 'playing' | 'thinking' | 'reveal'

export type AppScreen = 'login' | 'playlists' | 'game'

export interface Track {
  uri: string
  title: string
  artist: string
  durationMs: number
}

export interface Playlist {
  id: string
  name: string
  trackCount: number
  ownerName: string
}

export interface TokenSet {
  accessToken: string
  refreshToken: string
  expiresAt: number
}
