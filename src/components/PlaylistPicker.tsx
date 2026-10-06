import { useState } from 'react'
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
  onBack: () => void
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
  onBack,
  onLogout,
}: PlaylistPickerProps) {
  const selectedCount = selectedIds.length
  const allSelected = playlists.length > 0 && selectedCount === playlists.length
  const [filter, setFilter] = useState('')
  const needle = filter.trim().toLocaleLowerCase('de')
  const visible = needle ? playlists.filter((playlist) => playlist.name.toLocaleLowerCase('de').includes(needle)) : playlists
  const searchable = playlists.length > 8

  return (
    <section className="panel with-menu fit-screen">
      <header className="panel-head">
        <div>
          <p className="eyebrow">Spotify</p>
          <h1>Playlists wählen</h1>
        </div>
        <div className="panel-head-meta">
          <AppMenu
            timings={savedTimings}
            onSaveTimings={onSaveTimings}
            onLogout={onLogout}
            onLeaveRound={onBack}
          />
        </div>
      </header>
      <div className="fit-scroll">
      <p className="lede">
        Wähle eine oder mehrere Playlists. Daraus werden die Titel-URIs geladen.
      </p>
      {error ? <p className="banner error">{error}</p> : null}
      {loading ? <p className="muted">Playlists werden geladen …</p> : null}
      {!loading ? (
        <div className="toolbar">
          {needle ? null : (
            <button type="button" className="btn ghost compact" onClick={onToggleAll}>
              {allSelected ? 'Auswahl aufheben' : 'Alle auswählen'}
            </button>
          )}
          <span className="muted" aria-live="polite">
            {selectedCount} ausgewählt
          </span>
        </div>
      ) : null}
      {!loading && searchable ? (
        <div className="playlist-search">
          <label className="sr-only" htmlFor="playlist-filter">
            Playlists durchsuchen
          </label>
          <input
            id="playlist-filter"
            type="search"
            value={filter}
            placeholder="Playlists durchsuchen"
            autoComplete="off"
            enterKeyHint="search"
            onChange={(event) => setFilter(event.target.value)}
          />
        </div>
      ) : null}
      {!loading && needle && visible.length === 0 ? <p className="muted">Keine Playlist passt zur Suche.</p> : null}
      {!loading && playlists.length === 0 ? (
        <p className="muted">Keine Playlists gefunden. Lege in Spotify eine eigene Playlist an.</p>
      ) : null}
      <ul className="playlist-list">
        {visible.map((playlist) => {
          const checked = selectedIds.includes(playlist.id)
          return (
            <li key={playlist.id}>
              <label className={checked ? 'playlist selected' : 'playlist'}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(playlist.id)}
                />
                {playlist.imageUrl ? (
                  <img className="playlist-cover" src={playlist.imageUrl} alt="" loading="lazy" decoding="async" />
                ) : (
                  <span className="playlist-cover is-empty" aria-hidden="true" />
                )}
                <span className="playlist-text">
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
      </div>
      <div className="actions">
        <button
          type="button"
          className={`btn primary cta${loadingTracks ? ' is-wrapping' : ''}`}
          onClick={onStart}
          disabled={loadingTracks || selectedCount === 0}
        >
          {loadingTracks
            ? 'Titel werden geladen …'
            : selectedCount > 0
              ? `Spiel starten · ${selectedCount} ${selectedCount === 1 ? 'Playlist' : 'Playlists'}`
              : 'Spiel starten'}
        </button>
        <button type="button" className="btn ghost back" onClick={onBack} aria-label="Zurück zum Hauptmenü">
          Zurück
        </button>
      </div>
    </section>
  )
}
