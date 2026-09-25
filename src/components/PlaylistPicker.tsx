import type { PhaseTimings } from '../lib/phaseTimings.ts'
import type { Playlist } from '../types.ts'
import { AppMenu } from './AppMenu.tsx'

interface PlaylistPickerProps {
  playlists: Playlist[]
  selectedIds: string[]
  loading: boolean
  loadingTracks: boolean
  error: string | null
  savedTimings: PhaseTimings
  onSaveTimings: (timings: PhaseTimings) => void
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
  savedTimings,
  onSaveTimings,
  onToggle,
  onToggleAll,
  onStart,
  onLogout,
}: PlaylistPickerProps) {
  const selectedCount = selectedIds.length
  const allSelected = playlists.length > 0 && selectedCount === playlists.length

  return (
    <section className="panel with-menu">
      <header className="panel-head">
        <div>
          <p className="eyebrow">Spotify</p>
          <h1>Playlists wählen</h1>
        </div>
        <div className="panel-head-meta">
          <AppMenu timings={savedTimings} onSaveTimings={onSaveTimings} onLogout={onLogout} />
        </div>
      </header>
      <p className="lede">
        Wähle eine oder mehrere Playlists. Daraus werden die Titel-URIs geladen.
      </p>
      {error ? <p className="banner error">{error}</p> : null}
      {loading ? <p className="muted">Playlists werden geladen …</p> : null}
      {!loading ? (
        <div className="toolbar">
          <button type="button" className="btn ghost compact" onClick={onToggleAll}>
            {allSelected ? 'Auswahl aufheben' : 'Alle auswählen'}
          </button>
          <span className="muted">{selectedCount} ausgewählt</span>
        </div>
      ) : null}
      {!loading && playlists.length === 0 ? (
        <p className="muted">Keine Playlists gefunden. Lege in Spotify eine eigene Playlist an.</p>
      ) : null}
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
      <div className="actions">
        <button
          type="button"
          className={`btn primary cta${loadingTracks ? ' is-wrapping' : ''}`}
          onClick={onStart}
          disabled={loadingTracks || selectedCount === 0}
        >
          {loadingTracks ? 'Titel werden geladen …' : 'Spiel starten'}
        </button>
      </div>
    </section>
  )
}
