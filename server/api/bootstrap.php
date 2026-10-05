<?php

declare(strict_types=1);

$autoload = __DIR__ . '/vendor/autoload.php';
if (is_file($autoload)) {
    require $autoload;
    return;
}

require __DIR__ . '/src/SecretRedactor.php';
require __DIR__ . '/src/AppLogWriter.php';
require __DIR__ . '/src/LogEndpoint.php';
