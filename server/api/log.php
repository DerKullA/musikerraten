<?php

declare(strict_types=1);

ini_set('display_errors', '0');

require __DIR__ . '/bootstrap.php';

Musikerraten\Log\LogEndpoint::handle();
