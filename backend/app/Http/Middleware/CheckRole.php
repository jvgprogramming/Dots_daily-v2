<?php

namespace App\Http\Middleware;

use App\Traits\ApiResponse;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckRole
{
    use ApiResponse;

    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user) {
            return $this->error(
                message: 'Unauthenticated.',
                code: 401,
            );
        }

        // A deactivated account loses access immediately, even if it still
        // holds a token issued before it was deactivated.
        if ($user->is_active === false) {
            return $this->error(
                message: 'Account is deactivated. Contact an administrator.',
                code: 403,
            );
        }

        foreach ($roles as $role) {
            if ($user->role === $role) {
                return $next($request);
            }
        }

        return $this->error(
            message: 'Forbidden. You do not have the required role.',
            code: 403,
        );
    }
}
