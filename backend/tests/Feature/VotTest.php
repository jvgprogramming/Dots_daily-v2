<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Medication;
use App\Models\MedicationLog;
use App\Models\NotificationRecipient;
use App\Models\Patient;
use App\Models\TreatmentPlan;
use App\Models\TreatmentPlanMedication;
use App\Models\User;
use App\Models\VotSubmission;
use App\Support\Adherence;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Video-Observed Therapy end to end: a nurse enrols a patient, the patient
 * submits proof for a dose, and a nurse verifies, rejects or asks again —
 * with adherence, notifications and the audit trail following along.
 */
class VotTest extends TestCase
{
    use RefreshDatabase;

    private ?User $nurseUser = null;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    // ── Eligibility ─────────────────────────────────────────────────

    public function test_a_nurse_can_grant_vot_eligibility(): void
    {
        [, $patient] = $this->patientWithRegimen();
        Sanctum::actingAs($this->nurse());

        $this->putJson("/api/v1/patients/{$patient->id}/vot-enrollment", [
            'status' => 'active',
            'assigned_nurse_id' => $this->nurse()->id,
            'notes' => 'Works night shifts; cannot visit daily.',
        ])
            ->assertOk()
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.is_active', true)
            ->assertJsonPath('data.assigned_nurse_name', $this->nurse()->name)
            ->assertJsonPath('data.granted_by_name', $this->nurse()->name)
            ->assertJsonPath('data.eligible_since', now()->toDateString());

        $this->assertTrue($patient->fresh()->isVotActive());
        $this->assertTrue(ActivityLog::where('action', 'vot.enrollment.created')->exists());
        $this->assertSame(1, NotificationRecipient::where('user_id', $patient->user_id)->count());

        $this->getJson("/api/v1/patients/{$patient->id}/vot-enrollment")
            ->assertOk()
            ->assertJsonPath('data.status', 'active');
    }

    public function test_suspending_vot_requires_a_reason(): void
    {
        [, $patient] = $this->enrolledPatient();
        Sanctum::actingAs($this->nurse());

        $this->putJson("/api/v1/patients/{$patient->id}/vot-enrollment", ['status' => 'suspended'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('status_reason');

        $this->putJson("/api/v1/patients/{$patient->id}/vot-enrollment", [
            'status' => 'suspended',
            'status_reason' => 'Patient lost their phone.',
        ])->assertOk()->assertJsonPath('data.is_active', false);
    }

    public function test_a_patient_cannot_manage_eligibility_or_see_the_review_queue(): void
    {
        [$user, $patient] = $this->enrolledPatient();
        Sanctum::actingAs($user);

        $this->putJson("/api/v1/patients/{$patient->id}/vot-enrollment", ['status' => 'active'])->assertForbidden();
        $this->getJson('/api/v1/vot/submissions')->assertForbidden();
        $this->getJson('/api/v1/vot/summary')->assertForbidden();
    }

    // ── Submission ──────────────────────────────────────────────────

    public function test_the_app_learns_whether_the_patient_is_enrolled(): void
    {
        [$user] = $this->enrolledPatient();
        Sanctum::actingAs($user);

        $this->getJson('/api/v1/mobile/vot')
            ->assertOk()
            ->assertJsonPath('data.enrolled', true)
            ->assertJsonPath('data.assigned_nurse_name', $this->nurse()->name)
            ->assertJsonPath('data.allowed_media', ['video', 'photo'])
            ->assertJsonPath('data.instructions', fn ($lines) => count($lines) === 5);

        $this->getJson('/api/v1/mobile/regimen')->assertJsonPath('data.vot_enrolled', true);
    }

    public function test_a_patient_not_enrolled_cannot_submit_proof(): void
    {
        [$user] = $this->patientWithRegimen();
        Sanctum::actingAs($user);

        $this->submit()->assertForbidden();
        $this->assertSame(0, VotSubmission::count());
    }

    public function test_an_enrolled_patient_submits_a_video_and_the_dose_is_pending(): void
    {
        [$user, $patient] = $this->enrolledPatient();
        Sanctum::actingAs($user);

        $this->submit()
            ->assertCreated()
            ->assertJsonPath('data.submission.status', 'pending')
            ->assertJsonPath('data.submission.attempt', 1)
            ->assertJsonPath('data.dose.verification_status', 'pending');

        $submission = VotSubmission::sole();
        $log = MedicationLog::sole();

        // Stored privately, linked to the right dose, plan and patient.
        Storage::disk('local')->assertExists($submission->media_path);
        $this->assertSame($log->id, $submission->medication_log_id);
        $this->assertSame($patient->id, $submission->patient_id);
        $this->assertSame($log->treatmentPlanMedication->treatment_plan_id, $submission->treatment_plan_id);
        $this->assertSame(30, $submission->duration_seconds);
        $this->assertSame($submission->media_path, $log->proof_video_path);

        // Not verified — but the patient isn't penalised while it waits.
        $this->assertNull($log->observed_by);
        $this->assertSame(1, $this->daysTaken($patient));

        // The assigned nurse and the patient are both told.
        $this->assertTrue(NotificationRecipient::where('user_id', $this->nurse()->id)
            ->whereHas('notification', fn ($q) => $q->where('type', 'vot.submitted'))->exists());
        $this->assertTrue(NotificationRecipient::where('user_id', $user->id)
            ->whereHas('notification', fn ($q) => $q->where('type', 'vot.received'))->exists());
    }

    public function test_a_photo_is_accepted_as_proof(): void
    {
        [$user] = $this->enrolledPatient();
        Sanctum::actingAs($user);

        $this->post('/api/v1/mobile/vot/submissions', [
            'scheduled_date' => now()->toDateString(),
            'scheduled_time' => '07:00',
            'media_type' => 'photo',
            'media' => UploadedFile::fake()->create('proof.jpg', 300, 'image/jpeg'),
        ], ['Accept' => 'application/json'])->assertCreated();

        $this->assertSame(VotSubmission::sole()->media_path, MedicationLog::sole()->proof_photo);
    }

    public function test_the_same_dose_cannot_be_submitted_twice(): void
    {
        [$user] = $this->enrolledPatient();
        Sanctum::actingAs($user);

        $this->submit()->assertCreated();
        $this->submit()->assertStatus(409);

        $this->assertSame(1, VotSubmission::count());
    }

    public function test_bad_uploads_are_rejected(): void
    {
        [$user] = $this->enrolledPatient();
        Sanctum::actingAs($user);

        $this->submit(['media' => UploadedFile::fake()->create('notes.pdf', 50, 'application/pdf')])
            ->assertStatus(422)->assertJsonValidationErrors('media');

        $this->submit(['duration_seconds' => 2])
            ->assertStatus(422)->assertJsonValidationErrors('duration_seconds');

        $this->submit(['scheduled_date' => now()->addDay()->toDateString()])
            ->assertStatus(422)->assertJsonValidationErrors('scheduled_date');

        $this->assertSame(0, VotSubmission::count());
    }

    // ── Review ──────────────────────────────────────────────────────

    public function test_a_nurse_sees_the_submission_and_can_play_it_through_a_signed_link(): void
    {
        [$user, $patient] = $this->enrolledPatient();
        Sanctum::actingAs($user);
        $this->submit()->assertCreated();
        $submission = VotSubmission::sole();

        Sanctum::actingAs($this->nurse());

        $this->getJson('/api/v1/vot/summary')
            ->assertOk()
            ->assertJsonPath('data.total_submissions', 1)
            ->assertJsonPath('data.pending', 1)
            ->assertJsonPath('data.enrolled_patients', 1);

        $this->getJson('/api/v1/vot/submissions?status=pending&search='.urlencode($patient->first_name))
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.id', $submission->id)
            ->assertJsonPath('data.0.patient.assigned_nurse_name', $this->nurse()->name)
            ->assertJsonPath('data.0.dose.medication_name', 'Rifampicin 150mg')
            ->assertJsonMissingPath('data.0.media_url');

        $this->getJson('/api/v1/vot/submissions?status=verified')->assertJsonPath('meta.total', 0);

        $url = $this->getJson("/api/v1/vot/submissions/{$submission->id}")
            ->assertOk()
            ->assertJsonPath('data.history.0.attempt', 1)
            ->json('data.media_url');

        $this->assertTrue(ActivityLog::where('action', 'vot.viewed')->exists());

        // The signed link plays; a tampered or unsigned one does not.
        $this->get($url)->assertOk();
        $this->get($url.'x')->assertForbidden();
        $this->get("/api/v1/media/vot/{$submission->id}")->assertForbidden();
    }

    public function test_verifying_confirms_the_dose_and_tells_the_patient(): void
    {
        [$user, $patient] = $this->enrolledPatient();
        Sanctum::actingAs($user);
        $this->submit()->assertCreated();
        $submission = VotSubmission::sole();

        Sanctum::actingAs($this->nurse());
        $this->postJson("/api/v1/vot/submissions/{$submission->id}/verify")
            ->assertOk()
            ->assertJsonPath('data.status', 'verified')
            ->assertJsonPath('data.reviewed_by_name', $this->nurse()->name)
            ->assertJsonPath('data.dose.verification_status', 'verified');

        $log = MedicationLog::sole();
        $this->assertSame($this->nurse()->id, $log->observed_by);
        $this->assertSame(1, $this->daysTaken($patient));
        $this->assertTrue(ActivityLog::where('action', 'vot.verified')->exists());
        $this->assertTrue(NotificationRecipient::where('user_id', $user->id)
            ->whereHas('notification', fn ($q) => $q->where('type', 'vot.verified'))->exists());

        // A decided proof cannot be decided again.
        $this->postJson("/api/v1/vot/submissions/{$submission->id}/reject", ['reason' => 'Changed my mind'])
            ->assertStatus(409);
    }

    public function test_rejecting_needs_a_reason_holds_the_dose_out_and_allows_new_proof(): void
    {
        [$user, $patient] = $this->enrolledPatient();
        Sanctum::actingAs($user);
        $this->submit()->assertCreated();
        $submission = VotSubmission::sole();

        Sanctum::actingAs($this->nurse());
        $this->postJson("/api/v1/vot/submissions/{$submission->id}/reject")
            ->assertStatus(422)->assertJsonValidationErrors('reason');

        $this->postJson("/api/v1/vot/submissions/{$submission->id}/reject", ['reason' => 'Medicine not visible.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'rejected');

        $this->assertSame('rejected', MedicationLog::sole()->verification_status);
        $this->assertSame(0, $this->daysTaken($patient));

        // The patient records again — same dose, attempt 2, video kept.
        Sanctum::actingAs($user);
        $this->submit()->assertCreated()->assertJsonPath('data.submission.attempt', 2);

        $this->assertSame(1, MedicationLog::count());
        $this->assertSame(2, VotSubmission::count());
        Storage::disk('local')->assertExists($submission->media_path);
        $this->assertSame(1, $this->daysTaken($patient));
    }

    public function test_requesting_new_proof_reopens_the_same_dose(): void
    {
        [$user, $patient] = $this->enrolledPatient();
        Sanctum::actingAs($user);
        $this->submit()->assertCreated();
        $submission = VotSubmission::sole();

        Sanctum::actingAs($this->nurse());
        $this->postJson("/api/v1/vot/submissions/{$submission->id}/request-resubmission", [
            'reason' => 'Video cut off before swallowing.',
        ])->assertOk()->assertJsonPath('data.status', 'resubmission_requested');

        $this->assertSame('resubmission_required', MedicationLog::sole()->verification_status);
        $this->assertSame(0, $this->daysTaken($patient));
        $this->assertTrue(NotificationRecipient::where('user_id', $user->id)
            ->whereHas('notification', fn ($q) => $q->where('type', 'vot.resubmission_requested'))->exists());

        // The app shows the reason, and the patient's inbox has it.
        Sanctum::actingAs($user);
        $this->getJson('/api/v1/mobile/dose-logs')
            ->assertJsonPath('data.logs.0.verification_status', 'resubmission_required')
            ->assertJsonPath('data.logs.0.review_reason', 'Video cut off before swallowing.');
        $this->getJson('/api/v1/mobile/notifications')
            ->assertOk()
            ->assertJsonPath('data.notifications.0.type', 'vot.resubmission_requested');

        $this->submit()->assertCreated()->assertJsonPath('data.dose.verification_status', 'pending');
        $this->assertSame(1, MedicationLog::count());
    }

    public function test_the_legacy_one_click_verify_cannot_bypass_vot_review(): void
    {
        [$user] = $this->enrolledPatient();
        Sanctum::actingAs($user);
        $this->submit()->assertCreated();

        Sanctum::actingAs($this->nurse());
        $this->postJson('/api/v1/medication-logs/'.MedicationLog::sole()->id.'/verify')->assertStatus(422);
    }

    // ── Helpers ─────────────────────────────────────────────────────

    private function submit(array $overrides = [])
    {
        return $this->post('/api/v1/mobile/vot/submissions', array_merge([
            'scheduled_date' => now()->toDateString(),
            'scheduled_time' => '07:00',
            'taken_at' => now()->setTime(7, 5)->toIso8601String(),
            'media_type' => 'video',
            'duration_seconds' => 30,
            'media' => UploadedFile::fake()->create('proof.mp4', 1500, 'video/mp4'),
        ], $overrides), ['Accept' => 'application/json']);
    }

    private function daysTaken(Patient $patient): int
    {
        return Adherence::planWindowSummary([$patient->id])['summary']['taken'];
    }

    private function nurse(): User
    {
        return $this->nurseUser ??= User::factory()->create(['role' => 'staff', 'name' => 'Nurse Joy']);
    }

    /** @return array{0: User, 1: Patient} */
    private function enrolledPatient(): array
    {
        [$user, $patient] = $this->patientWithRegimen();
        $patient->votEnrollment()->create([
            'status' => 'active',
            'eligible_since' => now()->toDateString(),
            'assigned_nurse_id' => $this->nurse()->id,
            'granted_by' => $this->nurse()->id,
        ]);

        return [$user, $patient->fresh()];
    }

    /** @return array{0: User, 1: Patient} */
    private function patientWithRegimen(): array
    {
        $user = User::factory()->create(['role' => 'patient']);
        $patient = Patient::factory()->forUser($user)->create(['registered_by' => $this->nurse()->id]);

        $plan = TreatmentPlan::factory()->create([
            'patient_id' => $patient->id,
            'assigned_by' => $this->nurse()->id,
            'status' => 'active',
            'phase' => 'intensive',
            'start_date' => now()->subDays(10)->toDateString(),
            'expected_end_date' => now()->addMonths(5)->toDateString(),
        ]);

        TreatmentPlanMedication::factory()->create([
            'treatment_plan_id' => $plan->id,
            'medication_id' => Medication::factory()->create(['name' => 'Rifampicin', 'strength' => '150mg'])->id,
            'dosage' => '300mg',
            'preferred_time' => '07:00:00',
        ]);

        return [$user, $patient];
    }
}
