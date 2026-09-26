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

  it('uses a pause icon while audio should be playing', () => {
    expect(centerTransportCue({ running: true, paused: false, phase: 'playing' })).toEqual({
      icon: 'pause',
      label: 'Pause',
      action: 'pause',
    })
    expect(centerTransportCue({ running: true, paused: false, phase: 'reveal' })).toEqual({
      icon: 'pause',
      label: 'Pause',
      action: 'pause',
    })
  })

  it('uses a play icon during Denkzeit and does not label it Weiter', () => {
    const cue = centerTransportCue({ running: true, paused: false, phase: 'thinking' })
    expect(cue).toEqual({
      icon: 'play',
      label: 'Abspielen',
      action: 'reveal',
    })
    expect(cue.label).not.toBe('Weiter')
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
