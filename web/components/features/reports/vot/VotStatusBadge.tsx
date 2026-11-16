import { CheckCircle2, Clock, RotateCcw, Upload, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { VotDoseStatus, VotSubmissionStatus } from "@/lib/types";

type BadgeVariant = "success" | "warning" | "danger" | "info" | "default";

const SUBMISSION_META: Record<VotSubmissionStatus, { label: string; variant: BadgeVariant; icon: React.ElementType }> = {
  pending: { label: "Pending review", variant: "warning", icon: Clock },
  verified: { label: "Verified", variant: "success", icon: CheckCircle2 },
  rejected: { label: "Rejected", variant: "danger", icon: XCircle },
  resubmission_requested: { label: "New proof requested", variant: "info", icon: RotateCcw },
};

const DOSE_META: Record<VotDoseStatus, { label: string; variant: BadgeVariant; icon: React.ElementType }> = {
  awaiting_proof: { label: "Awaiting proof", variant: "default", icon: Upload },
  pending: { label: "Pending review", variant: "warning", icon: Clock },
  verified: { label: "Verified", variant: "success", icon: CheckCircle2 },
  rejected: { label: "Rejected", variant: "danger", icon: XCircle },
  resubmission_required: { label: "Resubmission required", variant: "info", icon: RotateCcw },
};

/** Review state of one proof attempt. */
export function VotSubmissionBadge({ status }: { status: VotSubmissionStatus }) {
  const meta = SUBMISSION_META[status];
  const Icon = meta.icon;
  return (
    <Badge variant={meta.variant} size="sm">
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}

/** Review state of a dose (what adherence and the calendar read). */
export function VotDoseBadge({ status }: { status: VotDoseStatus }) {
  const meta = DOSE_META[status];
  const Icon = meta.icon;
  return (
    <Badge variant={meta.variant} size="sm">
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}

export const VOT_SUBMISSION_STATUS_OPTIONS: { value: VotSubmissionStatus; label: string }[] = (
  Object.keys(SUBMISSION_META) as VotSubmissionStatus[]
).map((value) => ({ value, label: SUBMISSION_META[value].label }));

// ── Formatting (local time; matches the rest of Reports) ──

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

export function fmtClock(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return `${fmtDate(iso)} · ${fmtClock(iso)}`;
}

/** "07:00" → "7:00 AM". */
export function fmtTime(hhmm: string | null | undefined): string {
  if (!hhmm) return "—";
  const [hRaw, m] = hhmm.split(":");
  const h = Number(hRaw);
  if (Number.isNaN(h)) return hhmm;
  return `${h % 12 === 0 ? 12 : h % 12}:${m ?? "00"} ${h < 12 ? "AM" : "PM"}`;
}

export function fmtDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "—";
  const m = Math.floor(seconds / 60);
  return `${m}:${String(seconds % 60).padStart(2, "0")}`;
}

export function fmtBytes(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Local-time ISO date (YYYY-MM-DD). */
export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
