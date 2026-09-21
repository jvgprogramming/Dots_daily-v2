# AI Handoff — Mobile App (Flutter)

> **Audience:** An AI coding agent (or developer) picking up the mobile app next.
> **Scope:** Flutter app in `mobile/` only.
> **Supersedes:** `docs/HANDOFF-CALENDAR-MODULE.md` — **every task in it is now
> done** (calendar module built, Meds tab removed). Do not action that file.
> **Working tree:** NOT committed. All changes below are uncommitted local edits.

---

## 0. Project context you need first

**Repo layout** (monorepo root: `Dots_daily-v2/`):

| Folder    | What it is |
|-----------|------------|
| `mobile/` | Flutter app (target of this handoff). Package id `com.example.mobile`. |
| `web/`    | Next.js web app — **source of truth for branding**. |
| `backend/`| Laravel 11 API, Sanctum token auth, prefix `/api/v1`. |

**Toolchain actually installed:** Flutter 3.44.4 (stable), Dart SDK `^3.12.2`,
adb 37.0.0, target device `2412DPC0AG` on Android 16 (API 36).

**Run on the physical phone with no USB cable** (Wireless Debugging):

```bash
# phone: Developer options → Wireless debugging → Pair device with pairing code
adb pair <phone-ip>:<pairing-port> <6-digit-code>
adb connect <phone-ip>:<connect-port>     # port shown at top of that screen

# backend (terminal 1) — MUST bind all interfaces, not just localhost
cd backend && composer serve

# app (terminal 2) — from mobile/
adb reverse tcp:8000 tcp:8000             # tunnels phone 127.0.0.1:8000 → PC:8000
flutter run --dart-define=API_BASE_URL=http://127.0.0.1:8000/api/v1
```

`adb reverse` is the recommended approach: it dodges Windows Firewall and the
changing LAN IP. If you prefer the LAN IP (`ipconfig` → Wi-Fi IPv4, was
`192.168.254.123`), pass `--dart-define=API_BASE_URL=http://<lan-ip>:8000/api/v1`
and allow inbound TCP 8000 through the firewall.

Seeded login: `admin@dotsdaily.com` / `password`.

**Branding (do not change):** every colour comes from `mobile/lib/theme/app_theme.dart`
→ `AppColors` ("Healthcare Green"): `primary #16A34A`, `primaryDark #15803D`,
`greenLight #4ADE80`, background `#F0FDF4`,
`primaryGradient = [#16A34A, #22C55E, #4ADE80]`. New UI must use `AppColors.*` —
no hardcoded hex.

**State management:** `package:provider`, two providers in `main.dart`:
`AuthProvider` (real API) and `MedicationsProvider` (mock-backed; owns the single
regimen, the reminder, and dose logs).

**Bottom nav is now 5 tabs:** Home · **Reminder** · **Calendar** · Chat · Symptoms.
(There is no "Alarms" or "Meds" tab any more.)

**Everything except auth is still mock data** generated in
`MedicationsProvider._initMockData()`. Nothing is persisted — see §4.

---

## 1. What changed this session

### 1.1 The alarm page became a single daily reminder

TB patients take one combined regimen once a day before breakfast, so a
multi-alarm CRUD screen was wrong.

- `lib/pages/alarms_page.dart` → **`lib/pages/reminder_page.dart`**
  (`AlarmsPage` → `ReminderPage`). One big tap-to-pick time, a daily on/off
  switch, Save, a link to the alarm demo, and the medicine it covers. The old
  tip card was removed as unprofessional.
- `MedicationsProvider` now owns **one** reminder instead of one alarm per
  medication: `static const String reminderId = 'daily-reminder'`, default
  `07:00`, label `Before breakfast`. Getters/methods: `reminder`,
  `reminderEnabled`, `updateReminder({time, enabled})`. `addMedication` no
  longer spawns alarms.
- **Alarm sound actually works now.** In `notification_service.dart`:
  - Channel id is versioned: `medication_alarms_v2`. **Android freezes a
    channel's sound once created**, so on already-installed devices the sound
    would never have applied without bumping the id. Don't rename it back.
  - Both channel and details set
    `audioAttributesUsage: AudioAttributesUsage.alarm` so it plays on the
    **alarm** stream (full volume, can break silent/DND).
  - `res/raw/alarm_sound.wav` was verified to be a valid 16-bit/22.05 kHz PCM
    file (~3.5 s), so the raw-resource reference resolves to real audio.
- Scheduled with `scheduleDailyAlarm` (repeats daily), payload
  `alarm:daily-reminder`; taps route through `NotificationService.onAlarmTap` in
  `main.dart` into the full-screen ringing page.

### 1.2 Meds tab removed; one medicine named "Drug Intake"

- Removed the tab, its `case` in `_buildTab`, the import, the dashboard nav
  references, and the `navigation_header.dart` entry.
- **Deleted** `lib/pages/medications_page.dart`.
- Provider holds a single `Medication`. The physical intake form just says
  "Drug Intake", so: `medicineName = 'Drug Intake'`,
  `medicineDosage = '4 tablets'`, `medicineFullName = medicineName` (no drug
  name, dosage no longer concatenated into display strings). Copy elsewhere was
  changed from "all of your TB medicines" to "your medicine".
- Dashboard stat tile `'Medications'/'${meds.medications.length}'` became
  **`'Days taken'/'Logged this month'`** — this removed the last
  `medications.length` reference the old handoff flagged.

### 1.3 "How your alarm works" demo screen

- New **`lib/pages/alarm_demo_page.dart`**, linked from the Reminder tab.
  Explains the 3 steps, previews the ringing screen, and can fire a real
  notification in 10 seconds so the patient can hear the actual alarm sound.
- `AlarmRingingPage` gained a `preview` flag (wired through
  `AlarmRingingPage.open(context, alarm, preview: true)`) so the demo shows the
  exact screen **without logging a fake dose**.

### 1.4 Calendar module

- New **`lib/pages/calendar_page.dart`**: gradient month header with ◀ ▶
  (forward disabled at the current month), Taken/Missed/Adherence summary tiles,
  Sunday-first month grid (green taken + check, amber logged-but-unverified, red
  missed, `primaryDark` ring for today, muted future/pre-regimen), tap-for-detail
  bottom sheet, and a legend.
- Provider additions: `logsOnDay`, `doseLogsByDay(month)` (keyed `yyyy-MM-dd`
  via `dayKey`), `isDayTaken`, `isDayUnverified`, `takenCountInMonth`,
  `missedCountInMonth`, `adherenceInMonth`, `regimenStart`.
- `_initMockData()` seeds **~90 days** of history with `Random(7)` (fixed seed →
  identical every launch): most days taken, ~9% missed, ~12% unverified, and
  today always logged.
- **Retroactive logging:** `DoseLog? logDoseOn(day)` backfills a day that has no
  log (returns `null` if one exists — one dose per day), timestamped at the
  reminder time, capped at `now`. The day sheet offers **"Log this dose"** on
  empty past days. **Backfilled doses are saved `verified: false` (pending)** to
  match the "I took my dose" flow on the alarm, so the day shows amber rather
  than green. Change that if the product wants self-confirmation = verified.

### 1.5 UI fixes

- Removed the floating profile bubble from `MainShell` (looked tacky); profile
  is still reachable from the dashboard's settings gear.
- `MainShell` `extendBody: true → false` so the footer nav bar reserves its own
  space instead of covering the last elements of a page.
- **Bounding-box fixes** (found with the scan in §2, not by guessing):
  - `alarm_ringing_page.dart`: the Column overflowed **50 px at 320×568 at
    normal text size**. It is now `LayoutBuilder` + `SingleChildScrollView` +
    `ConstrainedBox(minHeight)` + centred Column, so nothing is ever clipped on
    short phones. The clock row scales down via `FittedBox` instead of
    overflowing with large system text.
  - Dashboard: stat-card tiles (tile ratio `1.2 → 1.0`, single-line label,
    flexible + ellipsised value/subtitle), "TREATMENT STATUS" header, and
    quick-action rows all wrapped in `Expanded`/`Flexible`.
  - Reminder + alarm-demo header rows wrapped in `Expanded` so they wrap instead
    of overflowing.
  - Calendar day tiles use `FittedBox(scaleDown)` so they survive large text.

---

## 2. Verification state

As of this handoff, **all green**:

```bash
cd mobile
flutter analyze     # No issues found!
flutter test        # 15 tests, All tests passed!
```

`test/widget_test.dart` covers: launch → sign-in, the single reminder model,
`updateReminder` editing in place, three months of dose history, today always
logged, `isDayTaken` ↔ `logsOnDay` agreement, taken+missed == scheduled days,
adherence range, day-key grouping, empty future month, calendar page render,
and an **end-to-end test that taps a missed day, taps "Log this dose", and
asserts the day becomes taken**.

### The layout-overflow scan technique (reusable, saved nowhere)

There is **no committed layout test**. To re-create the scan used for §1.5:

1. Write a throwaway `test/layout_scan_test.dart` that pumps each page wrapped in
   `MultiProvider` + `MaterialApp(theme: AppTheme.lightTheme)` at several
   `tester.binding.setSurfaceSize(...)` values (320×568, 360×800, 412×915) and
   text scales 1.0 and 1.3 (`MediaQuery.copyWith(textScaler: TextScaler.linear)`).
2. Install `FlutterError.onError` to print `details.toString()` so each overflow
   reports its causing widget and file:line, then scroll each `ListView` so
   off-screen children get laid out.
3. **Load real Roboto metrics** or you will get roughly twice as many false
   positives:
   ```dart
   final loader = FontLoader('Roboto');           // from flutter/services.dart
   for (final f in ['roboto-regular.ttf','roboto-medium.ttf','roboto-bold.ttf']) {
     final file = File('$flutterRoot/bin/cache/artifacts/material_fonts/$f');
     loader.addFont(Future.value(file.readAsBytesSync().buffer.asByteData()));
   }
   await loader.load();
   // then wrap the page in a theme whose textTheme has fontFamily: 'Roboto'
   ```
   Delete the scan when done — it hardcodes a local SDK font path.

---

## 3. Gotchas / landmines

1. **Android notification channel sound is immutable.** Never rename
   `medication_alarms_v2` back to `medication_alarms`; changing the sound of an
   existing channel id is silently ignored on real devices.
2. **Flutter's default test font has 1:1 glyph widths** (~2× real text). Any
   overflow you measure without loading a real font is probably fake. This cost
   a full round of wrong conclusions during this session.
3. **`API_BASE_URL` is a compile-time `--dart-define`.** On a physical phone the
   fallback `http://10.0.2.2:8000/api/v1` is the *emulator* alias and will fail.
   Always pass the LAN IP or use `adb reverse` + `127.0.0.1`.
4. **The diff is noisy.** Several files were run through `dart format` (the repo
   is format-clean at HEAD), and some pre-existing uncommitted edits got
   reformatted with them. Review with `git diff -w` for `dashboard_page.dart`,
   `alarm_ringing_page.dart`, `test_alarm_page.dart`, `navigation_header.dart`.
5. **The working tree was already dirty before this session** — `backend/app/Models/User.php`,
   `backend/composer.json`, and several mobile files had unrelated in-progress
   edits. Don't assume everything in `git status` came from this work.
6. **`lib/widgets/navigation_header.dart` is dead code** — nothing imports it.
   Its Meds entry was removed for consistency but the file could be deleted.
7. **Two overlapping "alarm test" surfaces exist:** the old dev-flavoured
   `TestAlarmPage` (reachable only from the dashboard's "Test medication alarm"
   card: Instant / Batch / Cancel-all / history) and the new patient-facing
   `AlarmDemoPage`. Consider consolidating.
8. `MedicationsProvider` is now misnamed (it owns the regimen, the reminder and
   dose logs). The old handoff suggested renaming to `TreatmentProvider`; that
   rename was **not** done.
9. Backend: `User` model must keep its `$fillable` (mass assignment was silently
   discarding updates before 2026-09-21). Don't regress it.

---

## 4. Not done / suggested next work

Ordered by how much they'd annoy a real user:

1. **Nothing is persisted.** Dose logs, the reminder, and the backfilled doses
   live in memory only — they vanish on app restart. This is the biggest gap:
   a patient logging doses would lose them. Persist locally
   (`shared_preferences`/`sqflite`) or wire the backend.
2. **Backend calendar endpoint.** `docs/HANDOFF-CALENDAR-MODULE.md` §5 specifies
   `GET /mobile/calendar?month=YYYY-MM` returning the patient's `medication_logs`
   (resolve `$request->user()->patient`), plus `ApiService.fetchCalendarMonth()`
   and hydration in the provider with mock data as offline fallback.
3. **Reminder permissions UX.** Exact-alarm and notification permissions are
   requested but never explained; if denied, the alarm silently falls back to
   inexact scheduling.
4. **iOS sound.** `res/raw/alarm_sound.wav` is Android-only. iOS uses the default
   notification sound; a custom one needs the file bundled in the Xcode project.
5. **No layout regression test.** The scan in §2 is deleted each time — worth
   committing a portable version.
6. `docs/HANDOFF-CALENDAR-MODULE.md` is now stale; delete it once this doc is
   accepted.

---

## 5. Verification checklist

```bash
cd mobile
flutter analyze
flutter test

adb connect <phone-ip>:<connect-port>
adb reverse tcp:8000 tcp:8000
flutter run --dart-define=API_BASE_URL=http://127.0.0.1:8000/api/v1
```

Manual pass:
1. Log in (`admin@dotsdaily.com` / `password`).
2. Confirm 5 tabs: Home · Reminder · Calendar · Chat · Symptoms.
3. **Reminder** → change the time → Save → no crash, confirmation snackbar.
4. **Reminder → "See how your alarm works"** → "Send a real alarm in 10 seconds"
   → lock the phone → you should **hear the alarm sound** and see the full-screen
   alert. Tapping "I took my dose" logs a dose.
5. **Calendar** → month chevrons work, forward stops at the current month → tap a
   red/missed day → "Log this dose" → day turns amber and the Taken/adherence
   tiles increase.
6. Tap a green day → bottom sheet lists that day's dose with a Verified badge.
7. Dashboard: stat tiles and the "Medication history" card render without
   overflow; the card's "Calendar" link switches to the Calendar tab.
8. Profile is still reachable from the dashboard gear (the floating bubble is
   intentionally gone).
