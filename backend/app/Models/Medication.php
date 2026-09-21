<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;


#[Fillable([
    'name',
    'generic_name',
    'brand_name',
    'dosage_form',
    'strength',
    'unit',
    'description',
    'is_active',
    // Inventory fields
    'dosage',
    'quantity',
    'reorder_level',
    'storage_condition',
    'expiry_date',
    'stock_status',
    'last_restocked_at',
    'notes',
])]
class Medication extends Model
{
    /** @use HasFactory<\Database\Factories\MedicationFactory> */
    use HasFactory;

    // ── Storage conditions ──
    public const STORAGE_ROOM_TEMPERATURE = 'room_temperature';
    public const STORAGE_REFRIGERATOR = 'refrigerator';
    public const STORAGE_COLD_STORAGE = 'cold_storage';
    public const STORAGE_SPECIAL = 'special';

    public const STORAGE_CONDITIONS = [
        self::STORAGE_ROOM_TEMPERATURE,
        self::STORAGE_REFRIGERATOR,
        self::STORAGE_COLD_STORAGE,
        self::STORAGE_SPECIAL,
    ];

    // ── Stock statuses ──
    public const STOCK_IN_STOCK = 'in_stock';
    public const STOCK_LOW_STOCK = 'low_stock';
    public const STOCK_OUT_OF_STOCK = 'out_of_stock';
    public const STOCK_EXPIRED = 'expired';

    /**
     * Extend expiry warnings: items within this many days of expiring
     * are flagged as "nearing expiry".
     */
    public const NEARING_EXPIRY_DAYS = 90;

    /**
     * Stock count units — what `quantity` counts (discrete items in stock).
     * Deliberately excludes mass units (mg/g): those describe the *dose*
     * strength (see `strength`/`dosage`), not how many items are on the shelf.
     */
    public const STOCK_UNITS = [
        'tablets',
        'capsules',
        'vials',
        'strips',
        'bottles',
        'ampoules',
        'sachets',
    ];

    protected $table = 'medications';

    public function treatmentPlanMedications(): HasMany
    {
        return $this->hasMany(TreatmentPlanMedication::class);
    }

    public function treatmentPlans(): BelongsToMany
    {
        return $this->belongsToMany(TreatmentPlan::class, 'treatment_plan_medication')
            ->withPivot(['dosage', 'frequency', 'route', 'duration_weeks', 'preferred_time', 'notes'])
            ->withTimestamps();
    }

    public function stockMovements(): HasMany
    {
        return $this->hasMany(MedicationStockMovement::class)->latest();
    }

    /**
     * Derive stock status from quantity, reorder level and expiry date.
     * Expired wins over everything; otherwise standard stock thresholds.
     */
    public function computeStockStatus(): string
    {
        if ($this->expiry_date && $this->expiry_date->isPast()) {
            return self::STOCK_EXPIRED;
        }
        if ($this->quantity <= 0) {
            return self::STOCK_OUT_OF_STOCK;
        }
        if ($this->quantity <= $this->reorder_level) {
            return self::STOCK_LOW_STOCK;
        }
        return self::STOCK_IN_STOCK;
    }

    /** Days until expiry (negative = already expired). */
    public function daysUntilExpiry(): ?int
    {
        return $this->expiry_date
            ? (int) now()->startOfDay()->diffInDays($this->expiry_date->copy()->startOfDay(), false)
            : null;
    }

    /** Nearing expiry = not yet expired, but inside the warning window. */
    public function isNearingExpiry(): bool
    {
        $days = $this->daysUntilExpiry();

        return $days !== null && $days >= 0 && $days <= self::NEARING_EXPIRY_DAYS;
    }

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'expiry_date' => 'date',
            'last_restocked_at' => 'datetime',
            'quantity' => 'integer',
            'reorder_level' => 'integer',
        ];
    }
}
