import 'dart:math';

import 'package:flutter/foundation.dart';
import '../models/medication.dart';

class MedicationsProvider extends ChangeNotifier {
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

  List<Medication> get medications => _medications;
  List<Alarm> get alarms => _alarms;
  List<DoseLog> get doseLogs => _doseLogs;

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
    final sorted = List<DoseLog>.from(_doseLogs)
      ..sort((a, b) => b.timestamp.compareTo(a.timestamp));
    return sorted.take(6).toList();
  }

  // ---------- Calendar ----------

  /// The day the regimen started — earlier calendar days are greyed out.
  DateTime get regimenStart {
    final start = _medications.isEmpty ? null : _medications.first.startDate;
    return DateTime.tryParse(start ?? '') ?? DateTime(2000);
  }

  /// Stable `yyyy-MM-dd` key used to group logs by day.
  static String dayKey(DateTime day) =>
      '${day.year.toString().padLeft(4, '0')}-'
      '${day.month.toString().padLeft(2, '0')}-'
      '${day.day.toString().padLeft(2, '0')}';

  /// That day's dose logs, newest first (empty when nothing was logged).
  List<DoseLog> logsOnDay(DateTime day) {
    return _doseLogs.where((log) => _isSameDay(log.timestamp, day)).toList()
      ..sort((a, b) => b.timestamp.compareTo(a.timestamp));
  }

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

  bool isDayTaken(DateTime day) =>
      _doseLogs.any((log) => _isSameDay(log.timestamp, day));

  /// A day that has a dose logged but not yet verified.
  bool isDayUnverified(DateTime day) {
    final logs = logsOnDay(day);
    return logs.isNotEmpty && logs.any((log) => !log.verified);
  }

  /// Number of days in [month] with at least one dose logged.
  int takenCountInMonth(DateTime month) => doseLogsByDay(month).length;

  /// Scheduled days in [month] up to today with no dose logged.
  int missedCountInMonth(DateTime month) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final monthStart = DateTime(month.year, month.month);
    final monthEnd = DateTime(month.year, month.month + 1, 0);
    final lastDay = monthEnd.isBefore(today) ? monthEnd : today;
    final firstDay = regimenStart.isAfter(monthStart)
        ? regimenStart
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

  double get adherenceRate {
    if (_doseLogs.isEmpty) return 0;
    final verified = _doseLogs.where((log) => log.verified).length;
    return (verified / _doseLogs.length) * 100;
  }

  int get treatmentDays => _doseLogs.length;

  int get progressPercentage {
    const totalTreatmentDays = 180;
    if (_doseLogs.isEmpty) return 0;
    return ((_doseLogs.length / totalTreatmentDays) * 100).round().clamp(
      0,
      100,
    );
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

  void addDoseLog(DoseLog log) {
    _doseLogs.insert(0, log);
    notifyListeners();
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
    _doseLogs.sort((a, b) => b.timestamp.compareTo(a.timestamp));
    notifyListeners();
    return log;
  }

  void deleteDoseLog(String id) {
    _doseLogs.removeWhere((log) => log.id == id);
    notifyListeners();
  }
}
