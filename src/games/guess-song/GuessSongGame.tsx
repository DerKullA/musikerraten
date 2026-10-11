import type { GameScreenProps } from '@/games/registry.ts'
import { useWakeLock } from '@/platform/wakeLock/useWakeLock.ts'
import { GuessSongScreen } from './GuessSongScreen.tsx'
import { useGuessSongRound } from './useGuessSongRound.ts'

// Song erraten als Registry-Spiel: Rundenlogik (Hook) und Oberfläche (Screen) zusammenstecken.
export function GuessSongGame({ tracks, error, playback, onLogout, onShowPlaylists, onError }: GameScreenProps) {
  const round = useGuessSongRound({ tracks, error, playback, onError })
  useWakeLock(round.running)

  return (
    <GuessSongScreen
      track={round.track}
      phase={round.phase}
      index={round.index}
      total={round.total}
      running={round.running}
      paused={round.paused}
      snippetReady={round.snippetReady}
      audiblePlay={round.audiblePlay}
      error={error}
      roundTimings={round.roundTimings}
      savedTimings={round.savedTimings}
      onSaveTimings={round.onSaveTimings}
      onPlay={round.onPlay}
      onPause={round.onPause}
      onResume={round.onResume}
      onReplay={round.onReplay}
      onReveal={round.onReveal}
      onSkipNext={round.onSkipNext}
      onForceSkip={round.onForceSkip}
      onAbort={() => {
        round.onAbort()
        onShowPlaylists()
      }}
      onLogout={() => {
        round.haltForLogout()
        onLogout()
      }}
    />
  )
}
