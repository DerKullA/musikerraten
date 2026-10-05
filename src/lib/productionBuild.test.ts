import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const repoRoot = new URL('../../', import.meta.url)

describe('Produktions-Build', () => {
  it('baut standardmäßig für die Seitenwurzel und ohne Pages-Workflow', () => {
    const packageJson = readFileSync(new URL('package.json', repoRoot), 'utf8')
    const viteConfig = readFileSync(new URL('vite.config.ts', repoRoot), 'utf8')
    const scripts = JSON.parse(packageJson) as { scripts: Record<string, string> }

    expect(scripts.scripts.build).toBe('tsc -b && vite build')
    expect(scripts.scripts['build:pages']).toBeUndefined()
    expect(scripts.scripts['build:prod']).toBeUndefined()
    expect(packageJson).not.toContain('/musikerraten/')
    expect(viteConfig).toContain('base: ROOT_BASE_PATH')
    expect(viteConfig).not.toContain('VITE_BASE')
    expect(viteConfig).not.toContain('/musikerraten/')
    expect(existsSync(new URL('.github/workflows/pages.yml', repoRoot))).toBe(false)
  })
})
