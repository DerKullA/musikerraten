export type GamePhase = 'idle' | 'playing' | 'thinking' | 'reveal'

export type AppScreen = 'login' | 'menu' | 'playlists' | 'game' | 'shotless'

export interface Track {
  uri: string
  title: string
  artist: string
  durationMs: number
  playlistId?: string
  albumImageUrl?: string
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
