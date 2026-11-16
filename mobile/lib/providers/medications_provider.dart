import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/medication.dart';
import '../models/vot.dart';
import '../services/api_service.dart';
import '../services/notification_service.dart';

class MedicationsProvider extends ChangeNotifier {
  /// Shared with [AuthProvider] so dose writes carry the signed-in token.
  final ApiService _api = ApiService.shared;

  /// The patient only needs one reminder a day — all TB medicines are taken
  /// together, once daily — so alarms are represented by this single, fixed
  /// entry instead of one alarm per medication. The dose can be taken any time
  /// during the day; the reminder just nudges them, preferably before lunch.
  static const String reminderId = 'daily-reminder';

  static const Alarm _defaultReminder = Alarm(
    id: reminderId,
    medicationId: '1',
    medicationName: medicineName,
    time: '09:00',
    enabled: true,
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    label: 'Daily dose',
  );

  List<Medication> _medications = [];
  List<Alarm> _alarms = [];
  List<DoseLog> _doseLogs = [];

  /// Medicine the single combined daily intake is recorded against, as assigned
  /// by the backend's `/mobile/regimen`.
  int? _primaryPivotId;

  /// Start of the active treatment plan; earlier calendar days are greyed out.
  DateTime? _planStartDate;

  /// Last day the plan covers, so a finished plan stops accruing expected doses.
  DateTime? _planEndDate;

  /// Set false once the backend reports this patient has no regimen yet, so the
  /// UI stops offering a "log this dose" action that could only fail.
  bool _canLogDoses = true;

  /// Adherence over the patient's full scheduled course (plan start → scheduled
  /// end), computed by the backend on the same basis the admin dashboard uses.
  /// Null until the first successful sync, or when there is no active plan.
  double? _adherenceRate;
  int? _adherenceScheduledDays;
  int? _adherenceDaysTaken;

  /// When the scheduled course ends, and the next follow-up visit the clinic
  /// derives from the plan (the same schedule the treatments hub shows).
  DateTime? _treatmentEndDate;
  DateTime? _nextFollowUpDate;
  String _nextFollowUpStatus = 'none';

  /// Video-Observed Therapy settings for this patient (GET /mobile/vot).
  VotConfig _vot = VotConfig.none;

  bool _syncing = false;
  String? _syncError;

  /// Doses recorded on this phone the backend has not accepted yet.
  final List<DoseLog> _unsynced = [];

  bool _disposed = false;

  List<Medication> get medications => _medications;
  List<Alarm> get alarms => _alarms;
  List<DoseLog> get doseLogs => _doseLogs;

  /// True while the regimen/history are being pulled from the backend.
  bool get isSyncing => _syncing;

  /// Set when the backend could not be reached, so the fallback to local data
  /// is visible instead of silent.
  String? get syncError => _syncError;

  /// Doses waiting to reach the backend (logged while offline).
  int get unsyncedCount => _unsynced.length;

  /// Whether the backend has a regimen this app can log doses against.
  bool get canLogDoses => _canLogDoses;

  /// The clinic's VOT settings for this patient.
  VotConfig get vot => _vot;

  /// True when each dose is confirmed by recording proof for a nurse (VOT)
  /// rather than the plain "I took it" confirmation.
  bool get isVotEnrolled => _vot.enrolled;

  /// Scheduled dose days across the whole course, and how many were taken.
  int? get adherenceScheduledDays => _adherenceScheduledDays;
  int? get adherenceDaysTaken => _adherenceDaysTaken;

  /// The scheduled last day of treatment, if the plan has one.
  DateTime? get treatmentEndDate => _treatmentEndDate;

  /// The next follow-up visit, derived from the plan by the backend — the
  /// same schedule the admin's treatments hub works from. Null when there is
  /// nothing scheduled.
  DateTime? get nextFollowUpDate => _nextFollowUpDate;

  /// `scheduled`, `due` (within 14 days), `overdue`, or `none`.
  String get nextFollowUpStatus => _nextFollowUpStatus;

  /// The patient's single daily reminder (falls back to the default).
  Alarm get reminder {
    final index = _alarms.indexWhere((a) => a.id == reminderId);
    return index == -1 ? _defaultReminder : _alarms[index];
  }

  bool get reminderEnabled => reminder.enabled;

  MedicationsProvider() {
    _initMockData();
  }

  /// The intake form lists the medicine simply as "Drug Intake", so the whole
  /// app refers to it the same way — no brand or drug name.
  static const String medicineName = 'Drug Intake';
  static const String medicineDosage = '4 tablets';
  static const String medicineFullName = medicineName;

  void _initMockData() {
    _medications = [
      const Medication(
        id: '1',
        name: medicineName,
        dosage: medicineDosage,
        frequency: 'Once daily',
        instructions:
            'Take all 4 tablets together, once a day — any time during the day, preferably before lunch.',
        prescribedBy: 'Dr. Sarah Johnson',
        startDate: '2024-01-01',
        endDate: '2024-07-01',
        reminderTimes: ['07:00'],
        color: '#16A34A',
      ),
    ];

    // One daily reminder for the whole regimen.
    _alarms = [_defaultReminder];

    // About three months of dose history so the calendar has realistic logged,
    // missed and flagged days to show. Deterministic (fixed seed) so the demo
    // looks the same on every launch.
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final rng = Random(7);
    _doseLogs = [];
    for (var daysAgo = 90; daysAgo >= 0; daysAgo--) {
      final day = today.subtract(Duration(days: daysAgo));
      // The occasional missed day keeps it believable; today always counts as
      // taken so the calendar never opens looking broken.
      if (daysAgo != 0 && rng.nextDouble() < 0.09) continue;

      // A logged dose counts by default; a nurse flags the rare suspicious one.
      final flagged = daysAgo != 0 && rng.nextDouble() < 0.06;
      _doseLogs.add(
        DoseLog(
          id: 'cal-$daysAgo',
          medicationId: '1',
          medicationName: medicineFullName,
          timestamp: DateTime(
            day.year,
            day.month,
            day.day,
            8 + rng.nextInt(4), // taken through the morning
            rng.nextInt(60),
          ),
          verified: false,
          flagged: flagged,
          flagReason: flagged ? 'Under review by your clinic' : null,
        ),
      );
    }
    _doseLogs.sort((a, b) => b.timestamp.compareTo(a.timestamp));
  }

  List<Alarm> get upcomingAlarms {
    final now = DateTime.now();
    final currentTime =
        '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
    return _alarms
        .where((a) => a.enabled && a.time.compareTo(currentTime) > 0)
        .toList()
      ..sort((a, b) => a.time.compareTo(b.time));
  }

  List<DoseLog> get recentDoseDates {
    final sorted = _doseLogs.where((log) => !log.isMissed).toList()
      ..sort((a, b) => b.timestamp.compareTo(a.timestamp));
    return sorted.take(6).toList();
  }

  // ---------- Calendar ----------

  /// The day the regimen started — earlier calendar days are greyed out.
  ///
  /// Prefers the real treatment plan's start date once it has been loaded, so
  /// the calendar greys out days from before the patient was on treatment.
  DateTime get regimenStart {
    if (_planStartDate != null) return _planStartDate!;
    final start = _medications.isEmpty ? null : _medications.first.startDate;
    return DateTime.tryParse(start ?? '') ?? DateTime(2000);
  }

  /// Stable `yyyy-MM-dd` key used to group logs by day.
  static String dayKey(DateTime day) =>
      '${day.year.toString().padLeft(4, '0')}-'
      '${day.month.toString().padLeft(2, '0')}-'
      '${day.day.toString().padLeft(2, '0')}';

  /// That day's dose logs, newest first (empty when nothing was logged).
  ///
  /// Includes `missed` entries, which record that a dose was *not* taken. Use
  /// [dosesOnDay] when you mean doses the patient actually took.
  List<DoseLog> logsOnDay(DateTime day) {
    return _doseLogs.where((log) => _isSameDay(log.timestamp, day)).toList()
      ..sort((a, b) => b.timestamp.compareTo(a.timestamp));
  }

  /// That day's doses, newest first, excluding days recorded as missed.
  List<DoseLog> dosesOnDay(DateTime day) =>
      logsOnDay(day).where((log) => !log.isMissed).toList();

  /// Days in [month] with at least one dose log, keyed by [dayKey].
  Map<String, List<DoseLog>> doseLogsByDay(DateTime month) {
    final result = <String, List<DoseLog>>{};
    for (final log in _doseLogs) {
      final ts = log.timestamp;
      if (ts.year != month.year || ts.month != month.month) continue;
      result.putIfAbsent(dayKey(ts), () => []).add(log);
    }
    return result;
  }

  /// A day the patient actually took their medicine.
  ///
  /// A day the backend recorded as `missed` has a log row but no dose, so it is
  /// deliberately not "taken" — otherwise missed days would count towards
  /// adherence and could never be backfilled.
  bool isDayTaken(DateTime day) =>
      _doseLogs.any((log) => !log.isMissed && _isSameDay(log.timestamp, day));

  /// Today's recorded dose (the one actually taken, not a `missed` marker), or
  /// null if the patient hasn't logged one yet today. Drives the home screen's
  /// "take today's dose" vs "done today" state.
  DoseLog? get todaysDose {
    final today = DateTime.now();
    for (final log in _doseLogs) {
      if (!log.isMissed && _isSameDay(log.timestamp, today)) return log;
    }
    return null;
  }

  /// Whether today's dose has already been logged.
  bool get hasTakenToday => todaysDose != null;

  /// The VOT review state of today's dose (same vocabulary as [votStatusOn]).
  String? get todaysVotStatus => votStatusOn(DateTime.now());

  /// A day whose logged dose a nurse flagged as suspicious (held out of
  /// adherence until the clinic clears it).
  bool isDayFlagged(DateTime day) {
    final doses = dosesOnDay(day);
    return doses.isNotEmpty && doses.any((log) => log.flagged);
  }

  /// The VOT review state of [day]'s dose: null for a non-VOT dose (or none),
  /// 'uploading' while a recorded proof is still queued on this phone.
  String? votStatusOn(DateTime day) {
    for (final log in dosesOnDay(day)) {
      if (log.hasQueuedProof) return 'uploading';
      if (log.verificationStatus != null) return log.verificationStatus;
    }
    return null;
  }

  /// Whether [day]'s dose is held out of adherence: flagged by a nurse, or a
  /// VOT dose still needing (new) proof.
  bool isDayHeld(DateTime day) =>
      isDayFlagged(day) || VotStatusText.needsNewProof(votStatusOn(day));

  /// The newest dose the patient can and should send new proof for (proof
  /// missing, rejected, or asked for again), or null.
  DoseLog? get doseNeedingProof {
    if (!_vot.enrolled) return null;
    for (final log in _doseLogs) {
      if (log.isMissed || log.hasQueuedProof) continue;
      final status = log.verificationStatus;
      if (!VotStatusText.needsNewProof(status)) continue;
      if (status == 'rejected' && !_vot.allowResubmitAfterReject) continue;
      return log;
    }
    return null;
  }

  /// Number of days in [month] with at least one dose actually taken.
  int takenCountInMonth(DateTime month) {
    final days = <String>{};
    for (final log in _doseLogs) {
      if (log.isMissed) continue;
      if (log.timestamp.year != month.year ||
          log.timestamp.month != month.month) {
        continue;
      }
      days.add(dayKey(log.timestamp));
    }
    return days.length;
  }

  /// Scheduled days in [month] up to today with no dose logged.
  int missedCountInMonth(DateTime month) {
    final expectedUntil = _expectedUntil;
    final monthStart = _dayOnly(DateTime(month.year, month.month));
    final monthEnd = _dayOnly(DateTime(month.year, month.month + 1, 0));
    final lastDay = monthEnd.isBefore(expectedUntil) ? monthEnd : expectedUntil;
    final firstDay = _dayOnly(regimenStart).isAfter(monthStart)
        ? _dayOnly(regimenStart)
        : monthStart;
    if (lastDay.isBefore(firstDay)) return 0;

    final scheduled = lastDay.difference(firstDay).inDays + 1; // inclusive
    return (scheduled - takenCountInMonth(month)).clamp(0, scheduled);
  }

  /// Percentage of the month's scheduled days that have a dose logged.
  double adherenceInMonth(DateTime month) {
    final taken = takenCountInMonth(month);
    final scheduled = taken + missedCountInMonth(month);
    if (scheduled == 0) return 0;
    return (taken / scheduled) * 100;
  }

  bool _isSameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;

  /// How well the patient has kept up with their medicine: the share of the
  /// days a dose was *expected* that one was actually taken.
  ///
  /// Prefers the backend's own figure — adherence over the full scheduled
  /// course (plan start → scheduled end), the same basis the admin dashboard,
  /// reports and treatments hub report, so the clinic and the app cannot
  /// disagree. Before the first successful sync, a local estimate is shown
  /// instead: regimen start → today, where a day never logged counts against
  /// the patient exactly like a day recorded as missed.
  double get adherenceRate {
    if (_adherenceRate != null) return _adherenceRate!;

    var start = _dayOnly(regimenStart);

    if (_planStartDate == null) {
      // No plan to date from: judge only the days the backend actually recorded,
      // rather than counting back to the fallback epoch.
      final taken = _doseLogs.where((log) => !log.isMissed).toList();
      if (taken.isEmpty) return 0;
      start = _dayOnly(
        taken.map((log) => log.timestamp).reduce((a, b) => a.isBefore(b) ? a : b),
      );
    }

    final end = _expectedUntil;
    if (end.isBefore(start)) return 0;

    var expected = 0;
    var takenDays = 0;
    for (var day = start; !day.isAfter(end); day = _dayOnly(DateTime(day.year, day.month, day.day + 1))) {
      expected++;
      if (isDayTaken(day)) takenDays++;
    }

    return expected == 0 ? 0 : (takenDays / expected) * 100;
  }

  /// The last day a dose is still expected: today, capped by the plan's end.
  DateTime get _expectedUntil {
    final today = _dayOnly(DateTime.now());
    final planEnd = _planEndDate;
    if (planEnd == null) return today;

    final end = _dayOnly(planEnd);
    return end.isBefore(today) ? end : today;
  }

  static DateTime _dayOnly(DateTime day) =>
      DateTime(day.year, day.month, day.day);

  /// How many days of treatment the patient has a dose recorded for.
  int get treatmentDays => _doseLogs.where((log) => !log.isMissed).length;

  /// Course progress: how much of the scheduled course has elapsed, matching
  /// the backend's plan window (start → scheduled end). Falls back to the old
  /// "days logged of 180" heuristic only when no plan data has been synced.
  int get progressPercentage {
    final start = _planStartDate;
    final end = _treatmentEndDate ?? _planEndDate;
    if (start != null && end != null) {
      final now = DateTime.now();
      final totalDays = end.difference(_dayOnly(start)).inDays + 1;
      if (totalDays > 0) {
        final elapsed = _dayOnly(now).difference(_dayOnly(start)).inDays + 1;
        return (elapsed * 100 ~/ totalDays).clamp(0, 100);
      }
    }
    const totalTreatmentDays = 180;
    if (treatmentDays == 0) return 0;
    return ((treatmentDays / totalTreatmentDays) * 100).round().clamp(0, 100);
  }

  /// Total scheduled days of the course, when known from the plan.
  int? get totalScheduledDays =>
      _adherenceScheduledDays ?? (_planStartDate != null && _planEndDate != null
          ? _planEndDate!.difference(_dayOnly(_planStartDate!)).inDays + 1
          : null);

  int get activeAlarmCount => _alarms.where((a) => a.enabled).length;

  /// The enabled alarm with the soonest time-of-day from now, or null.
  Alarm? get nextAlarm {
    final now = DateTime.now();
    final nowMinutes = now.hour * 60 + now.minute;

    Alarm? best;
    int? bestDelta;
    for (final alarm in _alarms.where((a) => a.enabled)) {
      final (h, m) = alarm.timeParts;
      var delta = h * 60 + m - nowMinutes;
      if (delta <= 0) delta += 24 * 60; // next occurrence is tomorrow
      if (bestDelta == null || delta < bestDelta) {
        bestDelta = delta;
        best = alarm;
      }
    }
    return best;
  }

  void upsertAlarm(Alarm alarm) {
    final index = _alarms.indexWhere((a) => a.id == alarm.id);
    if (index != -1) {
      _alarms[index] = alarm;
    } else {
      _alarms.add(alarm);
    }
    notifyListeners();
  }

  /// Updates the single daily reminder's time and/or on-off state.
  void updateReminder({String? time, bool? enabled}) {
    final updated = reminder.copyWith(
      time: time,
      enabled: enabled,
      days: const ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    );
    final index = _alarms.indexWhere((a) => a.id == reminderId);
    if (index == -1) {
      _alarms.add(updated);
    } else {
      _alarms[index] = updated;
    }
    _saveReminder(updated);
    notifyListeners();
  }

  // ---------- Reminder persistence (survives restart & reboot) ----------

  static const String _reminderTimeKey = 'dots.reminder_time';

  /// Stable id for the single daily reminder. Shared with ReminderPage so a
  /// re-arm from either place replaces the same scheduled alarm (no doubles).
  static const int reminderNotificationId = 0x5D2A7E;

  Future<void> _saveReminder(Alarm reminder) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_reminderTimeKey, reminder.time);
    } catch (_) {
      // Best-effort: failing to persist must not break saving the reminder.
    }
  }

  /// Loads the saved reminder time into state (so the UI shows it after a
  /// restart) and re-schedules the daily alarm. Called once at app launch:
  /// an app update clears scheduled notifications, and this keeps the Dart
  /// state and the OS alarm in agreement after a reboot.
  Future<void> restoreAndArmReminder() async {
    String? savedTime;
    try {
      final prefs = await SharedPreferences.getInstance();
      savedTime = prefs.getString(_reminderTimeKey);
    } catch (_) {
      // Fall back to the default reminder time.
    }

    // Materialize the reminder into _alarms (so an alarm-tap lookup finds it),
    // using the saved time when present.
    updateReminder(time: savedTime ?? reminder.time, enabled: true);
    await armDailyReminder();
  }

  /// (Re)schedules the single daily reminder from the current reminder time.
  Future<void> armDailyReminder() async {
    final service = NotificationService();
    final current = reminder;
    final (hour, minute) = current.timeParts;

    try {
      await service.cancel(reminderNotificationId);
      if (!current.enabled) return;
      await service.scheduleDailyAlarm(
        id: reminderNotificationId,
        title: '⏰ Time for your daily dose',
        body: 'Take your medicine today — preferably before lunch.',
        hour: hour,
        minute: minute,
        payload: 'alarm:$reminderId',
      );
    } catch (_) {
      // Scheduling can fail if permissions were revoked; the Reminder screen
      // surfaces and re-requests them.
    }
  }

  void deleteAlarm(String id) {
    _alarms.removeWhere((a) => a.id == id);
    notifyListeners();
  }

  String get upcomingMedicationNames {
    return _medications.take(3).map((m) => m.name).join(' • ');
  }

  void addMedication(Medication medication) {
    // New medicines are covered by the existing single daily reminder.
    _medications.add(medication);
    notifyListeners();
  }

  void toggleAlarm(String id) {
    final index = _alarms.indexWhere((a) => a.id == id);
    if (index != -1) {
      _alarms[index] = _alarms[index].copyWith(
        enabled: !_alarms[index].enabled,
      );
      notifyListeners();
    }
  }

  /// Records a dose the patient confirmed from the alarm ring screen.
  ///
  /// The day updates immediately, then the row is pushed to the backend — which
  /// is what makes it show up in the admin web app. If the push fails the dose
  /// stays on this phone and is retried on the next [refresh].
  void addDoseLog(DoseLog log) {
    _doseLogs.insert(0, log);
    _sortDoseLogs();
    notifyListeners();
    _persist(log);
  }

  /// Backfills a dose on [day] for a patient who took their medicine but forgot
  /// to log it. Returns the new log, or null if that day already has one.
  ///
  /// Logged-by-default: it counts immediately, exactly like a dose recorded
  /// from the alarm, unless the clinic later flags it.
  DoseLog? logDoseOn(DateTime day, {String? notes}) {
    if (isDayTaken(day)) return null;

    final (hour, minute) = reminder.timeParts;
    var timestamp = DateTime(day.year, day.month, day.day, hour, minute);
    // A dose logged for today can never be in the future.
    if (timestamp.isAfter(DateTime.now())) timestamp = DateTime.now();

    final log = DoseLog(
      id: 'log-${timestamp.microsecondsSinceEpoch}',
      medicationId: _medications.isEmpty ? '1' : _medications.first.id,
      medicationName: medicineFullName,
      timestamp: timestamp,
      verified: false,
      notes: notes ?? 'Logged later from the calendar',
    );
    _doseLogs.add(log);
    // Keep the list newest-first, like the seeded history.
    _sortDoseLogs();
    notifyListeners();
    _persist(log);
    return log;
  }

  void deleteDoseLog(String id) {
    _doseLogs.removeWhere((log) => log.id == id);
    notifyListeners();
  }

  // ---------- Backend sync ----------

  /// Pulls the patient's regimen and dose history from the backend, then makes
  /// the server the source of truth for the calendar.
  ///
  /// Called once after login. Until it succeeds the app runs on its local
  /// history, so it stays usable offline; a failure is reported through
  /// [syncError] rather than swallowed. A no-op when signed out (or in tests),
  /// where there is no token to authenticate the request with.
  Future<void> refresh() async {
    // Bring back anything queued on a previous run before we decide to sync, so
    // offline-recorded proofs reappear on the calendar even when signed out.
    await restoreQueue();

    if (_api.token == null || _syncing) return;

    _syncing = true;
    _safeNotify();

    try {
      // Drain anything logged while offline first, so the fetch below already
      // includes it.
      await _pushUnsynced();
      await _loadRegimen();
      await _loadVot();

      final response = await _api.get('/mobile/dose-logs');
      final data = response['data'] as Map<String, dynamic>;
      final logs = (data['logs'] as List<dynamic>)
          .map(
            (entry) => DoseLog.fromApiJson(
              entry as Map<String, dynamic>,
              medicationName: medicineFullName,
            ),
          )
          .toList();

      _doseLogs = logs;

      // Keep doses the backend has not accepted yet on the calendar so they are
      // never silently dropped.
      for (final pending in _unsynced) {
        final alreadyThere = _doseLogs.any(
          (log) => dayKey(log.timestamp) == dayKey(pending.timestamp),
        );
        if (!alreadyThere) _doseLogs.add(pending);
      }

      _sortDoseLogs();
      _syncError = null;
    } on ApiException catch (e) {
      _syncError = e.message;
      // 403 = this account has no patient profile, so it can never log a dose.
      if (e.statusCode == 403) _canLogDoses = false;
    } catch (_) {
      _syncError =
          'Could not reach the server. Showing only the doses saved on this phone.';
    } finally {
      _syncing = false;
      _safeNotify();
    }

    // Outside the sync lock: a slow inbox must never hold up the calendar.
    await checkInbox();
  }

  /// Fetches the active regimen: which medicine the daily intake is recorded
  /// against, and when the treatment started.
  Future<void> _loadRegimen() async {
    final response = await _api.get('/mobile/regimen');
    final data = response['data'] as Map<String, dynamic>;

    _canLogDoses = data['can_log_doses'] as bool? ?? false;

    final id = data['primary_treatment_plan_medication_id'];
    _primaryPivotId = id is int ? id : int.tryParse('$id');

    final plan = data['treatment_plan'] as Map<String, dynamic>?;
    _planStartDate = plan == null
        ? null
        : DateTime.tryParse('${plan['start_date']}');
    _planEndDate = plan == null
        ? null
        : DateTime.tryParse('${plan['actual_end_date'] ?? plan['expected_end_date']}');

    // Full-course adherence, straight from the backend's own calculation.
    final adherence = data['adherence'] as Map<String, dynamic>?;
    _adherenceRate = (adherence?['rate'] as num?)?.toDouble();
    _adherenceScheduledDays = adherence?['scheduled_days'] as int?;
    _adherenceDaysTaken = adherence?['days_taken'] as int?;

    // Treatment end + the clinic's follow-up schedule.
    _treatmentEndDate = DateTime.tryParse('${data['treatment_end_date'] ?? ''}');
    _nextFollowUpDate = DateTime.tryParse('${data['next_follow_up'] ?? ''}');
    _nextFollowUpStatus = data['next_follow_up_status'] as String? ?? 'none';
  }

  /// VOT settings. A failure keeps the last known config: an enrolled patient
  /// must not silently fall back to the plain confirmation just because one
  /// request timed out.
  Future<void> _loadVot() async {
    try {
      final response = await _api.get('/mobile/vot');
      _vot = VotConfig.fromJson(response['data'] as Map<String, dynamic>);
    } catch (_) {
      // Keep the previous value.
    }
  }

  /// Uploads a VOT proof for a dose right now, reporting progress.
  ///
  /// [existing] is the dose being re-recorded (after a rejection or a request
  /// for new proof); [forDay] backfills a past day. Otherwise it is today's
  /// dose. Throws [ApiException] — the caller decides whether to retry or to
  /// [queueVotProof] for later. Never marks the dose verified: it stays
  /// "waiting for nurse review" until the clinic decides.
  Future<void> submitVotProof(
    VotProof proof, {
    DoseLog? existing,
    DateTime? forDay,
    void Function(double progress)? onProgress,
  }) async {
    final log = _proofLog(proof, existing: existing, forDay: forDay);

    final response = await _api.postMultipart(
      '/mobile/vot/submissions',
      fields: _votPayload(log),
      filePath: proof.path,
      fileField: 'media',
      onProgress: onProgress,
    );

    _adoptSubmittedDose(log, response['data'] as Map<String, dynamic>);
    await _deleteLocalVideo(proof.path);
    _safeNotify();
  }

  /// Keeps a proof that could not be uploaded (offline, server down) and sends
  /// it on the next sync. The dose shows on the calendar meanwhile.
  Future<void> queueVotProof(
    VotProof proof, {
    DoseLog? existing,
    DateTime? forDay,
  }) async {
    final log = _proofLog(proof, existing: existing, forDay: forDay);
    _doseLogs.removeWhere(
      (l) => !l.isMissed && dayKey(l.timestamp) == dayKey(log.timestamp),
    );
    _doseLogs.add(log);
    _sortDoseLogs();
    _unsynced.add(log);
    await _saveQueue();
    _safeNotify();
  }

  DoseLog _proofLog(VotProof proof, {DoseLog? existing, DateTime? forDay}) {
    DateTime takenAt;
    if (existing != null) {
      // Same scheduled dose, same moment it was taken — new proof only.
      takenAt = existing.timestamp;
    } else if (forDay != null) {
      final (hour, minute) = reminder.timeParts;
      takenAt = DateTime(forDay.year, forDay.month, forDay.day, hour, minute);
      if (takenAt.isAfter(DateTime.now())) takenAt = DateTime.now();
    } else {
      takenAt = DateTime.now();
    }

    return DoseLog(
      id: existing?.id ?? 'vot-${DateTime.now().microsecondsSinceEpoch}',
      medicationId: _medications.isEmpty ? '1' : _medications.first.id,
      medicationName: medicineFullName,
      timestamp: takenAt,
      verified: false,
      notes: existing?.notes ?? 'Recorded with video-observed therapy',
      scheduledDate: existing?.scheduledDate ?? dayKey(takenAt),
      localVideoPath: proof.path,
      localProofType: proof.mediaType,
      localProofSeconds: proof.durationSeconds,
    );
  }

  void _adoptSubmittedDose(DoseLog local, Map<String, dynamic> data) {
    final dose = data['dose'] as Map<String, dynamic>;
    final saved = DoseLog.fromApiJson(dose, medicationName: medicineFullName);

    _doseLogs.removeWhere(
      (l) =>
          !l.isMissed &&
          (l.id == local.id ||
              l.id == saved.id ||
              dayKey(l.timestamp) == dayKey(local.timestamp)),
    );
    _doseLogs.add(saved);
    _sortDoseLogs();
  }

  Map<String, dynamic> _votPayload(DoseLog log) => {
        'scheduled_date': log.scheduledDate ?? dayKey(log.timestamp),
        'scheduled_time': reminder.time,
        'taken_at': log.timestamp.toIso8601String(),
        'media_type': log.localProofType ?? 'video',
        if (log.localProofSeconds != null)
          'duration_seconds': log.localProofSeconds,
        if (_primaryPivotId != null)
          'treatment_plan_medication_id': _primaryPivotId,
      };

  // ---------- In-app inbox -> phone notifications ----------

  bool _checkingInbox = false;

  /// Shows the clinic's new messages (proof verified, rejected, record again,
  /// VOT enrolment changes) as phone notifications, then marks them read so
  /// each appears once. There is no push service: this runs on every sync and
  /// whenever the app comes back to the foreground.
  Future<void> checkInbox() async {
    if (_api.token == null || _checkingInbox) return;
    _checkingInbox = true;
    var reviewChanged = false;
    try {
      final response = await _api.get('/mobile/notifications?unread=1');
      final data = response['data'] as Map<String, dynamic>;
      final items = (data['notifications'] as List<dynamic>? ?? [])
          .cast<Map<String, dynamic>>();

      for (final n in items.reversed) {
        final type = '${n['type'] ?? ''}';
        // "Proof submitted" was already shown on the confirmation screen.
        if (type != 'vot.received') {
          await NotificationService().showInfo(
            id: (n['id'] as num).toInt(),
            title: '${n['title'] ?? 'DOTS Daily'}',
            body: '${n['body'] ?? ''}',
          );
        }
        if (type.startsWith('vot.') && type != 'vot.received') {
          reviewChanged = true;
        }
        await _api.post('/mobile/notifications/${n['id']}/read');
      }
    } catch (_) {
      // The inbox is a convenience; a failure must never surface as an error.
    } finally {
      _checkingInbox = false;
    }

    // A review decision changes the calendar (and enrolment the flow) — pull
    // it in.
    if (reviewChanged && !_syncing) await refresh();
  }

  /// Sends one dose and adopts the server's row on success.
  Future<void> _persist(DoseLog log) async {
    // Signed out, or a unit test — there is nothing to authenticate with.
    // We still queue + persist so a dose recorded while signed out (or offline)
    // is not lost; it uploads on the next refresh once there is a token.
    _unsynced.add(log);
    await _saveQueue();
    _safeNotify();

    if (_api.token == null) return;

    await _pushUnsynced();
    _safeNotify();
  }

  /// Posts every queued dose, stopping at the first failure so the rest stay
  /// queued — repeated failures are almost always the connection, not the data.
  Future<void> _pushUnsynced() async {
    for (final log in List<DoseLog>.from(_unsynced)) {
      try {
        final proofOnDisk =
            log.hasQueuedProof && File(log.localVideoPath!).existsSync();

        if (proofOnDisk) {
          // A queued VOT proof: upload it to the nurse's review queue.
          final response = await _api.postMultipart(
            '/mobile/vot/submissions',
            fields: _votPayload(log),
            filePath: log.localVideoPath!,
            fileField: 'media',
          );
          _adoptSubmittedDose(log, response['data'] as Map<String, dynamic>);
        } else {
          // A plain confirmation (or a proof whose file went missing — the
          // backend then records it as awaiting proof for a VOT patient).
          final response = await _api.post(
            '/mobile/dose-logs',
            body: _dosePayload(log),
          );
          final saved = DoseLog.fromApiJson(
            response['data'] as Map<String, dynamic>,
            medicationName: medicineFullName,
          );
          final index = _doseLogs.indexWhere(
            (existing) => dayKey(existing.timestamp) == dayKey(log.timestamp),
          );
          if (index != -1) _doseLogs[index] = saved;
        }

        // Uploaded (or already gone) — don't let proof files pile up.
        await _deleteLocalVideo(log.localVideoPath);
        _unsynced.remove(log);
        await _saveQueue();
        _syncError = null;
      } on ApiException catch (e) {
        _syncError = e.displayMessage;
        // 409: this dose already has proof on the server — nothing left to
        // send. 403/422: the server will never accept this item as it is (not
        // enrolled, file too long...); retrying forever would block every dose
        // queued behind it.
        if (e.statusCode == 409 || e.statusCode == 403 || e.statusCode == 422) {
          await _deleteLocalVideo(log.localVideoPath);
          _unsynced.remove(log);
          await _saveQueue();
          continue;
        }
        return;
      } catch (_) {
        _syncError =
            'Could not reach the server. Showing only the doses saved on this phone.';
        return;
      }
    }
  }

  // ---------- Offline upload queue persistence ----------

  static const String _queueKey = 'dots.unsynced_dose_logs';

  bool _queueRestored = false;

  /// Writes the pending-upload queue to disk so a force-quit between recording
  /// a proof and uploading it never loses the clip reference.
  Future<void> _saveQueue() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        _queueKey,
        jsonEncode(_unsynced.map((l) => l.toJson()).toList()),
      );
    } catch (_) {
      // Best-effort: a failed persist must not break logging a dose.
    }
  }

  /// Reloads doses queued on a previous run (recorded offline, then the app was
  /// closed) and shows them on the calendar until they upload. Runs once.
  Future<void> restoreQueue() async {
    if (_queueRestored) return;
    _queueRestored = true;
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_queueKey);
      if (raw == null || raw.isEmpty) return;

      final restored = (jsonDecode(raw) as List<dynamic>)
          .map((e) => DoseLog.fromJson(e as Map<String, dynamic>))
          .toList();

      for (final pending in restored) {
        if (_unsynced.any((l) => l.id == pending.id)) continue;
        _unsynced.add(pending);
        final onCalendar = _doseLogs.any(
          (log) => dayKey(log.timestamp) == dayKey(pending.timestamp),
        );
        if (!onCalendar) _doseLogs.add(pending);
      }
      _sortDoseLogs();
      _safeNotify();
    } catch (_) {
      // A corrupt queue should not stop the app from starting.
    }
  }

  Future<void> _deleteLocalVideo(String? path) async {
    if (path == null) return;
    try {
      final file = File(path);
      if (await file.exists()) await file.delete();
    } catch (_) {
      // A leftover temp file is harmless; ignore delete failures.
    }
  }

  /// The body the backend's `/mobile/dose-logs` endpoint expects.
  Map<String, dynamic> _dosePayload(DoseLog log) => {
        'scheduled_date': log.scheduledDate ?? dayKey(log.timestamp),
        // The app's reminder is the schedule the patient actually follows.
        'scheduled_time': reminder.time,
        'taken_at': log.timestamp.toIso8601String(),
        'dose_quantity': medicineDosage,
        if (_primaryPivotId != null)
          'treatment_plan_medication_id': _primaryPivotId,
        if (log.notes != null) 'notes': log.notes,
      };

  void _sortDoseLogs() =>
      _doseLogs.sort((a, b) => b.timestamp.compareTo(a.timestamp));

  /// [refresh] and the writes it triggers finish after the widget tree may be
  /// gone, and notifying a disposed ChangeNotifier throws.
  void _safeNotify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
