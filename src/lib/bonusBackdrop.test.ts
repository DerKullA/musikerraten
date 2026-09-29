import { describe, expect, it } from 'vitest'
import {
  backdropPositionMs,
  backdropRemainingMs,
  backdropWaitMs,
  pickBackdropTrack,
  prepareGuessHandoff,
  rememberPlayedTrack,
  runBackdropPlayback,
  type BackdropPosition,
  type BackdropTrack,
} from './bonusBackdrop.ts'

const first: BackdropTrack = { uri: 'spotify:track:a', durationMs: 10_000 }
const second: BackdropTrack = { uri: 'spotify:track:b', durationMs: 8_000 }

describe('rememberPlayedTrack', () => {
  it('merkt sich einen Song nur einmal', () => {
    const played = rememberPlayedTrack(rememberPlayedTrack([], first), first)
    expect(played).toEqual([first])
  })
})

describe('pickBackdropTrack', () => {
  it('nimmt einen anderen schon gespielten Song', () => {
    const pick = pickBackdropTrack([first, second], first.uri, () => 0)
    expect(pick).toEqual(second)
  })

  it('wiederholt den einzigen schon gespielten Song', () => {
    const pick = pickBackdropTrack([first], first.uri, () => 0)
    expect(pick).toEqual(first)
  })
})

describe('backdropWaitMs', () => {
  it('wechselt, sobald der Song zu Ende ist', () => {
    expect(backdropRemainingMs(10_000, 9_800)).toBe(200)
    expect(backdropWaitMs(200)).toBe(0)
    expect(backdropWaitMs(5_000)).toBe(1_000)
  })
})

describe('runBackdropPlayback', () => {
  it('spielt nach dem Ende einen schon gespielten Song', async () => {
    const played: string[] = []
    const reads: Array<BackdropPosition | null> = [
      { uri: first.uri, positionMs: 9_900 },
      { uri: second.uri, positionMs: 100 },
    ]
    let cancelled = false
    await runBackdropPlayback(
      { uri: first.uri, durationMs: first.durationMs, positionMs: 1_000, resume: true },
      {
        play: async (uri) => {
          played.push(uri)
        },
        resume: async () => undefined,
        readPosition: async () => reads.shift() ?? { uri: second.uri, positionMs: 100 },
        nextTrack: (finishedUri) => pickBackdropTrack([first, second], finishedUri, () => 0),
        isCancelled: () => cancelled,
        onPlayback: () => undefined,
        onError: () => undefined,
      },
      async () => {
        cancelled = true
      },
    )
    expect(played).toEqual([second.uri])
  })

  it('ignoriert eine Position vom vorigen Song', () => {
    expect(backdropPositionMs(second.uri, { uri: first.uri, positionMs: 9_900 }, 0)).toBe(0)
  })

  it('überspringt den Folgesong nicht wegen der alten Endposition', async () => {
    const played: string[] = []
    const reads: Array<BackdropPosition | null> = [
      { uri: first.uri, positionMs: 9_900 },
      { uri: second.uri, positionMs: 9_900 },
      { uri: second.uri, positionMs: 200 },
    ]
    let cancelled = false
    await runBackdropPlayback(
      { uri: first.uri, durationMs: first.durationMs, positionMs: 1_000, resume: true },
      {
        play: async (uri) => {
          played.push(uri)
        },
        resume: async () => undefined,
        readPosition: async () => reads.shift() ?? { uri: second.uri, positionMs: 200 },
        nextTrack: (finishedUri) => pickBackdropTrack([first, second], finishedUri, () => 0),
        isCancelled: () => cancelled,
        onPlayback: () => undefined,
        onError: () => undefined,
      },
      async () => {
        cancelled = true
      },
    )
    expect(played).toEqual([second.uri])
  })
})

describe('prepareGuessHandoff', () => {
  it('pausiert einen laufenden Song und lädt den Guess-Song erst danach', async () => {
    const steps: string[] = []
    const reads = [false, false, true]
    await prepareGuessHandoff({
      readPaused: async () => reads.shift() ?? true,
      pause: async () => {
        steps.push('pause')
      },
      prime: async () => {
        steps.push('prime')
      },
      wait: async () => undefined,
    })
    expect(steps).toEqual(['pause', 'prime'])
  })

  it('lädt den Guess-Song sofort, wenn schon pausiert ist', async () => {
    const steps: string[] = []
    await prepareGuessHandoff({
      readPaused: async () => true,
      pause: async () => {
        steps.push('pause')
      },
      prime: async () => {
        steps.push('prime')
      },
      wait: async () => undefined,
    })
    expect(steps).toEqual(['prime'])
  })
})
