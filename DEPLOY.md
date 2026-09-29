# Deploy: GitHub Pages und wisinguy.com

Zwei statische Ziele, ein Build. GitHub Pages bleibt die Live-Seite, bis der Cutover auf [https://wisinguy.com/](https://wisinguy.com/) abgeschlossen ist. `getRedirectUri()` setzt `window.location.origin` plus die konfigurierte Vite-Basis, immer mit abschließendem Schrägstrich. Die wisinguy-Adresse steht damit erst an, wenn der Build mit Basis `/` dort ausgeliefert wird. Bis dahin sendet der Pages-Build weiter `https://derkulla.github.io/musikerraten/`.

## Ziele

| Ziel | Befehl | Vite-`base` | Spotify-Redirect (exakt) |
| --- | --- | --- | --- |
| GitHub Pages (live) | `npm run build:pages` | `/musikerraten/` | `https://derkulla.github.io/musikerraten/` |
| wisinguy.com (nach Cutover) | `npm run build:wisinguy` | `/` | `https://wisinguy.com/` |
| Lokal | `npm run dev` | `/` | `http://127.0.0.1:43123/` |

`npm run build` ohne gesetztes `VITE_BASE` erzeugt die Seitenwurzel (`/`), also das wisinguy-Artefakt. Das Pages-Workflow setzt `VITE_BASE=/musikerraten/` und bleibt beim bisherigen Pfad. Ein gesetztes `VITE_BASE` gewinnt gegenüber dem Default in `vite.config.ts`. `build:pages` und `build:wisinguy` übergeben `--base` und legen den Pfad damit für diesen Lauf fest.

## Umgebungsvariablen

| Variable | Pflicht | Wirkung |
| --- | --- | --- |
| `VITE_SPOTIFY_CLIENT_ID` | ja, für echten Login | Spotify-Client-ID. Vite bettet sie beim Build ein. Kein Secret ins Repository. |
| `VITE_BASE` | nein | Öffentlicher Basis-Pfad. Pages-Workflow: `/musikerraten/`. Leer oder `/` für die Seitenwurzel. |

Lokal steht die Client-ID in `.env.local` (siehe `.env.example`). In GitHub Actions kommt sie aus dem Secret oder der Variable `VITE_SPOTIFY_CLIENT_ID`. Für den wisinguy-Build dieselbe Variable in der Shell setzen.

## wisinguy-Build

Live-URL nach dem Cutover: `https://wisinguy.com/`
Vite-Basis: `/`

```bash
export VITE_SPOTIFY_CLIENT_ID='…'
npm ci
npm run build:wisinguy
```

`dist/` ist eine Release-Fassung für die Seitenwurzel. `index.html` und `favicon.svg` liegen an der Wurzel des Releases, gehashte Assets unter `dist/assets/`.

Kontrolle vor dem Kopieren: in `dist/index.html` beginnen Skript- und Stylesheet-Pfade mit `/assets/`.

## Server

| | |
| --- | --- |
| Live-URL | `https://wisinguy.com/` |
| Basis-Pfad | `/` |
| Docroot (Symlink) | `/var/www/wisinguy.com/current` |
| Releases | `/var/www/wisinguy.com/releases/<id>/` |
| Besitzer | `christian:www-data` |
| SSH | WireGuard, `christian@10.73.92.1`, Alias `webserver`, Key `ed25519_wg` |
| Helfer auf dem Server | `~/bin/deploy-wisinguy.sh` (atomarer Symlink-Wechsel) |

Der Webserver zeigt auf den Symlink `current`. Ein neues Release liegt unter `releases/<id>/`. `deploy-wisinguy.sh` im Home von `christian` stellt `current` atomar auf dieses Release um.

### Deploy über den Helfer

Build lokal mit Basis `/` erzeugen, das Release auf den Server legen und den Symlink mit dem Helfer umschalten:

```bash
ssh webserver
~/bin/deploy-wisinguy.sh
```

`webserver` ist der SSH-Alias für `christian@10.73.92.1` (Key `ed25519_wg`, nur über WireGuard). Argumente des Helfers stehen auf dem Server; dieses Repository enthält das Skript nicht.

### Deploy von Hand

```bash
RELEASE=$(date -u +%Y%m%d%H%M%S)
rsync -a dist/ "webserver:/var/www/wisinguy.com/releases/${RELEASE}/"
ssh webserver "chown -R christian:www-data /var/www/wisinguy.com/releases/${RELEASE} && ln -sfn /var/www/wisinguy.com/releases/${RELEASE} /var/www/wisinguy.com/current"
```

Damit zeigt `/var/www/wisinguy.com/current` auf `/var/www/wisinguy.com/releases/<timestamp>/`. Besitzer des Releases: `christian:www-data`.

## Hinweis für den Serveradmin (SPA)

OAuth kehrt auf `https://wisinguy.com/?code=…&state=…` zurück. Der vHost für den Docroot `current` braucht dafür:

```nginx
try_files $uri $uri/ /index.html;
```

Das richtet der Serveradmin ein. GitHub Pages kopiert im Workflow zusätzlich `dist/404.html`. Der wisinguy-Build legt diese Datei nicht an.

## Spotify-Redirects zum Cutover

Im [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) muss die Zeichenkette exakt stehen (Schema, Host, Port, Pfad, Schrägstrich). Dieses Repository und dieser Stand ändern das Dashboard nicht.

Eingetragen bleibt, solange Pages ausliefert:

- `https://derkulla.github.io/musikerraten/`

Erst hinzufügen, wenn `https://wisinguy.com/` per HTTPS erreichbar ist und der Login dort laufen soll:

- `https://wisinguy.com/`

Lokal, sobald das Dashboard bearbeitet werden kann (an der Wurzel sendet die App den Schrägstrich mit):

- `http://127.0.0.1:43123/`

Die Pages-URI aus dem Dashboard nehmen, nachdem Pages abgeschaltet ist. Bis dahin dürfen beide URIs parallel stehen.

## Cutover-Checkliste

1. DNS: A-Record für `wisinguy.com` auf `5.146.125.66`.
2. Warten, bis HTTPS für `https://wisinguy.com/` live und gültig ist. Spotify akzeptiert Produktions-Redirects nur über HTTPS.
3. Im Spotify-Dashboard `https://wisinguy.com/` hinzufügen. `https://derkulla.github.io/musikerraten/` bleibt stehen.
4. `VITE_SPOTIFY_CLIENT_ID` setzen und `npm run build:wisinguy` ausführen (Basis `/`).
5. Deploy über `~/bin/deploy-wisinguy.sh`, oder `dist/` nach `/var/www/wisinguy.com/releases/<timestamp>/` legen und `current` darauf zeigen lassen. Besitzer `christian:www-data`.
6. `https://wisinguy.com/` öffnen. Auf dem Login-Screen muss die Redirect-URI exakt `https://wisinguy.com/` sein.
7. Wenn Pages nicht mehr gebraucht wird: Workflow `.github/workflows/pages.yml` bzw. die Pages-Quelle abschalten, danach die Redirect-URI `https://derkulla.github.io/musikerraten/` im Dashboard entfernen.
