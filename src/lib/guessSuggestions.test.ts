import { describe, expect, it } from 'vitest'
import { suggestGuesses, suggestSongTitles } from '@/lib/guessSuggestions.ts'

const tracks = [
  { title: 'Under Pressure', artist: 'Queen, David Bowie' },
  { title: 'Bohemian Rhapsody', artist: 'Queen' },
  { title: 'Heroes (2017 Remaster)', artist: 'David Bowie' },
  { title: 'Pressure', artist: 'Billy Joel' },
  { title: 'Ohne Interpret' },
]

describe('guessSuggestions', () => {
  it('liefert bei Suchtexten unter 2 Zeichen nichts', () => {
    expect(suggestGuesses(tracks, '', 'title')).toEqual([])
    expect(suggestGuesses(tracks, 'u', 'title')).toEqual([])
    expect(suggestGuesses(tracks, '(', 'title')).toEqual([])
  })

  it('findet Titel per normalisiertem Teilstring in Katalogreihenfolge', () => {
    expect(suggestGuesses(tracks, 'press', 'title')).toEqual([
      { label: 'Under Pressure', field: 'title' },
      { label: 'Pressure', field: 'title' },
    ])
    expect(suggestGuesses(tracks, 'heroes', 'title')).toEqual([{ label: 'Heroes (2017 Remaster)', field: 'title' }])
  })

  it('zerlegt Interpreten an Kommas und entdoppelt', () => {
    expect(suggestGuesses(tracks, 'queen', 'artist')).toEqual([{ label: 'Queen', field: 'artist' }])
    expect(suggestGuesses(tracks, 'bowie', 'artist')).toEqual([{ label: 'David Bowie', field: 'artist' }])
  })

  it('kombiniert bei "either" zuerst Titel, dann Interpreten', () => {
    expect(suggestGuesses(tracks, 'pressure', 'either')).toEqual([
      { label: 'Under Pressure', field: 'title' },
      { label: 'Pressure', field: 'title' },
    ])
    expect(suggestGuesses(tracks, 'david', 'either')).toEqual([{ label: 'David Bowie', field: 'artist' }])
  })

  it('begrenzt die Trefferzahl', () => {
    expect(suggestGuesses(tracks, 'e', 'title')).toEqual([])
    expect(suggestGuesses(tracks, 'er', 'title', 2)).toHaveLength(2)
  })

  it('kommt mit Titeln ohne Interpret zurecht', () => {
    expect(suggestGuesses(tracks, 'ohne', 'either')).toEqual([{ label: 'Ohne Interpret', field: 'title' }])
  })

  it('suggestSongTitles liefert nur Titel', () => {
    expect(suggestSongTitles(tracks, 'press')).toEqual([{ title: 'Under Pressure' }, { title: 'Pressure' }])
    expect(suggestSongTitles(tracks, 'queen')).toEqual([])
    expect(suggestSongTitles(tracks, 'er', 1)).toHaveLength(1)
  })
})
