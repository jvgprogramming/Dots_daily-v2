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
     * Mobile login — patient accounts only. Staff use the web portal.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::where('email', $request->email)->first();

        // A patient whose email was never confirmed has no password of their
        // own yet (staff registered them), so send the app into activation.
        if ($user && $user->is_active && $user->canUseMobile() && $user->email_verified_at === null) {
            return $this->error(
                message: 'Your account needs to be activated first. We will email you a code.',
                code: 403,
                data: ['reason' => 'activation_required'],
            );
        }

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

        if (! $user->canUseMobile()) {
            return $this->error(
                message: 'This app is for patient accounts. Staff should sign in to the web portal.',
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
