import { useState } from 'react'
import { startSpeakerKeepAlive } from '@/platform/playback/speakerKeepAlive.ts'
import {
  addShotlessPlayer,
  canStartShotless,
  readShotlessSession,
  removeShotlessPlayer,
  writeShotlessSession,
} from '@/games/shotless/logic/session.ts'
import { pickClipOrigin, type ShotlessGuessTarget, type ShotlessMode } from '@/games/shotless/logic/rules.ts'

export function useShotlessLobby(onLiveChange?: (live: boolean) => void) {
  const stored = readShotlessSession()
  const [mode, setMode] = useState<ShotlessMode | null>(stored?.mode ?? null)
  const [guessTarget, setGuessTarget] = useState<ShotlessGuessTarget>(stored?.guessTarget ?? 'title')
  const [players, setPlayers] = useState<string[]>(stored?.players ?? [])
  const [nameDraft, setNameDraft] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [started, setStarted] = useState(false)
  const [openingOrigin] = useState(() => pickClipOrigin())

  function rememberSession(
    nextMode: ShotlessMode | null,
    nextPlayers: readonly string[],
    nextTarget: ShotlessGuessTarget,
  ): void {
    if (!nextMode) {
      return
    }
    writeShotlessSession({ mode: nextMode, players: [...nextPlayers], guessTarget: nextTarget })
  }

  function selectMode(next: ShotlessMode): void {
    setMode(next)
    rememberSession(next, players, guessTarget)
  }

  function selectGuessTarget(next: ShotlessGuessTarget): void {
    setGuessTarget(next)
    rememberSession(mode, players, next)
  }

  function addName(): void {
    const result = addShotlessPlayer(players, nameDraft)
    setNameError(result.error)
    if (result.error) {
      return
    }
    setPlayers(result.players)
    setNameDraft('')
    rememberSession(mode, result.players, guessTarget)
  }

  function removeName(name: string): void {
    const next = removeShotlessPlayer(players, name)
    setPlayers(next)
    rememberSession(mode, next, guessTarget)
  }

  function startRound(beginRound: () => void): void {
    if (!canStartShotless(mode, players) || !mode) {
      return
    }
    startSpeakerKeepAlive()
    beginRound()
    rememberSession(mode, players, guessTarget)
    setStarted(true)
    onLiveChange?.(true)
  }

  return {
    mode,
    guessTarget,
    players,
    nameDraft,
    nameError,
    started,
    openingOrigin,
    setNameDraft,
    selectMode,
    selectGuessTarget,
    addName,
    removeName,
    startRound,
  }
}
