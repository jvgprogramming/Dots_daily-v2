<?php

namespace App\Services\Notification;

use App\Models\Notification;
use Illuminate\Support\Facades\DB;

/**
 * Writes an in-app notification for a set of users, using the same
 * `notifications` + `notification_recipients` tables the portal bell reads.
 * Patients are users too, so the mobile app reads its own inbox from here.
 */
class NotificationService
{
    /**
     * @param  array<int, int|null>  $userIds  nulls and duplicates are ignored
     */
    public function send(string $type, string $title, string $body, array $data, array $userIds): ?Notification
    {
        $ids = array_values(array_unique(array_filter(array_map(
            fn ($id) => $id === null ? null : (int) $id,
            $userIds,
        ))));

        if ($ids === []) {
            return null;
        }

        return DB::transaction(function () use ($type, $title, $body, $data, $ids) {
            $notification = Notification::create([
                'type' => $type,
                'title' => $title,
                'body' => $body,
                'data' => $data,
            ]);

            $now = now();
            DB::table('notification_recipients')->insert(array_map(fn (int $id) => [
                'notification_id' => $notification->id,
                'user_id' => $id,
                'is_read' => false,
                'created_at' => $now,
                'updated_at' => $now,
            ], $ids));

            return $notification;
        });
    }
}
