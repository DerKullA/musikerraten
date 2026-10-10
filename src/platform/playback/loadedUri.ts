import type { WarmPlaybackState } from '@/platform/playback/clipWarmup/index.ts'

export interface LoadedUri {
  requested: string
  before: string | null
  actual: string | null
  settled: boolean
}

// Manche Titel spielt Spotify unter einer anderen URI ab, ohne die angefragte
// mitzuliefern. Der erste neue Titel nach einem Ladebefehl gilt als der geladene.
export function adoptLoadedUri(
  loaded: LoadedUri | null,
  state: WarmPlaybackState | null,
  onAlias?: (requested: string, actual: string) => void,
): WarmPlaybackState | null {
  if (!state?.uri || !loaded) {
    return state
  }
  if (state.uri === loaded.requested) {
    loaded.settled = true
    return state
  }
  if (!loaded.settled && loaded.actual === null && state.uri !== loaded.before) {
    loaded.actual = state.uri
    onAlias?.(loaded.requested, state.uri)
  }
  return state.uri === loaded.actual ? { ...state, uri: loaded.requested } : state
}
