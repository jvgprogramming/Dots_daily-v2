> # ⚠️ SUPERSEDED — DO NOT ACTION THIS FILE
>
> **Status: complete.** Both tasks below (§1 Calendar module, §2 Remove the
> Medications tab) have been implemented and verified. The single remaining
> unstarted item is the **optional** backend wiring in §5.
>
> **Read `docs/HANDOFF-MOBILE.md` instead** — it describes the current state of
> the app. This file is kept only for historical context.

---

# AI Handoff — Calendar Module + Remove Medications Tab

> **Audience:** An AI coding agent (or developer) picking up the mobile app next.
> **Scope:** Flutter app in `mobile/` only. Backend changes are optional (see §5).
> **Status at handoff:** All tasks below are unstarted. The green rebrand and the
> LAN-device run setup are already done and verified.

---

## 0. Project context you need first

**Repo layout** (monorepo root: `Dots_daily-v2/`):

| Folder    | What it is |
|-----------|------------|
| `mobile/` | Flutter app (the target of this handoff). Package id `com.example.mobile`. |
| `web/`    | Next.js web app — **source of truth for branding**. Palette in `web/app/globals.css`. |
| `backend/`| Laravel 11 API, Sanctum token auth. Prefix `/api/v1`. Runs with `composer serve` (binds `0.0.0.0:8000`). |

**Run the app on a physical Android device:**
```bash
# terminal 1 (from backend/)
composer serve                       # = php artisan serve --host=0.0.0.0 --port=8000

# terminal 2 (from mobile/)
flutter run --dart-define=API_BASE_URL=http://192.168.254.123:8000/api/v1
```
Seeded login: `admin@dotsdaily.com` / `password`. Phone and PC must share the
`192.168.254.x` Wi-Fi. If the PC's DHCP IP changes, re-check `ipconfig`.

**Branding (do not change):** All colors come from `mobile/lib/theme/app_theme.dart`
→ `AppColors` ("Healthcare Green", matched to the web login page):
`primary #16A34A`, `primaryDark #15803D`, `greenLight #4ADE80`, background `#F0FDF4`,
`primaryGradient = [#16A34A, #22C55E, #4ADE80]`. Any new UI must use `AppColors.*`
— no hardcoded hex values.

**State management:** `package:provider`. Two providers registered in `main.dart`:
`AuthProvider`, `MedicationsProvider`. Despite its name, `MedicationsProvider`
(`mobile/lib/providers/medications_provider.dart`) also owns **alarms** and
**dose logs** consumed across the app — be careful not to break those when doing §2.

**App is currently mock-data only** for medications/alarms/dose logs
(`_initMockData()` in the provider). Auth hits the real API; everything else is local.

---

## 1. Task A — Add a Calendar module

**Goal:** A patient can open a calendar and see, for each day of a month, whether
they took their medicine.

### 1.1 Data model to build on

The single source of truth for "did they take it" is the **dose log** concept.
Two layers exist:

- **Flutter mock layer (required):** `DoseLog` in `mobile/lib/models/medication.dart`
  — fields `id, medicationId, medicationName, timestamp (DateTime), verified (bool),
  photoUrl?, videoUrl?, notes?`. Stored in `MedicationsProvider._doseLogs`.
  Relevant existing getters: `recentDoseDates`, `adherenceRate`, `addDoseLog`.
- **Backend (optional, §5):** Laravel table `medication_logs` with
  `patient_id, scheduled_date (date), scheduled_time, taken_at, status, notes…`
  — already designed for day-level adherence queries.

Because **only one medication regimen exists** (see §2), the calendar is
**day-level, not per-medication**: a day is *taken* if ≥1 dose log exists for it.

### 1.2 Required provider additions (`MedicationsProvider`)

Add (mock-backed first; do not invent API calls yet):

```dart
/// Days in [month] (DateTime first-of-month) that have ≥1 dose log.
/// Key format: 'yyyy-MM-dd' → list of that day's logs.
Map<String, List<DoseLog>> doseLogsByDay(DateTime month);

/// Convenience for one cell.
bool isDayTaken(DateTime day);

int takenCountInMonth(DateTime month);
int missedCountInMonth(DateTime month); // scheduled days without a log, up to today
```

Extend `_initMockData()` so ~2–3 months of history exist: most days taken/verified,
a realistic sprinkle of missed days and a couple of unverified logs, so the
calendar demonstrates all states. Keep `id` values unique (`'cal-$i'` etc.).

### 1.3 UI — new page `mobile/lib/pages/calendar_page.dart`

Follow the structural conventions of `alarms_page.dart` (header style, `onViewChange`
callback signature, rounded cards, `AppColors` everywhere):

1. **Header card** using `primaryGradient` (mirror the alarms page header):
   month name + year ("September 2026"), with left/right chevrons to change month.
   Disallow navigating into the future beyond the current month.
2. **Summary row** under the header: `X days taken · Y missed · Z% adherence`
   (reuse/adapt `adherenceRate` logic over the shown month).
3. **Month grid** (7 columns, Mon-first or Sun-first — pick Sun-first to match
   `repeatSummary`'s English conventions; label the weekday headers):
   - **Taken day:** solid `AppColors.primary` filled circle, white day number,
     small white check icon.
   - **Missed day (past, scheduled, no log):** `AppColors.destructive` outline or
     light red tint, muted number.
   - **Logged but unverified:** `AppColors.amber` tint.
   - **Today:** `AppColors.primaryDark` ring (can combine with taken/missed state).
   - **Future days:** plain, disabled.
   - **Days before treatment start** (mock `startDate`): plain/disabled.
4. **Day detail — bottom sheet** on tapping a taken/unverified day:
   `showModalBottomSheet` (theme's `dialogTheme` shape applies) listing that day's
   `DoseLog`s: `formattedDateTime`, verified badge (green check / amber clock),
   notes. Missed days show a single "No dose recorded" line.
5. **Legend row** at the bottom: small color dots + labels for Taken / Missed /
   Unverified / Today.

### 1.4 Where the calendar lives

Add it as a **5th tab, replacing the removed Meds tab** (§2): position 3 in
`_tabs` (after alarms), icon `Icons.calendar_month_outlined` /
`Icons.calendar_month_rounded`, label `'Calendar'`. Wire it in `main.dart`
`_buildTab` exactly like the other pages (it needs no `onViewChange` initially,
but accept the optional callback for future parity).

Also add a dashboard entry point: in `dashboard_page.dart` the "Recent doses"
section (`_buildRecentDoses` / the card around line ~780 that currently calls
`onViewChange?.call('medications')`) should instead route to `'calendar'`, and its
"View all" affordance (`line ~639`) likewise.

---

## 2. Task B — Remove the Medications tab

The center dispenses a single regimen, so the multi-medication list is gone.
**Remove the tab and page; keep the underlying models** — `Alarm` and `DoseLog`
are load-bearing across alarms/ringing/dashboard pages.

### 2.1 Exact change list

1. **`main.dart`**
   - Delete the `('medications', 'Meds', …)` entry from `_tabs` (line ~97).
   - Delete the `case 'medications':` branch in `_buildTab` (line ~192) and the
     `import 'pages/medications_page.dart';` (line 8).
2. **Delete file** `mobile/lib/pages/medications_page.dart`.
3. **`dashboard_page.dart`**
   - Stats row (~line 569): the `('Medications', '${meds.medications.length}', …)`
     tile — replace with a regimen-level stat (e.g. current phase / days remaining,
     or route the tile's tap to `'calendar'`). It must not reference
     `meds.medications.length` anymore.
   - Lines ~639 and ~780: replace `onViewChange?.call('medications')` with
     `'calendar'` (per §1.4).
4. **`widgets/navigation_header.dart`** (line ~23): delete the
   `('medications', 'Medications', …)` entry from its view list.
5. **`providers/medications_provider.dart`**
   - Remove the 5-medication `_initMockData` list and `addMedication`.
   - Keep `Alarm`-related state/getters and `DoseLog` state intact.
   - Derive the single regimen display name from the dose logs / a single
     constant (e.g. `static const regimenName = 'Anti-TB Daily Regimen'`), and
     fix `upcomingMedicationNames` or remove it if unused after the above.
   - **Optional but nice:** rename the class/file to `TreatmentProvider`
     (`treatment_provider.dart`) and update the 5 importing pages
     (`main, alarms, alarm_ringing, dashboard, profile/test_alarm` — check imports).
     Only do this if time allows; a rename is not required for acceptance.
6. **Do NOT touch** `alarm_ringing_page.dart` logic, `Alarm`/`DoseLog` model
   classes, or the notification service.

---

## 3. Conventions the new code must follow

- Colors: only `AppColors.*` (see §0). Radius 12–24 to match existing cards.
- Pages are stateless/stateful widgets taking `final void Function(String view)? onViewChange;`
- Provider updates end with `notifyListeners();`
- Text styles come from the theme (`headlineSmall`, `titleMedium`, …) or explicit
  `TextStyle` copies matching existing pages.
- No new dependencies for the calendar grid — build it with
  `TableCalendar`-free plain `GridView`/`Table` + `DateTime` math. The pubspec
  currently has no calendar package and adding one is out of scope unless you
  ask the user first.

## 4. Acceptance criteria

1. `flutter analyze` passes with **no issues**.
2. Bottom nav shows 5 tabs: Home, Alarms, **Calendar**, Chat, Symptoms.
3. Calendar renders the current month with mock history: green taken days,
   red missed days, amber unverified, today ring; month chevrons work and
   cannot go past the current month.
4. Tapping a logged day opens the bottom sheet with that day's dose details.
5. No dead references to `MedicationsPage` / `'medications'` route remain
   (`grep -rn "medications'" lib/` returns only provider-internal identifiers).
6. Dashboard stats row and "recent doses" entry point no longer navigate to a
   medications view.
7. App still logs in against the backend and alarms/dose-taken flows are unbroken.

## 5. Optional backend wiring (ask the user before doing)

If the user wants real data instead of mocks for the calendar:

1. New route in `backend/routes/api.php` inside the `mobile` + `auth:sanctum` group:
   `GET /mobile/calendar?month=YYYY-MM`.
2. New controller method (e.g. in a `MobileDoseController`): resolve the
   authenticated **user → patient** (`$request->user()->patient` — mobile users
   are in `users`, logs point at `patients` via `patient_id`), then return
   `medication_logs` rows for that patient & month, projected to:
   `{ date, status, taken_at, notes }[]`.
3. Flutter side: extend `ApiService` (`mobile/lib/services/api_service.dart`,
   token auth already implemented) with `fetchCalendarMonth(String month)`,
   and have `MedicationsProvider` hydrate `doseLogs` from it on login, keeping
   the mock data as fallback when the call fails (app must stay usable offline).

**Known backend gotcha (already fixed, don't regress):** `User` model must keep
its `$fillable` (mass assignment was silently discarding updates before
2026-09-21). If you add model updates, verify `$fillable` covers the fields.

---

## 6. Verification checklist for the implementing agent

```bash
cd mobile
flutter analyze                 # must be clean
flutter run --dart-define=API_BASE_URL=http://192.168.254.123:8000/api/v1
```

Manual: log in → confirm 5 tabs → open Calendar → verify month grid states →
tap a green day → bottom sheet shows logs → switch months → dashboard still
renders, alarm ring/snooze still works.
