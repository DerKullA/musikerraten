import { describe, expect, it } from 'vitest'
import {
  CLIP_LEAD_IN_MS,
  SHOTLESS_STAGES,
  artistsMatch,
  clipStartMs,
  formatClipLength,
  guessFieldLabel,
  guessTargetRevealLine,
  isCorrectGuess,
  isLastShotlessStage,
  normalizeSongTitle,
  penaltyTone,
  pickClipOrigin,
  skipControlLabel,
  stageByIndex,
  stageStatusLabel,
  titlesMatch,
} from './rules.ts'

describe('shotlessRules: Stufen', () => {
  it('hat vier Stufen mit wachsender Clip-Länge', () => {
    expect(SHOTLESS_STAGES.map((stage) => [stage.durationMs, stage.penalty])).toEqual([
      [1_000, 'Shot'],
      [2_000, '5 Schlücke'],
      [4_000, '3 Schlücke'],
      [8_000, '1 Schluck'],
    ])
  })

  it('findet Stufen per Index und wirft bei unbekanntem Index', () => {
    expect(stageByIndex(2).penalty).toBe('3 Schlücke')
    expect(() => stageByIndex(4)).toThrow('Unbekannte Shotless-Stufe.')
    expect(() => stageByIndex(-1)).toThrow()
  })

  it('erkennt die letzte Stufe', () => {
    expect(isLastShotlessStage(2)).toBe(false)
    expect(isLastShotlessStage(3)).toBe(true)
    expect(isLastShotlessStage(7)).toBe(true)
  })

  it('beschriftet Stufen und Überspringen-Knopf', () => {
    expect(stageStatusLabel(stageByIndex(0))).toBe('Stufe 1 von 4 · 1 s')
    expect(stageStatusLabel(stageByIndex(3))).toBe('Stufe 4 von 4 · 8 s')
    expect(skipControlLabel(0)).toBe('Länger hören')
    expect(skipControlLabel(3)).toBe('Aufgeben')
  })

  it('formatiert Clip-Längen mit deutschem Komma', () => {
    expect(formatClipLength(2_000)).toBe('2 s')
    expect(formatClipLength(1_500)).toBe('1,5 s')
    expect(formatClipLength(2_250)).toBe('2,3 s')
  })

  it('ordnet Strafen Farbtönen zu', () => {
    expect(penaltyTone('Shot')).toBe('shot')
    expect(penaltyTone('5 Schlücke')).toBe('heavy')
    expect(penaltyTone('3 Schlücke')).toBe('mid')
    expect(penaltyTone('1 Schluck')).toBe('light')
    expect(penaltyTone('irgendwas')).toBe('light')
  })
})

describe('shotlessRules: Clip-Start', () => {
  it('wählt den Ursprung gleichverteilt aus dem Zufallswert', () => {
    expect(pickClipOrigin(() => 0)).toBe('anfang')
    expect(pickClipOrigin(() => 0.34)).toBe('mitte')
    expect(pickClipOrigin(() => 0.99)).toBe('drop')
    expect(pickClipOrigin(() => 1)).toBe('drop')
    expect(pickClipOrigin(() => -3)).toBe('anfang')
  })

  it('berechnet Startpositionen je Ursprung bei einem 3-Minuten-Titel', () => {
    const duration = 180_000
    expect(clipStartMs(duration, 'anfang')).toBe(CLIP_LEAD_IN_MS)
    expect(clipStartMs(duration, 'mitte')).toBe(90_000)
    expect(clipStartMs(duration, 'drop')).toBe(122_400)
  })

  it('hält Platz für den längsten Clip plus Puffer vor dem Titelende', () => {
    // maxStart = 20_000 - 8_000 - 2_000
    expect(clipStartMs(20_000, 'drop')).toBe(10_000)
    expect(clipStartMs(20_000, 'mitte')).toBe(10_000)
    expect(clipStartMs(11_000, 'anfang')).toBe(1_000)
  })

  it('startet bei kurzen oder ungültigen Längen bei 0', () => {
    expect(clipStartMs(5_000, 'drop')).toBe(0)
    expect(clipStartMs(0, 'mitte')).toBe(0)
    expect(clipStartMs(-1, 'mitte')).toBe(0)
    expect(clipStartMs(Number.NaN, 'anfang')).toBe(0)
    expect(clipStartMs(Number.POSITIVE_INFINITY, 'anfang')).toBe(0)
  })
})

describe('shotlessRules: Titel- und Interpretenvergleich', () => {
  it('normalisiert Klammern, Featurings, Akzente und Sonderzeichen', () => {
    expect(normalizeSongTitle('Héllo (Remastered 2011)')).toBe('hello')
    expect(normalizeSongTitle('Song [Live]')).toBe('song')
    expect(normalizeSongTitle('Song (feat. Someone)')).toBe('song')
    expect(normalizeSongTitle('Song - feat. Someone Else')).toBe('song')
    expect(normalizeSongTitle('Song ft. Someone')).toBe('song')
    expect(normalizeSongTitle("Don't Stop!")).toBe('dont stop')
    expect(normalizeSongTitle('  A   B  ')).toBe('a b')
    expect(normalizeSongTitle('Rock’n’Roll')).toBe('rocknroll')
    expect(normalizeSongTitle('')).toBe('')
  })

  it('vergleicht Titel normalisiert, leere Eingaben passen nie', () => {
    expect(titlesMatch('hello', 'Hello (Remastered)')).toBe(true)
    expect(titlesMatch('hallo', 'Hello')).toBe(false)
    expect(titlesMatch('', '')).toBe(false)
    expect(titlesMatch('(live)', '(studio)')).toBe(false)
  })

  it('vergleicht Interpreten gegen den Gesamtnamen und jeden kommagetrennten Teil', () => {
    expect(artistsMatch('queen', 'Queen')).toBe(true)
    expect(artistsMatch('david bowie', 'Queen, David Bowie')).toBe(true)
    // IST: Das Komma fällt bei der Normalisierung weg, der Gesamtname passt daher auch ohne Komma.
    expect(artistsMatch('queen david bowie', 'Queen, David Bowie')).toBe(true)
    expect(artistsMatch('', 'Queen')).toBe(false)
    expect(artistsMatch('bowie', 'Queen, David Bowie')).toBe(false)
  })

  it('bewertet Tipps je Ziel, null heißt leere Eingabe', () => {
    const track = { title: 'Under Pressure', artist: 'Queen, David Bowie' }
    const guess = (text: string, artistText = '') => ({ text, artistText })
    expect(isCorrectGuess(guess('under pressure'), track, 'title')).toBe(true)
    expect(isCorrectGuess(guess('queen'), track, 'title')).toBe(false)
    expect(isCorrectGuess(guess(''), track, 'title')).toBeNull()
    expect(isCorrectGuess(guess('Bowie'), track, 'artist')).toBe(false)
    expect(isCorrectGuess(guess('david bowie'), track, 'artist')).toBe(true)
    expect(isCorrectGuess(guess('queen'), track, 'either')).toBe(true)
    expect(isCorrectGuess(guess('under pressure'), track, 'either')).toBe(true)
    expect(isCorrectGuess(guess('foo'), track, 'either')).toBe(false)
    expect(isCorrectGuess(guess('   '), track, 'either')).toBeNull()
    expect(isCorrectGuess(guess('under pressure', 'queen'), track, 'both')).toBe(true)
    expect(isCorrectGuess(guess('under pressure', 'foo'), track, 'both')).toBe(false)
    expect(isCorrectGuess(guess('under pressure', ''), track, 'both')).toBeNull()
    expect(isCorrectGuess(guess('', 'queen'), track, 'both')).toBeNull()
  })

  it('liefert Auflösungs- und Feldtexte je Ziel', () => {
    expect(guessTargetRevealLine('title')).toBe('Gesucht war der Titel')
    expect(guessTargetRevealLine('artist')).toBe('Gesucht war der Interpret')
    expect(guessTargetRevealLine('either')).toBe('Titel oder Interpret hat gereicht')
    expect(guessTargetRevealLine('both')).toBe('Titel und Interpret waren nötig')
    expect(guessFieldLabel('title')).toBe('Songtitel')
    expect(guessFieldLabel('artist')).toBe('Interpret')
    expect(guessFieldLabel('either')).toBe('Titel oder Interpret')
    expect(guessFieldLabel('both')).toBe('Titel und Interpret')
  })
})
