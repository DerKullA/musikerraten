import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { formatAppVersion, readAppVersion } from './appVersion.ts'

describe('formatAppVersion', () => {
  it('setzt das Versionskürzel vor die Nummer', () => {
    expect(formatAppVersion('1.0.0')).toBe('v1.0.0')
    expect(formatAppVersion('v2.3.4')).toBe('v2.3.4')
  })
})

describe('readAppVersion', () => {
  it('spiegelt die Version aus package.json', () => {
    const parsed: unknown = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
    if (!isPackageVersion(parsed)) {
      throw new Error('package.json enthält keine Version')
    }
    expect(readAppVersion()).toBe(`v${parsed.version}`)
  })
})

function isPackageVersion(value: unknown): value is { version: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    typeof value.version === 'string'
  )
}
