import 'package:flutter/foundation.dart';
import '../models/medication.dart';

class MedicationsProvider extends ChangeNotifier {
  List<Medication> _medications = [];
  List<Alarm> _alarms = [];
  List<DoseLog> _doseLogs = [];

  List<Medication> get medications => _medications;
  List<Alarm> get alarms => _alarms;
  List<DoseLog> get doseLogs => _doseLogs;

  MedicationsProvider() {
    _initMockData();
  }

  void _initMockData() {
    _medications = [
      Medication(
        id: '1',
        name: 'Rifampicin',
        dosage: '600mg',
        frequency: 'Once daily',
        instructions: 'Take on empty stomach, 1 hour before breakfast. May cause orange/red discoloration of urine.',
        prescribedBy: 'Dr. Sarah Johnson',
        startDate: '2024-01-01',
        endDate: '2024-07-01',
        reminderTimes: ['07:00'],
        color: '#DC2626',
      ),
      Medication(
        id: '2',
        name: 'Isoniazid',
        dosage: '300mg',
        frequency: 'Once daily',
        instructions: 'Take on empty stomach with Rifampicin. Avoid alcohol.',
        prescribedBy: 'Dr. Sarah Johnson',
        startDate: '2024-01-01',
        endDate: '2024-07-01',
        reminderTimes: ['07:00'],
        color: '#2563EB',
      ),
      Medication(
        id: '3',
        name: 'Pyrazinamide',
        dosage: '1500mg',
        frequency: 'Once daily',
        instructions: 'Take with other TB medications. Monitor for joint pain.',
        prescribedBy: 'Dr. Sarah Johnson',
        startDate: '2024-01-01',
        endDate: '2024-03-01',
        reminderTimes: ['07:00'],
        color: '#16A34A',
      ),
      Medication(
        id: '4',
        name: 'Ethambutol',
        dosage: '1200mg',
        frequency: 'Once daily',
        instructions: 'Take with food. Report any vision changes immediately.',
        prescribedBy: 'Dr. Sarah Johnson',
        startDate: '2024-01-01',
        endDate: '2024-03-01',
        reminderTimes: ['07:00'],
        color: '#9333EA',
      ),
      Medication(
        id: '5',
        name: 'Pyridoxine (Vitamin B6)',
        dosage: '25mg',
        frequency: 'Once daily',
        instructions: 'Prevents nerve damage from Isoniazid. Take with TB medications.',
        prescribedBy: 'Dr. Sarah Johnson',
        startDate: '2024-01-01',
        endDate: '2024-07-01',
        reminderTimes: ['07:00'],
        color: '#F59E0B',
      ),
    ];

    // Generate alarms from medications
    _alarms = [];
    for (final med in _medications) {
      for (final time in med.reminderTimes) {
        _alarms.add(Alarm(
          id: '${med.id}-$time',
          medicationId: med.id,
          medicationName: '${med.name} ${med.dosage}',
          time: time,
          enabled: true,
          days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          label: 'Morning dose',
        ));
      }
    }

    // Sample dose logs
    final now = DateTime.now();
    _doseLogs = [
      DoseLog(
        id: '1',
        medicationId: '1',
        medicationName: 'Rifampicin 600mg',
        timestamp: now.subtract(const Duration(hours: 2)),
        verified: true,
      ),
      DoseLog(
        id: '2',
        medicationId: '2',
        medicationName: 'Isoniazid 300mg',
        timestamp: now.subtract(const Duration(minutes: 90)),
        verified: true,
      ),
      DoseLog(
        id: '3',
        medicationId: '4',
        medicationName: 'Ethambutol 1200mg',
        timestamp: now.subtract(const Duration(hours: 2)),
        verified: false,
        notes: 'Taken with breakfast',
      ),
    ];
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

  double get adherenceRate {
    if (_doseLogs.isEmpty) return 0;
    final verified = _doseLogs.where((log) => log.verified).length;
    return (verified / _doseLogs.length) * 100;
  }

  int get treatmentDays => _doseLogs.length;

  int get progressPercentage {
    const totalTreatmentDays = 180;
    if (_doseLogs.isEmpty) return 0;
    return ((_doseLogs.length / totalTreatmentDays) * 100).round().clamp(0, 100);
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

  void deleteAlarm(String id) {
    _alarms.removeWhere((a) => a.id == id);
    notifyListeners();
  }

  String get upcomingMedicationNames {
    return _medications.take(3).map((m) => m.name).join(' • ');
  }

  void addMedication(Medication medication) {
    _medications.add(medication);
    for (final time in medication.reminderTimes) {
      _alarms.add(Alarm(
        id: '${medication.id}-$time',
        medicationId: medication.id,
        medicationName: '${medication.name} ${medication.dosage}',
        time: time,
        enabled: true,
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        label: 'Dose reminder',
      ));
    }
    notifyListeners();
  }

  void toggleAlarm(String id) {
    final index = _alarms.indexWhere((a) => a.id == id);
    if (index != -1) {
      _alarms[index] = _alarms[index].copyWith(enabled: !_alarms[index].enabled);
      notifyListeners();
    }
  }
  void addDoseLog(DoseLog log) {
    _doseLogs.insert(0, log);
    notifyListeners();
  }

  void deleteDoseLog(String id) {
    _doseLogs.removeWhere((log) => log.id == id);
    notifyListeners();
  }
}
