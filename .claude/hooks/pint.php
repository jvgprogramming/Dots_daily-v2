<?php
// PostToolUse hook: run Laravel Pint on an edited backend PHP file.
$input = json_decode(stream_get_contents(STDIN), true);
$file = $input['tool_input']['file_path'] ?? ($input['tool_response']['filePath'] ?? null);
if (!$file || substr($file, -4) !== '.php') exit(0);

$backend = realpath(__DIR__ . '/../../backend');
$real = realpath($file);
if (!$backend || !$real) exit(0);

$norm = fn($p) => strtolower(str_replace('\\', '/', $p));
if (strpos($norm($real), $norm($backend) . '/') !== 0) exit(0);
if (strpos($norm($real), $norm($backend) . '/vendor/') === 0) exit(0);

chdir($backend);
$pint = $backend . DIRECTORY_SEPARATOR . 'vendor' . DIRECTORY_SEPARATOR . 'bin' . DIRECTORY_SEPARATOR . 'pint';
passthru(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($pint) . ' ' . escapeshellarg($real), $code);
exit($code);
