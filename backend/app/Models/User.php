<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Auth\MustVerifyEmail as MustVerifyEmailTrait;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'email', 'phone', 'password', 'role', 'permissions', 'profile_photo_path', 'is_active'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, MustVerifyEmailTrait, Notifiable, SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'email',
        'phone',
        'password',
        'role',
        'profile_photo_path',
        'is_active',
        'email_verified_at',
        'last_login_at',
    ];

    public function patient(): HasOne
    {
        return $this->hasOne(Patient::class);
    }

    public function registeredPatients(): HasMany
    {
        return $this->hasMany(Patient::class, 'registered_by');
    }

    public function assignedTreatmentPlans(): HasMany
    {
        return $this->hasMany(TreatmentPlan::class, 'assigned_by');
    }

    public function monitoredSessions(): HasMany
    {
        return $this->hasMany(DailyMonitoring::class, 'recorded_by');
    }

    public function observedLogs(): HasMany
    {
        return $this->hasMany(MedicationLog::class, 'observed_by');
    }

    public function reviewedRecommendations(): HasMany
    {
        return $this->hasMany(AiRecommendation::class, 'reviewed_by');
    }

    public function sentNotifications(): HasMany
    {
        return $this->hasMany(Notification::class, 'sender_id');
    }

    public function activityLogs(): HasMany
    {
        return $this->hasMany(ActivityLog::class);
    }

    public function notificationRecipients(): HasMany
    {
        return $this->hasMany(NotificationRecipient::class);
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function isPatient(): bool
    {
        return $this->role === 'patient';
    }

    public function isNurse(): bool
    {
        return $this->role === 'nurse';
    }

    /** Roles allowed to sign in to the web portal. */
    public const PORTAL_ROLES = ['admin', 'nurse'];

    public function canUsePortal(): bool
    {
        return in_array($this->role, self::PORTAL_ROLES, true);
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'is_active' => 'boolean',
            'password' => 'hashed',
            'permissions' => 'array',
        ];
    }
}
