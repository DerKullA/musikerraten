import { describe, expect, it } from 'vitest'
import { centerTransportCue } from './centerTransport.ts'

describe('centerTransportCue', () => {
  it('zeigt Abspielen, solange keine Runde läuft oder die Phase idle ist', () => {
    const start = { icon: 'play', label: 'Abspielen', action: 'start' }
    expect(centerTransportCue({ running: false, paused: false, phase: 'playing' })).toEqual(start)
    expect(centerTransportCue({ running: true, paused: false, phase: 'idle' })).toEqual(start)
    expect(centerTransportCue({ running: true, paused: true, phase: 'idle' })).toEqual(start)
  })

  it('zeigt Weiter bei Pause', () => {
    expect(centerTransportCue({ running: true, paused: true, phase: 'thinking' })).toEqual({
      icon: 'play',
      label: 'Weiter',
      action: 'resume',
    })
  })

  it('zeigt Pause während der laufenden Wiedergabe', () => {
    expect(centerTransportCue({ running: true, paused: false, phase: 'reveal' })).toEqual({
      icon: 'pause',
      label: 'Pause',
      action: 'pause',
    })
  })
})
