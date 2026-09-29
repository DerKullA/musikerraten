# Deploy: GitHub Pages und musikerraten.wirsindgeil.com

Zwei statische Ziele, ein Build. GitHub Pages bleibt die Live-Seite, bis der Cutover auf [https://musikerraten.wirsindgeil.com/](https://musikerraten.wirsindgeil.com/) abgeschlossen ist. `getRedirectUri()` setzt `window.location.origin` plus die konfigurierte Vite-Basis, immer mit abschließendem Schrägstrich. Die Subdomain steht damit erst an, wenn der Build mit Basis `/` dort ausgeliefert wird. Bis dahin sendet der Pages-Build weiter `https://derkulla.github.io/musikerraten/`.

## Ziele

| Ziel | Befehl | Vite-`base` | Spotify-Redirect (exakt) |
| --- | --- | --- | --- |
| GitHub Pages (live) | `npm run build:pages` | `/musikerraten/` | `https://derkulla.github.io/musikerraten/` |
| musikerraten.wirsindgeil.com (nach Cutover) | `npm run build:prod` | `/` | `https://musikerraten.wirsindgeil.com/` |
| Lokal | `npm run dev` | `/` | `http://127.0.0.1:43123/` |

`npm run build` ohne gesetztes `VITE_BASE` erzeugt die Seitenwurzel (`/`), also dasselbe Artefakt wie `build:prod`. Das Pages-Workflow setzt `VITE_BASE=/musikerraten/` und bleibt beim bisherigen Pfad. Ein gesetztes `VITE_BASE` gewinnt gegenüber dem Default in `vite.config.ts`. `build:pages` und `build:prod` übergeben `--base` und legen den Pfad damit für diesen Lauf fest.

## Umgebungsvariablen

| Variable | Pflicht | Wirkung |
| --- | --- | --- |
| `VITE_SPOTIFY_CLIENT_ID` | ja, für echten Login | Spotify-Client-ID. Vite bettet sie beim Build ein. Kein Secret ins Repository. |
| `VITE_BASE` | nein | Öffentlicher Basis-Pfad. Pages-Workflow: `/musikerraten/`. Leer oder `/` für die Seitenwurzel. |

Lokal steht die Client-ID in `.env.local` (siehe `.env.example`). In GitHub Actions kommt sie aus dem Secret oder der Variable `VITE_SPOTIFY_CLIENT_ID`. Für den Produktions-Build dieselbe Variable in der Shell setzen.

## Produktions-Build

Live-URL nach dem Cutover: `https://musikerraten.wirsindgeil.com/`
Vite-Basis: `/`

```bash
export VITE_SPOTIFY_CLIENT_ID='…'   # lokal aus .env.local, in CI aus dem Secret
npm ci
npm run build:prod
```

`dist/` ist eine Release-Fassung für die Seitenwurzel. `index.html` und `favicon.svg` liegen an der Wurzel des Releases, gehashte Assets unter `dist/assets/`.

Kontrolle vor dem Kopieren: in `dist/index.html` beginnen Skript- und Stylesheet-Pfade mit `/assets/`.

## Server

| | |
| --- | --- |
| Live-URL | `https://musikerraten.wirsindgeil.com/` |
| Basis-Pfad | `/` |
| Docroot (Symlink) | `/var/www/musikerraten.wirsindgeil.com/current` |
| Releases | `/var/www/musikerraten.wirsindgeil.com/releases/<id>/` |
| SSH | Host-Alias `webserver` = `christian@10.73.92.1` (WireGuard), Key `ed25519_wg` |
| Helfer auf dem Server | `~/bin/deploy-musikerraten.sh` (atomarer Symlink-Wechsel) |

Nginx, der Docroot und HTTPS sind live unter `https://musikerraten.wirsindgeil.com/`.

Der Webserver zeigt auf den Symlink `current`. Ein neues Release liegt unter `releases/<id>/`. `deploy-musikerraten.sh` im Home von `christian` bekommt den Release-Pfad und stellt `current` atomar darauf um.

### Deploy

Build lokal mit Basis `/` erzeugen, dann:

```bash
STAMP=$(date +%Y%m%d-%H%M%S)
ssh webserver "install -d -o christian -g www-data -m 2750 /var/www/musikerraten.wirsindgeil.com/releases/$STAMP"
rsync -avz --delete dist/ "webserver:/var/www/musikerraten.wirsindgeil.com/releases/$STAMP/"
ssh webserver "~/bin/deploy-musikerraten.sh /var/www/musikerraten.wirsindgeil.com/releases/$STAMP"
```

Damit zeigt `/var/www/musikerraten.wirsindgeil.com/current` auf `/var/www/musikerraten.wirsindgeil.com/releases/<STAMP>/`. Das Release-Verzeichnis gehört `christian:www-data` (Modus `2750`).

`webserver` ist der SSH-Alias für `christian@10.73.92.1` (Key `ed25519_wg`, nur über WireGuard). Das Helfer-Skript selbst liegt auf dem Server, nicht in diesem Repository.

## Hinweis für den Serveradmin (SPA)

OAuth kehrt auf `https://musikerraten.wirsindgeil.com/?code=…&state=…` zurück. Der vHost für den Docroot `current` braucht dafür:

```nginx
try_files $uri $uri/ /index.html;
```

Nginx, Docroot und HTTPS sind bereit. GitHub Pages kopiert im Workflow zusätzlich `dist/404.html`. Der Produktions-Build legt diese Datei nicht an.

## Spotify-Redirects zum Cutover

Im [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) muss die Zeichenkette exakt stehen (Schema, Host, Port, Pfad, Schrägstrich). Dieses Repository und dieser Stand ändern das Dashboard nicht.

Eingetragen bleibt, solange Pages ausliefert:

- `https://derkulla.github.io/musikerraten/`

HTTPS für `https://musikerraten.wirsindgeil.com/` ist live. Die URI ins Dashboard aufnehmen, wenn der Login dort laufen soll:

- `https://musikerraten.wirsindgeil.com/`

Lokal, sobald das Dashboard bearbeitet werden kann (an der Wurzel sendet die App den Schrägstrich mit):

- `http://127.0.0.1:43123/`

Die Pages-URI aus dem Dashboard nehmen, nachdem Pages abgeschaltet ist. Bis dahin dürfen beide URIs parallel stehen.

## Cutover-Checkliste

1. Erledigt: DNS und Let's Encrypt. `https://musikerraten.wirsindgeil.com/` antwortet per HTTPS. Nginx und Docroot sind bereit.
2. Im Spotify-Dashboard `https://musikerraten.wirsindgeil.com/` hinzufügen. `https://derkulla.github.io/musikerraten/` bleibt stehen.
3. `VITE_SPOTIFY_CLIENT_ID` aus `.env.local` bzw. dem Secret setzen und `npm run build:prod` ausführen (Basis `/`).
4. Deploy mit dem Kommando oben (`STAMP`, `install`, `rsync`, `deploy-musikerraten.sh`).
5. `https://musikerraten.wirsindgeil.com/` öffnen. Auf dem Login-Screen muss die Redirect-URI exakt `https://musikerraten.wirsindgeil.com/` sein.
6. Wenn Pages nicht mehr gebraucht wird: Workflow `.github/workflows/pages.yml` bzw. die Pages-Quelle abschalten, danach die Redirect-URI `https://derkulla.github.io/musikerraten/` im Dashboard entfernen.
