import {
  EVERYONE_SHOT_MESSAGE,
  TIPPEN_GUESSER,
  isCorrectGuess,
  isLastShotlessStage,
  stageByIndex,
  type ClipOrigin,
  type ShotlessCommand,
  type ShotlessRound,
} from './shotlessRules.ts'

export function correctDrinkMessage(name: string, penalty: string): string {
  return `Alle außer ${name} trinken: ${penalty}`
}

export function wrongDrinkMessage(penalty: string): string {
  return `Falsch — du trinkst: ${penalty}`
}

export function wrongWinnerMessage(name: string, penalty: string): string {
  return `${name} lag falsch — ${name} trinkt: ${penalty}`
}

export function everyoneShotMessage(): string {
  return EVERYONE_SHOT_MESSAGE
}

export function createShotlessRound(origin: ClipOrigin = 'mitte'): ShotlessRound {
  return {
    trackIndex: 0,
    stageIndex: 0,
    view: 'guessing',
    feedback: null,
    revealMessage: null,
    winner: null,
    replayNonce: 0,
    origin,
  }
}

export function reduceShotlessRound(round: ShotlessRound, command: ShotlessCommand): ShotlessRound {
  if (command.type === 'next') {
    return advanceTrack(round, command.trackCount, command.origin)
  }
  if (command.type === 'wrong-winner') {
    return revokeWinner(round)
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
    return submitGuess(round, command)
  }
  if (command.type === 'claim') {
    return claimRound(round)
  }
  if (command.type === 'assign') {
    return assignGuesser(round, command.name)
  }
  return round
}

function advanceTrack(round: ShotlessRound, trackCount: number, origin: ClipOrigin): ShotlessRound {
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
    winner: null,
    replayNonce: round.replayNonce + 1,
    origin,
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
    winner: null,
  }
}

function revealCorrect(round: ShotlessRound, name: string): ShotlessRound {
  return {
    ...round,
    view: 'reveal',
    feedback: null,
    revealMessage: correctDrinkMessage(name, stageByIndex(round.stageIndex).penalty),
    winner: name,
  }
}

function submitGuess(
  round: ShotlessRound,
  command: Extract<ShotlessCommand, { type: 'submit-guess' }>,
): ShotlessRound {
  if (round.view !== 'guessing') {
    return round
  }
  const verdict = isCorrectGuess(
    { text: command.guess, artistText: command.artistGuess },
    { title: command.title, artist: command.artist },
    command.target,
  )
  if (verdict === null) {
    return round
  }
  if (verdict) {
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

function revokeWinner(round: ShotlessRound): ShotlessRound {
  if (round.view !== 'reveal' || round.winner === null) {
    return round
  }
  const penalty = stageByIndex(round.stageIndex).penalty
  return {
    ...round,
    revealMessage: wrongWinnerMessage(round.winner, penalty),
    winner: null,
  }
}
