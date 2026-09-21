<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'medication_id',
    'type',
    'quantity_change',
    'quantity_before',
    'quantity_after',
    'reason',
    'user_id',
])]
class MedicationStockMovement extends Model
{
    /** @use HasFactory<\Database\Factories\MedicationStockMovementFactory> */
    use HasFactory;

    public const TYPE_INITIAL = 'initial';
    public const TYPE_RESTOCK = 'restock';
    public const TYPE_DEDUCTION = 'deduction';
    public const TYPE_CORRECTION = 'correction';

    protected $table = 'medication_stock_movements';

    public function medication(): BelongsTo
    {
        return $this->belongsTo(Medication::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    protected function casts(): array
    {
        return [
            'quantity_change' => 'integer',
            'quantity_before' => 'integer',
            'quantity_after' => 'integer',
        ];
    }
}
