import 'dart:math';

import 'package:flutter/foundation.dart';
import '../models/medication.dart';
import '../services/api_service.dart';

class MedicationsProvider extends ChangeNotifier {
  /// Shared with [AuthProvider] so dose writes carry the signed-in token.
  final ApiService _api = ApiService.shared;

  /// The patient only needs one reminder a day — all TB medicines are taken
  /// together before breakfast — so alarms are represented by this single,
  /// fixed entry instead of one alarm per medication.
  static const String reminderId = 'daily-reminder';

  static const Alarm _defaultReminder = Alarm(
    id: reminderId,
    medicationId: '1',
    medicationName: medicineName,
    time: '07:00',
    enabled: true,
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    label: 'Before breakfast',
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
            'Take on an empty stomach, 1 hour before breakfast. Swallow all 4 tablets together.',
        prescribedBy: 'Dr. Sarah Johnson',
        startDate: '2024-01-01',
        endDate: '2024-07-01',
        reminderTimes: ['07:00'],
        color: '#16A34A',
      ),
    ];

    // One daily reminder for the whole regimen.
    _alarms = [_defaultReminder];

    // About three months of dose history so the calendar has realistic taken,
    // missed and unverified days to show. Deterministic (fixed seed) so the
    // demo looks the same on every launch.
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final rng = Random(7);
    _doseLogs = [];
    for (var daysAgo = 90; daysAgo >= 0; daysAgo--) {
      final day = today.subtract(Duration(days: daysAgo));
      // The occasional missed day keeps it believable; today always counts as
      // taken so the calendar never opens looking broken.
      if (daysAgo != 0 && rng.nextDouble() < 0.09) continue;

      final verified = rng.nextDouble() > 0.12;
      _doseLogs.add(
        DoseLog(
          id: 'cal-$daysAgo',
          medicationId: '1',
          medicationName: medicineFullName,
          timestamp: DateTime(
            day.year,
            day.month,
            day.day,
            6 + rng.nextInt(3), // taken before breakfast
            rng.nextInt(60),
          ),
          verified: verified,
          notes: verified ? null : 'Awaiting confirmation',
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

  /// A day with a dose taken but not yet confirmed by a DOTS observer.
  bool isDayUnverified(DateTime day) {
    final doses = dosesOnDay(day);
    return doses.isNotEmpty && doses.any((log) => !log.verified);
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
  /// The window runs from the regimen start to today (or the end of the plan),
  /// so a day the patient never logged counts against them exactly like a day
  /// recorded as missed — otherwise a patient could score 100% by going quiet.
  /// The admin web app computes the same figure from the same definition, so
  /// the two surfaces cannot disagree.
  double get adherenceRate {
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

  int get progressPercentage {
    const totalTreatmentDays = 180;
    if (treatmentDays == 0) return 0;
    return ((treatmentDays / totalTreatmentDays) * 100).round().clamp(0, 100);
  }

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
    notifyListeners();
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
  /// Self-reported, so it stays unverified (pending) exactly like a dose
  /// confirmed from the alarm.
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
    if (_api.token == null || _syncing) return;

    _syncing = true;
    _safeNotify();

    try {
      // Drain anything logged while offline first, so the fetch below already
      // includes it.
      await _pushUnsynced();
      await _loadRegimen();

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
  }

  /// Sends one dose and adopts the server's row on success.
  Future<void> _persist(DoseLog log) async {
    // Signed out, or a unit test — there is nothing to authenticate with.
    if (_api.token == null) return;

    _unsynced.add(log);
    _safeNotify();

    await _pushUnsynced();
    _safeNotify();
  }

  /// Posts every queued dose, stopping at the first failure so the rest stay
  /// queued — repeated failures are almost always the connection, not the data.
  Future<void> _pushUnsynced() async {
    for (final log in List<DoseLog>.from(_unsynced)) {
      try {
        final response = await _api.post(
          '/mobile/dose-logs',
          body: _dosePayload(log),
        );
        final saved = DoseLog.fromApiJson(
          response['data'] as Map<String, dynamic>,
          medicationName: medicineFullName,
        );

        // Swap the local placeholder for the stored row (server id + status).
        final index = _doseLogs.indexWhere(
          (existing) => dayKey(existing.timestamp) == dayKey(log.timestamp),
        );
        if (index != -1) _doseLogs[index] = saved;

        _unsynced.remove(log);
        _syncError = null;
      } on ApiException catch (e) {
        _syncError = e.message;
        return;
      } catch (_) {
        _syncError =
            'Could not reach the server. Showing only the doses saved on this phone.';
        return;
      }
    }
  }

  /// The body the backend's `/mobile/dose-logs` endpoint expects.
  Map<String, dynamic> _dosePayload(DoseLog log) => {
        'scheduled_date': dayKey(log.timestamp),
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
