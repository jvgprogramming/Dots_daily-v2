/**
 * Canonical treatment lifecycle options — shared by the Treatments hub,
 * the update modal, and the patient profile display so labels stay
 * consistent everywhere (single source of truth for UI vocabulary).
 */

export const TREATMENT_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "discontinued", label: "Discontinued" },
  { value: "interrupted", label: "Interrupted" },
] as const;

export const TREATMENT_PHASE_OPTIONS = [
  { value: "intensive", label: "Intensive" },
  { value: "continuation", label: "Continuation" },
] as const;

export const TREATMENT_OUTCOME_OPTIONS = [
  { value: "cured", label: "Cured" },
  { value: "treatment_completed", label: "Treatment Completed" },
  { value: "died", label: "Died" },
  { value: "failed", label: "Failed" },
  { value: "lost_to_followup", label: "Lost to Follow-up" },
] as const;

export const REGIMEN_OPTIONS = [
  { value: "2HRZE/4HR", label: "2HRZE / 4HR — DS-TB standard (6 mo)" },
  { value: "2HRZE/10HR", label: "2HRZE / 10HR — extended (12 mo)" },
  { value: "9H", label: "9H — TB infection, 9 months isoniazid" },
  { value: "3HP", label: "3HP — TB infection, 3 months HP" },
  { value: "4R", label: "4R — TB infection, 4 months rifampicin" },
  { value: "BPaLM", label: "BPaLM — RR/MDR-TB (6 mo)" },
  { value: "BPaL", label: "BPaL — RR/MDR-TB (6 mo)" },
  { value: "9-11 mo MDR", label: "9–11 month MDR regimen" },
  { value: "individualized", label: "Individualized MDR/XDR regimen" },
] as const;

export const LAB_TEST_TYPE_OPTIONS = [
  { value: "xpert", label: "Xpert MTB/RIF" },
  { value: "xpert_ultra", label: "Xpert MTB/RIF Ultra" },
  { value: "smear", label: "Smear Microscopy" },
  { value: "tb_lamp", label: "TB LAMP" },
  { value: "cxr", label: "Chest X-ray" },
  { value: "tst", label: "Tuberculin Skin Test" },
  { value: "other", label: "Other" },
] as const;

export const LAB_TEST_STATUS_OPTIONS = [
  { value: "done", label: "Done" },
  { value: "not_yet_done", label: "Not yet done" },
  { value: "not_available", label: "Not available" },
] as const;

/** Resolve an option list value → label, falling back to the raw value. */
export function optionLabel(
  options: ReadonlyArray<{ value: string; label: string }>,
  value: string | null | undefined
): string {
  if (!value) return "—";
  return options.find((o) => o.value === value)?.label ?? value.replace(/_/g, " ");
}
