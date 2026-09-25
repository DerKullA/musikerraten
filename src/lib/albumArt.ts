import type { GamePhase } from '../types.ts'

export interface AlbumImage {
  url?: string
  width?: number | null
  height?: number | null
}

const COVER_TARGET_PX = 300

export function pickAlbumImageUrl(images: readonly AlbumImage[] | undefined): string | undefined {
  const usable = usableAlbumImages(images)
  if (usable.length === 0) {
    return undefined
  }
  const known = usable.filter((image) => image.width > 0)
  const pool = known.length > 0 ? known : usable
  const largeEnough = pool.filter((image) => image.width >= COVER_TARGET_PX)
  if (largeEnough.length > 0) {
    return narrowestImage(largeEnough).url
  }
  return widestImage(pool).url
}

function narrowestImage(images: Array<{ url: string; width: number }>): { url: string; width: number } {
  return images.reduce((best, image) => (image.width < best.width ? image : best))
}

function widestImage(images: Array<{ url: string; width: number }>): { url: string; width: number } {
  return images.reduce((best, image) => (image.width > best.width ? image : best))
}

export function revealAlbumArtUrl(
  phase: GamePhase,
  albumImageUrl: string | null | undefined,
): string | null {
  if (phase !== 'reveal') {
    return null
  }
  return safeCoverUrl(albumImageUrl)
}

function usableAlbumImages(
  images: readonly AlbumImage[] | undefined,
): Array<{ url: string; width: number }> {
  if (!images) {
    return []
  }
  const usable: Array<{ url: string; width: number }> = []
  for (const image of images) {
    const url = safeCoverUrl(image.url)
    if (!url || !/^https?:\/\//i.test(url)) {
      continue
    }
    const width = typeof image.width === 'number' && image.width > 0 ? image.width : 0
    usable.push({ url, width })
  }
  return usable
}

function safeCoverUrl(albumImageUrl: string | null | undefined): string | null {
  const url = albumImageUrl?.trim()
  if (!url) {
    return null
  }
  if (url.startsWith('/') && !url.startsWith('//')) {
    return url
  }
  if (/^https?:\/\//i.test(url)) {
    return url
  }
  return null
}
