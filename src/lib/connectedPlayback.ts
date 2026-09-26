interface PausablePlayer {
  pause: () => Promise<void>
}

interface PlaybackStateProbe {
  getCurrentState?: () => Promise<{ paused?: boolean } | null>
}

export async function pauseConnectedPlayback(
  deviceId: string | null,
  player: PausablePlayer | null,
  pauseWeb: (deviceId: string) => Promise<void>,
): Promise<void> {
  const web = deviceId ? pauseWeb(deviceId).catch(() => undefined) : Promise.resolve()
  const sdk = player ? player.pause().catch(() => undefined) : Promise.resolve()
  await Promise.all([web, sdk])
}

export async function readSpotifyPaused(player: PlaybackStateProbe | null): Promise<boolean | null> {
  if (!player?.getCurrentState) {
    return null
  }
  try {
    const state = await player.getCurrentState()
    if (!state || typeof state.paused !== 'boolean') {
      return null
    }
    return state.paused
  } catch {
    return null
  }
}
