import { describe, expect, it } from 'vitest'
import {
  debugScreenName,
  isClipGameScreen,
  isFullBleedScreen,
  requiresSpotify,
  selectableGameId,
  toggleAllPlaylistIds,
  togglePlaylistId,
} from './navigation.ts'
import { findGame } from '@/games/registry.ts'
import type { Playlist } from '@/types.ts'

const song = findGame('guess-song')
const shotless = findGame('shotless')

function playlist(id: string): Playlist {
  return { id, name: id, trackCount: 1, ownerName: 'x' }
}

describe('selectableGameId', () => {
  it('lässt verfügbare Spiele zu', () => {
    expect(selectableGameId('guess-song')).toBe('guess-song')
    expect(selectableGameId('shotless')).toBe('shotless')
    expect(selectableGameId('tangera')).toBe('tangera')
  })

  it('ignoriert Platzhalter und Unbekanntes', () => {
    expect(selectableGameId('placeholder-2')).toBeNull()
    expect(selectableGameId('nope')).toBeNull()
  })
})

describe('requiresSpotify', () => {
  it('Tangera startet ohne Spotify, die Musikspiele nicht', () => {
    expect(requiresSpotify('tangera')).toBe(false)
    expect(requiresSpotify('guess-song')).toBe(true)
    expect(requiresSpotify('shotless')).toBe(true)
  })

  it('behandelt Unbekanntes sicherheitshalber als Spotify-Spiel', () => {
    expect(requiresSpotify('nope')).toBe(true)
  })
})

describe('isFullBleedScreen', () => {
  it('Song erraten ist im Spiel immer Vollbild', () => {
    expect(isFullBleedScreen('game', song, false)).toBe(true)
  })

  it('Shotless ist erst Vollbild, wenn die Runde läuft', () => {
    expect(isFullBleedScreen('game', shotless, false)).toBe(false)
    expect(isFullBleedScreen('game', shotless, true)).toBe(true)
  })

  it('andere Bildschirme sind nie Vollbild, auch nicht bei gameLive', () => {
    for (const screen of ['login', 'menu', 'playlists'] as const) {
      expect(isFullBleedScreen(screen, song, true)).toBe(false)
      expect(isFullBleedScreen(screen, shotless, true)).toBe(false)
    }
    expect(isFullBleedScreen('game', null, true)).toBe(false)
  })
})

describe('isClipGameScreen', () => {
  it('nur auf dem Spiel-Bildschirm eines Clip-Spiels', () => {
    expect(isClipGameScreen('game', shotless)).toBe(true)
    expect(isClipGameScreen('game', song)).toBe(false)
    expect(isClipGameScreen('playlists', shotless)).toBe(false)
    expect(isClipGameScreen('menu', shotless)).toBe(false)
    expect(isClipGameScreen('game', null)).toBe(false)
  })
})

describe('debugScreenName', () => {
  it('liefert wie zuvor game bzw. shotless für den Spiel-Bildschirm', () => {
    expect(debugScreenName('game', song)).toBe('game')
    expect(debugScreenName('game', shotless)).toBe('shotless')
  })

  it('reicht die übrigen Bildschirme unverändert durch', () => {
    expect(debugScreenName('login', song)).toBe('login')
    expect(debugScreenName('menu', shotless)).toBe('menu')
    expect(debugScreenName('playlists', shotless)).toBe('playlists')
    expect(debugScreenName('game', null)).toBe('game')
  })
})

describe('Playlist-Auswahl', () => {
  it('schaltet eine Id ein und aus', () => {
    expect(togglePlaylistId(['a'], 'b')).toEqual(['a', 'b'])
    expect(togglePlaylistId(['a', 'b'], 'a')).toEqual(['b'])
  })

  it('wählt alle oder keine', () => {
    const all = [playlist('a'), playlist('b')]
    expect(toggleAllPlaylistIds([], all)).toEqual(['a', 'b'])
    expect(toggleAllPlaylistIds(['a'], all)).toEqual(['a', 'b'])
    expect(toggleAllPlaylistIds(['a', 'b'], all)).toEqual([])
    expect(toggleAllPlaylistIds([], [])).toEqual([])
  })
})
