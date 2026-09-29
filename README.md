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

Die Redirect URI ist immer Origin plus Vite-Basis, **mit abschließendem Schrägstrich** — auch an der Seitenwurzel.

| Umgebung | Befehl | Redirect URI |
| --- | --- | --- |
| Lokal | `npm run dev` | `http://127.0.0.1:43123/` |
| GitHub Pages (live) | `npm run build:pages` | `https://derkulla.github.io/musikerraten/` |
| musikerraten.wirsindgeil.com (nach Cutover) | `npm run build:prod` | `https://musikerraten.wirsindgeil.com/` |
| Vercel / andere Wurzel-Domain | `npm run build` | `https://<deployment>/` |

Die Zeichenkette muss **exakt** mit dem Dashboard übereinstimmen (Schema, Host, Port, Pfad, Schrägstrich). `http://localhost` ist für neue Spotify-Apps nicht zulässig, nutze `127.0.0.1`.

Produktions-Redirects müssen **HTTPS** sein. Pages bleibt auf `https://derkulla.github.io/musikerraten/`, bis der Cutover fertig ist. HTTPS für `https://musikerraten.wirsindgeil.com/` ist live; die Redirect-URI darf ins Dashboard, sobald der Login dort laufen soll. Details und Checkliste: [DEPLOY.md](DEPLOY.md).

## GitHub Pages

Das Workflow-File `.github/workflows/pages.yml` bleibt bis zum Cutover die Quelle für Pages und baut mit:

- `npm run build` und `VITE_BASE=/musikerraten/` (gleichwertig zu `npm run build:pages`)
- `VITE_SPOTIFY_CLIENT_ID` aus dem Repository-Secret `VITE_SPOTIFY_CLIENT_ID`

Unter *Settings → Pages* als Quelle **GitHub Actions** wählen. Im Spotify-Dashboard die Pages-URL inklusive Pfad und Schrägstrich als Redirect URI eintragen.

## Vercel

`vercel.json` baut nach `dist` und leitet alle Routen auf `/index.html` um. Ohne `VITE_BASE` ist die Basis `/`. Die Redirect URI ist der HTTPS-Origin mit abschließendem Schrägstrich.

## Eigener Server (musikerraten.wirsindgeil.com)

`npm run build:prod` erzeugt `dist/` mit Basis `/` für `https://musikerraten.wirsindgeil.com/`. Die Client-ID kommt aus `.env.local` bzw. dem Secret `VITE_SPOTIFY_CLIENT_ID`. Auslieferung über den Symlink `/var/www/musikerraten.wirsindgeil.com/current` auf ein Release unter `/var/www/musikerraten.wirsindgeil.com/releases/<id>/`. SSH-Alias `webserver` (`christian@10.73.92.1`, WireGuard), Helfer `~/bin/deploy-musikerraten.sh` und die Cutover-Checkliste stehen in [DEPLOY.md](DEPLOY.md). Nginx, Docroot und HTTPS sind live.

## Umgebungsvariablen

Siehe `.env.example`.

```
VITE_SPOTIFY_CLIENT_ID=
# optional, überschreibt den Basis-Pfad:
# VITE_BASE=/musikerraten/
```

Keine echten Client-IDs und keine `.env`-Dateien ins Repository committen. `VITE_*` landet im Frontend-Bundle.

## Skripte

- `npm run dev` – Entwicklung auf `127.0.0.1:43123` (Basis `/`)
- `npm run build` – Typecheck und Production-Build, Basis `/` sofern `VITE_BASE` leer ist
- `npm run build:pages` – Basis `/musikerraten/` für GitHub Pages
- `npm run build:prod` – Basis `/` für https://musikerraten.wirsindgeil.com/
- `npm run preview` – gebaute App lokal ansehen
