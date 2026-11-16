<?php

use App\Http\Controllers\API\Auth\AuthController;
use App\Http\Controllers\API\Auth\EmailVerificationController;
use App\Http\Controllers\API\Auth\ForgotPasswordController;
use App\Http\Controllers\API\Auth\MobileAuthController;
use App\Http\Controllers\API\Auth\ResetPasswordController;
use App\Http\Controllers\API\DashboardController;
use App\Http\Controllers\API\DoseVerificationController;
use App\Http\Controllers\API\MedicationInventoryController;
use App\Http\Controllers\API\MobileDoseLogController;
use App\Http\Controllers\API\MobileVotController;
use App\Http\Controllers\API\MonitoringController;
use App\Http\Controllers\API\NotificationController;
use App\Http\Controllers\API\PatientController;
use App\Http\Controllers\API\ProofMediaController;
use App\Http\Controllers\API\ReportsController;
use App\Http\Controllers\API\SearchController;
use App\Http\Controllers\API\SettingsController;
use App\Http\Controllers\API\TreatmentsController;
use App\Http\Controllers\API\VotEnrollmentController;
use App\Http\Controllers\API\VotSubmissionController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| DOTS Daily v2 REST API
| Prefix: /api/v1
| Authentication: Sanctum Token-based
|
*/

// ──────────────────────────────────────────────
// 1. Public Routes (No Authentication Required)
// ──────────────────────────────────────────────

Route::prefix('v1')->group(function () {

    // Auth
    Route::post('/register', [AuthController::class, 'register']);
    // Sign-in and password reset are rate limited (5 attempts / minute) to
    // slow down password guessing and reset-email abuse.
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1');

    // Password Reset
    Route::post('/forgot-password', [ForgotPasswordController::class, 'sendResetLink'])->middleware('throttle:5,1');
    Route::post('/reset-password', [ResetPasswordController::class, 'reset'])->middleware('throttle:5,1');

    // Email Verification (signed URL — no auth required)
    Route::get('/email/verify/{id}/{hash}', [EmailVerificationController::class, 'verify'])
        ->middleware('signed')
        ->name('verification.verify');

    // ──────────────────────────────────────────────
    // 2. Protected Routes (Sanctum Token Required)
    // ──────────────────────────────────────────────

    Route::middleware('auth:sanctum')->group(function () {

        // Auth
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/user', [AuthController::class, 'user']);
        Route::get('/profile', [PatientController::class, 'profile']);

        // Email Verification
        Route::post('/email/verification-notification', [EmailVerificationController::class, 'sendVerification']);

        // Dashboard (Admin)
        Route::get('/dashboard/stats', [DashboardController::class, 'stats'])->middleware('role:admin');

        // Global search (Admin)
        Route::get('/search', [SearchController::class, 'index'])->middleware('role:admin');

        // Staff notification inbox (missed-dose escalations, follow-up reminders)
        Route::prefix('notifications')->middleware('role:admin,staff')->group(function () {
            Route::get('/', [NotificationController::class, 'index']);
            Route::post('read-all', [NotificationController::class, 'markAllRead']);
            Route::post('{id}/read', [NotificationController::class, 'markRead'])->whereNumber('id');
        });

        // Settings values every portal user needs (risk bands, regimens…)
        Route::get('/settings/public', [SettingsController::class, 'publicSettings'])->middleware('role:admin,staff');

        // Settings (Admin) — system configuration control panel
        Route::prefix('settings')->middleware('role:admin')->group(function () {
            Route::get('/', [SettingsController::class, 'index']);
            Route::put('/', [SettingsController::class, 'update']);
            Route::get('audit', [SettingsController::class, 'audit']);
            Route::get('audit/export', [SettingsController::class, 'exportAudit']);
            Route::get('login-activity', [SettingsController::class, 'loginActivity']);
            Route::get('users', [SettingsController::class, 'users']);
            Route::post('users', [SettingsController::class, 'storeUser']);
            Route::put('users/{user}', [SettingsController::class, 'updateUser']);
            Route::delete('users/{user}', [SettingsController::class, 'destroyUser']);
            Route::post('users/{user}/revoke-sessions', [SettingsController::class, 'revokeSessions']);
        });

        // Reports (Admin + Staff) — medication adherence + proof evidence from live logs
        Route::get('/reports/medication-adherence', [ReportsController::class, 'index'])->middleware('role:admin,staff');

        // Dose verification (Admin + Staff) — confirm a patient's logged intake by setting
        // `medication_logs.observed_by`, the flag the calendars read for verified/pending.
        Route::post('/medication-logs/{log}/verify', [DoseVerificationController::class, 'verify'])->middleware('role:admin,staff');
        Route::post('/medication-logs/{log}/unverify', [DoseVerificationController::class, 'unverify'])->middleware('role:admin,staff');
        // Logged-by-default review: flag a suspicious proof video (excludes it
        // from adherence until cleared), or clear the flag.
        Route::post('/medication-logs/{log}/flag', [DoseVerificationController::class, 'flag'])->middleware('role:admin,staff');
        Route::post('/medication-logs/{log}/unflag', [DoseVerificationController::class, 'unflag'])->middleware('role:admin,staff');

        // Treatments hub (Admin + Staff) — records, follow-up schedule, reschedule
        // Video-Observed Therapy review queue (Reports → VOT) and eligibility.
        // Policies narrow these further (VotSubmissionPolicy / PatientPolicy).
        Route::prefix('vot')->middleware('role:admin,staff')->group(function () {
            Route::get('summary', [VotSubmissionController::class, 'summary']);
            Route::get('nurses', [VotEnrollmentController::class, 'nurses']);
            Route::get('submissions', [VotSubmissionController::class, 'index']);
            Route::get('submissions/{submission}', [VotSubmissionController::class, 'show']);
            Route::post('submissions/{submission}/verify', [VotSubmissionController::class, 'verify']);
            Route::post('submissions/{submission}/reject', [VotSubmissionController::class, 'reject']);
            Route::post('submissions/{submission}/request-resubmission', [VotSubmissionController::class, 'requestResubmission']);
        });
        Route::get('/patients/{patient}/vot-enrollment', [VotEnrollmentController::class, 'show'])->middleware('role:admin,staff');
        Route::put('/patients/{patient}/vot-enrollment', [VotEnrollmentController::class, 'update'])->middleware('role:admin,staff');

        Route::get('/treatments', [TreatmentsController::class, 'index'])->middleware('role:admin,staff');
        Route::put('/treatments/{plan}', [TreatmentsController::class, 'updateTreatment'])->middleware('role:admin,staff');
        Route::post('/treatments/{plan}/reschedule-follow-up', [TreatmentsController::class, 'rescheduleFollowUp'])
            ->middleware('role:admin,staff');

        // Medication inventory (Admin + Staff)
        Route::prefix('medications-inventory')->middleware('role:admin,staff')->group(function () {
            Route::get('/', [MedicationInventoryController::class, 'index']);
            Route::get('summary', [MedicationInventoryController::class, 'summary']);
            Route::post('/', [MedicationInventoryController::class, 'store']);
            Route::put('{medication}', [MedicationInventoryController::class, 'update']);
            Route::get('{medication}/movements', [MedicationInventoryController::class, 'movements']);
            Route::delete('{medication}', [MedicationInventoryController::class, 'destroy']);
        });

        // Patient Routes (Admin + Staff)
        // Both portal roles see every patient; deletion stays admin-only.
        Route::prefix('patients')->middleware('role:admin,staff')->group(function () {
            Route::get('/', [PatientController::class, 'index']);
            Route::get('/list', [PatientController::class, 'list']);
            // Static segments must be registered before the {patient} wildcard route
            Route::get('monitoring', [MonitoringController::class, 'index']);
            Route::post('/', [PatientController::class, 'store']);
            Route::post('{patient}/complete-draft', [PatientController::class, 'completeDraft']);
            Route::post('{patient}/update-draft', [PatientController::class, 'updateDraft']);
            Route::get('{patient}', [PatientController::class, 'show']);
            Route::put('{patient}', [PatientController::class, 'update']);
            // Deleting a patient record stays admin-only.
            Route::delete('{patient}', [PatientController::class, 'destroy'])->middleware('role:admin');
        });

    });

    // ──────────────────────────────────────────────
    // 3. Mobile Routes (No admin restriction)
    // ──────────────────────────────────────────────

    // ──────────────────────────────────────────────
    // Private proof media (signed, expiring links)
    // ──────────────────────────────────────────────
    // No bearer token here on purpose: <video>/<img> tags cannot send one.
    // Links are only issued by authenticated, authorised API responses
    // (App\Support\ProofMedia) and expire after a short time.
    Route::middleware(['signed', 'throttle:120,1'])->prefix('media')->group(function () {
        Route::get('proof/{log}/{kind}', [ProofMediaController::class, 'log'])->name('proof-media.log');
        Route::get('vot/{submission}', [ProofMediaController::class, 'submission'])->name('proof-media.vot');
    });

    Route::prefix('mobile')->group(function () {

        // Public
        Route::post('/login', [MobileAuthController::class, 'login']);

        // Protected
        Route::middleware('auth:sanctum')->group(function () {
            Route::get('/profile', [MobileAuthController::class, 'profile']);
            Route::post('/logout', [MobileAuthController::class, 'logout']);

            // Dose logging: the patient's regimen + their daily intake history.
            // Writes land in `medication_logs`, which the admin web app already
            // reads for its adherence reports and monitoring calendar.
            Route::get('/regimen', [MobileDoseLogController::class, 'regimen']);
            Route::get('/dose-logs', [MobileDoseLogController::class, 'index']);
            Route::post('/dose-logs', [MobileDoseLogController::class, 'store']);

            // Video-Observed Therapy: status + instructions, and proof upload.
            Route::get('/vot', [MobileVotController::class, 'show']);
            Route::post('/vot/submissions', [MobileVotController::class, 'store'])->middleware('throttle:20,1');

            // The patient's own in-app inbox (same tables as the portal bell).
            Route::get('/notifications', [NotificationController::class, 'index']);
            Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
            Route::post('/notifications/{id}/read', [NotificationController::class, 'markRead'])->whereNumber('id');
        });

    });

});
