import type { Playlist } from '../types.ts'

interface PlaylistPickerProps {
  playlists: Playlist[]
  selectedIds: string[]
  loading: boolean
  loadingTracks: boolean
  error: string | null
  demo: boolean
  onToggle: (id: string) => void
  onToggleAll: () => void
  onStart: () => void
  onLogout: () => void
}

export function PlaylistPicker({
  playlists,
  selectedIds,
  loading,
  loadingTracks,
  error,
  demo,
  onToggle,
  onToggleAll,
  onStart,
  onLogout,
}: PlaylistPickerProps) {
  const selectedCount = selectedIds.length
  const allSelected = playlists.length > 0 && selectedCount === playlists.length

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <p className="eyebrow">{demo ? 'Demo' : 'Spotify'}</p>
          <h1>Playlists wählen</h1>
        </div>
        <button type="button" className="btn text" onClick={onLogout}>
          {demo ? 'Zurück' : 'Abmelden'}
        </button>
      </header>
      <p className="lede">
        {demo
          ? 'Im Demo-Modus stehen feste Beispieltitel bereit. Starte einfach das Quiz.'
          : 'Wähle eine oder mehrere Playlists. Daraus werden die Titel-URIs geladen.'}
      </p>
      {error ? <p className="banner error">{error}</p> : null}
      {loading ? <p className="muted">Playlists werden geladen …</p> : null}
      {!loading && !demo ? (
        <div className="toolbar">
          <button type="button" className="btn ghost compact" onClick={onToggleAll}>
            {allSelected ? 'Auswahl aufheben' : 'Alle auswählen'}
          </button>
          <span className="muted">{selectedCount} ausgewählt</span>
        </div>
      ) : null}
      {!loading && !demo && playlists.length === 0 ? (
        <p className="muted">Keine Playlists gefunden. Lege in Spotify eine eigene Playlist an.</p>
      ) : null}
      {!demo ? (
        <ul className="playlist-list">
          {playlists.map((playlist) => {
            const checked = selectedIds.includes(playlist.id)
            return (
              <li key={playlist.id}>
                <label className={checked ? 'playlist selected' : 'playlist'}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(playlist.id)}
                  />
                  <span>
                    <strong>{playlist.name}</strong>
                    <small>
                      {playlist.trackCount} Titel
                      {playlist.ownerName ? ` · ${playlist.ownerName}` : ''}
                    </small>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      ) : null}
      <div className="actions">
        <button
          type="button"
          className="btn primary"
          onClick={onStart}
          disabled={loadingTracks || (!demo && selectedCount === 0)}
        >
          {loadingTracks ? 'Titel werden geladen …' : 'Spiel starten'}
        </button>
      </div>
    </section>
  )
}
