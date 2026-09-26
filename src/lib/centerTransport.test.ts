import { describe, expect, it } from 'vitest'
import { centerTransportCue } from './centerTransport.ts'

describe('centerTransportCue', () => {
  it('uses a play icon labelled Abspielen before the round starts', () => {
    expect(centerTransportCue({ running: false, paused: false, phase: 'idle' })).toEqual({
      icon: 'play',
      label: 'Abspielen',
      action: 'start',
    })
  })

  it('uses a pause icon while the phase timer is running', () => {
    for (const phase of ['playing', 'thinking', 'reveal'] as const) {
      expect(centerTransportCue({ running: true, paused: false, phase })).toEqual({
        icon: 'pause',
        label: 'Pause',
        action: 'pause',
      })
    }
  })

  it('pauses and resumes Denkzeit instead of skipping to the reveal', () => {
    const running = centerTransportCue({ running: true, paused: false, phase: 'thinking' })
    const paused = centerTransportCue({ running: true, paused: true, phase: 'thinking' })
    expect(running.action).toBe('pause')
    expect(paused.action).toBe('resume')
    expect(running.action).not.toBe('resume')
    expect([running.action, paused.action]).not.toContain('reveal')
  })

  it('uses a play icon labelled Weiter when the round is paused', () => {
    for (const phase of ['playing', 'thinking', 'reveal'] as const) {
      expect(centerTransportCue({ running: true, paused: true, phase })).toEqual({
        icon: 'play',
        label: 'Weiter',
        action: 'resume',
      })
    }
  })
})
