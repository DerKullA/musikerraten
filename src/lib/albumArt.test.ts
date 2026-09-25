import { describe, expect, it } from 'vitest'
import { pickAlbumImageUrl, revealAlbumArtUrl } from './albumArt.ts'

describe('pickAlbumImageUrl', () => {
  it('prefers the smallest cover that is still sharp enough for the button', () => {
    const url = pickAlbumImageUrl([
      { url: 'https://i.scdn.co/image/large', width: 640, height: 640 },
      { url: 'https://i.scdn.co/image/mid', width: 300, height: 300 },
      { url: 'https://i.scdn.co/image/tiny', width: 64, height: 64 },
    ])
    expect(url).toBe('https://i.scdn.co/image/mid')
  })

  it('falls back to the largest image when every size is small', () => {
    const url = pickAlbumImageUrl([
      { url: 'https://i.scdn.co/image/tiny', width: 64 },
      { url: 'https://i.scdn.co/image/small', width: 120 },
    ])
    expect(url).toBe('https://i.scdn.co/image/small')
  })

  it('ignores missing, blank, and non-http urls', () => {
    expect(
      pickAlbumImageUrl([
        { url: 'javascript:alert(1)', width: 640 },
        { url: '  ', width: 640 },
        { url: '/local.svg', width: 640 },
        {},
      ]),
    ).toBeUndefined()
    expect(pickAlbumImageUrl(undefined)).toBeUndefined()
  })

  it('keeps an https cover when width is unknown', () => {
    expect(pickAlbumImageUrl([{ url: 'https://i.scdn.co/image/unknown', width: null }])).toBe(
      'https://i.scdn.co/image/unknown',
    )
  })
})

describe('revealAlbumArtUrl', () => {
  it('returns art only during reveal', () => {
    const url = 'https://i.scdn.co/image/cover'
    expect(revealAlbumArtUrl('reveal', url)).toBe(url)
    expect(revealAlbumArtUrl('playing', url)).toBeNull()
    expect(revealAlbumArtUrl('thinking', url)).toBeNull()
    expect(revealAlbumArtUrl('idle', url)).toBeNull()
  })

  it('falls back when the cover url is missing or unsafe', () => {
    expect(revealAlbumArtUrl('reveal', undefined)).toBeNull()
    expect(revealAlbumArtUrl('reveal', '   ')).toBeNull()
    expect(revealAlbumArtUrl('reveal', 'javascript:alert(1)')).toBeNull()
    expect(revealAlbumArtUrl('reveal', '//evil.example/cover.jpg')).toBeNull()
  })

  it('allows a same-origin path for the demo cover', () => {
    expect(revealAlbumArtUrl('reveal', '/musikerraten/demo-cover.svg')).toBe(
      '/musikerraten/demo-cover.svg',
    )
    expect(revealAlbumArtUrl('playing', '/musikerraten/demo-cover.svg')).toBeNull()
  })
})
