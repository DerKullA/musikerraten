import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GamePhase } from '@/types.ts'
import { DEFAULT_PHASE_TIMINGS, type PhaseTimings } from '@/ui/phaseTimings.ts'
import {
  CLOCK_CLEARED,
  armClock,
  followingPhasePlan,
  freezeClock,
  isActionAllowed,
  mediaPlaybackFor,
  nextTrackIndex,
  phaseAudioStep,
  phaseEntryMarks,
  phaseEntryPlan,
  phaseTimerPlan,
  remainingFromDeadline,
  resumePlan,
  snippetAudible,
  type RoundAction,
  type RoundState,
} from './roundTransitions.ts'

const PHASES: GamePhase[] = ['idle', 'playing', 'thinking', 'reveal']
const NO_THINKING: PhaseTimings = { ...DEFAULT_PHASE_TIMINGS, thinkMs: 0 }

function state(overrides: Partial<RoundState> = {}): RoundState {
  return { running: true, paused: false, phase: 'playing', trackCount: 5, ...overrides }
}

function allowedPhases(action: RoundAction, overrides: Partial<RoundState> = {}): GamePhase[] {
  return PHASES.filter((phase) => isActionAllowed(action, state({ ...overrides, phase })))
}

describe('isActionAllowed', () => {
  it('Starten braucht nur Titel', () => {
    expect(isActionAllowed('play', state({ running: false, phase: 'idle' }))).toBe(true)
    expect(isActionAllowed('play', state({ trackCount: 0 }))).toBe(false)
  })

  it('Nochmal und Auflösen gehen nur in Abspielen und Nachdenken', () => {
    expect(allowedPhases('restart')).toEqual(['playing', 'thinking'])
    expect(allowedPhases('reveal')).toEqual(['playing', 'thinking'])
    expect(allowedPhases('restart', { running: false })).toEqual([])
    expect(allowedPhases('reveal', { running: false })).toEqual([])
    expect(isActionAllowed('restart', state({ trackCount: 0 }))).toBe(false)
    // Auflösen prüft die Titelzahl nicht (wie bisher).
    expect(isActionAllowed('reveal', state({ trackCount: 0 }))).toBe(true)
  })

  it('Nächster geht nur in der Auflösung', () => {
    expect(allowedPhases('skip-next')).toEqual(['reveal'])
    expect(allowedPhases('skip-next', { running: false })).toEqual([])
  })

  it('Force-Skip braucht nur eine laufende Runde, in jeder Phase', () => {
    expect(allowedPhases('force-skip')).toEqual(PHASES)
    expect(allowedPhases('force-skip', { running: false })).toEqual([])
  })

  it('Pause geht laufend, nicht pausiert und nicht in Bereit', () => {
    expect(allowedPhases('pause')).toEqual(['playing', 'thinking', 'reveal'])
    expect(allowedPhases('pause', { paused: true })).toEqual([])
    expect(allowedPhases('pause', { running: false })).toEqual([])
  })

  it('Weiter geht nur laufend und pausiert', () => {
    expect(isActionAllowed('resume', state({ paused: true }))).toBe(true)
    expect(isActionAllowed('resume', state({ paused: false }))).toBe(false)
    expect(isActionAllowed('resume', state({ paused: true, running: false }))).toBe(false)
  })

  it('Phasenwechsel sind laufend und ohne Pause erlaubt', () => {
    expect(isActionAllowed('enter-phase', state())).toBe(true)
    expect(isActionAllowed('enter-phase', state({ paused: true }))).toBe(false)
    expect(isActionAllowed('enter-phase', state({ running: false }))).toBe(false)
  })
})

describe('nextTrackIndex', () => {
  it('zählt hoch und springt nach dem letzten Titel auf 0', () => {
    expect(nextTrackIndex(0, 3)).toBe(1)
    expect(nextTrackIndex(1, 3)).toBe(2)
    expect(nextTrackIndex(2, 3)).toBe(0)
  })

  it('bleibt bei einem einzelnen Titel auf 0', () => {
    expect(nextTrackIndex(0, 1)).toBe(0)
  })

  it('fällt bei leerer Liste auf 0', () => {
    expect(nextTrackIndex(0, 0)).toBe(0)
  })
})

describe('Phasen-Uhr', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('armClock setzt Deadline und Restzeit', () => {
    const now = Date.now()
    expect(armClock(11_000, now)).toEqual({ remainingMs: 11_000, deadline: now + 11_000 })
  })

  it('Restzeit schrumpft mit der Uhr und wird nie negativ', () => {
    const clock = armClock(10_000, Date.now())
    vi.advanceTimersByTime(4_000)
    expect(remainingFromDeadline(clock, Date.now())).toBe(6_000)
    vi.advanceTimersByTime(20_000)
    expect(remainingFromDeadline(clock, Date.now())).toBe(0)
  })

  it('ohne Deadline gilt die gemerkte Restzeit', () => {
    expect(remainingFromDeadline({ remainingMs: 2_500, deadline: null }, Date.now())).toBe(2_500)
    expect(remainingFromDeadline(CLOCK_CLEARED, Date.now())).toBe(0)
  })

  it('Pause friert die Restzeit ein und verwirft die Deadline', () => {
    const clock = armClock(8_000, Date.now())
    vi.advanceTimersByTime(3_000)
    const frozen = freezeClock(clock, Date.now())
    expect(frozen).toEqual({ remainingMs: 5_000, deadline: null })
    vi.advanceTimersByTime(60_000)
    expect(remainingFromDeadline(frozen, Date.now())).toBe(5_000)
  })

  it('doppeltes Einfrieren ändert die Restzeit nicht', () => {
    const frozen = freezeClock(armClock(8_000, Date.now()), Date.now())
    vi.advanceTimersByTime(1_000)
    expect(freezeClock(frozen, Date.now())).toEqual(frozen)
  })

  it('Weiter nach Pause: neue Deadline aus der Restzeit', () => {
    const frozen = freezeClock(armClock(8_000, Date.now()), Date.now() + 3_000)
    vi.advanceTimersByTime(30_000)
    const resumed = armClock(frozen.remainingMs, Date.now())
    vi.advanceTimersByTime(2_000)
    expect(remainingFromDeadline(resumed, Date.now())).toBe(3_000)
  })
})

describe('Phasenfolge und Timer-Plan', () => {
  it('folgt playing -> thinking -> reveal -> playing', () => {
    expect(followingPhasePlan('playing', DEFAULT_PHASE_TIMINGS)).toEqual({ next: 'thinking', delayMs: 11_000 })
    expect(followingPhasePlan('thinking', DEFAULT_PHASE_TIMINGS)).toEqual({ next: 'reveal', delayMs: 3_000 })
    expect(followingPhasePlan('reveal', DEFAULT_PHASE_TIMINGS)).toEqual({ next: 'playing', delayMs: 8_000 })
  })

  it('überspringt Nachdenken bei Denkzeit 0', () => {
    expect(followingPhasePlan('playing', NO_THINKING)).toEqual({ next: 'reveal', delayMs: 11_000 })
    expect(followingPhasePlan('reveal', NO_THINKING).next).toBe('playing')
  })

  it('Bereit hat keine Dauer und führt in Abspielen', () => {
    expect(followingPhasePlan('idle', DEFAULT_PHASE_TIMINGS)).toEqual({ next: 'playing', delayMs: 0 })
  })

  it('phaseTimerPlan nutzt die vorgegebene Zeit', () => {
    expect(phaseTimerPlan('thinking', 1_234, DEFAULT_PHASE_TIMINGS)).toEqual({ next: 'reveal', delayMs: 1_234 })
  })
})

describe('resumePlan', () => {
  it('geht ohne Restzeit direkt in die nächste Phase', () => {
    expect(resumePlan('playing', 0, DEFAULT_PHASE_TIMINGS)).toEqual({ kind: 'advance', next: 'thinking' })
    expect(resumePlan('playing', 0, NO_THINKING)).toEqual({ kind: 'advance', next: 'reveal' })
    expect(resumePlan('reveal', -5, DEFAULT_PHASE_TIMINGS)).toEqual({ kind: 'advance', next: 'playing' })
  })

  it('setzt mit Restzeit fort und spielt nur in Abspielen/Auflösung Audio weiter', () => {
    expect(resumePlan('playing', 4_000, DEFAULT_PHASE_TIMINGS)).toEqual({
      kind: 'continue',
      resumeAudio: true,
      remainingMs: 4_000,
    })
    expect(resumePlan('reveal', 1, DEFAULT_PHASE_TIMINGS)).toMatchObject({ resumeAudio: true })
    expect(resumePlan('thinking', 2_000, DEFAULT_PHASE_TIMINGS)).toMatchObject({ resumeAudio: false })
  })
})

describe('Phaseneintritt', () => {
  it('wählt nur beim Eintritt in Abspielen den nächsten Titel', () => {
    expect(PHASES.filter((phase) => phaseEntryPlan(phase).advanceTrack)).toEqual(['playing'])
  })

  it('setzt Marker je Phase zurück', () => {
    expect(phaseEntryPlan('playing')).toEqual({ advanceTrack: true, clearSnippetReady: true, clearAudiblePlay: true })
    expect(phaseEntryPlan('thinking')).toEqual({ advanceTrack: false, clearSnippetReady: true, clearAudiblePlay: false })
    expect(phaseEntryPlan('reveal')).toEqual({ advanceTrack: false, clearSnippetReady: false, clearAudiblePlay: false })
    expect(phaseEntryPlan('idle')).toEqual({ advanceTrack: false, clearSnippetReady: false, clearAudiblePlay: false })
  })

  it('wählt den Audio-Schritt', () => {
    expect(phaseAudioStep('playing', false)).toBe('play-current')
    expect(phaseAudioStep('reveal', false)).toBe('resume')
    expect(phaseAudioStep('thinking', false)).toBe('pause')
    expect(phaseAudioStep('idle', false)).toBe('pause')
    for (const phase of PHASES) {
      expect(phaseAudioStep(phase, true)).toBe('pause')
    }
  })

  it('markiert hörbar/Ausschnitt nur, wenn die Phase noch stimmt', () => {
    expect(phaseEntryMarks('playing', 'playing', true)).toEqual({ audiblePlay: true, snippetReady: false })
    expect(phaseEntryMarks('playing', 'playing', false)).toEqual({ audiblePlay: false, snippetReady: false })
    expect(phaseEntryMarks('playing', 'reveal', true)).toEqual({ audiblePlay: false, snippetReady: false })
    expect(phaseEntryMarks('thinking', 'thinking', false)).toEqual({ audiblePlay: false, snippetReady: true })
    expect(phaseEntryMarks('thinking', 'idle', true)).toEqual({ audiblePlay: false, snippetReady: false })
    expect(phaseEntryMarks('reveal', 'reveal', true)).toEqual({ audiblePlay: false, snippetReady: false })
  })

  it('snippetAudible braucht gestartete Wiedergabe in Abspielen', () => {
    expect(snippetAudible(true, 'playing')).toBe(true)
    expect(snippetAudible(false, 'playing')).toBe(false)
    expect(snippetAudible(true, 'thinking')).toBe(false)
  })
})

describe('mediaPlaybackFor', () => {
  it('spielt nur in Abspielen/Auflösung und nie pausiert', () => {
    expect(mediaPlaybackFor('playing', false)).toBe('playing')
    expect(mediaPlaybackFor('reveal', false)).toBe('playing')
    expect(mediaPlaybackFor('thinking', false)).toBe('paused')
    expect(mediaPlaybackFor('idle', false)).toBe('paused')
    expect(mediaPlaybackFor('playing', true)).toBe('paused')
    expect(mediaPlaybackFor('reveal', true)).toBe('paused')
  })
})
