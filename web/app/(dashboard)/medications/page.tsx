"use client";

/**
 * Medication — medicine registration and inventory tracking.
 *
 * Summary cards (stock + expiry alerts), storage status breakdown,
 * searchable inventory table, and add/edit medicine modal.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Pill,
  Plus,
  Search,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Archive,
  Pencil,
  Thermometer,
  Snowflake,
  Refrigerator,
  PackageSearch,
  Loader2,
  History,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Modal } from "@/components/ui/modal";
import { Table } from "@/components/ui/table";
import {
  getMedicationInventory,
  getMedicationSummary,
  createMedication,
  updateMedication,
  deleteMedication,
  adjustMedicationStock,
  getMedicationMovements,
} from "@/lib/services/medications";
import type {
  MedicationInventoryItem,
  MedicationInventorySummary,
  MedicationInventoryPayload,
  MedicationStockMovement,
  StorageCondition,
  StockStatus,
  StockMovementType,
} from "@/lib/types";

// ─── Display config ───
const STORAGE_LABELS: Record<StorageCondition, { label: string; icon: React.ElementType }> = {
  room_temperature: { label: "Room temperature", icon: Thermometer },
  refrigerator: { label: "Refrigerator", icon: Refrigerator },
  cold_storage: { label: "Cold storage", icon: Snowflake },
  special: { label: "Special storage", icon: PackageSearch },
};

const STORAGE_OPTIONS: Array<{ value: StorageCondition; label: string }> = [
  { value: "room_temperature", label: "Room temperature" },
  { value: "refrigerator", label: "Refrigerator (2–8°C)" },
  { value: "cold_storage", label: "Cold storage (frozen)" },
  { value: "special", label: "Special storage required" },
];

const UNIT_OPTIONS = ["tablets", "capsules", "vials", "strips", "bottles", "ampoules", "sachets"];

const STOCK_BADGES: Record<StockStatus, { label: string; variant: "success" | "warning" | "danger" | "default" }> = {
  in_stock: { label: "In stock", variant: "success" },
  low_stock: { label: "Low stock", variant: "warning" },
  out_of_stock: { label: "Out of stock", variant: "danger" },
  expired: { label: "Expired", variant: "danger" },
};

const MOVEMENT_CONFIG: Record<StockMovementType, { label: string; icon: React.ElementType; className: string }> = {
  initial: { label: "Initial stock", icon: Plus, className: "text-text-secondary" },
  restock: { label: "Restock", icon: ArrowUpRight, className: "text-success-text" },
  deduction: { label: "Deduction", icon: ArrowDownRight, className: "text-warning-text" },
  correction: { label: "Correction", icon: Pencil, className: "text-danger-text" },
};

const EMPTY_FORM: MedicationInventoryPayload = {
  name: "",
  generic_name: "",
  brand_name: "",
  dosage: "",
  quantity: 0,
  reorder_level: 10,
  unit: "tablets",
  storage_condition: "room_temperature",
  expiry_date: "",
  notes: "",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function expiryTone(item: MedicationInventoryItem): "danger" | "warning" | null {
  if (item.stock_status === "expired") return "danger";
  if (item.nearing_expiry) return "warning";
  return null;
}

// ─── Summary card ───
function SummaryCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const tones = {
    default: "text-text-primary",
    success: "text-success-text",
    warning: "text-warning-text",
    danger: "text-danger-text",
  };
  return (
    <div className="rounded-[12px] border border-border-light bg-bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-text-tertiary" />
        <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${tones[tone]}`}>{value}</p>
    </div>
  );
}

export default function MedicationsPage() {
  const [items, setItems] = useState<MedicationInventoryItem[]>([]);
  const [summary, setSummary] = useState<MedicationInventorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ── Filters ──
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | StockStatus>("");
  const [storageFilter, setStorageFilter] = useState<"" | StorageCondition>("");

  // ── Modal state ──
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MedicationInventoryItem | null>(null);
  const [form, setForm] = useState<MedicationInventoryPayload>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleting, setDeleting] = useState<MedicationInventoryItem | null>(null);

  // ── Adjust stock state ──
  const [adjusting, setAdjusting] = useState<MedicationInventoryItem | null>(null);
  const [adjustMode, setAdjustMode] = useState<"delta" | "absolute">("delta");
  const [adjustInput, setAdjustInput] = useState(0);
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustSaving, setAdjustSaving] = useState(false);
  const [adjustError, setAdjustError] = useState("");

  // ── Movement history state ──
  const [historyFor, setHistoryFor] = useState<MedicationInventoryItem | null>(null);
  const [movements, setMovements] = useState<MedicationStockMovement[]>([]);
  const [movementsPage, setMovementsPage] = useState(1);
  const [movementsLastPage, setMovementsLastPage] = useState(1);
  const [movementsLoading, setMovementsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [inv, sum] = await Promise.all([
        getMedicationInventory({
          search,
          stock_status: statusFilter || undefined,
          storage_condition: storageFilter || undefined,
          per_page: 50,
        }),
        getMedicationSummary(),
      ]);
      setItems(inv.data);
      setSummary(sum.data ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load medication inventory");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, storageFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Search debounce ──
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ── Modal helpers ──
  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (item: MedicationInventoryItem) => {
    setEditing(item);
    setForm({
      name: item.name,
      generic_name: item.generic_name,
      brand_name: item.brand_name ?? "",
      dosage: item.dosage ?? "",
      quantity: item.quantity ?? 0,
      reorder_level: item.reorder_level ?? 10,
      unit: item.unit ?? "tablets",
      storage_condition: item.storage_condition ?? "room_temperature",
      expiry_date: item.expiry_date ?? "",
      notes: item.notes ?? "",
    });
    setFormError("");
    setModalOpen(true);
  };

  const updateField = (key: keyof MedicationInventoryPayload, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    setFormError("");
    try {
      if (editing) {
        await updateMedication(editing.id, form);
      } else {
        await createMedication(form);
      }
      setModalOpen(false);
      await load();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to save medicine");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await deleteMedication(deleting.id);
      setDeleting(null);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to remove medicine");
    } finally {
      setSaving(false);
    }
  };

  // ── Adjust stock helpers ──
  const openAdjust = (item: MedicationInventoryItem) => {
    setAdjusting(item);
    setAdjustMode("delta");
    setAdjustInput(0);
    setAdjustReason("");
    setAdjustError("");
  };

  const adjustedQty = adjusting
    ? adjustMode === "absolute"
      ? adjustInput
      : adjusting.quantity + adjustInput
    : 0;

  const adjustValid =
    adjusting !== null && adjustedQty >= 0 && (adjustMode === "absolute" ? adjustInput !== adjusting.quantity : adjustInput !== 0);

  const handleAdjust = async () => {
    if (!adjusting || !adjustValid) return;
    setAdjustSaving(true);
    setAdjustError("");
    try {
      await adjustMedicationStock(adjusting.id, {
        ...(adjustMode === "absolute"
          ? { new_quantity: adjustInput }
          : { quantity_change: adjustInput }),
        reason: adjustReason || undefined,
      });
      setAdjusting(null);
      await load();
    } catch (err: unknown) {
      setAdjustError(err instanceof Error ? err.message : "Failed to adjust stock");
    } finally {
      setAdjustSaving(false);
    }
  };

  // ── Movement history helpers ──
  const openHistory = (item: MedicationInventoryItem, page = 1) => {
    setHistoryFor(item);
    setMovementsPage(page);
    setMovementsLoading(true);
    getMedicationMovements(item.id, page)
      .then((res) => {
        setMovements(res.data);
        setMovementsLastPage(res.meta.last_page);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load movement history");
      })
      .finally(() => setMovementsLoading(false));
  };

  const selectClass =
    "flex h-11 w-full rounded-[10px] border border-border-default bg-bg-card px-4 py-2 text-sm text-text-primary transition-all duration-200 hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary-400/25 focus:border-primary-500";

  const columns = [
    {
      key: "name",
      header: "Medicine",
      cell: (m: MedicationInventoryItem) => (
        <div>
          <p className="font-medium text-text-primary">{m.name}</p>
          <p className="text-xs text-text-tertiary">
            {m.generic_name}
            {m.brand_name ? ` · ${m.brand_name}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "dosage",
      header: "Dosage",
      cell: (m: MedicationInventoryItem) => <span>{m.dosage}</span>,
    },
    {
      key: "quantity",
      header: "Quantity",
      cell: (m: MedicationInventoryItem) => (
        <span className={m.stock_status === "out_of_stock" ? "text-danger-text font-medium" : ""}>
          {m.quantity} {m.unit}
        </span>
      ),
    },
    {
      key: "storage_condition",
      header: "Storage",
      cell: (m: MedicationInventoryItem) => {
        const cfg = STORAGE_LABELS[m.storage_condition];
        const Icon = cfg?.icon ?? Thermometer;
        return (
          <span className="inline-flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 text-text-tertiary" />
            {cfg?.label ?? m.storage_condition}
          </span>
        );
      },
    },
    {
      key: "expiry_date",
      header: "Expiry",
      cell: (m: MedicationInventoryItem) => {
        const tone = expiryTone(m);
        return (
          <span
            className={`inline-flex items-center gap-1 ${
              tone === "danger" ? "text-danger-text font-medium" : tone === "warning" ? "text-warning-text" : ""
            }`}
          >
            {tone === "danger" && <XCircle className="h-3.5 w-3.5" />}
            {tone === "warning" && <AlertTriangle className="h-3.5 w-3.5" />}
            {formatDate(m.expiry_date)}
          </span>
        );
      },
    },
    {
      key: "stock_status",
      header: "Status",
      cell: (m: MedicationInventoryItem) => {
        const cfg = STOCK_BADGES[m.stock_status];
        return (
          <div className="flex items-center gap-1.5">
            <Badge variant={cfg?.variant ?? "default"} size="sm">
              {cfg?.label ?? m.stock_status}
            </Badge>
            {m.nearing_expiry && m.stock_status !== "expired" && (
              <span className="text-[11px] text-warning-text">
                {m.days_until_expiry !== null && m.days_until_expiry <= 30
                  ? `${m.days_until_expiry}d left`
                  : "nearing expiry"}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "updated_at",
      header: "Last Updated",
      cell: (m: MedicationInventoryItem) => <span>{formatDate(m.updated_at)}</span>,
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (m: MedicationInventoryItem) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => openAdjust(m)}
            className="rounded-[6px] p-1.5 text-text-tertiary transition-colors hover:bg-bg-subtle hover:text-text-primary"
            aria-label={`Adjust stock for ${m.name}`}
          >
            <PackageSearch className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => openHistory(m)}
            className="rounded-[6px] p-1.5 text-text-tertiary transition-colors hover:bg-bg-subtle hover:text-text-primary"
            aria-label={`View stock history for ${m.name}`}
          >
            <History className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => openEdit(m)}
            className="rounded-[6px] p-1.5 text-text-tertiary transition-colors hover:bg-bg-subtle hover:text-text-primary"
            aria-label={`Edit ${m.name}`}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeleting(m)}
            className="rounded-[6px] p-1.5 text-text-tertiary transition-colors hover:bg-bg-subtle hover:text-danger"
            aria-label={`Remove ${m.name}`}
          >
            <Archive className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-text-primary">Medication</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Register medicines and track inventory, storage, and expiry.
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Add Medicine
        </Button>
      </div>

      {error && <Alert variant="danger" onClose={() => setError("")}>{error}</Alert>}

      {/* ── Summary cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard icon={Pill} label="Total Medicines" value={summary?.total_medicines ?? "—"} />
        <SummaryCard icon={CheckCircle2} label="In Stock" value={summary?.in_stock ?? "—"} tone="success" />
        <SummaryCard icon={AlertTriangle} label="Low Stock" value={summary?.low_stock ?? "—"} tone="warning" />
        <SummaryCard icon={XCircle} label="Out of Stock" value={summary?.out_of_stock ?? "—"} tone="danger" />
        <SummaryCard icon={AlertTriangle} label="Expiring Soon" value={summary?.nearing_expiry ?? "—"} tone="warning" />
      </div>

      {/* ── Storage breakdown ── */}
      {summary && (
        <div className="flex flex-wrap gap-2">
          {(Object.keys(STORAGE_LABELS) as StorageCondition[]).map((key) => {
            const cfg = STORAGE_LABELS[key];
            const Icon = cfg.icon;
            const count = summary.storage_breakdown[key] ?? 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setStorageFilter(storageFilter === key ? "" : key)}
                className={`inline-flex items-center gap-2 rounded-[8px] border px-3 py-1.5 text-xs font-medium transition-colors ${
                  storageFilter === key
                    ? "border-primary-300 bg-primary-50 text-primary-700"
                    : "border-border-light bg-bg-card text-text-secondary hover:bg-bg-subtle"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {cfg.label}
                <span className="rounded-full bg-bg-subtle px-1.5 text-[11px] text-text-tertiary">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <Input
            placeholder="Search medicines by name or generic name…"
            className="pl-9 h-10 rounded-[8px]"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <select
          className={`${selectClass} sm:w-48 h-10`}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "" | StockStatus)}
        >
          <option value="">All stock statuses</option>
          <option value="in_stock">In stock</option>
          <option value="low_stock">Low stock</option>
          <option value="out_of_stock">Out of stock</option>
          <option value="expired">Expired</option>
        </select>
        {(search || statusFilter || storageFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchInput("");
              setStatusFilter("");
              setStorageFilter("");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* ── Inventory table ── */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        </div>
      ) : (
        <Table
          columns={columns}
          data={items}
          keyExtractor={(m) => m.id}
          emptyMessage="No medicines registered yet. Click “Add Medicine” to get started."
        />
      )}

      {/* ── Add / Edit modal ── */}
      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editing ? "Edit Medicine" : "Add Medicine"}
        description={
          editing
            ? "Update inventory details, storage, or expiry information."
            : "Register a new medicine into inventory."
        }
        size="lg"
      >
        <div className="space-y-5">
          {formError && <Alert variant="danger">{formError}</Alert>}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 block">Medicine Name *</label>
              <Input
                placeholder="e.g. Rifampicin"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 block">Generic Name *</label>
              <Input
                placeholder="e.g. Rifampicin"
                value={form.generic_name}
                onChange={(e) => updateField("generic_name", e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 block">Brand Name</label>
              <Input
                placeholder="Optional"
                value={form.brand_name ?? ""}
                onChange={(e) => updateField("brand_name", e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 block">Dosage *</label>
              <Input
                placeholder="e.g. 300mg capsule"
                value={form.dosage}
                onChange={(e) => updateField("dosage", e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 block">Quantity *</label>
              <Input
                type="number"
                min={0}
                value={form.quantity}
                onChange={(e) => updateField("quantity", Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 block">Unit *</label>
              <select
                className={selectClass}
                value={form.unit}
                onChange={(e) => updateField("unit", e.target.value)}
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 block">Low Stock Alert Level</label>
              <Input
                type="number"
                min={0}
                value={form.reorder_level ?? 10}
                onChange={(e) => updateField("reorder_level", Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 block">Storage Type *</label>
              <select
                className={selectClass}
                value={form.storage_condition}
                onChange={(e) => updateField("storage_condition", e.target.value)}
              >
                {STORAGE_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 block">Expiry Date *</label>
              <Input
                type="date"
                value={form.expiry_date}
                onChange={(e) => updateField("expiry_date", e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-text-secondary mb-1.5 block">Notes</label>
              <textarea
                rows={2}
                className="flex w-full rounded-[10px] border border-border-default bg-bg-card px-4 py-2 text-sm text-text-primary transition-all duration-200 hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary-400/25 focus:border-primary-500"
                placeholder="Storage instructions, batch number, remarks…"
                value={form.notes ?? ""}
                onChange={(e) => updateField("notes", e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : editing ? (
                "Save Changes"
              ) : (
                "Register Medicine"
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Delete confirmation ── */}
      <Modal
        open={deleting !== null}
        onClose={() => !saving && setDeleting(null)}
        title="Remove medicine"
        description="This medicine will be archived from inventory."
        size="sm"
      >
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-[10px] bg-bg-subtle p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-warning shrink-0" />
            <p className="text-sm text-text-secondary">
              {deleting?.name} will no longer appear in active inventory. Treatment history
              referencing it is preserved.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? "Removing…" : "Remove"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Adjust stock modal ── */}
      <Modal
        open={adjusting !== null}
        onClose={() => !adjustSaving && setAdjusting(null)}
        title="Adjust Stock"
        description={adjusting ? `${adjusting.name} · current stock: ${adjusting.quantity} ${adjusting.unit}` : undefined}
        size="sm"
      >
        <div className="space-y-5">
          {adjustError && <Alert variant="danger">{adjustError}</Alert>}

          {/* Mode toggle */}
          <div className="flex rounded-[8px] border border-border-light p-1">
            {(["delta", "absolute"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setAdjustMode(mode);
                  setAdjustInput(0);
                }}
                className={`flex-1 rounded-[6px] px-3 py-1.5 text-sm font-medium transition-colors ${
                  adjustMode === mode
                    ? "bg-primary-50 text-primary-700"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {mode === "delta" ? "Add / Remove" : "Set exact"}
              </button>
            ))}
          </div>

          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">
              {adjustMode === "delta" ? "Quantity change (use − to deduct)" : "New quantity"}
            </label>
            <Input
              type="number"
              value={adjustInput}
              onChange={(e) => setAdjustInput(Number(e.target.value))}
            />
          </div>

          {/* Live preview */}
          <div className="flex items-center justify-center gap-3 rounded-[10px] bg-bg-subtle px-4 py-3">
            <span className="text-lg font-semibold text-text-tertiary">{adjusting?.quantity ?? 0}</span>
            <span className={`text-sm font-semibold ${adjustedQty >= (adjusting?.quantity ?? 0) ? "text-success-text" : "text-warning-text"}`}>
              →
            </span>
            <span className="text-lg font-bold text-text-primary">{adjustedQty}</span>
            <span className="text-xs text-text-tertiary">{adjusting?.unit}</span>
            {!adjustValid && adjustedQty < 0 && (
              <span className="text-xs text-danger-text">cannot go below zero</span>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Reason</label>
            <textarea
              rows={2}
              className="flex w-full rounded-[10px] border border-border-default bg-bg-card px-4 py-2 text-sm text-text-primary transition-all duration-200 hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary-400/25 focus:border-primary-500"
              placeholder="e.g. Delivered 2 boxes from supplier, dispensed to patients…"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setAdjusting(null)} disabled={adjustSaving}>
              Cancel
            </Button>
            <Button onClick={handleAdjust} disabled={adjustSaving || !adjustValid}>
              {adjustSaving ? "Saving…" : "Confirm Adjustment"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Movement history modal ── */}
      <Modal
        open={historyFor !== null}
        onClose={() => setHistoryFor(null)}
        title="Stock History"
        description={historyFor ? `${historyFor.name} · every quantity change is recorded` : undefined}
        size="lg"
      >
        <div className="space-y-4">
          {movementsLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : movements.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-tertiary">No stock movements recorded yet.</p>
          ) : (
            <>
              <ul className="max-h-80 divide-y divide-border-light overflow-y-auto">
                {movements.map((mv) => {
                  const cfg = MOVEMENT_CONFIG[mv.type];
                  const Icon = cfg.icon;
                  const positive = mv.quantity_change > 0;
                  return (
                    <li key={mv.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-bg-subtle ${cfg.className}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-text-primary">{cfg.label}</p>
                          <span className={`text-sm font-semibold ${positive ? "text-success-text" : "text-danger-text"}`}>
                            {positive ? "+" : ""}{mv.quantity_change}
                          </span>
                        </div>
                        <p className="text-xs text-text-tertiary">
                          {mv.quantity_before} → {mv.quantity_after} · {new Date(mv.created_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                          {mv.user ? ` · by ${mv.user}` : ""}
                        </p>
                        {mv.reason && <p className="mt-0.5 truncate text-xs text-text-secondary">{mv.reason}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {movementsLastPage > 1 && (
                <div className="flex items-center justify-between border-t border-border-light pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={movementsPage <= 1}
                    onClick={() => historyFor && openHistory(historyFor, movementsPage - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-text-tertiary">
                    Page {movementsPage} of {movementsLastPage}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={movementsPage >= movementsLastPage}
                    onClick={() => historyFor && openHistory(historyFor, movementsPage + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setHistoryFor(null)}>Close</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
