import { describe, expect, it } from 'vitest'
import { normalizeBasePath, ROOT_BASE_PATH } from './basePath.ts'

describe('normalizeBasePath', () => {
  it('nutzt die Seitenwurzel, wenn kein Pfad gesetzt ist', () => {
    expect(normalizeBasePath(undefined)).toBe(ROOT_BASE_PATH)
    expect(normalizeBasePath('')).toBe(ROOT_BASE_PATH)
    expect(normalizeBasePath('/')).toBe(ROOT_BASE_PATH)
    expect(normalizeBasePath('  /  ')).toBe(ROOT_BASE_PATH)
  })
})
