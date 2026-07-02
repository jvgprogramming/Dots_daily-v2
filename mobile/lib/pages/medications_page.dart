import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/medication.dart';
import '../providers/medications_provider.dart';
import '../theme/app_theme.dart';

class MedicationsPage extends StatelessWidget {
  final ValueChanged<String>? onViewChange;

  const MedicationsPage({super.key, this.onViewChange});

  @override
  Widget build(BuildContext context) {
    final meds = context.watch<MedicationsProvider>();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Medications',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          const Text(
            'Your current TB treatment regimen',
            style: TextStyle(fontSize: 14, color: AppColors.mutedForeground),
          ),
          const SizedBox(height: 20),
          ...meds.medications.map((med) => _MedicationCard(medication: med)),
          const SizedBox(height: 20),
          Center(
            child: TextButton.icon(
              onPressed: () => onViewChange?.call('dashboard'),
              icon: const Icon(Icons.arrow_back),
              label: const Text('Back to Dashboard'),
            ),
          ),
        ],
      ),
    );
  }
}

class _MedicationCard extends StatelessWidget {
  final Medication medication;

  const _MedicationCard({required this.medication});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 12,
                  height: 12,
                  decoration: BoxDecoration(
                    color: medication.color != null
                        ? Color(int.parse(medication.color!.replaceFirst('#', '0xFF')))
                        : AppColors.primary,
                    borderRadius: BorderRadius.circular(6),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        medication.name,
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 16,
                        ),
                      ),
                      Text(
                        '${medication.dosage} - ${medication.frequency}',
                        style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.mutedForeground,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (medication.instructions.isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.muted.withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  medication.instructions,
                  style: const TextStyle(fontSize: 13, height: 1.4),
                ),
              ),
            ],
            if (medication.prescribedBy != null) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(Icons.person_outline, size: 14, color: AppColors.mutedForeground),
                  const SizedBox(width: 6),
                  Text(
                    'Prescribed by ${medication.prescribedBy}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.mutedForeground,
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
