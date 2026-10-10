import { describe, expect, it } from 'vitest'
import { ROOT_BASE_PATH } from './basePath.ts'
import { buildRedirectUri } from './redirectUri.ts'

describe('buildRedirectUri', () => {
  it('endet an der Seitenwurzel mit Schrägstrich', () => {
    expect(buildRedirectUri('https://musikerraten.wirsindgeil.com', ROOT_BASE_PATH)).toBe(
      'https://musikerraten.wirsindgeil.com/',
    )
    expect(buildRedirectUri('https://musikerraten.wirsindgeil.com/', '/')).toBe(
      'https://musikerraten.wirsindgeil.com/',
    )
    expect(buildRedirectUri('http://127.0.0.1:43123', ROOT_BASE_PATH)).toBe('http://127.0.0.1:43123/')
    expect(buildRedirectUri('http://127.0.0.1:43123/', undefined)).toBe('http://127.0.0.1:43123/')
  })
})
