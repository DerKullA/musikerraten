import { describe, expect, it } from 'vitest'
import { pickAlbumImageUrl, revealAlbumArtUrl } from '@/lib/albumArt.ts'

describe('pickAlbumImageUrl', () => {
  it('liefert undefined ohne verwendbare Bilder', () => {
    expect(pickAlbumImageUrl(undefined)).toBeUndefined()
    expect(pickAlbumImageUrl([])).toBeUndefined()
    expect(pickAlbumImageUrl([{ url: 'ftp://x/a.jpg', width: 640 }, { url: '' }, {}])).toBeUndefined()
  })

  it('nimmt das schmalste Bild ab 300 px', () => {
    expect(
      pickAlbumImageUrl([
        { url: 'https://i/640', width: 640 },
        { url: 'https://i/300', width: 300 },
        { url: 'https://i/64', width: 64 },
      ]),
    ).toBe('https://i/300')
  })

  it('nimmt sonst das breiteste Bild', () => {
    expect(
      pickAlbumImageUrl([
        { url: 'https://i/64', width: 64 },
        { url: 'https://i/200', width: 200 },
      ]),
    ).toBe('https://i/200')
  })

  it('bevorzugt Bilder mit bekannter Breite und fällt sonst auf das erste zurück', () => {
    expect(
      pickAlbumImageUrl([
        { url: 'https://i/unknown', width: null },
        { url: 'https://i/100', width: 100 },
      ]),
    ).toBe('https://i/100')
    expect(pickAlbumImageUrl([{ url: 'https://i/a' }, { url: 'https://i/b' }])).toBe('https://i/a')
  })
})

describe('revealAlbumArtUrl', () => {
  it('zeigt das Cover nur in der Auflösung', () => {
    expect(revealAlbumArtUrl('playing', 'https://i/a.jpg')).toBeNull()
    expect(revealAlbumArtUrl('thinking', 'https://i/a.jpg')).toBeNull()
    expect(revealAlbumArtUrl('idle', 'https://i/a.jpg')).toBeNull()
    expect(revealAlbumArtUrl('reveal', ' https://i/a.jpg ')).toBe('https://i/a.jpg')
  })

  it('lässt nur absolute http(s)-URLs und Pfade zu', () => {
    expect(revealAlbumArtUrl('reveal', '/cover.png')).toBe('/cover.png')
    expect(revealAlbumArtUrl('reveal', '//evil.example/x.png')).toBeNull()
    expect(revealAlbumArtUrl('reveal', 'javascript:alert(1)')).toBeNull()
    expect(revealAlbumArtUrl('reveal', 'data:image/png;base64,AAAA')).toBeNull()
    expect(revealAlbumArtUrl('reveal', '')).toBeNull()
    expect(revealAlbumArtUrl('reveal', null)).toBeNull()
    expect(revealAlbumArtUrl('reveal', undefined)).toBeNull()
  })
})
