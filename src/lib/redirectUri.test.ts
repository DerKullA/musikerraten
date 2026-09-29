import { describe, expect, it } from 'vitest'
import { PAGES_BASE_PATH, ROOT_BASE_PATH } from './basePath.ts'
import { buildRedirectUri } from './redirectUri.ts'

describe('buildRedirectUri', () => {
  it('endet an der Seitenwurzel mit Schrägstrich', () => {
    expect(buildRedirectUri('https://wisinguy.com', ROOT_BASE_PATH)).toBe('https://wisinguy.com/')
    expect(buildRedirectUri('http://127.0.0.1:43123', ROOT_BASE_PATH)).toBe('http://127.0.0.1:43123/')
    expect(buildRedirectUri('https://example.vercel.app/', undefined)).toBe('https://example.vercel.app/')
  })

  it('behält die GitHub-Pages-URI mit Pfad und Schrägstrich', () => {
    expect(buildRedirectUri('https://derkulla.github.io', PAGES_BASE_PATH)).toBe(
      'https://derkulla.github.io/musikerraten/',
    )
    expect(buildRedirectUri('https://derkulla.github.io/', 'musikerraten')).toBe(
      'https://derkulla.github.io/musikerraten/',
    )
  })
})
