const SECRET_TEXT =
  /bearer\s+\S+|((?:access_token|refresh_token|id_token|client_secret)["']?\s*[:=]\s*["']?)[^\s"',}&]+/gi

const SECRET_QUERY = new Set([
  'access_token',
  'refresh_token',
  'id_token',
  'client_secret',
  'code',
  'token',
  'state',
  'authorization',
])

/** Entfernt Bearer-Tokens und Token-Felder aus einem Text. */
export function redactSecrets(value: string): string {
  return value.replace(SECRET_TEXT, (_match, prefix: string | undefined) =>
    prefix ? `${prefix}[redacted]` : 'bearer [redacted]',
  )
}

/** Entfernt geheime Query-Parameter und Token aus einer URL. */
export function redactUrl(value: string): string {
  try {
    const url = new URL(value)
    for (const key of [...url.searchParams.keys()]) {
      if (SECRET_QUERY.has(key.toLowerCase())) {
        url.searchParams.set(key, '[redacted]')
      }
    }
    return redactSecrets(url.toString())
  } catch {
    return redactSecrets(value)
  }
}
