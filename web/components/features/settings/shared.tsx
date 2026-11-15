"use client";

/**
 * Building blocks shared by every Settings section: field rows, toggles,
 * cards, the save/discard bar, and the per-group draft form handle.
 */

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SettingEntry, SettingsGroup } from "@/lib/types";

export const SELECT_CLASSES =
  "flex h-10 w-full rounded-[10px] border border-border-default bg-bg-card px-3 py-2 text-sm text-text-primary transition-all duration-200 hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary-400/25 focus:border-primary-500";

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * Everything a section needs to read and edit one settings group. Created by
 * the Settings page, which owns the drafts and the save call.
 */
export interface GroupForm {
  group: SettingsGroup;
  str: (key: string) => string;
  bool: (key: string) => boolean;
  set: (key: string, value: string | boolean) => void;
  entry: (key: string) => SettingEntry | undefined;
  dirty: boolean;
  saving: boolean;
  save: () => void;
  discard: () => void;
}

export function SettingField({
  label,
  hint,
  children,
  updatedBy,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  /** Optional "last changed by" line from the stored entry. */
  updatedBy?: SettingEntry;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-text-secondary">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-text-tertiary">{hint}</p>}
      {updatedBy?.updated_by_name && (
        <p className="mt-0.5 text-[10.5px] text-text-tertiary/80">
          Changed by {updatedBy.updated_by_name} · {fmtDateTime(updatedBy.updated_at)}
        </p>
      )}
    </div>
  );
}

export function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors duration-200 disabled:opacity-50 ${
        checked ? "justify-end bg-primary-500" : "justify-start bg-border-strong"
      }`}
    >
      <span className="h-5 w-5 rounded-full bg-white shadow" />
    </button>
  );
}

export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[10px] border border-border-light px-4 py-3">
      <div>
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {hint && <p className="text-xs text-text-tertiary mt-0.5">{hint}</p>}
      </div>
      <div className="flex items-center gap-2.5">
        <span className={`text-[12px] font-medium ${checked ? "text-success-text" : "text-text-tertiary"}`}>
          {checked ? "On" : "Off"}
        </span>
        <Toggle checked={checked} onChange={onChange} label={label} />
      </div>
    </div>
  );
}

export function Card({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="matte-surface rounded-[16px] border p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-text-tertiary">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function SaveBar({ form }: { form: GroupForm }) {
  if (!form.dirty) return null;
  return (
    <div className="mt-5 flex items-center justify-end gap-3 border-t border-border-light pt-4">
      <Button variant="ghost" onClick={form.discard} disabled={form.saving}>
        Discard
      </Button>
      <Button onClick={form.save} disabled={form.saving}>
        {form.saving ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Saving…
          </>
        ) : (
          "Save Changes"
        )}
      </Button>
    </div>
  );
}

/** Text/number input bound to a group key. */
export function BoundInput({
  form,
  k,
  type = "text",
  min,
  max,
  placeholder,
}: {
  form: GroupForm;
  k: string;
  type?: "text" | "number" | "email" | "time";
  min?: number;
  max?: number;
  placeholder?: string;
}) {
  return (
    <Input
      type={type}
      min={min}
      max={max}
      placeholder={placeholder}
      value={form.str(k)}
      onChange={(e) => form.set(k, e.target.value)}
    />
  );
}
