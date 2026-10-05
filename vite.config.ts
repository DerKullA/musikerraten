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
    __APP_VERSION__: JSON.stringify(readPackageVersion()),
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
