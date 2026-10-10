import { describe, expect, it } from 'vitest'
import { trackAfter } from './trackAfter.ts'

const queue = [{ uri: 'a' }, { uri: 'b' }, { uri: 'c' }]

describe('trackAfter', () => {
  it('liefert den folgenden Titel', () => {
    expect(trackAfter(queue, 'a')).toBe('b')
    expect(trackAfter(queue, 'b')).toBe('c')
  })

  it('springt am Ende auf den ersten Titel', () => {
    expect(trackAfter(queue, 'c')).toBe('a')
  })

  it('liefert null für unbekannte URI, einzelne Titel und leere Listen', () => {
    expect(trackAfter(queue, 'x')).toBeNull()
    expect(trackAfter([{ uri: 'a' }], 'a')).toBeNull()
    expect(trackAfter([], 'a')).toBeNull()
  })

  it('liefert null, wenn der Nachfolger dieselbe URI hat', () => {
    expect(trackAfter([{ uri: 'a' }, { uri: 'a' }], 'a')).toBeNull()
  })
})
