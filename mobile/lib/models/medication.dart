class Medication {
  final String id;
  final String name;
  final String dosage;
  final String frequency;
  final String instructions;
  final String? prescribedBy;
  final String startDate;
  final String? endDate;
  final List<String> reminderTimes;
  final String? color;

  const Medication({
    required this.id,
    required this.name,
    required this.dosage,
    required this.frequency,
    required this.instructions,
    this.prescribedBy,
    required this.startDate,
    this.endDate,
    required this.reminderTimes,
    this.color,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'dosage': dosage,
        'frequency': frequency,
        'instructions': instructions,
        'prescribedBy': prescribedBy,
        'startDate': startDate,
        'endDate': endDate,
        'reminderTimes': reminderTimes,
        'color': color,
      };

  factory Medication.fromJson(Map<String, dynamic> json) => Medication(
        id: json['id'] as String,
        name: json['name'] as String,
        dosage: json['dosage'] as String,
        frequency: json['frequency'] as String,
        instructions: json['instructions'] as String,
        prescribedBy: json['prescribedBy'] as String?,
        startDate: json['startDate'] as String,
        endDate: json['endDate'] as String?,
        reminderTimes: (json['reminderTimes'] as List<dynamic>)
            .map((e) => e as String)
            .toList(),
        color: json['color'] as String?,
      );
}

class Alarm {
  final String id;
  final String medicationId;
  final String medicationName;

  /// 24-hour time in `HH:mm` format.
  final String time;
  final bool enabled;
  final List<String> days;

  /// Short user-facing label, e.g. "Morning dose".
  final String label;
  final String? lastTaken;

  const Alarm({
    required this.id,
    required this.medicationId,
    required this.medicationName,
    required this.time,
    required this.enabled,
    this.days = const [],
    this.label = 'Medication reminder',
    this.lastTaken,
  });

  /// Parses the [time] string into hour/minute parts. Falls back to 08:00.
  (int, int) get timeParts {
    final parts = time.split(':');
    final h = int.tryParse(parts.isNotEmpty ? parts[0] : '') ?? 8;
    final m = parts.length > 1 ? int.tryParse(parts[1]) ?? 0 : 0;
    return (h.clamp(0, 23), m.clamp(0, 59));
  }

  /// `07:05 AM` style display string.
  String get displayTime {
    final (h, m) = timeParts;
    final hour12 = h == 0 ? 12 : (h > 12 ? h - 12 : h);
    final amPm = h >= 12 ? 'PM' : 'AM';
    return '${hour12.toString().padLeft(2, '0')}:${m.toString().padLeft(2, '0')} $amPm';
  }

  /// Short repeat summary: "Every day", "Weekdays", "Weekends" or "Mon, Fri".
  String get repeatSummary {
    if (days.length >= 7) return 'Every day';
    if (days.length == 5 &&
        const ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].every(days.contains)) {
      return 'Weekdays';
    }
    if (days.length == 2 && days.contains('Sat') && days.contains('Sun')) {
      return 'Weekends';
    }
    if (days.isEmpty) return 'Once';
    return days.join(', ');
  }

  Alarm copyWith({
    String? id,
    String? medicationId,
    String? medicationName,
    String? time,
    bool? enabled,
    List<String>? days,
    String? label,
    String? lastTaken,
  }) =>
      Alarm(
        id: id ?? this.id,
        medicationId: medicationId ?? this.medicationId,
        medicationName: medicationName ?? this.medicationName,
        time: time ?? this.time,
        enabled: enabled ?? this.enabled,
        days: days ?? this.days,
        label: label ?? this.label,
        lastTaken: lastTaken ?? this.lastTaken,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'medicationId': medicationId,
        'medicationName': medicationName,
        'time': time,
        'enabled': enabled,
        'days': days,
        'label': label,
        'lastTaken': lastTaken,
      };

  factory Alarm.fromJson(Map<String, dynamic> json) => Alarm(
        id: json['id'] as String,
        medicationId: json['medicationId'] as String? ?? '',
        medicationName: json['medicationName'] as String? ?? 'Medication',
        time: json['time'] as String,
        enabled: json['enabled'] as bool? ?? true,
        days: (json['days'] as List<dynamic>?)?.map((e) => e as String).toList() ??
            const [],
        label: json['label'] as String? ?? 'Medication reminder',
        lastTaken: json['lastTaken'] as String?,
      );
}

class DoseLog {
  final String id;
  final String medicationId;
  final String medicationName;
  final DateTime timestamp;
  final bool verified;

  /// The backend's outcome for the day: `taken`, `late`, `missed` or `skipped`.
  ///
  /// Null for doses that only exist on this phone (and for the demo history),
  /// which count as taken. A `missed` entry is the system recording that no dose
  /// was taken — it must not be shown as a logged dose.
  final String? status;

  final String? photoUrl;
  final String? videoUrl;
  final String? notes;

  const DoseLog({
    required this.id,
    required this.medicationId,
    required this.medicationName,
    required this.timestamp,
    required this.verified,
    this.status,
    this.photoUrl,
    this.videoUrl,
    this.notes,
  });

  /// True when the backend recorded that this day's dose was not taken.
  bool get isMissed => status == 'missed';

  String get formattedDate {
    final months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return '${months[timestamp.month - 1]} ${timestamp.day}, ${timestamp.year}';
  }

  String get formattedDateTime {
    final months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    final hour = timestamp.hour > 12 ? timestamp.hour - 12 : timestamp.hour;
    final minute = timestamp.minute.toString().padLeft(2, '0');
    final amPm = timestamp.hour >= 12 ? 'PM' : 'AM';
    return '${months[timestamp.month - 1]} ${timestamp.day}, $hour:$minute $amPm';
  }

  /// Builds a log from the backend's `/mobile/dose-logs` payload.
  ///
  /// [medicationName] overrides the server's medicine name on purpose: the app
  /// presents the regimen as a single "Drug Intake" and never a drug name.
  factory DoseLog.fromApiJson(
    Map<String, dynamic> json, {
    String? medicationName,
  }) {
    final takenAt = json['taken_at'] as String?;
    final date = json['scheduled_date'] as String? ?? '';
    final time = json['scheduled_time'] as String? ?? '';

    // A missed dose has no `taken_at`, so fall back to when it was scheduled.
    DateTime timestamp;
    if (takenAt != null && takenAt.isNotEmpty) {
      timestamp = DateTime.parse(takenAt).toLocal();
    } else if (date.isNotEmpty) {
      timestamp = DateTime.parse(
        '$date ${time.length == 5 ? '$time:00' : time}',
      );
    } else {
      timestamp = DateTime.now();
    }

    return DoseLog(
      id: '${json['id']}',
      medicationId: '${json['treatment_plan_medication_id'] ?? ''}',
      medicationName:
          medicationName ?? (json['medication_name'] as String?) ?? 'Drug Intake',
      timestamp: timestamp,
      verified: json['verified'] as bool? ?? false,
      status: json['status'] as String?,
      notes: json['notes'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'medicationId': medicationId,
        'medicationName': medicationName,
        'timestamp': timestamp.toIso8601String(),
        'verified': verified,
        'status': status,
        'photoUrl': photoUrl,
        'videoUrl': videoUrl,
        'notes': notes,
      };

  factory DoseLog.fromJson(Map<String, dynamic> json) => DoseLog(
        id: json['id'] as String,
        medicationId: json['medicationId'] as String,
        medicationName: json['medicationName'] as String,
        timestamp: DateTime.parse(json['timestamp'] as String),
        verified: json['verified'] as bool? ?? false,
        status: json['status'] as String?,
        photoUrl: json['photoUrl'] as String?,
        videoUrl: json['videoUrl'] as String?,
        notes: json['notes'] as String?,
      );
}
