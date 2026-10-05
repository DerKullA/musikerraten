<?php

declare(strict_types=1);

namespace Musikerraten\Log;

use JsonException;

final class LogEndpoint
{
    private const DEFAULT_DIRECTORY = '/var/www/musikerraten.wirsindgeil.com/logs';

    private const CONTEXT_KEYS = ['source', 'uri', 'action', 'phase', 'step'];

    /** Nimmt nur gleichzeitige POST-Meldungen an und schreibt sie außerhalb des Docroots. */
    public static function handle(): void
    {
        $body = file_get_contents('php://input');
        $decision = self::accept([
            'method' => $_SERVER['REQUEST_METHOD'] ?? '',
            'origin' => $_SERVER['HTTP_ORIGIN'] ?? '',
            'referer' => $_SERVER['HTTP_REFERER'] ?? '',
            'host' => $_SERVER['HTTP_HOST'] ?? '',
            'contentType' => $_SERVER['CONTENT_TYPE'] ?? ($_SERVER['HTTP_CONTENT_TYPE'] ?? ''),
            'body' => is_string($body) ? $body : '',
        ]);
        if ($decision['status'] === 204 && isset($decision['level'], $decision['message'], $decision['context'])) {
            AppLogWriter::write(self::directory(), $decision['level'], $decision['message'], $decision['context']);
        }
        self::finish($decision['status']);
    }

    /** Liefert das Log-Verzeichnis aus der Umgebung oder den festen Geschwisterpfad. */
    public static function directory(): string
    {
        $env = getenv('MUSIKERRATEN_LOG_DIR');
        if (is_string($env) && $env !== '') {
            return $env;
        }
        return self::DEFAULT_DIRECTORY;
    }

    /**
     * Prüft Methode, Herkunft und JSON.
     *
     * @param array{method?: string, origin?: string, referer?: string, host?: string, contentType?: string, body?: string} $request
     * @return array{status: int, level?: string, message?: string, context?: array<string, string|null>}
     */
    public static function accept(array $request): array
    {
        $method = strtoupper((string) ($request['method'] ?? ''));
        if ($method !== 'POST') {
            return ['status' => 405];
        }
        if (!self::requestIsSameOrigin($request)) {
            return ['status' => 403];
        }
        $contentType = strtolower((string) ($request['contentType'] ?? ''));
        if (!str_starts_with($contentType, 'application/json')) {
            return ['status' => 415];
        }
        $body = (string) ($request['body'] ?? '');
        if ($body === '' || strlen($body) > 8192) {
            return ['status' => 400];
        }
        try {
            $decoded = json_decode($body, true, 8, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return ['status' => 400];
        }
        if (!is_array($decoded) || !self::isListFreeObject($decoded)) {
            return ['status' => 400];
        }
        $level = $decoded['level'] ?? null;
        $message = $decoded['message'] ?? null;
        if (($level !== 'error' && $level !== 'warning') || !is_string($message)) {
            return ['status' => 400];
        }
        $cleanMessage = SecretRedactor::singleLine($message);
        if ($cleanMessage === '') {
            return ['status' => 400];
        }

        return [
            'status' => 204,
            'level' => $level,
            'message' => $cleanMessage,
            'context' => self::context($decoded),
        ];
    }

    /** Antwortet ohne Körper und ohne Log-Inhalt. */
    private static function finish(int $status): void
    {
        http_response_code($status);
        header('Content-Length: 0');
        header('Cache-Control: no-store');
        header('X-Content-Type-Options: nosniff');
        if ($status === 405) {
            header('Allow: POST');
        }
    }

    /** Lässt nur Aufrufe derselben Herkunft durch, über Origin oder sonst Referer. */
    private static function requestIsSameOrigin(array $request): bool
    {
        $host = (string) ($request['host'] ?? '');
        $origin = (string) ($request['origin'] ?? '');
        if ($origin !== '') {
            return self::sameOrigin($origin, $host);
        }
        $referer = (string) ($request['referer'] ?? '');
        return $referer !== '' && self::sameOrigin($referer, $host);
    }

    /** Vergleicht eine URL mit dem Host ohne Schema und ohne Port. */
    private static function sameOrigin(string $origin, string $host): bool
    {
        $parsed = parse_url($origin);
        if (!is_array($parsed) || !isset($parsed['host']) || !is_string($parsed['host'])) {
            return false;
        }
        return self::hostName($parsed['host']) === self::hostName($host) && self::hostName($host) !== '';
    }

    /** Normalisiert einen Hostnamen. */
    private static function hostName(string $host): string
    {
        $name = strtolower(trim($host));
        $stripped = preg_replace('/:\d+$/', '', $name);
        return is_string($stripped) ? $stripped : $name;
    }

    /**
     * @param array<mixed> $decoded
     * @return array<string, string|null>
     */
    private static function context(array $decoded): array
    {
        $context = [];
        $raw = $decoded['context'] ?? null;
        if (is_array($raw)) {
            foreach (self::CONTEXT_KEYS as $key) {
                if (!array_key_exists($key, $raw)) {
                    continue;
                }
                $value = $raw[$key];
                if ($value === null) {
                    $context[$key] = null;
                    continue;
                }
                if (is_string($value) || is_int($value) || is_float($value) || is_bool($value)) {
                    $context[$key] = SecretRedactor::singleLine((string) $value, 500);
                }
            }
        }
        self::copyField($context, $decoded, 'page', 500, true);
        self::copyField($context, $decoded, 'version', 500, false);
        self::copyField($context, $decoded, 'stack', 2000, false);
        return $context;
    }

    /**
     * @param array<string, string|null> $context
     * @param array<mixed> $decoded
     */
    private static function copyField(array &$context, array $decoded, string $key, int $limit, bool $asUrl): void
    {
        $value = $decoded[$key] ?? null;
        if (!is_string($value) || trim($value) === '') {
            return;
        }
        $clean = $asUrl ? SecretRedactor::url($value) : SecretRedactor::singleLine($value, $limit);
        if ($clean !== '') {
            $context[$key] = $clean;
        }
    }

    /** Unterscheidet ein JSON-Objekt von einer Liste. */
    private static function isListFreeObject(array $value): bool
    {
        return array_is_list($value) === false || $value === [];
    }
}
