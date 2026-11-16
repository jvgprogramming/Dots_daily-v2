<?php

namespace App\Services\Vot;

use RuntimeException;

/**
 * A VOT rule was broken (not enrolled, duplicate proof, wrong state…). Carries
 * the HTTP status the API should answer with, so controllers stay thin.
 */
class VotException extends RuntimeException
{
    public function __construct(string $message, public readonly int $status = 422)
    {
        parent::__construct($message);
    }
}
