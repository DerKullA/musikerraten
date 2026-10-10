import { describe, expect, it } from 'vitest'
import {
  PLAY_MS,
  REVEAL_MS,
  THINK_MS,
  formatTrackDuration,
  isTitleHidden,
  nextPhase,
  phaseDuration,
  phaseLabel,
  phasePlaysAudio,
} from './gameLoop.ts'
import type { PhaseTimings } from '@/ui/phaseTimings.ts'

const NO_THINK: PhaseTimings = { playMs: 5_000, thinkMs: 0, revealMs: 4_000 }

describe('gameLoop', () => {
  it('leitet die Standarddauern aus den Standard-Timings ab', () => {
    expect([PLAY_MS, THINK_MS, REVEAL_MS]).toEqual([11_000, 3_000, 8_000])
  })

  it('formatiert Titellängen als m:ss und schneidet Sekundenbruchteile ab', () => {
    expect(formatTrackDuration(0)).toBe('0:00')
    expect(formatTrackDuration(999)).toBe('0:00')
    expect(formatTrackDuration(61_999)).toBe('1:01')
    expect(formatTrackDuration(600_000)).toBe('10:00')
    expect(formatTrackDuration(-5_000)).toBe('0:00')
  })

  it('liefert pro Phase die Dauer, im Leerlauf 0', () => {
    expect(phaseDuration('playing')).toBe(11_000)
    expect(phaseDuration('thinking')).toBe(3_000)
    expect(phaseDuration('reveal')).toBe(8_000)
    expect(phaseDuration('idle')).toBe(0)
    expect(phaseDuration('playing', NO_THINK)).toBe(5_000)
    expect(phaseDuration('reveal', NO_THINK)).toBe(4_000)
  })

  it('schaltet playing -> thinking -> reveal -> playing weiter', () => {
    expect(nextPhase('playing')).toBe('thinking')
    expect(nextPhase('thinking')).toBe('reveal')
    expect(nextPhase('reveal')).toBe('playing')
    expect(nextPhase('idle')).toBe('playing')
  })

  it('überspringt thinking bei 0 Sekunden Nachdenkzeit', () => {
    expect(nextPhase('playing', NO_THINK)).toBe('reveal')
    expect(nextPhase('thinking', NO_THINK)).toBe('reveal')
  })

  it('beschriftet Phasen, Pause hat Vorrang', () => {
    expect(phaseLabel('idle')).toBe('Bereit')
    expect(phaseLabel('playing')).toBe('Abspielen')
    expect(phaseLabel('thinking')).toBe('Nachdenken')
    expect(phaseLabel('reveal')).toBe('Auflösung')
    expect(phaseLabel('playing', true)).toBe('Pausiert')
    expect(phaseLabel('idle', true)).toBe('Pausiert')
  })

  it('verbirgt den Titel bis zur Auflösung', () => {
    expect(isTitleHidden('idle')).toBe(true)
    expect(isTitleHidden('playing')).toBe(true)
    expect(isTitleHidden('thinking')).toBe(true)
    expect(isTitleHidden('reveal')).toBe(false)
  })

  it('spielt nur in playing und reveal Audio', () => {
    expect(phasePlaysAudio('playing')).toBe(true)
    expect(phasePlaysAudio('reveal')).toBe(true)
    expect(phasePlaysAudio('thinking')).toBe(false)
    expect(phasePlaysAudio('idle')).toBe(false)
  })
})
