# Deploy: musikerraten.wirsindgeil.com

Produktionsziel ist die Dokumentwurzel auf [https://musikerraten.wirsindgeil.com/](https://musikerraten.wirsindgeil.com/). `npm run build` erzeugt `dist/` mit Vite-Basis `/`. Asset-Pfade beginnen mit `/assets/`.

`getRedirectUri()` setzt `window.location.origin` plus die Vite-Basis, immer mit abschließendem Schrägstrich. Bei Basis `/` sendet die App daher `https://musikerraten.wirsindgeil.com/`.

GitHub Pages ist abgelöst. Das Workflow-File `.github/workflows/pages.yml` ist entfernt. Es gibt keinen Pages-Build und keine Basis `/musikerraten/` mehr. Diese Änderung deployt nichts: kein Push auf den Webserver, kein Spotify-Dashboard.

## Ziele

| Ziel | Befehl | Vite-`base` | Spotify-Redirect (exakt) |
| --- | --- | --- | --- |
| musikerraten.wirsindgeil.com | `npm run build` | `/` | `https://musikerraten.wirsindgeil.com/` |
| Lokal | `npm run dev` | `/` | `http://127.0.0.1:43123/` |

Die Basis steht fest auf `/` (`ROOT_BASE_PATH` in `vite.config.ts`). `VITE_BASE` wird nicht gelesen.

## Umgebungsvariablen

| Variable | Pflicht | Wirkung |
| --- | --- | --- |
| `VITE_SPOTIFY_CLIENT_ID` | ja, für echten Login | Spotify-Client-ID. Vite bettet sie beim Build ein. Kein Secret ins Repository. |

Lokal steht die Client-ID in `.env.local` (siehe `.env.example`). Ein späterer Build auf dem Server setzt dieselbe Variable in der Umgebung.

## Produktions-Build

Live-URL: `https://musikerraten.wirsindgeil.com/`
Vite-Basis: `/`

```bash
export VITE_SPOTIFY_CLIENT_ID='…'   # lokal aus .env.local
npm ci
npm run build
```

`dist/` ist die Fassung für die Seitenwurzel. `index.html` und `favicon.svg` liegen an der Wurzel des Releases, gehashte Assets unter `dist/assets/`.

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

Dieses Repository enthält den Build, nicht den Auslieferungsvorgang. Ein späterer Webhook-Deploy von `main` liegt beim Serveradmin und ist nicht Teil dieser Änderung.

### Manuelles Kopieren eines fertigen `dist/`

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

Der Produktions-Build legt keine `dist/404.html` an.

## Spotify-Redirect

Im [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) muss die Zeichenkette exakt stehen (Schema, Host, Port, Pfad, Schrägstrich). Dieses Repository ändert das Dashboard nicht. Der Redirect für `https://musikerraten.wirsindgeil.com/` ist dort bereits eingetragen.

Die App sendet:

- Produktion: `https://musikerraten.wirsindgeil.com/`
- Lokal: `http://127.0.0.1:43123/`

## Checkliste für einen späteren Release-Stand

1. `VITE_SPOTIFY_CLIENT_ID` setzen und `npm run build` ausführen (Basis `/`).
2. In `dist/index.html` prüfen, dass Skript- und Stylesheet-Pfade mit `/assets/` beginnen.
3. Auslieferung macht der Serveradmin (Webhook von `main` oder das Kopierkommando oben). Dieser Stand deployt nicht.
4. `https://musikerraten.wirsindgeil.com/` öffnen. Auf dem Login-Screen muss die Redirect-URI exakt `https://musikerraten.wirsindgeil.com/` sein.
