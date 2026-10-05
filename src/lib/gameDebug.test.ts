import { afterEach, describe, expect, it } from 'vitest'
import { reportClientError, resetClientLogForTests, setClientLogSenderForTests } from './clientLog.ts'
import {
  clearGameDebugLog,
  formatGameDebugLog,
  gameDebugChanges,
  installGameDebug,
  isGameDebugEnabled,
  readGameDebugLog,
  resetGameDebugForTests,
  setGameDebugEnabled,
  traceGame,
} from './gameDebug.ts'
import { formatPlayMinute, songLoadLine, traceSongLoad } from './gameDebugSong.ts'

afterEach(() => {
  resetGameDebugForTests()
  resetClientLogForTests()
})

describe('gameDebugChanges', () => {
  it('liefert beim ersten Stand alles und danach nur Änderungen', () => {
    const first = gameDebugChanges(null, { phase: 'idle', index: 0 })
    expect(first).toEqual({ phase: 'idle', index: 0 })
    expect(gameDebugChanges({ phase: 'idle', index: 0 }, { phase: 'playing', index: 0 })).toEqual({
      phase: 'playing',
    })
    expect(gameDebugChanges({ phase: 'playing' }, { phase: 'playing' })).toBeNull()
  })
})

describe('Spiellog', () => {
  it('schreibt nur bei aktivem Schalter und schwärzt Geheimnisse', () => {
    traceGame('runde', { aktion: 'starten' })
    expect(readGameDebugLog()).toHaveLength(0)

    const api = installGameDebug('?debug=1')
    expect(api.istAn()).toBe(true)
    expect(formatGameDebugLog()).toContain('aktiv=true')

    traceGame('runde', { aktion: 'starten', hinweis: 'Bearer super-token' })
    traceGame('runde', { aktion: 'starten', hinweis: 'Bearer super-token' })
    const text = formatGameDebugLog()
    expect(text).toContain('aktion=starten')
    expect(text).toContain('bearer [redacted]')
    expect(text).not.toContain('super-token')
    expect(text.match(/aktion=starten/g)).toHaveLength(1)

    api.aus()
    expect(isGameDebugEnabled()).toBe(false)
    traceGame('runde', { aktion: 'stopp' })
    expect(formatGameDebugLog()).not.toContain('aktion=stopp')
    expect(formatGameDebugLog()).toContain('aktiv=false')
  })

  it('übernimmt Fehler aus dem Client-Log', () => {
    setClientLogSenderForTests(() => undefined)
    setGameDebugEnabled(true)
    clearGameDebugLog()
    reportClientError('access_token=geheim', {
      source: 'playback',
      action: 'play',
      phase: 'playing',
      uri: 'spotify:track:1',
    })
    const entry = readGameDebugLog().find((item) => item.event === 'fehler')
    expect(entry?.detail).toMatchObject({
      stufe: 'error',
      meldung: 'access_token=[redacted]',
      quelle: 'playback',
      aktion: 'play',
      phase: 'playing',
      uri: 'spotify:track:1',
    })
    expect(String(entry?.detail.meldung)).not.toContain('geheim')
  })

  it('nennt Song und Spielminute in der Ladezeile', () => {
    expect(formatPlayMinute(0)).toBe('0 (0:00)')
    expect(formatPlayMinute(134_000)).toBe('2 (2:14)')
    expect(
      songLoadLine({
        art: 'prime',
        titel: 'Yesterday',
        interpret: 'The Beatles',
        uri: 'spotify:track:1',
        positionMs: 134_000,
      }),
    ).toBe('[spiellog] Song geladen: The Beatles – Yesterday, Spielminute 2 (2:14)')

    traceSongLoad({
      art: 'play',
      titel: 'Yesterday',
      interpret: 'The Beatles',
      uri: 'spotify:track:1',
      positionMs: 134_000,
    })
    expect(readGameDebugLog()).toHaveLength(0)

    setGameDebugEnabled(true)
    clearGameDebugLog()
    traceSongLoad({
      art: 'play',
      titel: 'Yesterday',
      interpret: 'The Beatles',
      uri: 'spotify:track:1',
      positionMs: 134_000,
    })
    expect(readGameDebugLog().at(-1)?.detail).toMatchObject({
      art: 'play',
      titel: 'Yesterday',
      spielminute: '2 (2:14)',
      positionMs: 134_000,
    })
  })

  it('schaltet das Log über die Adresse aus', () => {
    setGameDebugEnabled(true)
    installGameDebug('?debug=0')
    expect(isGameDebugEnabled()).toBe(false)
  })
})
