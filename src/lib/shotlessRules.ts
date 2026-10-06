import type { Track } from '../types.ts'

export const SHOTLESS_STAGES = [
  { index: 0, durationMs: 1_000, penalty: 'Shot' },
  { index: 1, durationMs: 2_000, penalty: '5 Schlücke' },
  { index: 2, durationMs: 4_000, penalty: '3 Schlücke' },
  { index: 3, durationMs: 8_000, penalty: '1 Schluck' },
] as const

export type ShotlessStage = (typeof SHOTLESS_STAGES)[number]
export type ShotlessMode = 'tippen' | 'party'
export type ShotlessGuessTarget = 'title' | 'artist' | 'either' | 'both'

export const SHOTLESS_GUESS_TARGETS = [
  { id: 'title', label: 'Nur Titel' },
  { id: 'artist', label: 'Nur Interpret' },
  { id: 'either', label: 'Titel oder Interpret' },
  { id: 'both', label: 'Titel und Interpret' },
] as const satisfies readonly { id: ShotlessGuessTarget; label: string }[]
export type PenaltyTone = 'shot' | 'heavy' | 'mid' | 'light'

export const TIPPEN_GUESSER = 'dir'
export const EVERYONE_SHOT_MESSAGE = 'Alle trinken einen Shot'

export const CLIP_ORIGINS = ['anfang', 'mitte', 'drop'] as const
export type ClipOrigin = (typeof CLIP_ORIGINS)[number]

/** Kurzer Vorlauf, damit „Anfang“ nicht in reiner Stille landet. */
export const CLIP_LEAD_IN_MS = 2_000
/** Etwa die halbe Titellänge. */
export const CLIP_MIDDLE_RATIO = 0.5
/** Späterer Teil als Hook-Heuristik, ohne Audioanalyse (60–75 %). */
export const CLIP_DROP_RATIO = 0.68
/** Rest nach dem längsten Clip, damit die 8 Sekunden nicht ins Auslaufen laufen. */
export const CLIP_TAIL_BUFFER_MS = 2_000

const FEATURING = String.raw`feat\.?|featuring|ft\.?`

export type ShotlessView = 'guessing' | 'pick-player' | 'reveal'

export interface ShotlessRound {
  trackIndex: number
  stageIndex: number
  view: ShotlessView
  feedback: string | null
  revealMessage: string | null
  winner: string | null
  replayNonce: number
  origin: ClipOrigin
}

export type ShotlessCommand =
  | { type: 'skip' }
  | {
      type: 'submit-guess'
      guess: string
      artistGuess: string
      title: string
      artist: string
      target: ShotlessGuessTarget
    }
  | { type: 'claim' }
  | { type: 'assign'; name: string }
  | { type: 'nobody' }
  | { type: 'wrong-winner' }
  | { type: 'replay' }
  | { type: 'next'; trackCount: number; origin: ClipOrigin }

export interface TitleSuggestion {
  title: string
}

export interface GuessSuggestion {
  label: string
  field: 'title' | 'artist'
}

export interface GuessAttempt {
  text: string
  artistText: string
}

export function stageByIndex(index: number): ShotlessStage {
  const stage = SHOTLESS_STAGES[index]
  if (!stage) {
    throw new Error('Unbekannte Shotless-Stufe.')
  }
  return stage
}

export function isLastShotlessStage(stageIndex: number): boolean {
  return stageIndex >= SHOTLESS_STAGES.length - 1
}

export function formatClipLength(durationMs: number): string {
  if (durationMs % 1000 === 0) {
    return `${durationMs / 1000} s`
  }
  const whole = Math.floor(durationMs / 1000)
  const fraction = Math.round((durationMs % 1000) / 100)
  return `${whole},${fraction} s`
}

export function stageStatusLabel(stage: ShotlessStage): string {
  return `Stufe ${stage.index + 1} von ${SHOTLESS_STAGES.length} · ${formatClipLength(stage.durationMs)}`
}

export function skipControlLabel(stageIndex: number): string {
  return isLastShotlessStage(stageIndex) ? 'Aufgeben' : 'Länger hören'
}

export function penaltyTone(penalty: string): PenaltyTone {
  if (penalty === 'Shot') {
    return 'shot'
  }
  if (penalty.startsWith('5')) {
    return 'heavy'
  }
  if (penalty.startsWith('3')) {
    return 'mid'
  }
  return 'light'
}

export function pickClipOrigin(random: () => number = Math.random): ClipOrigin {
  const index = Math.floor(random() * CLIP_ORIGINS.length)
  return CLIP_ORIGINS[Math.min(CLIP_ORIGINS.length - 1, Math.max(0, index))] ?? 'mitte'
}

export function clipStartMs(durationMs: number, origin: ClipOrigin): number {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return 0
  }
  const maxStart = maxClipStartMs(durationMs)
  if (origin === 'anfang') {
    return Math.min(CLIP_LEAD_IN_MS, maxStart)
  }
  const ratio = origin === 'mitte' ? CLIP_MIDDLE_RATIO : CLIP_DROP_RATIO
  return Math.min(maxStart, Math.floor(durationMs * ratio))
}

function maxClipStartMs(durationMs: number): number {
  const longest = SHOTLESS_STAGES[SHOTLESS_STAGES.length - 1].durationMs
  return Math.max(0, durationMs - longest - CLIP_TAIL_BUFFER_MS)
}

export function normalizeSongTitle(value: string): string {
  const withoutFeaturing = value
    .replace(new RegExp(String.raw`\s*[([]\s*(?:${FEATURING})\s+[^)\]]*[)\]]`, 'gi'), ' ')
    .replace(new RegExp(String.raw`\s+[-–—]\s*(?:${FEATURING})\s+.*$`, 'gi'), ' ')
    .replace(new RegExp(String.raw`\s+(?:${FEATURING})\s+.*$`, 'gi'), ' ')
  const withoutGroups = withoutFeaturing.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
  return withoutGroups
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/['’´`]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function titlesMatch(guess: string, title: string): boolean {
  const left = normalizeSongTitle(guess)
  const right = normalizeSongTitle(title)
  return left.length > 0 && left === right
}

export function artistsMatch(guess: string, artist: string): boolean {
  const left = normalizeSongTitle(guess)
  if (!left) {
    return false
  }
  if (left === normalizeSongTitle(artist)) {
    return true
  }
  return artist
    .split(',')
    .some((part) => normalizeSongTitle(part) === left)
}

export function isCorrectGuess(
  guess: GuessAttempt,
  track: Pick<Track, 'title' | 'artist'>,
  target: ShotlessGuessTarget,
): boolean | null {
  if (target === 'both') {
    if (!normalizeSongTitle(guess.text) || !normalizeSongTitle(guess.artistText)) {
      return null
    }
    return titlesMatch(guess.text, track.title) && artistsMatch(guess.artistText, track.artist)
  }
  if (!normalizeSongTitle(guess.text)) {
    return null
  }
  if (target === 'title') {
    return titlesMatch(guess.text, track.title)
  }
  if (target === 'artist') {
    return artistsMatch(guess.text, track.artist)
  }
  return titlesMatch(guess.text, track.title) || artistsMatch(guess.text, track.artist)
}

export function guessTargetRevealLine(target: ShotlessGuessTarget): string {
  if (target === 'artist') {
    return 'Gesucht war der Interpret'
  }
  if (target === 'either') {
    return 'Titel oder Interpret hat gereicht'
  }
  if (target === 'both') {
    return 'Titel und Interpret waren nötig'
  }
  return 'Gesucht war der Titel'
}

export function guessFieldLabel(target: ShotlessGuessTarget): string {
  if (target === 'artist') {
    return 'Interpret'
  }
  if (target === 'either') {
    return 'Titel oder Interpret'
  }
  if (target === 'both') {
    return 'Titel und Interpret'
  }
  return 'Songtitel'
}

export { suggestGuesses, suggestSongTitles } from './guessSuggestions.ts'

export {
  correctDrinkMessage,
  wrongDrinkMessage,
  everyoneShotMessage,
  wrongWinnerMessage,
  createShotlessRound,
  reduceShotlessRound,
} from './shotlessReducer.ts'

