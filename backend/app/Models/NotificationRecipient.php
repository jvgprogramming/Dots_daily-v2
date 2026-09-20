<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'notification_id',
    'user_id',
    'is_read',
    'read_at',
])]
class NotificationRecipient extends Model
{
    /** @use HasFactory<\Database\Factories\NotificationRecipientFactory> */
    use HasFactory;

    protected $table = 'notification_recipients';

    protected $primaryKey = ['notification_id', 'user_id'];

    public $incrementing = false;

    protected function setKeysForSaveQuery($query): Builder
    {
        return $query->where('notification_id', $this->getAttribute('notification_id'))
                     ->where('user_id', $this->getAttribute('user_id'));
    }

    public function notification(): BelongsTo
    {
        return $this->belongsTo(Notification::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    protected function casts(): array
    {
        return [
            'is_read' => 'boolean',
            'read_at' => 'datetime',
        ];
    }
}
