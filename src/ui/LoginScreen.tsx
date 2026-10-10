import { getRedirectUri } from '@/platform/spotify/redirectUri.ts'

interface LoginScreenProps {
  clientIdPresent: boolean
  busy: boolean
  error: string | null
  onSpotifyLogin: () => void
  /** Spiele ohne Spotify direkt starten (Tangera). */
  onPlayWithoutSpotify: () => void
}

export function LoginScreen({
  clientIdPresent,
  busy,
  error,
  onSpotifyLogin,
  onPlayWithoutSpotify,
}: LoginScreenProps) {
  const redirectUri = getRedirectUri()

  return (
    <section className="panel hero login fit-screen">
      <div className="fit-scroll">
      <p className="eyebrow">Playlist-Quiz</p>
      <h1>Musikerraten</h1>
      <p className="lede">
        Ein kurzer Ausschnitt, drei Sekunden nachdenken, dann die Auflösung. Danach kommt automatisch der nächste
        Titel.
      </p>
      {error ? <p className="banner error">{error}</p> : null}
      <aside className="notes">
        <p>
          Du brauchst ein <strong>Spotify-Premium</strong>-Konto. Am besten läuft es in <strong>Chrome</strong>.
        </p>
        {import.meta.env.DEV ? (
          <p>
            Redirect-URI für das Spotify-Dashboard: <code>{redirectUri}</code>
          </p>
        ) : null}
        {!clientIdPresent ? (
          <p className="warn">
            Keine Client-ID gefunden. Lege <code>VITE_SPOTIFY_CLIENT_ID</code> an, um Spotify zu nutzen.
          </p>
        ) : null}
      </aside>
      </div>
      <div className="actions">
        <button type="button" className="btn primary" onClick={onSpotifyLogin} disabled={busy || !clientIdPresent}>
          {busy ? 'Verbinde …' : 'Mit Spotify anmelden'}
        </button>
        <button type="button" className="btn ghost" onClick={onPlayWithoutSpotify} disabled={busy}>
          Tangera ohne Spotify spielen
        </button>
      </div>
    </section>
  )
}
