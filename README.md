# Musikerraten

Spotify-Playlist-Quiz als Vite + React + TypeScript-SPA. Nach dem Login wählst du Playlists, die App lädt die Titel-URIs und spielt in einer Schleife kurze Ausschnitte.

## Ablauf

1. **Abspielen** (11 Sekunden): Ton läuft, Interpret und Titel bleiben verborgen.
2. **Nachdenken** (standardmäßig 3 Sekunden, im Menü 0 bis 30): weiterhin verborgen, Wiedergabe pausiert. **Pause** hält nur den Denkzeit-Timer an, **Weiter** setzt ihn fort. Steht die Denkzeit auf 0, folgt nach dem Vorspiel direkt die Auflösung.
3. **Auflösung** (standardmäßig 8 Sekunden, im Menü 1 bis 30): Interpret, Titel, Gesamtlänge (`m:ss`) und – falls vorhanden – das Albumcover im Transport-Knopf. Der Titel spielt weiter, der Zeitbalken läuft mit. Danach startet automatisch der nächste Titel.
4. Automatisch der nächste Titel. **Pause** hält Ton und Timer in Vorspiel, Denkzeit und Auflösung an, **Weiter** macht genau dort weiter. **Zurück** im Menü beendet die Runde und geht zur Playlist-Auswahl.

## Voraussetzungen

- Node.js 20 oder neuer
- Für echte Wiedergabe: **Spotify Premium** und ein aktueller **Chrome**- bzw. Chromium-Browser (Web Playback SDK)
- Eine Spotify-App im [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)

Safari und Firefox können den Player unzuverlässig starten; Chrome auf dem Desktop ist der unterstützte Weg.

## Lokal starten

```bash
cp .env.example .env.local
# VITE_SPOTIFY_CLIENT_ID in .env.local eintragen
npm install
npm run dev
```

Der Dev-Server läuft auf `http://127.0.0.1:43123`.

## Spotify-Dashboard einrichten

Die App nutzt **OAuth Authorization Code + PKCE**. Es wird **kein Client Secret** im Frontend gespeichert oder versendet.

1. Im Dashboard eine App anlegen (Web-App / Web Playback SDK).
2. Die **Client ID** nach `.env.local` als `VITE_SPOTIFY_CLIENT_ID` kopieren.
3. Unter Redirect URIs genau die Adresse eintragen, auf der die App läuft.

Die Redirect URI ist immer Origin plus Vite-Basis, **mit abschließendem Schrägstrich** — auch an der Seitenwurzel. Die Basis ist `/`.

| Umgebung | Befehl | Redirect URI |
| --- | --- | --- |
| Lokal | `npm run dev` | `http://127.0.0.1:43123/` |
| Produktion | `npm run build` | `https://musikerraten.wirsindgeil.com/` |

Die Zeichenkette muss **exakt** mit dem Dashboard übereinstimmen (Schema, Host, Port, Pfad, Schrägstrich). `http://localhost` ist für neue Spotify-Apps nicht zulässig, nutze `127.0.0.1`.

Der Produktions-Redirect ist **HTTPS**. `https://musikerraten.wirsindgeil.com/` ist im Spotify-Dashboard bereits eingetragen; dieses Repository ändert das Dashboard nicht. Details: [DEPLOY.md](DEPLOY.md).

## Produktion (musikerraten.wirsindgeil.com)

`npm run build` erzeugt `dist/` mit Basis `/` für `https://musikerraten.wirsindgeil.com/`. Asset-Pfade lauten `/assets/…`. Die Client-ID kommt aus `.env.local` als `VITE_SPOTIFY_CLIENT_ID`. Auslieferung über den Symlink `/var/www/musikerraten.wirsindgeil.com/current` steht in [DEPLOY.md](DEPLOY.md). Browser-Fehler gehen an `/api/log.php`; Einrichtung und Logs lesen steht in [LOGGING.md](LOGGING.md). Dieser Stand deployt nicht.

GitHub Pages ist abgelöst. Es gibt kein Pages-Workflow mehr.

## Vercel

`vercel.json` baut mit `npm run build` nach `dist` und leitet alle Routen auf `/index.html` um. Die Basis ist `/`. Die Redirect URI ist der HTTPS-Origin mit abschließendem Schrägstrich.

## Umgebungsvariablen

Siehe `.env.example`.

```
VITE_SPOTIFY_CLIENT_ID=
```

Keine echten Client-IDs und keine `.env`-Dateien ins Repository committen. `VITE_*` landet im Frontend-Bundle.

## Tangera

Trinkspiel mit einem Skatblatt (36 Karten), spielbar ohne Spotify direkt vom Login-Bildschirm. Jede Karte löst ein Ereignis aus (Wahrheit oder Pflicht, Sieben Tod, Quizmaster, Regel, Zehner, Kasper, Bitch, Kategorie, Wasserfall). Regeln, Annahmen und Meilensteine stehen in [docs/TANGERA_PLAN.md](docs/TANGERA_PLAN.md).

## Skripte

- `npm run dev` – Entwicklung auf `127.0.0.1:43123` (Basis `/`)
- `npm run build` – Typecheck und Production-Build für die Dokumentwurzel `/`
- `npm run preview` – gebaute App lokal ansehen
- `npm test` – Vitest
- `npm run lint` – oxlint

## Architektur und neues Spiel hinzufügen

Der Quellcode liegt in `src/` und ist nach Verantwortung getrennt. Importe laufen über den Alias `@/` (= `src/`) und enden auf `.ts`/`.tsx`.

```
src/
  main.tsx                  # Einstieg, lädt styles/base.css
  app/                      # Shell: Routing und Verdrahtung, ohne Spiellogik
    App.tsx                 # wählt den Screen, lädt die Titel, rendert das gewählte Spiel
    useNavigation.ts        # Screen, gewähltes Spiel, Fehleranzeige, Playlist-Auswahl, Epochen
    useSpotifySession.ts    # Login, Logout, Token-Bootstrap
  platform/                 # alles, was kein Spiel kennt
    spotify/                # API, Auth (PKCE), Web-Playback-SDK-Player, Titel mischen
    playback/               # usePlaybackEngine (PlaybackApi), Warmup, Stille-Wächter, Medien-Sitzung
    diagnostics/            # Client-Log, Spiellog (siehe LOGGING.md), App-Version
  ui/                       # geteilte Oberfläche (Menü, Login, Playlist-Auswahl, Einstellungen, Phasenzeiten)
  games/
    registry.ts             # Liste aller Spiele (GAMES) und der Vertrag GameScreenProps
    guess-song/             # Song erraten: GuessSongGame, useGuessSongRound, roundTransitions, GuessSongScreen, guess-song.css
    shotless/               # Shotless: ShotlessScreen, components/, hooks/, logic/, shotless.css
    tangera/                # Tangera (Kartenspiel, ohne Spotify): TangeraScreen, components/, hooks/, logic/, tangera.css
  styles/base.css           # Reset, .app, .panel, .btn und weitere gemeinsame Klassen
  types.ts                  # geteilte Typen: Track, Playlist, TokenSet, GamePhase
```

Die Shell hält nur, was Spiele teilen: Login, Navigation, die geladene Titelliste und die Wiedergabe. Jedes Spiel besitzt seinen Zustand selbst. Es wird eingehängt, sobald die Titel geladen sind, und gibt ihn beim Verlassen wieder frei.

### Neues Spiel hinzufügen

1. Ordner `src/games/<spiel>/` anlegen, darin ein Screen als React-Komponente mit den Props `GameScreenProps` aus `src/games/registry.ts`. Zustand, Timer und Regeln gehören in einen eigenen Hook (`use<Spiel>Round`) und möglichst in reine, getestete Funktionen daneben (Vorbild: `guess-song/roundTransitions.ts`).
2. Stylesheet `src/games/<spiel>/<spiel>.css` anlegen. Klassen mit Spielpräfix benennen; gemeinsame Klassen stehen in `styles/base.css`.
3. In `src/games/registry.ts` das CSS importieren (neue Spiele hinten anhängen, die Reihenfolge ist Teil der Kaskade) und einen Eintrag in `GAMES` ergänzen:
   `id`, `kicker`, `label`, `available`, `requiresSpotify` (`false` = startet ohne Login und Playlist-Auswahl, auch vom Login-Bildschirm aus; Beispiel Tangera), `entry: { kind: 'component', Screen }`, `clipPlayback` (spielt das Spiel Clips an wechselnden Stellen statt Runden-Phasen), `fullBleed` (`'always'` oder `'live'`), `debugScreen` (Name in den Spiellogs) und optional `menuVariant` und `clearSession` (Aufräumen beim Logout). Das Hauptmenü und die Navigation lesen nur diese Liste.
4. Mehr ist nicht nötig: `App.tsx` kennt kein einzelnes Spiel.

Was ein Spiel von der Shell bekommt (`GameScreenProps`):

| Prop | Bedeutung |
| --- | --- |
| `signedIn` | Spotify-Login vorhanden? Spiele ohne Spotify blenden dann „Abmelden“ aus |
| `tracks` | geladene und gemischte Titel der gewählten Playlists |
| `error` | Fehleranzeige der Shell |
| `playback` | `PlaybackApi` der Wiedergabe-Engine |
| `onLogout` | abmelden |
| `onLeave` | Spiel verlassen, zurück ins Hauptmenü |
| `onBackToPlaylists` | zurück zur Playlist-Auswahl (Fehler und Live-Zustand werden zurückgesetzt) |
| `onShowPlaylists` | nur der Bildschirmwechsel zur Playlist-Auswahl, ohne Zurücksetzen (Abbruch) |
| `onError` | Fehleranzeige der Shell setzen oder leeren |
| `onLiveChange` | meldet, ob das Spiel im Vollbild-Rundenmodus läuft (`fullBleed: 'live'`) |

Die Wiedergabe läuft ausschließlich über `PlaybackApi` (`src/platform/playback/usePlaybackEngine.ts`): `playCurrent`/`pause`/`resume`/`end` für Runden-Spiele, `primeClip`/`playClip` für Clip-Spiele, `beginMedia`/`engageMedia`/`syncMedia` für die Medien-Sitzung und `invalidate` für vorgeladene Titel. Spiele rufen weder Spotify-Player noch Warmup direkt auf. Ein Runden-Spiel meldet seine Phase über `playback.bindRound(…)` an, damit die Logs sie kennen.

Phasenzeiten teilen sich Menü, Playlist-Auswahl und Song erraten über `src/ui/savedPhaseTimings.ts` (Session-Speicher). Spiellogs schreibt ein Spiel mit `traceGame` und `useGameDebugWatch` aus `platform/diagnostics`.
