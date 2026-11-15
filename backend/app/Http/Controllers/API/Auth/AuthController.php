<?php

namespace App\Http\Controllers\API\Auth;

use App\Http\Controllers\API\BaseApiController;
use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
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

    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::where('email', $request->email)->first();

        if (! $user) {
            throw ValidationException::withMessages([
                'email' => ['No account found with that email address.'],
            ]);
        }

        if (! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'password' => ['Incorrect password. Please try again.'],
            ]);
        }

        if (! $user->is_active) {
            return $this->error(
                message: 'Account is deactivated. Contact an administrator.',
                code: 403,
            );
        }

        // Only staff roles may use the web portal (admins and nurses).
        if (! $user->canUsePortal()) {
            return $this->error(
                message: 'Access denied. This portal is for authorized hospital staff only.',
                code: 403,
            );
        }

        // One active web session per account, and it expires after a shift.
        $user->tokens()->delete();
        $token = $user->createToken('auth-token', ['*'], now()->addHours(12))->plainTextToken;
        $user->update(['last_login_at' => now()]);

        return $this->success(
            data: [
                'user' => new UserResource($user->load('patient')),
                'token' => $token,
            ],
            message: 'Login successful.',
        );
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

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
