<?php

namespace App\Http\Middleware;

use App\Support\AppSettings;
use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

/**
 * Idle session timeout for portal (admin/staff) sign-ins.
 *
 * When Security → "Session timeout" is set, every authenticated request pushes
 * the token's `expires_at` to now + timeout, capped at the 12-hour shift limit
 * set at login. A token left idle longer than the timeout is then rejected by
 * Sanctum itself on the next request (401 → the web app signs out). Mobile
 * patient tokens are untouched.
 */
class SlideSessionExpiry
{
    private const SHIFT_HOURS = 12;

    public function handle(Request $request, Closure $next): Response
    {
        // Group middleware runs before the route's auth:sanctum, so slide the
        // expiry once the request has been authenticated and handled.
        $response = $next($request);

        $user = $request->user();
        $token = $user?->currentAccessToken();
        $minutes = AppSettings::int('security.session_timeout_minutes', 0);

        // `exists` is false after logout deleted the token — saving would re-create it.
        if ($minutes > 0 && $token instanceof PersonalAccessToken && $token->exists && $user->canUsePortal()) {
            $cap = $token->created_at->copy()->addHours(self::SHIFT_HOURS);
            $next_expiry = now()->addMinutes($minutes)->min($cap);

            // Skip the write when the expiry barely moves.
            if ($token->expires_at === null || abs($token->expires_at->diffInSeconds($next_expiry)) >= 30) {
                $token->forceFill(['expires_at' => $next_expiry])->save();
            }
        }

        return $response;
    }
}
