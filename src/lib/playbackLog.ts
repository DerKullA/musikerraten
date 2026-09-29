export type PlaybackLogAction = 'prime' | 'play' | 'restore' | 'api' | 'sdk' | 'transfer'

export interface PlaybackLogContext {
  uri?: string | null
  action?: PlaybackLogAction
  phase?: string
  step?: string
}

const SECRET_VALUE = /bearer\s+\S+|((?:access_token|refresh_token|id_token|client_secret)["']?\s*[:=]\s*["']?)[^\s"',}&]+/gi

const loggedErrors = new WeakSet<Error>()

export function sanitizePlaybackText(value: string): string {
  return value.replace(SECRET_VALUE, (_match, prefix: string | undefined) =>
    prefix ? `${prefix}[redacted]` : 'bearer [redacted]',
  )
}

export function logPlaybackError(message: string, context: PlaybackLogContext = {}): void {
  const detail = {
    uri: context.uri ?? null,
    action: context.action ?? null,
    phase: context.phase ?? null,
    step: context.step ?? null,
  }
  console.error('[playback]', sanitizePlaybackText(message), detail)
}

export function rememberPlaybackLog(error: Error): void {
  loggedErrors.add(error)
}

export function wasPlaybackLogged(cause: unknown): boolean {
  return cause instanceof Error && loggedErrors.has(cause)
}

export function reportPlaybackFailure(message: string, context: PlaybackLogContext = {}): Error {
  const error = new Error(sanitizePlaybackText(message))
  logPlaybackError(error.message, context)
  rememberPlaybackLog(error)
  return error
}
