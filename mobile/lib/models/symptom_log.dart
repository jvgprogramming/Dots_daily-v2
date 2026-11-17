/// One symptom the patient reported on a given day, as returned by
/// `GET /mobile/symptoms` (and echoed back by the POST).
class SymptomLog {
  final int? id;
  final DateTime recordedDate;
  final String symptomType;
  final String label;
  final String severity; // 'mild' | 'moderate' | 'severe'
  final bool redFlag;
  final int? durationHours;
  final String? notes;

  const SymptomLog({
    this.id,
    required this.recordedDate,
    required this.symptomType,
    required this.label,
    required this.severity,
    required this.redFlag,
    this.durationHours,
    this.notes,
  });

  factory SymptomLog.fromApiJson(Map<String, dynamic> json) {
    return SymptomLog(
      id: json['id'] as int?,
      recordedDate:
          DateTime.tryParse('${json['recorded_date']}') ?? DateTime.now(),
      symptomType: '${json['symptom_type']}',
      label: '${json['label'] ?? json['symptom_type']}',
      severity: '${json['severity']}',
      redFlag: json['red_flag'] == true,
      durationHours: json['duration_hours'] as int?,
      notes: json['notes'] as String?,
    );
  }
}
