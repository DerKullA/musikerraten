import { LoserBonusOverlay } from './LoserBonusOverlay.tsx'
import { WrongGuessDialog } from './WrongGuessDialog.tsx'
import { ShotlessRoundView } from '@/components/shotless/ShotlessRoundView.tsx'
import { ShotlessSetup } from '@/components/shotless/ShotlessSetup.tsx'
import { useShotlessLobby } from '@/components/shotless/useShotlessLobby.ts'
import { useShotlessRound } from '@/components/shotless/useShotlessRound.ts'
import type { BackdropPosition } from '@/lib/bonusBackdrop.ts'
import type { Track } from '@/types.ts'

export { ShotlessRoundView } from '@/components/shotless/ShotlessRoundView.tsx'

interface ShotlessScreenProps {
  tracks: Track[]
  error: string | null
  onLogout: () => void
  onLeave: () => void
  onBackToPlaylists: () => void
  onPlayClip: (uri: string, positionMs: number) => Promise<void>
  onResumeClip: () => Promise<void>
  onPauseClip: () => Promise<void>
  onPrimeClip?: (uri: string, positionMs: number) => Promise<void>
  onInvalidateClip?: () => void
  onReadPosition?: () => Promise<BackdropPosition | null>
  onReadPaused?: () => Promise<boolean | null>
  onReleaseSilence?: () => Promise<void>
  onPlayback: (state: 'playing' | 'paused') => void
  onLiveChange?: (live: boolean) => void
}

export function ShotlessScreen({
  tracks,
  error,
  onLogout,
  onLeave,
  onBackToPlaylists,
  onPlayClip,
  onResumeClip,
  onPauseClip,
  onPrimeClip,
  onInvalidateClip,
  onReadPosition,
  onReadPaused,
  onReleaseSilence,
  onPlayback,
  onLiveChange,
}: ShotlessScreenProps) {
  const lobby = useShotlessLobby(onLiveChange)
  const round = useShotlessRound({
    tracks,
    started: lobby.started,
    mode: lobby.mode,
    guessTarget: lobby.guessTarget,
    openingOrigin: lobby.openingOrigin,
    onPlayClip,
    onResumeClip,
    onPauseClip,
    onPrimeClip,
    onInvalidateClip,
    onReadPosition,
    onReadPaused,
    onReleaseSilence,
    onPlayback,
  })

  if (!lobby.started || !lobby.mode || !round.track) {
    return (
      <ShotlessSetup
        mode={lobby.mode}
        players={lobby.players}
        nameDraft={lobby.nameDraft}
        nameError={lobby.nameError}
        error={error}
        onLogout={onLogout}
        onLeave={onLeave}
        onBackToPlaylists={onBackToPlaylists}
        guessTarget={lobby.guessTarget}
        onSelectMode={lobby.selectMode}
        onSelectGuessTarget={lobby.selectGuessTarget}
        onNameDraft={lobby.setNameDraft}
        onAddName={lobby.addName}
        onRemoveName={lobby.removeName}
        onStart={() => lobby.startRound(round.beginRound)}
      />
    )
  }

  return (
    <>
      <ShotlessRoundView
        mode={lobby.mode}
        guessTarget={lobby.guessTarget}
        track={round.track}
        trackCount={tracks.length}
        round={round.round}
        players={lobby.players}
        query={round.query}
        artistQuery={round.artistQuery}
        suggestions={round.suggestions}
        artistSuggestions={round.artistSuggestions}
        error={round.playbackError ?? error}
        onLogout={onLogout}
        onLeave={onLeave}
        onBackToPlaylists={onBackToPlaylists}
        onForceSkip={round.onForceSkip}
        onQuery={round.setQuery}
        onArtistQuery={round.setArtistQuery}
        onSubmitGuess={round.onSubmitGuess}
        onPickSuggestion={round.onPickSuggestion}
        onSkip={round.onSkip}
        onListen={round.onListen}
        onClaim={round.onClaim}
        onAssign={round.onAssign}
        onWrongWinner={round.onWrongWinner}
        onNobody={round.onNobody}
        clipPlaying={round.clipPlaying}
        firstPlayReady={round.firstPlayReady}
        onNext={round.onNext}
      />
      {round.wrongPopup ? (
        <WrongGuessDialog name={round.wrongPopup.name} penalty={round.wrongPopup.penalty} />
      ) : null}
      {round.bonusWinner ? (
        <LoserBonusOverlay winner={round.bonusWinner} closing={round.bonusClosing} onDismiss={round.onDismissBonus} />
      ) : null}
    </>
  )
}
