<?php

namespace App\Http\Controllers\API;

use App\Models\Medication;
use App\Models\MedicationStockMovement;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Medicine inventory management for the admin Medication module.
 *
 * Extends the existing Medication model with inventory fields:
 * dosage, quantity, unit, storage_condition, expiry_date,
 * stock_status (computed) and notes.
 *
 * Endpoints:
 *   GET    /medications-inventory            → paginated inventory list + summary
 *   POST   /medications-inventory            → register new medicine
 *   PUT    /medications-inventory/{medication} → update medicine / restock
 *   DELETE /medications-inventory/{medication} → soft-delete from inventory
 */
class MedicationInventoryController extends BaseApiController
{
    public function index(Request $request): JsonResponse
    {
        $query = Medication::query();

        // Search by name, generic or brand
        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('generic_name', 'like', "%{$search}%")
                    ->orWhere('brand_name', 'like', "%{$search}%");
            });
        }

        // Filter by computed stock status (in_stock | low_stock | out_of_stock | expired)
        if ($status = $request->get('stock_status')) {
            $query->where('stock_status', $status);
        }

        // Filter by storage condition
        if ($storage = $request->get('storage_condition')) {
            $query->where('storage_condition', $storage);
        }

        // Sort: expiry (soonest first) is the clinical default
        $sortBy = $request->get('sort_by', 'expiry_date');
        $sortDir = $request->get('sort_dir', 'asc');
        $allowed = ['name', 'quantity', 'expiry_date', 'created_at', 'updated_at'];
        if (in_array($sortBy, $allowed, true)) {
            $query->orderBy($sortBy, $sortDir === 'desc' ? 'desc' : 'asc');
        }

        $perPage = min((int) $request->get('per_page', 15), 50);
        $medications = $query->paginate($perPage);

        return $this->paginated($medications, 'Medication inventory retrieved successfully.');
    }

    /**
     * Inventory summary: counts by stock status + expiry buckets.
     * Used by the medication page header cards and sidebar badges.
     */
    public function summary(): JsonResponse
    {
        $now = Carbon::today();
        $nearingDays = Medication::NEARING_EXPIRY_DAYS;
        $nearingDate = (clone $now)->copy()->addDays($nearingDays);

        $summary = [
            'total_medicines' => Medication::count(),
            'in_stock' => Medication::where('stock_status', Medication::STOCK_IN_STOCK)->count(),
            'low_stock' => Medication::where('stock_status', Medication::STOCK_LOW_STOCK)->count(),
            'out_of_stock' => Medication::where('stock_status', Medication::STOCK_OUT_OF_STOCK)->count(),
            'expired' => Medication::where('stock_status', Medication::STOCK_EXPIRED)->count(),
            'nearing_expiry' => Medication::whereDate('expiry_date', '>=', $now->toDateString())
                ->whereDate('expiry_date', '<=', $nearingDate->toDateString())
                ->count(),
            'storage_breakdown' => [
                'room_temperature' => Medication::where('storage_condition', Medication::STORAGE_ROOM_TEMPERATURE)->count(),
                'refrigerator' => Medication::where('storage_condition', Medication::STORAGE_REFRIGERATOR)->count(),
                'cold_storage' => Medication::where('storage_condition', Medication::STORAGE_COLD_STORAGE)->count(),
                'special' => Medication::where('storage_condition', Medication::STORAGE_SPECIAL)->count(),
            ],
        ];

        return $this->success(data: $summary, message: 'Medication summary retrieved successfully.');
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validatePayload($request);

        try {
            DB::beginTransaction();

            $fields = $this->applyInventoryFields($data);
            $medication = Medication::create($fields);

            // Ledger: initial stock entry
            $medication->stockMovements()->create([
                'type' => MedicationStockMovement::TYPE_INITIAL,
                'quantity_change' => (int) $medication->quantity,
                'quantity_before' => 0,
                'quantity_after' => (int) $medication->quantity,
                'reason' => 'Initial stock on registration',
                'user_id' => Auth::id(),
            ]);

            DB::commit();

            return $this->created(
                data: ['medication' => $this->serialize($medication)],
                message: 'Medicine registered successfully.',
            );
        } catch (\Exception $e) {
            DB::rollBack();

            return $this->error(message: 'Failed to register medicine. ' . $e->getMessage(), code: 500);
        }
    }

    public function update(Request $request, Medication $medication): JsonResponse
    {
        $data = $this->validatePayload($request);

        try {
            DB::beginTransaction();

            $fields = $this->applyInventoryFields($data);

            $qtyBefore = (int) $medication->quantity;
            $qtyAfter = (int) ($fields['quantity'] ?? $qtyBefore);

            // Track restock events (quantity increased) for last_restocked_at
            if ($qtyAfter > $qtyBefore) {
                $fields['last_restocked_at'] = now();
            }

            $medication->update($fields);

            // Ledger: log any quantity change made through the edit form
            if ($qtyAfter !== $qtyBefore) {
                $medication->stockMovements()->create([
                    'type' => $qtyAfter > $qtyBefore
                        ? MedicationStockMovement::TYPE_RESTOCK
                        : MedicationStockMovement::TYPE_CORRECTION,
                    'quantity_change' => $qtyAfter - $qtyBefore,
                    'quantity_before' => $qtyBefore,
                    'quantity_after' => $qtyAfter,
                    'reason' => $data['notes'] ?? 'Updated via medicine edit',
                    'user_id' => Auth::id(),
                ]);
            }

            DB::commit();

            return $this->success(
                data: ['medication' => $this->serialize($medication->fresh())],
                message: 'Medicine updated successfully.',
            );
        } catch (\Exception $e) {
            DB::rollBack();

            return $this->error(message: 'Failed to update medicine. ' . $e->getMessage(), code: 500);
        }
    }

    public function destroy(Medication $medication): JsonResponse
    {
        // Archive from inventory rather than hard-deleting treatment history links
        $medication->update(['is_active' => false]);

        return $this->success(message: 'Medicine removed from inventory.');
    }

    /**
     * Adjust stock quantity for a medicine (restock, deduction or correction).
     * Records a ledger entry and recomputes stock status atomically.
     */
    public function adjust(Request $request, Medication $medication): JsonResponse
    {
        $data = $request->validate([
            // Signed delta (+50) or absolute new quantity
            'quantity_change' => ['required_without:new_quantity', 'integer'],
            'new_quantity' => ['required_without:quantity_change', 'integer', 'min:0'],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        try {
            DB::beginTransaction();

            $qtyBefore = (int) $medication->quantity;
            $qtyAfter = isset($data['new_quantity'])
                ? (int) $data['new_quantity']
                : $qtyBefore + (int) $data['quantity_change'];

            if ($qtyAfter < 0) {
                return $this->error(message: 'Stock cannot go below zero.', code: 422);
            }

            $type = match (true) {
                $qtyAfter > $qtyBefore => MedicationStockMovement::TYPE_RESTOCK,
                $qtyAfter < $qtyBefore => MedicationStockMovement::TYPE_DEDUCTION,
                default => MedicationStockMovement::TYPE_CORRECTION,
            };

            $medication->update([
                'quantity' => $qtyAfter,
                'stock_status' => $medication->computeStockStatus(),
                'last_restocked_at' => $qtyAfter > $qtyBefore ? now() : $medication->last_restocked_at,
            ]);

            $movement = $medication->stockMovements()->create([
                'type' => $type,
                'quantity_change' => $qtyAfter - $qtyBefore,
                'quantity_before' => $qtyBefore,
                'quantity_after' => $qtyAfter,
                'reason' => $data['reason'] ?? null,
                'user_id' => Auth::id(),
            ]);

            DB::commit();

            return $this->success(
                data: [
                    'medication' => $this->serialize($medication->fresh()),
                    'movement' => $this->serializeMovement($movement),
                ],
                message: 'Stock adjusted successfully.',
            );
        } catch (\Exception $e) {
            DB::rollBack();

            return $this->error(message: 'Failed to adjust stock. ' . $e->getMessage(), code: 500);
        }
    }

    /**
     * Stock movement history (audit trail) for a medicine.
     */
    public function movements(Request $request, Medication $medication): JsonResponse
    {
        $movements = $medication->stockMovements()
            ->with('user:id,name')
            ->paginate(min((int) $request->get('per_page', 15), 50));

        return $this->paginated($movements, 'Stock movement history retrieved successfully.');
    }

    // ──────────────────────────────────────────────

    private function validatePayload(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'generic_name' => ['required', 'string', 'max:255'],
            'brand_name' => ['nullable', 'string', 'max:255'],
            'dosage' => ['required', 'string', 'max:100'],
            'quantity' => ['required', 'integer', 'min:0'],
            'reorder_level' => ['nullable', 'integer', 'min:0'],
            'unit' => ['required', 'string', 'max:20'],
            'storage_condition' => ['required', 'string', 'in:' . implode(',', Medication::STORAGE_CONDITIONS)],
            'expiry_date' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);
    }

    /**
     * Map validated payload onto model fields and derive stock status.
     */
    private function applyInventoryFields(array $data): array
    {
        $medication = new Medication($data);
        $status = $medication->computeStockStatus();

        $fields = [
            'name' => $data['name'],
            'generic_name' => $data['generic_name'],
            'brand_name' => $data['brand_name'] ?? null,
            // Legacy NOT NULL columns kept in sync from the new dosage field
            'dosage_form' => $this->dosageFormFrom($data['dosage'] ?? ''),
            'strength' => $data['dosage'] ?? null,
            'dosage' => $data['dosage'] ?? null,
            'quantity' => $data['quantity'],
            'reorder_level' => $data['reorder_level'] ?? 10,
            'unit' => $data['unit'],
            'storage_condition' => $data['storage_condition'],
            'expiry_date' => $data['expiry_date'],
            'stock_status' => $status,
            'notes' => $data['notes'] ?? null,
        ];

        // New registrations with initial stock count as a restock event
        if (isset($data['quantity']) && $data['quantity'] > 0) {
            $fields['last_restocked_at'] = now();
        }

        return $fields;
    }

    private function serializeMovement(MedicationStockMovement $mv): array
    {
        return [
            'id' => $mv->id,
            'type' => $mv->type,
            'quantity_change' => $mv->quantity_change,
            'quantity_before' => $mv->quantity_before,
            'quantity_after' => $mv->quantity_after,
            'reason' => $mv->reason,
            'user' => $mv->user?->name,
            'created_at' => $mv->created_at?->toIso8601String(),
        ];
    }

    /** Extract the presentation word (tablet, capsule, vial…) from a dosage string. */
    private function dosageFormFrom(string $dosage): string
    {
        if (preg_match('/(tablet|capsule|vial|ampoule|sachet|strip|bottle|solution|suspension|injection)/i', $dosage, $m)) {
            return strtolower(substr($m[1], 0, 20));
        }

        return 'tablet';
    }

    private function serialize(Medication $m): array
    {
        return [
            'id' => $m->id,
            'name' => $m->name,
            'generic_name' => $m->generic_name,
            'brand_name' => $m->brand_name,
            'dosage' => $m->dosage,
            'quantity' => (int) $m->quantity,
            'reorder_level' => (int) $m->reorder_level,
            'unit' => $m->unit,
            'storage_condition' => $m->storage_condition,
            'expiry_date' => $m->expiry_date?->toDateString(),
            'stock_status' => $m->stock_status,
            'nearing_expiry' => $m->isNearingExpiry(),
            'days_until_expiry' => $m->daysUntilExpiry(),
            'last_restocked_at' => $m->last_restocked_at?->toIso8601String(),
            'notes' => $m->notes,
            'is_active' => $m->is_active,
            'updated_at' => $m->updated_at?->toIso8601String(),
        ];
    }
}
