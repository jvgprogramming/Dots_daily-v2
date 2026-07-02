<?php

namespace App\Http\Controllers\API\Auth;

use App\Http\Controllers\API\BaseApiController;
use App\Models\User;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmailVerificationController extends BaseApiController
{
    public function sendVerification(Request $request): JsonResponse
    {
        if ($request->user()->hasVerifiedEmail()) {
            return $this->success(message: 'Email already verified.');
        }

        $request->user()->sendEmailVerificationNotification();

        return $this->success(message: 'Verification link sent.');
    }

    public function verify($id, $hash): JsonResponse
    {
        $user = User::findOrFail($id);

        if (! hash_equals((string) $hash, sha1($user->getEmailForVerification()))) {
            return $this->error(
                message: 'Invalid verification link.',
                code: 400,
            );
        }

        if ($user->hasVerifiedEmail()) {
            return $this->success(message: 'Email already verified.');
        }

        if ($user->markEmailAsVerified()) {
            event(new Verified($user));
        }

        return $this->success(message: 'Email verified successfully.');
    }
}
