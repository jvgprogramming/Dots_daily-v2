<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'user_id',
    'date_of_birth',
    'gender',
    'civil_status',
    'address',
    'emergency_contact_name',
    'emergency_contact_phone',
    'occupation',
    'nationality',
    'health_id_number',
    'philhealth_number',
    'last_name',
    'first_name',
    'middle_name',
    'name_extension',
    'referred_by',
    'registered_by',
    'registered_at',
    'status',
    'draft_data',
])]
class Patient extends Model
{
    /** @use HasFactory<\Database\Factories\PatientFactory> */
    use HasFactory, SoftDeletes;

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function registeredBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registered_by');
    }

    public function treatmentPlans(): HasMany
    {
        return $this->hasMany(TreatmentPlan::class);
    }

    public function tbNotifications(): HasMany
    {
        return $this->hasMany(TbNotification::class);
    }

    public function laboratoryTests(): HasMany
    {
        return $this->hasMany(LaboratoryTest::class);
    }

    public function diagnoses(): HasMany
    {
        return $this->hasMany(Diagnosis::class);
    }

    public function tbClassification(): HasMany
    {
        return $this->hasMany(TbClassification::class);
    }

    public function closeContacts(): HasMany
    {
        return $this->hasMany(CloseContact::class);
    }

    public function isDraft(): bool
    {
        return $this->status === 'draft';
    }

    public function medicationLogs(): HasMany
    {
        return $this->hasMany(MedicationLog::class);
    }

    public function symptomLogs(): HasMany
    {
        return $this->hasMany(SymptomLog::class);
    }

    public function dailyMonitoring(): HasMany
    {
        return $this->hasMany(DailyMonitoring::class);
    }

    public function aiConversations(): HasMany
    {
        return $this->hasMany(AiConversation::class);
    }

    public function aiRecommendations(): HasMany
    {
        return $this->hasMany(AiRecommendation::class);
    }

    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
            'registered_at' => 'datetime',
            'draft_data' => 'array',
        ];
    }
}
