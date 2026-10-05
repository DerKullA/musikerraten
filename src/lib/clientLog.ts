import { readAppVersion } from './appVersion.ts'
import { redactSecrets, redactUrl } from './clientLogRedact.ts'

const CLIENT_LOG_URL = '/api/log.php'
const DEDUP_MS = 2_000
const MAX_PER_MINUTE = 30
const MAX_MESSAGE = 2_000
const MAX_FIELD = 500
const MAX_STACK = 2_000
const CONTEXT_KEYS = ['source', 'uri', 'action', 'phase', 'step'] as const

export interface ClientLogContext {
  source?: string
  uri?: string | null
  action?: string | null
  phase?: string | null
  step?: string | null
}

export interface ClientLogHost {
  addEventListener: (type: string, listener: (event: Event) => void) => void
  location: { href: string }
  navigator: { userAgent: string }
  console: {
    error: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
  }
}

interface ClientLogPayload {
  level: 'error' | 'warning'
  message: string
  page: string
  version: string
  context: Record<string, string | null>
  stack?: string
}

type ClientLogSender = (body: string) => void

const reportedErrors = new WeakSet<object>()
const recentKeys = new Map<string, number>()
const installedHosts = new WeakSet<object>()
let windowStarted = 0
let windowCount = 0
let sender: ClientLogSender = postClientLog

/** Setzt den Transport zurück. Nur für Tests. */
export function resetClientLogForTests(): void {
  recentKeys.clear()
  windowStarted = 0
  windowCount = 0
  sender = postClientLog
}

/** Ersetzt den Transport. `null` stellt den stillen Fetch wieder her. */
export function setClientLogSenderForTests(next: ClientLogSender | null): void {
  sender = next ?? postClientLog
}

/** Schickt einen Fehler an das Log, ohne die Oberfläche zu blockieren. */
export function reportClientError(message: string, context: ClientLogContext = {}, cause?: unknown): void {
  dispatchClientLog('error', message, context, cause)
}

/** Schickt eine Warnung an das Log, ohne die Oberfläche zu blockieren. */
export function reportClientWarning(message: string, context: ClientLogContext = {}, cause?: unknown): void {
  dispatchClientLog('warning', message, context, cause)
}

/** Meldet einen Fehler und gibt ihn zum Weiterwerfen zurück. */
export function clientError(message: string, context: ClientLogContext = {}): Error {
  const error = new Error(redactSecrets(message).slice(0, MAX_MESSAGE))
  reportClientError(error.message, context, error)
  return error
}

/** Hängt Fenster- und Konsolenfehler an den stillen Reporter. */
export function installClientLogger(host?: ClientLogHost): void {
  const target = host ?? defaultHost()
  if (!target || installedHosts.has(target)) {
    return
  }
  installedHosts.add(target)
  target.addEventListener('error', (event) => {
    const detail = readErrorEvent(event)
    if (!detail) {
      return
    }
    reportClientError(detail.message, { source: 'window', step: detail.step }, detail.error)
  })
  target.addEventListener('unhandledrejection', (event) => {
    const reason = 'reason' in event ? event.reason : undefined
    const message = reason instanceof Error && reason.message ? reason.message : 'Unbehandelte Promise'
    reportClientError(message, { source: 'promise' }, reason)
  })
  wrapConsole(target, 'error')
  wrapConsole(target, 'warning')
}

function defaultHost(): ClientLogHost | null {
  if (typeof window === 'undefined') {
    return null
  }
  return {
    addEventListener: (type, listener) => {
      window.addEventListener(type, listener)
    },
    location: window.location,
    navigator: window.navigator,
    console: window.console as ClientLogHost['console'],
  }
}

function wrapConsole(host: ClientLogHost, level: 'error' | 'warning'): void {
  const method = level === 'error' ? 'error' : 'warn'
  const original = host.console[method].bind(host.console)
  host.console[method] = (...args: unknown[]) => {
    original(...args)
    const described = describeConsoleArgs(args)
    if (!described) {
      return
    }
    dispatchClientLog(level, described.message, { source: 'console' }, described.error)
  }
}

function dispatchClientLog(
  level: 'error' | 'warning',
  message: string,
  context: ClientLogContext,
  cause?: unknown,
): void {
  const error = typeof cause === 'object' && cause !== null ? cause : undefined
  if (error && reportedErrors.has(error)) {
    return
  }
  const text = redactSecrets(message).replace(/[\r\n]+/g, ' ').slice(0, MAX_MESSAGE).trim()
  if (!text) {
    return
  }
  if (error) {
    reportedErrors.add(error)
  }
  if (!takeSlot(`${level}\n${text}`)) {
    return
  }
  deliver({
    level,
    message: text,
    page: currentPage(),
    version: readAppVersion(),
    context: compactContext(context),
    ...stackField(cause),
  })
}

function takeSlot(key: string): boolean {
  const now = Date.now()
  const previous = recentKeys.get(key)
  if (previous !== undefined && now - previous < DEDUP_MS) {
    return false
  }
  if (now - windowStarted >= 60_000) {
    windowStarted = now
    windowCount = 0
  }
  if (windowCount >= MAX_PER_MINUTE) {
    return false
  }
  windowCount += 1
  recentKeys.delete(key)
  recentKeys.set(key, now)
  while (recentKeys.size > 200) {
    const oldest = recentKeys.keys().next().value
    if (oldest === undefined) {
      break
    }
    recentKeys.delete(oldest)
  }
  return true
}

function deliver(payload: ClientLogPayload): void {
  let body: string
  try {
    body = JSON.stringify(payload)
  } catch {
    return
  }
  try {
    sender(body)
  } catch {
    return
  }
}

function postClientLog(body: string): void {
  if (typeof fetch !== 'function') {
    return
  }
  try {
    void fetch(CLIENT_LOG_URL, {
      method: 'POST',
      mode: 'same-origin',
      credentials: 'omit',
      cache: 'no-store',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body,
    }).catch(() => undefined)
  } catch {
    return
  }
}

function compactContext(context: ClientLogContext): Record<string, string | null> {
  const result: Record<string, string | null> = {}
  for (const key of CONTEXT_KEYS) {
    const value = context[key]
    if (value === undefined) {
      continue
    }
    result[key] = value === null ? null : redactSecrets(value).slice(0, MAX_FIELD)
  }
  return result
}

function stackField(cause: unknown): { stack?: string } {
  if (!(cause instanceof Error) || !cause.stack) {
    return {}
  }
  return { stack: redactSecrets(cause.stack).slice(0, MAX_STACK) }
}

function currentPage(): string {
  if (typeof location === 'undefined') {
    return ''
  }
  return redactUrl(location.href).slice(0, MAX_FIELD)
}

function readErrorEvent(event: Event): { message: string; error?: unknown; step?: string } | null {
  if (!('message' in event) || typeof event.message !== 'string') {
    return null
  }
  const filename = 'filename' in event && typeof event.filename === 'string' ? event.filename : ''
  const lineno = 'lineno' in event && typeof event.lineno === 'number' ? event.lineno : 0
  const colno = 'colno' in event && typeof event.colno === 'number' ? event.colno : 0
  return {
    message: event.message || 'Unbekannter Fehler',
    error: 'error' in event ? event.error : undefined,
    step: filename ? redactSecrets(`${filename}:${lineno}:${colno}`) : undefined,
  }
}

function describeConsoleArgs(args: unknown[]): { message: string; error?: Error } | null {
  if (args.length === 0) {
    return null
  }
  const parts: string[] = []
  let error: Error | undefined
  for (const arg of args) {
    if (arg instanceof Error) {
      error ??= arg
      parts.push(arg.message)
      continue
    }
    if (typeof arg === 'string') {
      parts.push(arg)
      continue
    }
    try {
      parts.push(JSON.stringify(arg))
    } catch {
      parts.push('unbekannt')
    }
  }
  const message = parts.join(' ').trim()
  if (!message) {
    return null
  }
  return { message, error }
}
