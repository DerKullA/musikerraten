<?php

declare(strict_types=1);

require dirname(__DIR__) . '/api/bootstrap.php';

use Musikerraten\Log\AppLogWriter;
use Musikerraten\Log\LogEndpoint;
use Musikerraten\Log\SecretRedactor;

$failed = 0;

function check(bool $ok, string $message): void
{
    global $failed;
    if ($ok) {
        return;
    }
    $failed += 1;
    fwrite(STDERR, "FAIL {$message}\n");
}

check(SecretRedactor::text('Authorization: Bearer abc.def') === 'Authorization: bearer [redacted]', 'bearer');
check(SecretRedactor::text('access_token=geheim') === 'access_token=[redacted]', 'access_token');
check(!str_contains(SecretRedactor::text('access_token=geheim'), 'geheim'), 'access_token raw');

$denied = LogEndpoint::accept([
    'method' => 'GET',
    'origin' => 'https://musikerraten.wirsindgeil.com',
    'host' => 'musikerraten.wirsindgeil.com',
    'contentType' => 'application/json',
    'body' => '{"level":"error","message":"nein"}',
]);
check($denied['status'] === 405, 'get ist 405');

$foreign = LogEndpoint::accept([
    'method' => 'POST',
    'origin' => 'https://evil.example',
    'host' => 'musikerraten.wirsindgeil.com',
    'contentType' => 'application/json',
    'body' => '{"level":"error","message":"nein"}',
]);
check($foreign['status'] === 403, 'fremde Origin ist 403');

$anonymous = LogEndpoint::accept([
    'method' => 'POST',
    'origin' => '',
    'referer' => '',
    'host' => 'musikerraten.wirsindgeil.com',
    'contentType' => 'application/json',
    'body' => '{"level":"error","message":"nein"}',
]);
check($anonymous['status'] === 403, 'fehlende Origin ist 403');

$refererOnly = LogEndpoint::accept([
    'method' => 'POST',
    'origin' => '',
    'referer' => 'https://musikerraten.wirsindgeil.com/',
    'host' => 'musikerraten.wirsindgeil.com',
    'contentType' => 'application/json',
    'body' => '{"level":"warning","message":"Hinweis"}',
]);
check($refererOnly['status'] === 204, 'gleicher Referer ist 204');

$payload = json_encode([
    'level' => 'error',
    'message' => "Bearer secret-token\nzweite Zeile",
    'page' => 'https://musikerraten.wirsindgeil.com/?code=oauth-code&next=1',
    'version' => 'v1.0.0',
    'stack' => "Error: Bearer secret-token\nat play",
    'context' => [
        'source' => 'playback',
        'action' => 'play',
        'uri' => 'spotify:track:1',
        'nested' => ['no' => true],
    ],
    'extra' => 'weg',
], JSON_THROW_ON_ERROR);

$accepted = LogEndpoint::accept([
    'method' => 'POST',
    'origin' => 'https://musikerraten.wirsindgeil.com',
    'host' => 'musikerraten.wirsindgeil.com',
    'contentType' => 'application/json; charset=utf-8',
    'body' => $payload,
]);
check($accepted['status'] === 204, 'post ist 204');
check(($accepted['message'] ?? '') === 'bearer [redacted] zweite Zeile', 'nachricht geschwärzt');
check(!str_contains((string) ($accepted['message'] ?? ''), 'secret-token'), 'token weg');
$context = $accepted['context'] ?? [];
check(($context['source'] ?? '') === 'playback', 'source');
check(!array_key_exists('nested', $context), 'nested fehlt');
check(!array_key_exists('extra', $context), 'extra fehlt');
check(isset($context['page']) && !str_contains($context['page'], 'oauth-code'), 'code weg');
check(isset($context['stack']) && !str_contains($context['stack'], 'secret-token'), 'stack geschwärzt');

$dir = sys_get_temp_dir() . '/musikerraten-log-' . getmypid();
mkdir($dir, 0700, true);
$written = AppLogWriter::write($dir, (string) $accepted['level'], (string) $accepted['message'], $context);
check($written, 'schreiben');
$files = glob($dir . '/musikerraten-*.log');
check(is_array($files) && count($files) === 1, 'tagesdatei');
$line = is_array($files) ? (string) file_get_contents((string) $files[0]) : '';
check(str_contains($line, 'musikerraten.ERROR'), 'error-zeile');
check(str_contains($line, '[redacted]') && !str_contains($line, 'secret-token'), 'datei ohne token');

$warning = AppLogWriter::write($dir, 'warning', 'Puffer langsam', ['source' => 'console']);
check($warning, 'warning');
$warningLine = is_array($files) ? (string) file_get_contents((string) $files[0]) : '';
check(str_contains($warningLine, 'musikerraten.WARNING'), 'warning-zeile');

$blocked = sys_get_temp_dir() . '/releases/musikerraten-blocked-' . getmypid();
mkdir($blocked, 0700, true);
check(AppLogWriter::write($blocked, 'error', 'nein', []) === false, 'releases blockiert');

$info = LogEndpoint::accept([
    'method' => 'POST',
    'origin' => 'https://musikerraten.wirsindgeil.com',
    'host' => 'musikerraten.wirsindgeil.com',
    'contentType' => 'application/json',
    'body' => '{"level":"info","message":"still"}',
]);
check($info['status'] === 400, 'info abgelehnt');

putenv('MUSIKERRATEN_LOG_DIR');
check(LogEndpoint::directory() === '/var/www/musikerraten.wirsindgeil.com/logs', 'standardverzeichnis');
putenv('MUSIKERRATEN_LOG_DIR=/tmp/musikerraten-custom');
check(LogEndpoint::directory() === '/tmp/musikerraten-custom', 'env verzeichnis');
putenv('MUSIKERRATEN_LOG_DIR');

$_SERVER['REQUEST_METHOD'] = 'GET';
$_SERVER['HTTP_ORIGIN'] = 'https://musikerraten.wirsindgeil.com';
$_SERVER['HTTP_HOST'] = 'musikerraten.wirsindgeil.com';
ob_start();
LogEndpoint::handle();
ob_end_clean();
check(http_response_code() === 405, 'handle get');

if ($failed > 0) {
    fwrite(STDERR, "{$failed} Prüfungen fehlgeschlagen\n");
    exit(1);
}

fwrite(STDOUT, "log endpoint ok\n");
