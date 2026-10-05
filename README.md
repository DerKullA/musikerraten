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

## Skripte

- `npm run dev` – Entwicklung auf `127.0.0.1:43123` (Basis `/`)
- `npm run build` – Typecheck und Production-Build für die Dokumentwurzel `/`
- `npm run preview` – gebaute App lokal ansehen
- `npm test` – Vitest
- `npm run lint` – oxlint
