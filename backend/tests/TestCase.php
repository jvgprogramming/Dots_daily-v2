<?php

namespace Tests;

use App\Models\Setting;
use App\Support\AppSettings;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /** Store a setting (e.g. 'vot.enroll_by_default') and drop the cache. */
    protected function storeSetting(string $dotted, string $value): void
    {
        [$group, $key] = explode('.', $dotted, 2);
        Setting::query()->updateOrCreate(['group' => $group, 'key' => $key], ['value' => $value]);
        AppSettings::flush();
    }
}
