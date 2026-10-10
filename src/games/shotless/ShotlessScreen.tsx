import { LoserBonusOverlay } from '@/games/shotless/components/LoserBonusOverlay.tsx'
import { WrongGuessDialog } from '@/games/shotless/components/WrongGuessDialog.tsx'
import { ShotlessRoundView } from '@/games/shotless/components/ShotlessRoundView.tsx'
import { ShotlessSetup } from '@/games/shotless/components/ShotlessSetup.tsx'
import { useShotlessLobby } from '@/games/shotless/hooks/useShotlessLobby.ts'
import { useShotlessRound } from '@/games/shotless/hooks/useShotlessRound.ts'
import type { PlaybackApi } from '@/platform/playback/usePlaybackEngine.ts'
import type { Track } from '@/types.ts'

interface ShotlessScreenProps {
  tracks: Track[]
  error: string | null
  onLogout: () => void
  onLeave: () => void
  onBackToPlaylists: () => void
  playback: PlaybackApi
  onLiveChange?: (live: boolean) => void
}

export function ShotlessScreen({
  tracks,
  error,
  onLogout,
  onLeave,
  onBackToPlaylists,
  playback,
  onLiveChange,
}: ShotlessScreenProps) {
  const lobby = useShotlessLobby(onLiveChange)
  const round = useShotlessRound({
    tracks,
    started: lobby.started,
    mode: lobby.mode,
    guessTarget: lobby.guessTarget,
    openingOrigin: lobby.openingOrigin,
    playback,
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
