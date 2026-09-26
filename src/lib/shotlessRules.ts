import type { Track } from '../types.ts'

export const SHOTLESS_STAGES = [
  { index: 0, durationMs: 100, penalty: 'Shot' },
  { index: 1, durationMs: 1_000, penalty: '5 Schlücke' },
  { index: 2, durationMs: 3_000, penalty: '3 Schlücke' },
  { index: 3, durationMs: 8_000, penalty: '1 Schluck' },
] as const

export type ShotlessStage = (typeof SHOTLESS_STAGES)[number]
export type ShotlessMode = 'tippen' | 'party'
export type PenaltyTone = 'shot' | 'heavy' | 'mid' | 'light'

export const TIPPEN_GUESSER = 'dir'
export const EVERYONE_SHOT_MESSAGE = 'Alle trinken einen Shot'

/** Anteil der Titellänge, an dem ein Clip bevorzugt einsetzt. */
export const CLIP_START_RATIO = 0.3
/** Intros sind oft still — mindestens so weit in den Titel springen, wenn er lang genug ist. */
export const MIN_INTRO_SKIP_MS = 15_000
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
}

export type ShotlessCommand =
  | { type: 'skip' }
  | { type: 'submit-guess'; guess: string; title: string }
  | { type: 'claim' }
  | { type: 'assign'; name: string }
  | { type: 'nobody' }
  | { type: 'replay' }
  | { type: 'next'; trackCount: number }

export interface TitleSuggestion {
  title: string
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

export function clipStartMs(
  durationMs: number,
  longestClipMs: number = SHOTLESS_STAGES[SHOTLESS_STAGES.length - 1].durationMs,
): number {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return 0
  }
  const needed = longestClipMs + CLIP_TAIL_BUFFER_MS
  if (durationMs <= needed) {
    return 0
  }
  const preferred = Math.max(MIN_INTRO_SKIP_MS, Math.floor(durationMs * CLIP_START_RATIO))
  const maxStart = durationMs - needed
  return Math.min(preferred, maxStart)
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

export function suggestSongTitles(
  tracks: readonly Pick<Track, 'title'>[],
  query: string,
  limit = 6,
): TitleSuggestion[] {
  const needle = normalizeSongTitle(query)
  if (needle.length < 2) {
    return []
  }
  const seen = new Set<string>()
  const matches: TitleSuggestion[] = []
  for (const track of tracks) {
    const key = normalizeSongTitle(track.title)
    if (!key.includes(needle) || seen.has(key)) {
      continue
    }
    seen.add(key)
    matches.push({ title: track.title })
    if (matches.length >= limit) {
      break
    }
  }
  return matches
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

export function createShotlessRound(): ShotlessRound {
  return {
    trackIndex: 0,
    stageIndex: 0,
    view: 'guessing',
    feedback: null,
    revealMessage: null,
    replayNonce: 0,
  }
}

export function reduceShotlessRound(round: ShotlessRound, command: ShotlessCommand): ShotlessRound {
  if (command.type === 'next') {
    return advanceTrack(round, command.trackCount)
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
    return submitGuess(round, command.guess, command.title)
  }
  if (command.type === 'claim') {
    return claimRound(round)
  }
  if (command.type === 'assign') {
    return assignGuesser(round, command.name)
  }
  return round
}

function advanceTrack(round: ShotlessRound, trackCount: number): ShotlessRound {
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

function submitGuess(round: ShotlessRound, guess: string, title: string): ShotlessRound {
  if (round.view !== 'guessing') {
    return round
  }
  if (!normalizeSongTitle(guess)) {
    return round
  }
  if (titlesMatch(guess, title)) {
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
