import { getRedirectUri } from '../lib/redirectUri.ts'

interface LoginScreenProps {
  clientIdPresent: boolean
  busy: boolean
  error: string | null
  onSpotifyLogin: () => void
  onDemo: () => void
}

export function LoginScreen({
  clientIdPresent,
  busy,
  error,
  onSpotifyLogin,
  onDemo,
}: LoginScreenProps) {
  const redirectUri = getRedirectUri()

  return (
    <section className="panel hero">
      <p className="eyebrow">Playlist-Quiz</p>
      <h1>Musikerraten</h1>
      <p className="lede">
        Ein kurzer Ausschnitt, drei Sekunden nachdenken, dann die Auflösung. Danach kommt automatisch
        der nächste Titel.
      </p>
      {error ? <p className="banner error">{error}</p> : null}
      <div className="actions">
        <button type="button" className="btn primary" onClick={onSpotifyLogin} disabled={busy || !clientIdPresent}>
          {busy ? 'Verbinde …' : 'Mit Spotify anmelden'}
        </button>
        <button type="button" className="btn ghost" onClick={onDemo} disabled={busy}>
          Demo ohne Spotify
        </button>
      </div>
      <aside className="notes">
        <p>
          Die Wiedergabe über das Spotify Web Playback SDK braucht ein <strong>Spotify-Premium</strong>
          -Konto und funktioniert zuverlässig in <strong>Chrome</strong> (Chromium, Desktop). Im
          Demo-Modus laufen dieselben Phasen ohne Ton.
        </p>
        <p>
          Redirect-URI für das Spotify-Dashboard:{' '}
          <code>{redirectUri}</code>
        </p>
        {!clientIdPresent ? (
          <p className="warn">
            Keine Client-ID gefunden. Lege <code>VITE_SPOTIFY_CLIENT_ID</code> an, um Spotify zu nutzen.
          </p>
        ) : null}
      </aside>
    </section>
  )
}
