# Musikerraten

Spotify-Playlist-Quiz als Vite + React + TypeScript-SPA. Nach dem Login wählst du Playlists, die App lädt die Titel-URIs und spielt in einer Schleife kurze Ausschnitte.

## Ablauf

1. **Abspielen** (11 Sekunden): Ton läuft, Interpret und Titel bleiben verborgen.
2. **Nachdenken** (3 Sekunden): weiterhin verborgen, Wiedergabe pausiert.
3. **Auflösung** (6 Sekunden): Interpret, Titel und Gesamtlänge (`m:ss`) erscheinen, der Titel spielt weiter.
4. Automatisch der nächste Titel. **Pause** hält Ton und Timer an, **Weiter** macht genau dort weiter. **Abbrechen** beendet die Runde und geht zur Playlist-Auswahl.

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

Beispiele für Redirect URIs:

| Umgebung | Redirect URI |
| --- | --- |
| Lokal | `http://127.0.0.1:43123` |
| Vercel / eigene Domain | `https://deine-domain.tld` (Deployment-Origin) |
| GitHub Pages (Projektseite) | `https://<user>.github.io/musikerraten/` (Origin + Pfad) |

Die App berechnet die Redirect URI zur Laufzeit aus `window.location.origin` und ergänzt den Basis-Pfad, wenn die App nicht unter `/` liegt (GitHub-Pages-Projektseite).

Die Zeichenkette muss **exakt** mit dem Dashboard übereinstimmen (Schema, Host, Port, Pfad, Schrägstrich). `http://localhost` ist für neue Spotify-Apps nicht zulässig, nutze `127.0.0.1`.

Produktions-Redirects müssen **HTTPS** sein. Trage dort den Deployment-Origin ein, bei einer GitHub-Pages-Projektseite den Origin plus Repository-Pfad.

## GitHub Pages

Das Workflow-File `.github/workflows/pages.yml` baut mit:

- `VITE_BASE=/musikerraten/`
- `VITE_SPOTIFY_CLIENT_ID` aus dem Repository-Secret `VITE_SPOTIFY_CLIENT_ID`

Unter *Settings → Pages* als Quelle **GitHub Actions** wählen. Im Spotify-Dashboard die Pages-URL inklusive Pfad als Redirect URI eintragen.

## Vercel

`vercel.json` baut nach `dist` und leitet alle Routen auf `/index.html` um. `VITE_BASE` bleibt leer (`/`). Die Redirect URI ist der HTTPS-Origin der Vercel-Domain.

## Umgebungsvariablen

Siehe `.env.example`. Es gibt nur:

```
VITE_SPOTIFY_CLIENT_ID=
```

Keine echten Client-IDs und keine `.env`-Dateien ins Repository committen.

## Skripte

- `npm run dev` – Entwicklung auf `127.0.0.1:43123`
- `npm run build` – Typecheck und Production-Build
- `npm run preview` – gebaute App lokal ansehen
