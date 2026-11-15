"use client";

/**
 * Treatment protocols: the TB regimens offered at registration (with phase
 * lengths that set a new plan's expected end date), adult FDC dosing by
 * weight band, and the outcome options for closing a treatment.
 */

import { useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { optionLabel, TREATMENT_OUTCOME_OPTIONS } from "@/lib/treatment-options";
import type { RegimenProtocol, WeightBand } from "@/lib/types";
import { Card, SaveBar, type GroupForm } from "./shared";

function parse<T>(raw: string, fallback: T[]): T[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

const CELL = "h-9 px-2 text-[13px]";

export function ProtocolsSection({ form }: { form: GroupForm }) {
  const regimens = useMemo(() => parse<RegimenProtocol>(form.str("regimens"), []), [form]);
  const bands = useMemo(() => parse<WeightBand>(form.str("weight_bands"), []), [form]);
  const outcomes = form.str("outcome_options").split(",").map((o) => o.trim()).filter(Boolean);

  const setRegimens = (next: RegimenProtocol[]) => form.set("regimens", JSON.stringify(next));
  const setBands = (next: WeightBand[]) => form.set("weight_bands", JSON.stringify(next));

  const updateRegimen = (i: number, patch: Partial<RegimenProtocol>) =>
    setRegimens(regimens.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const updateBand = (i: number, patch: Partial<WeightBand>) =>
    setBands(bands.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));

  const num = (v: string) => (v === "" ? 0 : Math.max(0, Number(v) || 0));

  return (
    <div className="space-y-6">
      <Card
        title="Regimens"
        description="Offered when registering a patient. Phase lengths set the plan's expected end date; 0 + 0 means the end date is set manually."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRegimens([...regimens, { code: "", name: "", intensive_days: 60, continuation_days: 122, drugs: "" }])}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add regimen
          </Button>
        }
      >
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
                <th className="pb-2 pr-2">Code</th>
                <th className="pb-2 pr-2">Name</th>
                <th className="pb-2 pr-2 w-24">Intensive (d)</th>
                <th className="pb-2 pr-2 w-24">Continuation (d)</th>
                <th className="pb-2 pr-2 w-20">Total</th>
                <th className="pb-2 pr-2">Drugs</th>
                <th className="pb-2 w-8" />
              </tr>
            </thead>
            <tbody className="align-top">
              {regimens.map((r, i) => {
                const total = (r.intensive_days || 0) + (r.continuation_days || 0);
                return (
                  <tr key={i} className="border-t border-border-light">
                    <td className="py-1.5 pr-2 w-32">
                      <Input className={CELL} value={r.code} error={!r.code} onChange={(e) => updateRegimen(i, { code: e.target.value })} placeholder="2HRZE/4HR" />
                    </td>
                    <td className="py-1.5 pr-2">
                      <Input className={CELL} value={r.name} onChange={(e) => updateRegimen(i, { name: e.target.value })} />
                    </td>
                    <td className="py-1.5 pr-2">
                      <Input className={CELL} type="number" min={0} value={r.intensive_days} onChange={(e) => updateRegimen(i, { intensive_days: num(e.target.value) })} />
                    </td>
                    <td className="py-1.5 pr-2">
                      <Input className={CELL} type="number" min={0} value={r.continuation_days} onChange={(e) => updateRegimen(i, { continuation_days: num(e.target.value) })} />
                    </td>
                    <td className="py-1.5 pr-2 pt-3.5 text-[12px] tabular-nums text-text-secondary">
                      {total > 0 ? `${total} d · ~${Math.round(total / 30.4)} mo` : "Manual"}
                    </td>
                    <td className="py-1.5 pr-2">
                      <Input className={CELL} value={r.drugs} onChange={(e) => updateRegimen(i, { drugs: e.target.value })} />
                    </td>
                    <td className="py-1.5 pt-2.5">
                      <button
                        type="button"
                        aria-label={`Remove ${r.code || "regimen"}`}
                        onClick={() => setRegimens(regimens.filter((_, idx) => idx !== i))}
                        className="rounded-[6px] p-1 text-text-tertiary hover:bg-danger-bg hover:text-danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-text-tertiary">
          Changing a code does not rename it on existing treatment plans — add a new regimen instead of renaming one in use.
        </p>
      </Card>

      <Card
        title="Weight-band Dosing (adult FDC)"
        description="Tablets per day by body weight, shown as a dosing guide for clinicians."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const last = bands[bands.length - 1];
              const min = last?.max_kg != null ? last.max_kg + 1 : 25;
              setBands([...bands, { min_kg: min, max_kg: null, intensive_tablets: 1, continuation_tablets: 1 }]);
            }}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add band
          </Button>
        }
      >
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[520px] text-left">
            <thead>
              <tr className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
                <th className="pb-2 pr-2">From (kg)</th>
                <th className="pb-2 pr-2">To (kg)</th>
                <th className="pb-2 pr-2">Intensive tablets</th>
                <th className="pb-2 pr-2">Continuation tablets</th>
                <th className="pb-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {bands.map((b, i) => (
                <tr key={i} className="border-t border-border-light">
                  <td className="py-1.5 pr-2">
                    <Input className={CELL} type="number" min={0} value={b.min_kg} onChange={(e) => updateBand(i, { min_kg: num(e.target.value) })} />
                  </td>
                  <td className="py-1.5 pr-2">
                    <Input
                      className={CELL}
                      type="number"
                      min={0}
                      placeholder="and above"
                      value={b.max_kg ?? ""}
                      onChange={(e) => updateBand(i, { max_kg: e.target.value === "" ? null : num(e.target.value) })}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <Input className={CELL} type="number" min={0} value={b.intensive_tablets} onChange={(e) => updateBand(i, { intensive_tablets: num(e.target.value) })} />
                  </td>
                  <td className="py-1.5 pr-2">
                    <Input className={CELL} type="number" min={0} value={b.continuation_tablets} onChange={(e) => updateBand(i, { continuation_tablets: num(e.target.value) })} />
                  </td>
                  <td className="py-1.5">
                    <button
                      type="button"
                      aria-label="Remove band"
                      onClick={() => setBands(bands.filter((_, idx) => idx !== i))}
                      className="rounded-[6px] p-1 text-text-tertiary hover:bg-danger-bg hover:text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <OutcomeOptions
        outcomes={outcomes}
        onChange={(next) => form.set("outcome_options", next.join(","))}
      />

      <SaveBar form={form} />
    </div>
  );
}

function OutcomeOptions({ outcomes, onChange }: { outcomes: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const code = draft.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30); // outcome column is 30 chars
    if (code && !outcomes.includes(code)) onChange([...outcomes, code]);
    setDraft("");
  };

  return (
    <Card title="Treatment Outcomes" description="Options offered when closing a treatment in the Treatments hub.">
      <div className="flex flex-wrap gap-1.5">
        {outcomes.map((o) => (
          <span key={o} className="inline-flex items-center gap-1 rounded-[8px] border border-border-light bg-bg-subtle px-2 py-1 text-[12px] text-text-secondary">
            {optionLabel(TREATMENT_OUTCOME_OPTIONS, o)}
            <button
              type="button"
              aria-label={`Remove ${o}`}
              disabled={outcomes.length <= 1}
              onClick={() => onChange(outcomes.filter((x) => x !== o))}
              className="text-text-tertiary hover:text-danger disabled:opacity-30"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-3 flex max-w-sm gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder="Add outcome, e.g. Not evaluated"
          className="h-9"
        />
        <Button variant="outline" size="sm" onClick={add} disabled={!draft.trim()}>
          Add
        </Button>
      </div>
    </Card>
  );
}
