import {
  clearPkceSession,
  createCodeChallenge,
  generateRandomString,
  readPkceState,
  readPkceVerifier,
  storePkceSession,
} from './pkce.ts'
import { getRedirectUri } from './redirectUri.ts'
import type { TokenSet } from '../types.ts'

const TOKEN_KEY = 'musikerraten_tokens'
const AUTH_URL = 'https://accounts.spotify.com/authorize'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'streaming',
  'user-modify-playback-state',
  'user-read-playback-state',
  'user-read-private',
].join(' ')

export function getSpotifyClientId(): string {
  return import.meta.env.VITE_SPOTIFY_CLIENT_ID?.trim() ?? ''
}

export function readStoredTokens(): TokenSet | null {
  const raw = localStorage.getItem(TOKEN_KEY)
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as TokenSet
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.expiresAt) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function storeTokens(tokens: TokenSet): void {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens))
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function tokensNeedRefresh(tokens: TokenSet, skewMs = 60_000): boolean {
  return Date.now() + skewMs >= tokens.expiresAt
}

export async function startSpotifyLogin(): Promise<void> {
  const clientId = getSpotifyClientId()
  if (!clientId) {
    throw new Error('VITE_SPOTIFY_CLIENT_ID fehlt.')
  }
  const verifier = generateRandomString(64)
  const state = generateRandomString(32)
  const challenge = await createCodeChallenge(verifier)
  storePkceSession(verifier, state)

  const url = new URL(AUTH_URL)
  url.search = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    scope: SCOPES,
    state,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  }).toString()
  window.location.assign(url.toString())
}

export function readAuthCallback(): { code: string | null; error: string | null; state: string | null } {
  const params = new URLSearchParams(window.location.search)
  return {
    code: params.get('code'),
    error: params.get('error'),
    state: params.get('state'),
  }
}

export function clearAuthCallbackFromUrl(): void {
  const url = new URL(window.location.href)
  url.search = ''
  window.history.replaceState({}, document.title, url.pathname + url.hash)
}

export async function exchangeAuthorizationCode(code: string, state: string | null): Promise<TokenSet> {
  const storedState = readPkceState()
  if (!state || !storedState || state !== storedState) {
    throw new Error('Ungültiger OAuth-State. Bitte erneut anmelden.')
  }
  const verifier = readPkceVerifier()
  if (!verifier) {
    throw new Error('PKCE-Verifier fehlt. Bitte erneut anmelden.')
  }
  const tokens = await requestTokens({
    grant_type: 'authorization_code',
    code,
    redirect_uri: getRedirectUri(),
    client_id: getSpotifyClientId(),
    code_verifier: verifier,
  })
  clearPkceSession()
  storeTokens(tokens)
  return tokens
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenSet> {
  const tokens = await requestTokens({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: getSpotifyClientId(),
  })
  const next: TokenSet = {
    ...tokens,
    refreshToken: tokens.refreshToken || refreshToken,
  }
  storeTokens(next)
  return next
}

export async function getValidAccessToken(): Promise<string> {
  const stored = readStoredTokens()
  if (!stored) {
    throw new Error('Nicht angemeldet.')
  }
  if (!tokensNeedRefresh(stored)) {
    return stored.accessToken
  }
  const refreshed = await refreshAccessToken(stored.refreshToken)
  return refreshed.accessToken
}

async function requestTokens(body: Record<string, string>): Promise<TokenSet> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  })
  const payload = (await response.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }
  if (!response.ok || !payload.access_token || !payload.expires_in) {
    throw new Error(payload.error_description || payload.error || 'Token-Austausch fehlgeschlagen.')
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? '',
    expiresAt: Date.now() + payload.expires_in * 1000,
  }
}
