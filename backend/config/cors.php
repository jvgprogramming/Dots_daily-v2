<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => [env('APP_FRONTEND_URL', 'http://localhost:3000')],

    // In local development only, also accept any localhost / 127.0.0.1 port so the
    // Flutter web build (which binds a random port each run) can reach the API.
    // Production keeps the strict whitelist above — browsers from other origins
    // are blocked. Native mobile builds are not affected by CORS at all.
    'allowed_origins_patterns' => env('APP_ENV') === 'local'
        ? ['#^http://(localhost|127\.0\.0\.1)(:\d+)?$#']
        : [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
