export function getRedirectUri(): string {
  const origin = window.location.origin
  const base = import.meta.env.BASE_URL
  if (!base || base === '/') {
    return origin
  }
  const path = base.startsWith('/') ? base : `/${base}`
  const withSlash = path.endsWith('/') ? path : `${path}/`
  return `${origin}${withSlash}`
}
