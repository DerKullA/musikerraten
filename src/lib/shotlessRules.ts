import type { Track } from '../types.ts'

export const SHOTLESS_STAGES = [
  { index: 0, durationMs: 100, penalty: 'Shot' },
  { index: 1, durationMs: 1_000, penalty: '5 Schlücke' },
  { index: 2, durationMs: 3_000, penalty: '3 Schlücke' },
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

export function penaltyPrompt(penalty: string): string {
  return `Wenn jetzt erraten wird: ${penalty}`
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

export function suggestSongTitles(
  tracks: readonly Pick<Track, 'title'>[],
  query: string,
  limit = 6,
): TitleSuggestion[] {
  return suggestGuesses(tracks, query, 'title', limit).map((entry) => ({ title: entry.label }))
}

export function suggestGuesses(
  tracks: readonly { title: string; artist?: string }[],
  query: string,
  field: 'title' | 'artist' | 'either',
  limit = 6,
): GuessSuggestion[] {
  const needle = normalizeSongTitle(query)
  if (needle.length < 2) {
    return []
  }
  const matches: GuessSuggestion[] = []
  const seen = new Set<string>()
  function push(label: string, suggestionField: 'title' | 'artist'): void {
    const key = `${suggestionField}:${normalizeSongTitle(label)}`
    if (!normalizeSongTitle(label).includes(needle) || seen.has(key) || matches.length >= limit) {
      return
    }
    seen.add(key)
    matches.push({ label, field: suggestionField })
  }
  if (field !== 'artist') {
    for (const track of tracks) {
      push(track.title, 'title')
    }
  }
  if (field !== 'title') {
    for (const track of tracks) {
      for (const label of artistSuggestionLabels(track.artist ?? '', needle)) {
        push(label, 'artist')
      }
    }
  }
  return matches
}

function artistSuggestionLabels(artist: string, needle: string): string[] {
  const parts = artist
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
  const matched = parts.filter((part) => normalizeSongTitle(part).includes(needle))
  if (matched.length > 0) {
    return matched
  }
  if (normalizeSongTitle(artist).includes(needle)) {
    return [artist.trim()]
  }
  return []
}

export function correctDrinkMessage(name: string, penalty: string): string {
  return `Alle außer ${name} trinken: ${penalty}`
}

export function wrongDrinkMessage(penalty: string): string {
  return `Falsch — du trinkst: ${penalty}`
}

export function everyoneShotMessage(): string {
  return EVERYONE_SHOT_MESSAGE
}

export function createShotlessRound(origin: ClipOrigin = 'mitte'): ShotlessRound {
  return {
    trackIndex: 0,
    stageIndex: 0,
    view: 'guessing',
    feedback: null,
    revealMessage: null,
    replayNonce: 0,
    origin,
  }
}

export function reduceShotlessRound(round: ShotlessRound, command: ShotlessCommand): ShotlessRound {
  if (command.type === 'next') {
    return advanceTrack(round, command.trackCount, command.origin)
  }
  if (round.view === 'reveal') {
    return round
  }
  if (command.type === 'skip') {
    return skipStage(round)
  }
  if (command.type === 'replay') {
    return replayStage(round)
  }
  if (command.type === 'nobody') {
    return revealGiveUp(round)
  }
  if (command.type === 'submit-guess') {
    return submitGuess(round, command)
  }
  if (command.type === 'claim') {
    return claimRound(round)
  }
  if (command.type === 'assign') {
    return assignGuesser(round, command.name)
  }
  return round
}

function advanceTrack(round: ShotlessRound, trackCount: number, origin: ClipOrigin): ShotlessRound {
  if (round.view !== 'reveal') {
    return round
  }
  const count = Math.max(1, Math.floor(trackCount))
  return {
    trackIndex: (round.trackIndex + 1) % count,
    stageIndex: 0,
    view: 'guessing',
    feedback: null,
    revealMessage: null,
    replayNonce: round.replayNonce + 1,
    origin,
  }
}

function skipStage(round: ShotlessRound): ShotlessRound {
  if (round.view !== 'guessing') {
    return round
  }
  if (isLastShotlessStage(round.stageIndex)) {
    return revealGiveUp(round)
  }
  return {
    ...round,
    stageIndex: round.stageIndex + 1,
    feedback: null,
    replayNonce: round.replayNonce + 1,
  }
}

function replayStage(round: ShotlessRound): ShotlessRound {
  if (round.view !== 'guessing') {
    return round
  }
  return {
    ...round,
    replayNonce: round.replayNonce + 1,
  }
}

function revealGiveUp(round: ShotlessRound): ShotlessRound {
  return {
    ...round,
    view: 'reveal',
    feedback: null,
    revealMessage: everyoneShotMessage(),
  }
}

function revealCorrect(round: ShotlessRound, name: string): ShotlessRound {
  return {
    ...round,
    view: 'reveal',
    feedback: null,
    revealMessage: correctDrinkMessage(name, stageByIndex(round.stageIndex).penalty),
  }
}

function submitGuess(
  round: ShotlessRound,
  command: Extract<ShotlessCommand, { type: 'submit-guess' }>,
): ShotlessRound {
  if (round.view !== 'guessing') {
    return round
  }
  const verdict = isCorrectGuess(
    { text: command.guess, artistText: command.artistGuess },
    { title: command.title, artist: command.artist },
    command.target,
  )
  if (verdict === null) {
    return round
  }
  if (verdict) {
    return revealCorrect(round, TIPPEN_GUESSER)
  }
  return {
    ...round,
    feedback: wrongDrinkMessage(stageByIndex(round.stageIndex).penalty),
  }
}

function claimRound(round: ShotlessRound): ShotlessRound {
  if (round.view !== 'guessing') {
    return round
  }
  return {
    ...round,
    view: 'pick-player',
    feedback: null,
  }
}

function assignGuesser(round: ShotlessRound, name: string): ShotlessRound {
  if (round.view !== 'pick-player') {
    return round
  }
  const guesser = name.trim()
  if (!guesser) {
    return round
  }
  return revealCorrect(round, guesser)
}
