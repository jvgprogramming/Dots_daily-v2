<?php

use App\Http\Controllers\API\Auth\AuthController;
use App\Http\Controllers\API\Auth\EmailVerificationController;
use App\Http\Controllers\API\Auth\ForgotPasswordController;
use App\Http\Controllers\API\Auth\MobileAuthController;
use App\Http\Controllers\API\Auth\ResetPasswordController;
use App\Http\Controllers\API\DashboardController;
use App\Http\Controllers\API\MedicationInventoryController;
use App\Http\Controllers\API\MobileDoseLogController;
use App\Http\Controllers\API\PatientController;
use App\Http\Controllers\API\ReportsController;
use App\Http\Controllers\API\SearchController;
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
    Route::post('/login', [AuthController::class, 'login']);

    // Password Reset
    Route::post('/forgot-password', [ForgotPasswordController::class, 'sendResetLink']);
    Route::post('/reset-password', [ResetPasswordController::class, 'reset']);

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

        // Reports (Admin) — medication adherence + proof evidence from live logs
        Route::get('/reports/medication-adherence', [ReportsController::class, 'index'])->middleware('role:admin');

        // Medication inventory (Admin)
        Route::prefix('medications-inventory')->middleware('role:admin')->group(function () {
            Route::get('/', [MedicationInventoryController::class, 'index']);
            Route::get('summary', [MedicationInventoryController::class, 'summary']);
            Route::post('/', [MedicationInventoryController::class, 'store']);
            Route::put('{medication}', [MedicationInventoryController::class, 'update']);
            Route::get('{medication}/movements', [MedicationInventoryController::class, 'movements']);
            Route::delete('{medication}', [MedicationInventoryController::class, 'destroy']);
        });

        // Patient Routes (Admin)
        Route::prefix('patients')->middleware('role:admin')->group(function () {
            Route::get('/', [PatientController::class, 'index']);
            Route::get('/list', [PatientController::class, 'list']);
            // Static segments must be registered before the {patient} wildcard route
            Route::get('monitoring', [\App\Http\Controllers\API\MonitoringController::class, 'index']);
            Route::post('/', [PatientController::class, 'store']);
            Route::post('{patient}/complete-draft', [PatientController::class, 'completeDraft']);
            Route::post('{patient}/update-draft', [PatientController::class, 'updateDraft']);
            Route::get('{patient}', [PatientController::class, 'show']);
            Route::put('{patient}', [PatientController::class, 'update']);
            Route::delete('{patient}', [PatientController::class, 'destroy']);
        });

    });

    // ──────────────────────────────────────────────
    // 3. Mobile Routes (No admin restriction)
    // ──────────────────────────────────────────────

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
        });

    });

});
