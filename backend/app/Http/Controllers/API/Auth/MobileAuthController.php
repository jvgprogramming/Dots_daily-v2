<?php

namespace App\Http\Controllers\API\Auth;

use App\Http\Controllers\API\BaseApiController;
use App\Http\Requests\LoginRequest;
use App\Http\Resources\PatientResource;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class MobileAuthController extends BaseApiController
{
    /**
     * Mobile login — allows both patients and admins.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if (! $user->is_active) {
            return $this->error(
                message: 'Account is deactivated. Contact an administrator.',
                code: 403,
            );
        }

        $user->tokens()->delete();
        $token = $user->createToken('mobile-token')->plainTextToken;
        $user->update(['last_login_at' => now()]);

        return $this->success(
            data: [
                'user' => new UserResource($user->load('patient')),
                'token' => $token,
            ],
            message: 'Login successful.',
        );
    }

    /**
     * Get the authenticated user's profile (with patient details).
     */
    public function profile(Request $request): JsonResponse
    {
        $user = $request->user()->load('patient');

        return $this->success(
            data: [
                'user' => new UserResource($user),
                'patient' => $user->patient
                    ? new PatientResource($user->patient)
                    : null,
            ],
            message: 'Profile retrieved successfully.',
        );
    }

    /**
     * Mobile logout.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return $this->success(message: 'Logged out successfully.');
    }
}
