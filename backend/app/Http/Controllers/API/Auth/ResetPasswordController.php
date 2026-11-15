<?php

namespace App\Http\Controllers\API\Auth;

use App\Http\Controllers\API\BaseApiController;
use App\Http\Controllers\API\SettingsController;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;

class ResetPasswordController extends BaseApiController
{
    public function reset(Request $request): JsonResponse
    {
        $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string', 'min:'.SettingsController::passwordMin(), 'confirmed'],
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function ($user, $password) use ($request) {
                $user->forceFill([
                    'password' => Hash::make($password),
                ])->save();

                $user->tokens()->delete();

                Audit::log($request, 'auth.password_reset', "{$user->email} reset their password via email link", $user, userId: $user->id);
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return $this->success(message: 'Password reset successful.');
        }

        throw ValidationException::withMessages([
            'email' => [__($status)],
        ]);
    }
}
