<?php

namespace App\Models;

use Database\Factories\PatientFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'user_id',
    'date_of_birth',
    'gender',
    'civil_status',
    'weight_kg',
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
    /** @use HasFactory<PatientFactory> */
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

    /**
     * The single rule for who may see a patient record in the staff portal:
     * both portal roles (admin and staff) see every patient; patients and
     * any other role see nothing here.
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->isAdmin() || $user->isStaff()) {
            return $query;
        }

        return $query->whereRaw('1 = 0');
    }

    public function isVisibleTo(User $user): bool
    {
        return $user->isAdmin() || $user->isStaff();
    }

    public function votEnrollment(): HasOne
    {
        return $this->hasOne(VotEnrollment::class);
    }

    /** Whether this patient may currently submit VOT proof. */
    public function isVotActive(): bool
    {
        return $this->votEnrollment?->isActive() ?? false;
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
            'weight_kg' => 'decimal:2',
            'registered_at' => 'datetime',
            'draft_data' => 'array',
        ];
    }
}
