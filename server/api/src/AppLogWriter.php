<?php

declare(strict_types=1);

namespace Musikerraten\Log;

use Monolog\Formatter\LineFormatter;
use Monolog\Handler\RotatingFileHandler;
use Monolog\Level;
use Monolog\Logger;
use Throwable;

final class AppLogWriter
{
    /** Schreibt ERROR oder WARNING nach Monolog, sonst in dieselbe Tagesdatei. */
    public static function write(string $directory, string $level, string $message, array $context): bool
    {
        if ($level !== 'error' && $level !== 'warning') {
            return false;
        }
        if (!self::directoryAllowed($directory)) {
            error_log('Musikerraten-Log-Pfad abgelehnt.');
            return false;
        }
        if (!is_dir($directory) || !is_writable($directory)) {
            error_log('Musikerraten-Log nicht schreibbar.');
            return false;
        }

        try {
            if (class_exists(Logger::class) && self::writeWithMonolog($directory, $level, $message, $context)) {
                return true;
            }
        } catch (Throwable $error) {
            error_log('Musikerraten Monolog: ' . $error->getMessage());
        }

        return self::writeFallback($directory, $level, $message, $context);
    }

    /** Lehnt Log-Pfade im Docroot und in Release-Verzeichnissen ab. */
    private static function directoryAllowed(string $directory): bool
    {
        $normalized = rtrim(str_replace('\\', '/', $directory), '/');
        if ($normalized === '' || str_contains($normalized, "\0")) {
            return false;
        }
        if (str_ends_with($normalized, '/current') || str_contains($normalized, '/releases/')) {
            return false;
        }
        return true;
    }

    /** Schreibt über Monolog ab WARNING in die rotierende Tagesdatei. */
    private static function writeWithMonolog(string $directory, string $level, string $message, array $context): bool
    {
        $logger = new Logger('musikerraten');
        $handler = new RotatingFileHandler(
            $directory . '/musikerraten.log',
            14,
            Level::Warning,
            true,
            0660,
            true,
        );
        $handler->setFormatter(new LineFormatter(
            "[%datetime%] %channel%.%level_name%: %message% %context% %extra%\n",
            'Y-m-d\TH:i:sP',
            false,
            true,
        ));
        $logger->pushHandler($handler);
        if ($level === 'warning') {
            $logger->warning($message, $context);
            return true;
        }
        $logger->error($message, $context);
        return true;
    }

    /** Schreibt dieselbe Zeile, wenn Monolog nicht installiert ist. */
    private static function writeFallback(string $directory, string $level, string $message, array $context): bool
    {
        $encoded = json_encode($context, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $line = sprintf(
            "[%s] musikerraten.%s: %s %s []\n",
            (new \DateTimeImmutable('now'))->format('Y-m-d\TH:i:sP'),
            strtoupper($level),
            $message,
            is_string($encoded) ? $encoded : '{}',
        );
        $path = $directory . '/musikerraten-' . (new \DateTimeImmutable('now'))->format('Y-m-d') . '.log';
        $written = file_put_contents($path, $line, FILE_APPEND | LOCK_EX);
        if ($written === false) {
            error_log('Musikerraten-Log nicht schreibbar.');
            return false;
        }
        @chmod($path, 0660);
        return true;
    }
}
