import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { ROOT_BASE_PATH } from './src/lib/basePath.ts'

function readPackageVersion(): string {
  const parsed: unknown = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
  if (!isPackageVersion(parsed)) {
    throw new Error('package.json enthält keine Version')
  }
  return parsed.version
}

function git(...args: string[]): string | null {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null
  } catch {
    return null
  }
}

/** Version aus package.json (Major.Minor) plus Commit-Anzahl als Patch und Kurz-Hash. Ohne Git bleibt die package.json-Version. */
function readBuildVersion(): string {
  const base = readPackageVersion()
  const count = git('rev-list', '--count', 'HEAD')
  const hash = git('rev-parse', '--short', 'HEAD')
  if (!count || !hash || !/^\d+$/.test(count)) {
    return base
  }
  const [major = '0', minor = '0'] = base.split('.')
  return `${major}.${minor}.${count}+${hash}`
}

function isPackageVersion(value: unknown): value is { version: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    typeof value.version === 'string' &&
    value.version.length > 0
  )
}

export default defineConfig({
  base: ROOT_BASE_PATH,
  define: {
    __APP_VERSION__: JSON.stringify(readBuildVersion()),
  },
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 43123,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
  },
})
