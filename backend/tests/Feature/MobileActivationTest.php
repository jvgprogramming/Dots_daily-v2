<?php

namespace Tests\Feature;

use App\Models\EmailOtp;
use App\Models\User;
use App\Notifications\Auth\PatientOtpNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * A health worker registers a patient's email; the patient proves they own it
 * with an emailed code and picks their own password in the app.
 */
class MobileActivationTest extends TestCase
{
    use RefreshDatabase;

    private ?string $sentCode = null;

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
    }

    /** Request a code and capture it from the faked email. */
    private function requestCode(User $user): string
    {
        $this->postJson('/api/v1/mobile/otp/request', ['email' => $user->email])->assertOk();

        Notification::assertSentTo($user, PatientOtpNotification::class, function ($n) use ($user) {
            preg_match('/\b(\d{6})\b/', $n->toMail($user)->subject, $m);
            $this->sentCode = $m[1] ?? null;

            return true;
        });

        return $this->sentCode;
    }

    public function test_an_unactivated_patient_is_sent_to_activation_on_login(): void
    {
        $user = User::factory()->unverified()->create();

        $this->postJson('/api/v1/mobile/login', ['email' => $user->email, 'password' => 'anything'])
            ->assertStatus(403)
            ->assertJsonPath('data.reason', 'activation_required');
    }

    public function test_a_patient_activates_with_the_emailed_code_and_their_own_password(): void
    {
        $user = User::factory()->unverified()->create();
        $code = $this->requestCode($user);

        $token = $this->postJson('/api/v1/mobile/otp/verify', ['email' => $user->email, 'code' => $code])
            ->assertOk()
            ->json('data.setup_token');

        $this->postJson('/api/v1/mobile/otp/complete', [
            'email' => $user->email,
            'setup_token' => $token,
            'password' => 'my-own-secret',
            'password_confirmation' => 'my-own-secret',
        ])->assertOk()->assertJsonStructure(['data' => ['token', 'user']]);

        $user->refresh();
        $this->assertNotNull($user->email_verified_at);
        $this->assertTrue(Hash::check('my-own-secret', $user->password));
        $this->assertDatabaseMissing('email_otps', ['user_id' => $user->id]);

        $this->postJson('/api/v1/mobile/login', ['email' => $user->email, 'password' => 'my-own-secret'])
            ->assertOk();
    }

    public function test_a_wrong_code_is_refused_and_attempts_are_limited(): void
    {
        $user = User::factory()->unverified()->create();
        $code = $this->requestCode($user);
        $wrong = $code === '000000' ? '111111' : '000000';

        for ($i = 0; $i < EmailOtp::MAX_ATTEMPTS; $i++) {
            $this->postJson('/api/v1/mobile/otp/verify', ['email' => $user->email, 'code' => $wrong])
                ->assertStatus(422);
        }

        // Even the right code no longer works once the attempts are used up.
        $this->postJson('/api/v1/mobile/otp/verify', ['email' => $user->email, 'code' => $code])
            ->assertStatus(422);
    }

    public function test_an_expired_code_is_refused(): void
    {
        $user = User::factory()->unverified()->create();
        $code = $this->requestCode($user);

        $this->travel(EmailOtp::CODE_TTL_MINUTES + 1)->minutes();

        $this->postJson('/api/v1/mobile/otp/verify', ['email' => $user->email, 'code' => $code])
            ->assertStatus(422);
    }

    public function test_a_new_code_cannot_be_requested_straight_away(): void
    {
        $user = User::factory()->unverified()->create();
        $this->requestCode($user);

        $this->postJson('/api/v1/mobile/otp/request', ['email' => $user->email])->assertStatus(429);
    }

    public function test_unknown_emails_get_the_same_answer_and_no_email(): void
    {
        $this->postJson('/api/v1/mobile/otp/request', ['email' => 'nobody@example.com'])->assertOk();

        Notification::assertNothingSent();
    }

    public function test_staff_cannot_use_the_patient_code_flow(): void
    {
        $staff = User::factory()->create(['role' => 'staff']);

        $this->postJson('/api/v1/mobile/otp/request', ['email' => $staff->email])->assertOk();

        Notification::assertNothingSent();
    }

    public function test_complete_needs_the_token_from_a_verified_code(): void
    {
        $user = User::factory()->unverified()->create();
        $this->requestCode($user);

        $this->postJson('/api/v1/mobile/otp/complete', [
            'email' => $user->email,
            'setup_token' => str_repeat('x', 64),
            'password' => 'my-own-secret',
            'password_confirmation' => 'my-own-secret',
        ])->assertStatus(422);

        $this->assertNull($user->fresh()->email_verified_at);
    }

    public function test_an_activated_patient_can_reset_a_forgotten_password(): void
    {
        $user = User::factory()->create(); // already verified
        $code = $this->requestCode($user);

        $token = $this->postJson('/api/v1/mobile/otp/verify', ['email' => $user->email, 'code' => $code])
            ->json('data.setup_token');

        $this->postJson('/api/v1/mobile/otp/complete', [
            'email' => $user->email,
            'setup_token' => $token,
            'password' => 'brand-new-pass',
            'password_confirmation' => 'brand-new-pass',
        ])->assertOk()->assertJsonPath('message', 'Your password has been changed.');
    }
}
