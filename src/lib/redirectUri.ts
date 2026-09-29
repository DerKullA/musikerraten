import { normalizeBasePath } from './basePath.ts'

export function buildRedirectUri(origin: string, base: string | undefined): string {
  const normalizedOrigin = origin.replace(/\/+$/, '')
  return `${normalizedOrigin}${normalizeBasePath(base)}`
}

export function getRedirectUri(): string {
  return buildRedirectUri(window.location.origin, import.meta.env.BASE_URL)
}
