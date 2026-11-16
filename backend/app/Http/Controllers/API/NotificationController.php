<?php

namespace App\Http\Controllers\API;

use App\Models\NotificationRecipient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The signed-in staff member's notification inbox (alerts raised by
 * `notifications:escalate-missed` and any future system messages).
 */
class NotificationController extends BaseApiController
{
    /** GET /notifications — newest first, with the unread count. */
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'unread' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:50'],
        ]);

        $userId = $request->user()->id;

        $query = NotificationRecipient::query()
            ->where('user_id', $userId)
            ->with('notification')
            ->orderByDesc('created_at')
            // Several notifications can land in the same second (a proof
            // submitted, then reviewed) — the notification id keeps "newest first" exact.
            ->orderByDesc('notification_id');

        if (! empty($data['unread'])) {
            $query->where('is_read', false);
        }

        $page = $query->paginate((int) ($data['per_page'] ?? 20));

        return $this->success(data: [
            'notifications' => collect($page->items())->map(fn (NotificationRecipient $r) => [
                'id' => $r->notification_id,
                'type' => $r->notification?->type,
                'title' => $r->notification?->title,
                'body' => $r->notification?->body,
                'data' => $r->notification?->data,
                'is_read' => (bool) $r->is_read,
                'read_at' => $r->read_at?->toIso8601String(),
                'created_at' => $r->created_at?->toIso8601String(),
            ])->all(),
            'unread_count' => NotificationRecipient::where('user_id', $userId)->where('is_read', false)->count(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    /** POST /notifications/{id}/read */
    public function markRead(Request $request, int $id): JsonResponse
    {
        NotificationRecipient::where('user_id', $request->user()->id)
            ->where('notification_id', $id)
            ->update(['is_read' => true, 'read_at' => now()]);

        return $this->success(message: 'Notification marked as read.');
    }

    /** POST /notifications/read-all */
    public function markAllRead(Request $request): JsonResponse
    {
        $count = NotificationRecipient::where('user_id', $request->user()->id)
            ->where('is_read', false)
            ->update(['is_read' => true, 'read_at' => now()]);

        return $this->success(data: ['updated' => $count], message: 'All notifications marked as read.');
    }
}
