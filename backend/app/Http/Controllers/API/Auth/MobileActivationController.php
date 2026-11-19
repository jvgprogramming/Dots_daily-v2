<?php

namespace App\Http\Controllers\API\Auth;

use App\Http\Controllers\API\BaseApiController;
use App\Http\Resources\UserResource;
use App\Models\EmailOtp;
use App\Models\User;
use App\Notifications\Auth\PatientOtpNotification;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Patient account activation and password reset by emailed one-time code.
 *
 * A health worker registers the patient with an email but no password. The
 * patient proves they own that email by entering the code sent to it, then
 * chooses their own password — so staff never know it. The same three steps
 * reset a forgotten password.
 *
 *   1. POST /mobile/otp/request  {email}                      → code emailed
 *   2. POST /mobile/otp/verify   {email, code}                → setup_token
 *   3. POST /mobile/otp/complete {email, setup_token, password} → signed in
 */
class MobileActivationController extends BaseApiController
{
    public function request(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'email']]);
        $user = $this->patient($data['email']);

        $meta = [
            'resend_in' => EmailOtp::RESEND_COOLDOWN_SECONDS,
            'expires_in' => EmailOtp::CODE_TTL_MINUTES * 60,
        ];

        // Same answer whether or not the account exists, so the endpoint can't
        // be used to discover which emails belong to patients.
        $message = 'If this email belongs to a DOTS Daily account, a 6-digit code is on its way.';

        if (! $user) {
            return $this->success(data: $meta, message: $message);
        }

        $otp = EmailOtp::firstWhere('user_id', $user->id);
        if ($otp && ($wait = $otp->resendIn()) > 0) {
            return $this->error(
                message: "Please wait {$wait} seconds before asking for another code.",
                code: 429,
                data: ['resend_in' => $wait],
            );
        }

        $code = str_pad((string) random_int(0, 999_999), 6, '0', STR_PAD_LEFT);
        EmailOtp::updateOrCreate(['user_id' => $user->id], [
            'code_hash' => Hash::make($code),
            'expires_at' => now()->addMinutes(EmailOtp::CODE_TTL_MINUTES),
            'attempts' => 0,
            'verified_at' => null,
            'setup_token_hash' => null,
        ]);

        $user->notify(new PatientOtpNotification($code, activating: $user->email_verified_at === null));
        Audit::log($request, 'auth.otp_sent', "Sent a sign-in code to {$user->email}", $user, userId: $user->id);

        return $this->success(data: $meta, message: $message);
    }

    public function verify(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'code' => ['required', 'digits:6'],
        ]);

        $user = $this->patient($data['email']);
        $otp = $user ? EmailOtp::firstWhere('user_id', $user->id) : null;

        if (! $otp || $otp->isExpired()) {
            return $this->error(message: 'This code has expired. Tap "Resend code" to get another.', code: 422);
        }
        // A wrong guess leaves the code usable until it expires; the route's
        // throttle (10/min) is what limits guessing.
        if (! Hash::check($data['code'], $otp->code_hash)) {
            return $this->error(message: "That code isn't right. Check the email and try again.", code: 422);
        }

        $setupToken = Str::random(64);
        $otp->update([
            'verified_at' => now(),
            'setup_token_hash' => hash('sha256', $setupToken),
        ]);

        return $this->success(data: ['setup_token' => $setupToken], message: 'Code confirmed.');
    }

    public function complete(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'setup_token' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = $this->patient($data['email']);
        $otp = $user ? EmailOtp::firstWhere('user_id', $user->id) : null;

        $valid = $otp
            && $otp->verified_at
            && $otp->setup_token_hash
            && $otp->verified_at->gt(now()->subMinutes(EmailOtp::SETUP_TTL_MINUTES))
            && hash_equals($otp->setup_token_hash, hash('sha256', $data['setup_token']));

        if (! $valid) {
            return $this->error(message: 'This session has expired. Please start again.', code: 422);
        }

        $activating = $user->email_verified_at === null;
        $user->forceFill([
            'password' => Hash::make($data['password']),
            'email_verified_at' => $user->email_verified_at ?? now(),
            'last_login_at' => now(),
        ])->save();
        $otp->delete();

        // A new password signs every other device out.
        $user->tokens()->delete();
        $token = $user->createToken('mobile-token')->plainTextToken;

        Audit::log(
            $request,
            $activating ? 'auth.account_activated' : 'auth.password_reset',
            $activating ? "{$user->email} activated their account" : "{$user->email} reset their password",
            $user,
            userId: $user->id,
        );

        return $this->success(
            data: [
                'user' => new UserResource($user->load('patient')),
                'token' => $token,
            ],
            message: $activating ? 'Your account is ready.' : 'Your password has been changed.',
        );
    }

    /** An active patient account with this email, or null. */
    private function patient(string $email): ?User
    {
        $user = User::where('email', $email)->first();

        return $user && $user->is_active && $user->canUseMobile() ? $user : null;
    }
}
