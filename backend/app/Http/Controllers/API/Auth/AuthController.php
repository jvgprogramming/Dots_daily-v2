<?php

namespace App\Http\Controllers\API\Auth;

use App\Http\Controllers\API\BaseApiController;
use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Support\AppSettings;
use App\Support\Audit;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends BaseApiController
{
    public function register(RegisterRequest $request): JsonResponse
    {
        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'phone' => $request->phone,
            'password' => Hash::make($request->password),
            'role' => 'patient',
            'is_active' => true,
        ]);

        event(new Registered($user));

        $token = $user->createToken('auth-token')->plainTextToken;

        return $this->created(
            data: [
                'user' => new UserResource($user),
                'token' => $token,
            ],
            message: 'Registration successful. Please verify your email.',
        );
    }

    /** Lockout window after too many failed sign-ins. */
    private const LOCKOUT_SECONDS = 15 * 60;

    public function login(LoginRequest $request): JsonResponse
    {
        $email = Str::lower(trim((string) $request->email));
        $throttleKey = 'portal-login|'.$email.'|'.$request->ip();
        $maxAttempts = max(3, AppSettings::int('security.max_login_attempts', 5));

        if (RateLimiter::tooManyAttempts($throttleKey, $maxAttempts)) {
            $minutes = (int) ceil(RateLimiter::availableIn($throttleKey) / 60);
            Audit::log($request, 'login.locked', "Sign-in blocked for {$email}: too many failed attempts", properties: ['email' => $email]);

            return $this->error(
                message: "Too many failed sign-in attempts. Try again in {$minutes} minute".($minutes === 1 ? '' : 's').'.',
                code: 429,
            );
        }

        $user = User::where('email', $request->email)->first();

        if (! $user) {
            $this->recordFailure($request, $throttleKey, $email, 'unknown email');
            throw ValidationException::withMessages([
                'email' => ['No account found with that email address.'],
            ]);
        }

        if (! Hash::check($request->password, $user->password)) {
            $this->recordFailure($request, $throttleKey, $email, 'wrong password', $user->id);
            throw ValidationException::withMessages([
                'password' => ['Incorrect password. Please try again.'],
            ]);
        }

        if (! $user->is_active) {
            Audit::log($request, 'login.denied', "Sign-in refused for deactivated account {$email}", $user, ['email' => $email, 'reason' => 'deactivated'], $user->id);

            return $this->error(
                message: 'Account is deactivated. Contact an administrator.',
                code: 403,
            );
        }

        // Only portal roles may sign in here (admins and staff). Patient
        // accounts belong to the mobile app.
        if (! $user->canUsePortal()) {
            Audit::log($request, 'login.denied', "Portal sign-in refused for patient account {$email}", $user, ['email' => $email, 'reason' => 'not_portal_role'], $user->id);

            return $this->error(
                message: 'Access denied. This portal is for authorized hospital staff only.',
                code: 403,
            );
        }

        RateLimiter::clear($throttleKey);

        // One active web session per account, and it expires after a shift
        // (or sooner when an idle timeout is configured — see SlideSessionExpiry).
        $user->tokens()->delete();
        $idle = AppSettings::int('security.session_timeout_minutes', 0);
        $expires = $idle > 0 ? now()->addMinutes(min($idle, 12 * 60)) : now()->addHours(12);
        $token = $user->createToken('auth-token', ['*'], $expires)->plainTextToken;
        $user->update(['last_login_at' => now()]);

        Audit::log($request, 'login.success', "{$user->name} signed in", $user, ['email' => $email], $user->id);

        return $this->success(
            data: [
                'user' => new UserResource($user->load('patient')),
                'token' => $token,
            ],
            message: 'Login successful.',
        );
    }

    private function recordFailure(LoginRequest $request, string $throttleKey, string $email, string $reason, ?int $userId = null): void
    {
        RateLimiter::hit($throttleKey, self::LOCKOUT_SECONDS);
        Audit::log($request, 'login.failed', "Failed sign-in for {$email} ({$reason})", properties: [
            'email' => $email,
            'reason' => $reason,
        ], userId: $userId);
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->currentAccessToken()->delete();

        if ($user->canUsePortal()) {
            Audit::log($request, 'auth.logout', "{$user->name} signed out", $user);
        }

        return $this->success(message: 'Logged out successfully.');
    }

    public function user(Request $request): JsonResponse
    {
        return $this->success(
            data: [
                'user' => new UserResource($request->user()->load('patient')),
            ],
        );
    }
}
