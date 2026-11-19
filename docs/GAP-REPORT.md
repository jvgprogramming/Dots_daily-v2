# DOTS Daily — Specification vs. Implementation Gap Report

**Version:** 1.0
**Date:** 2026-11-16
**Baseline commit:** `d73b655` (plus the in-progress video-proof and Ask DOTi work on this branch)
**Author:** Engineering

---

## 1. Purpose & method

This report records where the **implemented system** diverges from the project's
**written specification**, so the two can be reconciled before the thesis
defense. There is no single formal paper in the repository; the de-facto
specification is the `docs/` set, principally:

- `docs/project_constitution.md` — governing rules, tech stack, standards (v1.0)
- `docs/Roadmap.md` — the frozen feature scope ("Scope Freeze")
- `docs/Database.md` — the frozen 14-table data model (v2.0)

Supporting, non-spec references reviewed: `docs/HANDOFF-MOBILE.md`,
`CLAUDE.local.md` (developer notes, treated as ground truth where the docs
conflict), and the code itself (`backend/`, `web/`, `mobile/`). `docs/API.md`
and `docs/Features.md` exist but are **empty**.

> Where the documentation and the code disagree, the **code is authoritative** —
> `CLAUDE.local.md` states plainly that `docs/` is outdated.

---

## 2. Executive summary

| # | Area | Spec says | Code does | Severity | Recommendation |
|---|------|-----------|-----------|----------|----------------|
| 1 | Proof of intake | Photo only (`proof_photo`) | **Video** proof added (`proof_video_path`), photo retained | High | Update spec + ERD to include video |
| 2 | Patient help | Generic "AI Chat" (LLM, `ai_conversations`) | **Ask DOTi** — curated offline FAQ with an LLM-ready seam | Medium | Document Ask DOTi; keep AI tables as "future" |
| 3 | Roles | `ENUM('admin','patient')` | `admin` / `staff` (portal) + `patient` (mobile) | High | Rewrite role model in `Database.md` + constitution |
| 4 | Tech stack | Next 15 / Laravel 12 / shadcn+Axios+Zod+RHF+TanStack | Next 16.2.9 / Laravel ^13.8 / plain `fetch()` | Medium | Correct stack sections; remove uninstalled libs |
| 5 | Alarm/reminder | Backend "notifications" module only | Full on-device alarm engine (undocumented) | Medium | Document the mobile alarm as a first-class feature |
| 5b | DOTS review | Nurse verifies every dose (`observed_by`) | **Logged by default; nurse flags suspicious videos** (flagged excluded from adherence) | High | Document the flag-based review model |
| 6 | Dose logging | — | Single idempotent upsert endpoint; offline queue | Low | Document the mobile sync contract |
| 7 | Serialization | — | Dose logs hand-shaped per controller (no shared Resource) | Low (debt) | Extract `MedicationLogResource` later |

---

## 3. Proof of intake: photo (spec) vs. video (implemented)

**Spec.** `docs/Database.md:226` defines `proof_photo VARCHAR(255) NULLABLE —
Storage path to photo evidence from Flutter app`, and lines 242 describe the
Flutter app letting a patient *"upload a photo as proof of medication intake …
when a healthcare worker is not physically present."* No video field exists in
any document. A code comment in `DoseVerificationController.php` even de-scopes
video ("the original plan has patients attaching a photo or video … but the
admin's judgement is the source of truth").

**Implementation (this branch).** Per the approved plan, the mobile app now
records a short **video** after the alarm and uploads it:

- New columns `proof_video_path`, `proof_video_mime`, `proof_video_size` on
  `medication_logs` (migration `2026_11_17_000001_add_proof_video_to_medication_logs.php`).
- Multipart upload in `MobileDoseLogController::store()` via a new
  `StoreDoseLogRequest` (validates `mimetypes:video/mp4,video/quicktime`, max 64 MB).
- Clips are compressed on-device and stored as **files** on the `public` disk;
  the DB row keeps only the path (a database cannot hold video efficiently).
- `proof_photo` is retained and untouched (still read by the web portal).

**Recommendation.** Update `Database.md` (table + ERD + the proof narrative) and
the Roadmap scope to list **video proof**, noting photo remains supported. Record
that video proof is coupled to the alarm (the dose is logged by recording).

**Review model change (related).** The DOTS review workflow shifted from
"a nurse verifies every dose" to **logged-by-default, flag-by-exception**: a
recorded dose counts immediately, and a nurse only **flags** a dose whose video
looks suspicious. A flagged dose is **excluded from adherence** until it is
cleared. New columns `flagged_at/by` + `flag_reason`; new endpoints
`POST /medication-logs/{log}/flag` and `/unflag`; the web reports page plays the
video and offers Flag/Unflag; the exclusion lives in `App\Support\Adherence`.
The legacy `observed_by` verify path is retained but no longer the primary flow.
This materially reduces nurse workload and should be documented as the DOTS
oversight mechanism.

---

## 4. Patient help: "AI Chat" (spec) vs. Ask DOTi FAQ (implemented)

**Spec.** `Roadmap.md` lists "AI Chat" and "AI Recommendations"; `Database.md`
§9–11 models `ai_conversations`, `ai_messages`, `ai_recommendations` for a
free-form LLM assistant. The name "Ask DOTi" appears nowhere in the docs.

**Implementation (this branch).** The Chat tab is now **Ask DOTi**, a curated,
**offline** FAQ (`mobile/lib/data/faq_content.dart`) answered through a single
`ChatProvider.ask()` seam (`mobile/lib/providers/chat_provider.dart`). It uses
no network and no LLM, which is dependable and safe for medical content. The seam
is designed so an LLM backend can replace `ask()` later without UI changes; the
`ai_*` tables remain unused by mobile.

**Recommendation.** Document Ask DOTi as the shipped help feature, and keep the
`ai_*` tables explicitly marked "future / not yet wired."

---

## 5. Roles: `admin`/`patient` (spec) vs. `admin`/`staff`/`patient` (implemented)

**Spec.** `Database.md:57` defines `role ENUM('admin','patient')` and defers a
"nurse/doctor" role to "Future Expansion."

**Implementation.** The portal serves **`admin` + `nurse`** (per
`CLAUDE.local.md`), and migration `2026_11_16_000001_consolidate_staff_roles.php`
folds `clinician`/`nurse` into a **`staff`** role. Nurses see only patients they
registered (`Patient::scopeVisibleTo`); access is enforced by `role:` middleware
and mapped in `web/lib/access.ts`. The mobile user remains `patient` and is
blocked from the portal (`MobileAuthController` rejects non-patient roles).

**Recommendation.** Rewrite the role model in `Database.md` and the constitution
to the three-role reality (`admin`, `staff`, `patient`) and describe the
staff-visibility scoping.

---

## 6. Tech stack drift

| Component | Docs say | Actual |
|-----------|----------|--------|
| Next.js | 15 (`project_constitution.md:27`) | **16.2.9** (`web/package.json`) — breaking changes; see `web/AGENTS.md` |
| Laravel | 12 (`project_constitution.md:39`) | **^13.8** (`backend/composer.json`) |
| Web data libs | shadcn/ui, Axios, Zod, React Hook Form, TanStack Query | **None installed**; `web/lib/services/api.ts` uses `fetch()` |
| API prefix | implied `/api` | `/api/v1` |
| DB | MySQL (dev) | MySQL `dots_daily_db` (matches) |
| Mobile | Flutter | Flutter 3.x / Dart ^3.12 (matches) |

**Recommendation.** Correct the stack sections and delete references to
uninstalled libraries, or add a one-line "as-built stack" box pointing readers to
`CLAUDE.local.md`.

---

## 7. Other observed drift

- **On-device alarm is undocumented.** A mature alarm engine exists in the app
  (`notification_service.dart`, full-screen ring, lock gate, exact alarms) and
  has now been hardened: the daily reminder persists across reboot and the ring
  is dismissible **only by recording the dose**. The spec mentions only a
  backend "notifications" module. Document the alarm as a first-class feature,
  including its "single daily, time-editable, not-disable-able" design.
- **Mobile dose logging** is a single idempotent upsert endpoint
  (`POST /mobile/dose-logs`, unique on patient+medicine+day) with an offline
  retry queue now persisted across restarts. Worth a short "mobile sync contract"
  note.
- **No shared dose-log serializer.** `formatLog()` is duplicated across
  `MobileDoseLogController`, `ReportsController`, `MonitoringController`,
  `DoseVerificationController`. The path→URL logic was centralized into
  `App\Support\ProofMedia`, but a full `MedicationLogResource` is deferred —
  tracked here as known debt.

---

## 8. Remediation checklist

**Documentation edits**
- [ ] `Database.md`: add video proof columns + ERD; rewrite role model to `admin`/`staff`/`patient`.
- [ ] `project_constitution.md`: correct Next/Laravel versions; remove uninstalled web libraries.
- [ ] `Roadmap.md`: add video proof and Ask DOTi to the scope; mark `ai_*` tables "future."
- [ ] Fill `docs/API.md` (at least `/api/v1/mobile/*`) and `docs/Features.md`, or delete the empty stubs.
- [ ] Document the mobile alarm + dose-sync behavior.

**Code follow-ups (non-blocking)**
- [ ] Extract `MedicationLogResource`; point all four `formatLog()` sites at it.
- [ ] Add a `<video>` player to the admin dose-verification view to play `proof_video_url`.

---

*This report should be regenerated whenever the data model, roles, or feature
scope change, so the documentation and the defense stay in step with the code.*
