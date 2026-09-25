import type { GamePhase } from '../types.ts'

export type TransportIconName = 'play' | 'pause'
export type TransportAction = 'start' | 'pause' | 'resume' | 'reveal'
export type TransportLabel = 'Abspielen' | 'Pause' | 'Weiter'

export interface CenterTransportCue {
  icon: TransportIconName
  label: TransportLabel
  action: TransportAction
}

export function centerTransportCue(input: {
  running: boolean
  paused: boolean
  phase: GamePhase
}): CenterTransportCue {
  if (!input.running || input.phase === 'idle') {
    return { icon: 'play', label: 'Abspielen', action: 'start' }
  }
  if (input.paused) {
    return { icon: 'play', label: 'Weiter', action: 'resume' }
  }
  if (input.phase === 'thinking') {
    return { icon: 'play', label: 'Abspielen', action: 'reveal' }
  }
  return { icon: 'pause', label: 'Pause', action: 'pause' }
}
