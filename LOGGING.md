# Logs für Musikerraten

Die laufende App meldet Fehler und Warnungen an eine kleine PHP-Schnittstelle. Die schreibt nur `ERROR` und `WARNING` in ein Verzeichnis **neben** dem Docroot, nicht in `current` und nicht in `releases/`.

Dieser Stand deployt nichts. Vor dem Go-live schaltet der Serveradmin PHP-FPM und den Nginx-Pfad frei. Den Deploy gibt Christian frei.

## Browser

`installClientLogger()` in `src/main.tsx` hängt sich an:

- `window` `error`
- `unhandledrejection`
- `console.error` (Stufe `error`)
- `console.warn` (Stufe `warning`)

Wiedergabe-Fehler (SDK, Player-API, Warmup, Gerätewechsel) gehen zusätzlich direkt auf Stufe `error`, auch wenn sie in der Oberfläche abgefangen werden. `src/lib/playbackLog.ts` gibt es nicht mehr. Die Warmup- und Pufferlogik bleibt; es gibt keine zweite Konsolen-Schicht.

Der Browser sendet `POST` mit JSON an die gleiche Herkunft, Pfad `/api/log.php`. Der Aufruf blockiert die Oberfläche nicht. Schlägt er fehl (lokal gibt es kein PHP), passiert nichts weiter.

Bearer-Tokens, `access_token`, `refresh_token`, `id_token`, `client_secret` und die OAuth-Parameter `code` und `state` in der Seiten-URL werden vor dem Versand geschwärzt. Der Server schwärzt dieselben Felder noch einmal.

## Pfade

| | |
| --- | --- |
| Quelltext | `server/api/` |
| Auf dem Server | `/var/www/musikerraten.wirsindgeil.com/api/` |
| Script | `/var/www/musikerraten.wirsindgeil.com/api/log.php` |
| Log-Verzeichnis | `/var/www/musikerraten.wirsindgeil.com/logs` |
| Umgebungsvariable | `MUSIKERRATEN_LOG_DIR` |
| Tagesdatei | `musikerraten-YYYY-MM-DD.log` |

`server/api/` gehört nicht ins Vite-`dist/` und nicht in ein Release unter `releases/<id>/`. Der Docroot bleibt `current`. Die Schnittstelle liegt daneben, damit ein Release-Wechsel sie nicht mitnimmt und niemand die Logs über die Website lädt.

Ohne `MUSIKERRATEN_LOG_DIR` gilt der Pfad oben. Liegt Monolog in `server/api/vendor/`, schreibt Monolog (`RotatingFileHandler`, Stufe WARNING, 14 Tage). Ohne `vendor/` schreibt dieselbe Zeile die kleine Ersatzfunktion.

## Serveradmin, vor dem Go-live

1. PHP-FPM installieren und den Socket notieren, zum Beispiel `unix:/run/php/php8.3-fpm.sock`.
2. Log-Verzeichnis anlegen. Gruppe `www-data`, damit PHP schreiben und das SSH-Konto lesen kann, sobald es in der Gruppe ist:

```bash
sudo install -d -o www-data -g www-data -m 2770 /var/www/musikerraten.wirsindgeil.com/logs
sudo usermod -aG www-data christian
```

3. `server/api/` nach `/var/www/musikerraten.wirsindgeil.com/api/` legen (ohne `vendor/` aus einem anderen Rechner zu mischen) und Monolog installieren:

```bash
composer install --no-dev --no-interaction --working-dir /var/www/musikerraten.wirsindgeil.com/api
```

4. In der PHP-FPM-Pool-Datei das Verzeichnis setzen:

```ini
env[MUSIKERRATEN_LOG_DIR] = /var/www/musikerraten.wirsindgeil.com/logs
```

5. Nginx **vor** dem SPA-`try_files` eintragen. `SCRIPT_FILENAME` zeigt auf die Datei außerhalb von `current`:

```nginx
location = /api/log.php {
    include fastcgi_params;
    fastcgi_pass unix:/run/php/php8.3-fpm.sock;
    fastcgi_param SCRIPT_FILENAME /var/www/musikerraten.wirsindgeil.com/api/log.php;
    client_max_body_size 8k;
    limit_except POST { deny all; }
}

location /api/ {
    deny all;
}

location /logs/ {
    deny all;
}
```

Den Socket an die installierte PHP-Version anpassen. `/api/` außer `log.php` und `/logs/` bleiben gesperrt. Es gibt keine Liste der Logdateien.

6. Christian gibt den Deploy frei. Dieses Repository rollt den Stand nicht aus.

## Logs lesen

```bash
ssh webserver 'tail -f /var/www/musikerraten.wirsindgeil.com/logs/musikerraten-$(date +%F).log'
```

`webserver` ist der SSH-Alias aus [DEPLOY.md](DEPLOY.md) (`christian@10.73.92.1`, nur über WireGuard).

Eine Zeile sieht so aus:

```text
[2026-10-05T12:00:00+00:00] musikerraten.ERROR: Der Song hat nicht gestartet. {"source":"playback","action":"play","step":"buffer"} []
```

## Sicherheit

- nur `POST`, andere Methoden `405` bzw. Nginx `deny`
- `Origin` muss zum `Host` passen, sonst der `Referer`; fehlt beides, `403`
- nur JSON, höchstens 8 KB, nur die Stufen `error` und `warning`
- Antwort ohne Körper (`204`), der Log-Inhalt geht nicht zurück
- keine Verzeichnislistings, Logs nicht im Docroot
- Tokens werden im Browser und noch einmal in PHP ersetzt

## Lokal prüfen

`npm run dev` hat kein PHP. Der Browser versucht den `POST`, verwirft das Ergebnis und läuft weiter.

```bash
php server/tests/log_endpoint_test.php
```
