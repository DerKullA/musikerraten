export const PAGES_BASE_PATH = '/musikerraten/'
export const ROOT_BASE_PATH = '/'

export function normalizeBasePath(base: string | undefined): string {
  const trimmed = base?.trim() ?? ''
  if (trimmed === '' || trimmed === '/') {
    return ROOT_BASE_PATH
  }
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}
