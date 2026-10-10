const VERIFIER_KEY = 'musikerraten_code_verifier'
const STATE_KEY = 'musikerraten_oauth_state'

export function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const values = crypto.getRandomValues(new Uint8Array(length))
  return values.reduce((acc, value) => acc + possible[value % possible.length], '')
}

export async function createCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

export function storePkceSession(verifier: string, state: string): void {
  sessionStorage.setItem(VERIFIER_KEY, verifier)
  sessionStorage.setItem(STATE_KEY, state)
}

export function readPkceVerifier(): string | null {
  return sessionStorage.getItem(VERIFIER_KEY)
}

export function readPkceState(): string | null {
  return sessionStorage.getItem(STATE_KEY)
}

export function clearPkceSession(): void {
  sessionStorage.removeItem(VERIFIER_KEY)
  sessionStorage.removeItem(STATE_KEY)
}
