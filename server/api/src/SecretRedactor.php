<?php

declare(strict_types=1);

namespace Musikerraten\Log;

final class SecretRedactor
{
    /** Entfernt Bearer-Tokens und Token-Felder aus einem Text. */
    public static function text(string $value): string
    {
        $redacted = preg_replace_callback(
            '/bearer\s+\S+|((?:access_token|refresh_token|id_token|client_secret)["\']?\s*[:=]\s*["\']?)[^\s"\',}&]+/i',
            static function (array $match): string {
                $prefix = $match[1] ?? '';
                if (is_string($prefix) && $prefix !== '') {
                    return $prefix . '[redacted]';
                }
                return 'bearer [redacted]';
            },
            $value,
        );

        return is_string($redacted) ? $redacted : $value;
    }

    /** Kürzt einen bereits geschwärzten Text auf eine Zeile. */
    public static function singleLine(string $value, int $limit = 2000): string
    {
        $text = trim(str_replace(["\r", "\n"], ' ', self::text($value)));
        return self::limit($text, $limit);
    }

    /** Schwärzt geheime Query-Parameter einer URL. */
    public static function url(string $value): string
    {
        $parts = parse_url($value);
        if (!is_array($parts) || !isset($parts['scheme'], $parts['host']) || !is_string($parts['host'])) {
            return self::singleLine($value, 500);
        }

        $query = [];
        if (isset($parts['query']) && is_string($parts['query'])) {
            parse_str($parts['query'], $query);
        }
        $secret = [
            'access_token',
            'refresh_token',
            'id_token',
            'client_secret',
            'code',
            'token',
            'state',
            'authorization',
        ];
        foreach ($query as $key => $item) {
            if (!in_array(strtolower((string) $key), $secret, true)) {
                continue;
            }
            $query[$key] = '[redacted]';
            unset($item);
        }

        $rebuilt = $parts['scheme'] . '://';
        if (isset($parts['user']) && is_string($parts['user'])) {
            $rebuilt .= $parts['user'] . '@';
        }
        $rebuilt .= $parts['host'];
        if (isset($parts['port'])) {
            $rebuilt .= ':' . $parts['port'];
        }
        if (isset($parts['path']) && is_string($parts['path'])) {
            $rebuilt .= $parts['path'];
        }
        if ($query !== []) {
            $rebuilt .= '?' . http_build_query($query);
        }

        return self::singleLine($rebuilt, 500);
    }

    /** Begrenzt die Länge eines Textes. */
    public static function limit(string $value, int $limit): string
    {
        if (strlen($value) <= $limit) {
            return $value;
        }
        return substr($value, 0, $limit);
    }
}
