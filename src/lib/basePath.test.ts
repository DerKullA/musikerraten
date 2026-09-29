import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { normalizeBasePath, PAGES_BASE_PATH, ROOT_BASE_PATH } from './basePath.ts'

describe('normalizeBasePath', () => {
  it('nutzt die Seitenwurzel, wenn kein Pfad gesetzt ist', () => {
    expect(normalizeBasePath(undefined)).toBe(ROOT_BASE_PATH)
    expect(normalizeBasePath('')).toBe(ROOT_BASE_PATH)
    expect(normalizeBasePath('/')).toBe(ROOT_BASE_PATH)
    expect(normalizeBasePath('  /  ')).toBe(ROOT_BASE_PATH)
  })

  it('erzwingt führenden und abschließenden Schrägstrich für Projektseiten', () => {
    expect(normalizeBasePath('musikerraten')).toBe(PAGES_BASE_PATH)
    expect(normalizeBasePath('/musikerraten')).toBe(PAGES_BASE_PATH)
    expect(normalizeBasePath('/musikerraten/')).toBe(PAGES_BASE_PATH)
  })
})

describe('GitHub-Pages-Workflow', () => {
  it('baut weiterhin mit der Projektseiten-Basis', () => {
    const workflow = readFileSync(new URL('../../.github/workflows/pages.yml', import.meta.url), 'utf8')
    expect(workflow).toContain('npm run build')
    expect(workflow).toContain('VITE_BASE: /musikerraten/')
    expect(workflow).toContain('actions/deploy-pages@v4')
  })
})
