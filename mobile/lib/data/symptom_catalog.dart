import 'package:material_ui/material_ui.dart';

/// The curated list of symptoms a patient can report, mirroring the backend's
/// App\Support\Symptoms catalogue (slugs must match exactly). Kept here so the
/// Symptom Monitor works fully offline — only submitting needs the network.

enum SymptomSeverity { mild, moderate, severe }

extension SymptomSeverityX on SymptomSeverity {
  /// The value the API expects ('mild' | 'moderate' | 'severe').
  String get apiValue => name;

  String get label => switch (this) {
        SymptomSeverity.mild => 'Mild',
        SymptomSeverity.moderate => 'Moderate',
        SymptomSeverity.severe => 'Severe',
      };
}

/// A symptom chosen in the form: its slug plus the severity the patient picked.
class ReportedSymptom {
  final String slug;
  final SymptomSeverity severity;

  const ReportedSymptom(this.slug, this.severity);
}

class SymptomItem {
  final String slug;
  final String label;
  final IconData icon;

  /// A symptom that is dangerous in itself (the clinic is alerted at any
  /// severity). Shown with a warning accent so the patient understands.
  final bool redFlag;

  const SymptomItem(this.slug, this.label, this.icon, {this.redFlag = false});
}

class SymptomGroup {
  final String title;
  final List<SymptomItem> items;

  const SymptomGroup(this.title, this.items);
}

const List<SymptomGroup> symptomCatalog = [
  SymptomGroup('TB symptoms', [
    SymptomItem('cough', 'Cough', Icons.sick_outlined),
    SymptomItem('coughing_blood', 'Coughing up blood', Icons.bloodtype_outlined,
        redFlag: true),
    SymptomItem('fever', 'Fever', Icons.thermostat),
    SymptomItem('night_sweats', 'Night sweats', Icons.bedtime_outlined),
    SymptomItem('weight_loss', 'Weight loss', Icons.monitor_weight_outlined),
    SymptomItem('loss_of_appetite', 'Loss of appetite', Icons.no_meals_outlined),
    SymptomItem('fatigue', 'Tiredness or weakness', Icons.battery_alert_outlined),
    SymptomItem('chest_pain', 'Chest pain', Icons.favorite_border),
    SymptomItem(
        'severe_breathlessness', 'Severe shortness of breath', Icons.air,
        redFlag: true),
  ]),
  SymptomGroup('Medication side effects', [
    SymptomItem('nausea', 'Nausea or vomiting',
        Icons.sentiment_dissatisfied_outlined),
    SymptomItem('severe_vomiting', 'Severe or constant vomiting', Icons.sick,
        redFlag: true),
    SymptomItem('jaundice', 'Yellow eyes or skin', Icons.remove_red_eye_outlined,
        redFlag: true),
    SymptomItem('dark_urine', 'Dark-coloured urine', Icons.water_drop_outlined,
        redFlag: true),
    SymptomItem('rash', 'Skin rash or itching', Icons.healing_outlined),
    SymptomItem('severe_rash', 'Severe or spreading rash',
        Icons.coronavirus_outlined,
        redFlag: true),
    SymptomItem('vision_changes', 'Blurred or changed vision',
        Icons.visibility_outlined,
        redFlag: true),
    SymptomItem('hearing_changes', 'Hearing problems or ringing',
        Icons.hearing_outlined,
        redFlag: true),
    SymptomItem('numbness', 'Numbness or tingling in hands or feet',
        Icons.back_hand_outlined),
    SymptomItem('joint_pain', 'Joint pain', Icons.accessibility_new),
    SymptomItem('dizziness', 'Dizziness', Icons.blur_on),
  ]),
];

/// A report is a red flag when the symptom is dangerous or rated severe — the
/// app uses this to warn the patient; the backend makes the same decision.
bool isRedFlagReport(SymptomItem item, SymptomSeverity severity) =>
    item.redFlag || severity == SymptomSeverity.severe;
