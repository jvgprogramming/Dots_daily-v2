"use client";

/**
 * TreatmentUpdateModal — the treatment lifecycle update flow.
 *
 * Edits the EXISTING treatment plan record (status, phase, current and
 * end-of-treatment regimen, outcome + date/reason, progression notes) and
 * appends new lab tests as NEW entries. This is the ongoing-treatment
 * workflow — it never reopens the registration wizard or rewrites intake
 * snapshot data.
 */

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import {
  REGIMEN_OPTIONS,
  TREATMENT_STATUS_OPTIONS,
  TREATMENT_PHASE_OPTIONS,
  TREATMENT_OUTCOME_OPTIONS,
  LAB_TEST_TYPE_OPTIONS,
  LAB_TEST_STATUS_OPTIONS,
} from "@/lib/treatment-options";
import { updateTreatment } from "@/lib/services/treatments";
import type { NewLabTestEntry } from "@/lib/types";

const SELECT_CLASSES =
  "flex h-10 w-full rounded-[10px] border border-border-default bg-bg-card px-3 py-2 text-sm text-text-primary transition-all duration-200 hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary-400/25 focus:border-primary-500";

const LABEL_CLASSES = "mb-1 block text-xs font-medium text-text-secondary";

export interface TreatmentUpdateTarget {
  planId: number;
  patientName: string;
  planName: string;
  regimen_type?: string | null;
  regimen_type_end?: string | null;
  phase?: string | null;
  status?: string | null;
  outcome?: string | null;
  outcome_date?: string | null;
  outcome_reason?: string | null;
  notes?: string | null;
}

interface LabRow extends Partial<NewLabTestEntry> {
  key: number;
}

const emptyLabRow = (key: number): LabRow => ({
  key,
  test_type: "smear",
  status: "done",
});

export function TreatmentUpdateModal({
  target,
  onClose,
  onSaved,
}: {
  target: TreatmentUpdateTarget;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [regimenType, setRegimenType] = useState(target.regimen_type ?? "");
  const [regimenTypeEnd, setRegimenTypeEnd] = useState(target.regimen_type_end ?? "");
  const [phase, setPhase] = useState(target.phase ?? "intensive");
  const [status, setStatus] = useState(target.status ?? "active");
  const [outcome, setOutcome] = useState(target.outcome ?? "");
  const [outcomeDate, setOutcomeDate] = useState(target.outcome_date ?? "");
  const [outcomeReason, setOutcomeReason] = useState(target.outcome_reason ?? "");
  const [notes, setNotes] = useState(target.notes ?? "");
  const [labRows, setLabRows] = useState<LabRow[]>([]);
  const [labKey, setLabKey] = useState(1);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isTerminalStatus = status === "completed" || status === "discontinued";
  const outcomeSelected = outcome !== "";

  const addLabRow = () => {
    setLabRows((rows) => [...rows, emptyLabRow(labKey)]);
    setLabKey((k) => k + 1);
  };

  const updateLabRow = (key: number, patch: Partial<NewLabTestEntry>) => {
    setLabRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const removeLabRow = (key: number) => {
    setLabRows((rows) => rows.filter((r) => r.key !== key));
  };

  const handleSave = async () => {
    setError("");
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        regimen_type: regimenType || null,
        regimen_type_end: regimenTypeEnd || null,
        // phase is NOT NULL in the DB — only send it when active, otherwise
        // omit it so the last recorded phase is kept as history.
        ...(status === "active" ? { phase } : {}),
        status,
        outcome: outcome || null,
        outcome_date: outcome ? outcomeDate || undefined : null,
        outcome_reason: outcome ? outcomeReason || null : null,
        notes: notes || null,
      };

      const labs = labRows
        .filter((r) => r.test_type)
        .map((r) => ({
          test_type: r.test_type!,
          test_name: r.test_name || undefined,
          test_date: r.test_date || undefined,
          result: r.result || undefined,
          status: r.status ?? "done",
          remarks: r.remarks || undefined,
        }));
      if (labs.length > 0) payload.new_lab_tests = labs;

      const res = await updateTreatment(target.planId, payload);
      if (res.success) {
        const labsCount = labs.length;
        onSaved(
          labsCount > 0
            ? `Treatment updated for ${target.patientName} — ${labsCount} new lab ${labsCount === 1 ? "test" : "tests"} added.`
            : `Treatment updated for ${target.patientName}.`
        );
      } else {
        setError(res.message || "Failed to update treatment.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update treatment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => !saving && onClose()}
      title="Update Treatment"
      description={`${target.patientName} · ${target.planName}`}
      size="lg"
    >
      <div className="space-y-5">
        {/* ── Current regimen & phase ── */}
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-primary">
            Regimen & Phase
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={LABEL_CLASSES}>Current regimen</label>
              <select
                className={SELECT_CLASSES}
                value={regimenType}
                onChange={(e) => setRegimenType(e.target.value)}
              >
                <option value="">— Not set —</option>
                {REGIMEN_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL_CLASSES}>Phase</label>
              <select
                className={SELECT_CLASSES}
                value={phase}
                onChange={(e) => setPhase(e.target.value)}
                disabled={status !== "active"}
              >
                {TREATMENT_PHASE_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* ── Status ── */}
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-primary">
            Treatment Status
          </p>
          <div className="flex flex-wrap gap-2">
            {TREATMENT_STATUS_OPTIONS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setStatus(s.value)}
                className={`px-3.5 py-2 text-xs font-medium rounded-full border transition-all duration-150 ${
                  status === s.value
                    ? "bg-primary-500 border-primary-500 text-white"
                    : "bg-bg-card border-border-light text-text-secondary hover:border-border-strong"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>

        {/* ── Outcome ── */}
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-primary">
            Outcome
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={LABEL_CLASSES}>Regimen at end</label>
              <select
                className={SELECT_CLASSES}
                value={regimenTypeEnd}
                onChange={(e) => setRegimenTypeEnd(e.target.value)}
              >
                <option value="">— Not recorded yet —</option>
                {REGIMEN_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL_CLASSES}>Treatment outcome</label>
              <select
                className={SELECT_CLASSES}
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
              >
                <option value="">— Not recorded yet —</option>
                {TREATMENT_OUTCOME_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {outcomeSelected && (
              <>
                <div>
                  <label className={LABEL_CLASSES}>Outcome date</label>
                  <Input
                    type="date"
                    value={outcomeDate}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setOutcomeDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASSES}>Outcome reason</label>
                  <Input
                    placeholder={
                      outcome === "failed" || outcome === "lost_to_followup" || outcome === "died"
                        ? "e.g. Resistance to regimen, patient relocated…"
                        : "Optional"
                    }
                    value={outcomeReason}
                    maxLength={255}
                    onChange={(e) => setOutcomeReason(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
          {outcomeSelected && isTerminalStatus === false && (
            <p className="text-[11px] text-text-tertiary">
              Tip: set the status to Completed or Discontinued when recording a
              final outcome.
            </p>
          )}
        </section>

        {/* ── Lab tests (append-only) ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-primary">
              New Lab Tests
            </p>
            <Button variant="outline" size="sm" onClick={addLabRow}>
              <Plus className="h-3.5 w-3.5" />
              Add test
            </Button>
          </div>
          {labRows.length === 0 ? (
            <p className="rounded-[10px] bg-bg-subtle px-3 py-2.5 text-xs text-text-tertiary">
              Optional — new entries are appended after the registration lab
              records; existing results are never rewritten.
            </p>
          ) : (
            <div className="space-y-3">
              {labRows.map((row) => (
                <div key={row.key} className="rounded-[10px] border border-border-light p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" size="sm">New entry</Badge>
                    <button
                      type="button"
                      onClick={() => removeLabRow(row.key)}
                      className="text-text-tertiary hover:text-danger transition-colors"
                      title="Remove this entry"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className={LABEL_CLASSES}>Test type</label>
                      <select
                        className={SELECT_CLASSES}
                        value={row.test_type ?? ""}
                        onChange={(e) => updateLabRow(row.key, { test_type: e.target.value })}
                      >
                        {LAB_TEST_TYPE_OPTIONS.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={LABEL_CLASSES}>Test date</label>
                      <Input
                        type="date"
                        value={row.test_date ?? ""}
                        onChange={(e) => updateLabRow(row.key, { test_date: e.target.value })}
                      />
                    </div>
                    {row.test_type === "other" && (
                      <div className="sm:col-span-2">
                        <label className={LABEL_CLASSES}>Test name</label>
                        <Input
                          placeholder="e.g. Sputum culture & sensitivity"
                          value={row.test_name ?? ""}
                          maxLength={255}
                          onChange={(e) => updateLabRow(row.key, { test_name: e.target.value })}
                        />
                      </div>
                    )}
                    <div>
                      <label className={LABEL_CLASSES}>Result</label>
                      <Input
                        placeholder="e.g. Negative / MTB detected"
                        value={row.result ?? ""}
                        maxLength={255}
                        onChange={(e) => updateLabRow(row.key, { result: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLASSES}>Status</label>
                      <select
                        className={SELECT_CLASSES}
                        value={row.status ?? "done"}
                        onChange={(e) =>
                          updateLabRow(row.key, { status: e.target.value as NewLabTestEntry["status"] })
                        }
                      >
                        {LAB_TEST_STATUS_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className={LABEL_CLASSES}>Remarks</label>
                      <Input
                        placeholder="Optional remarks"
                        value={row.remarks ?? ""}
                        maxLength={500}
                        onChange={(e) => updateLabRow(row.key, { remarks: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Progression notes ── */}
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-primary">
            Treatment Progression Notes
          </p>
          <textarea
            className="flex min-h-[72px] w-full rounded-[10px] border border-border-default bg-bg-card px-3 py-2 text-sm text-text-primary transition-all duration-200 hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary-400/25 focus:border-primary-500"
            placeholder="e.g. Completed intensive phase, converting to continuation; weight gain noted…"
            value={notes}
            maxLength={2000}
            onChange={(e) => setNotes(e.target.value)}
          />
        </section>

        {error && <Alert variant="danger">{error}</Alert>}

        <div className="flex justify-end gap-3 pt-1">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
