import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class SymptomsPage extends StatelessWidget {
  final ValueChanged<String>? onViewChange;

  const SymptomsPage({super.key, this.onViewChange});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      // Clears the notch with half the extra space the home hero gets.
      padding: EdgeInsets.fromLTRB(
        16,
        MediaQuery.of(context).padding.top + 8,
        16,
        16,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Symptom Monitor',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          const Text(
            'Track TB symptoms and medication side effects',
            style: TextStyle(fontSize: 14, color: AppColors.mutedForeground),
          ),
          const SizedBox(height: 32),
          Center(
            child: Column(
              children: [
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: AppColors.orange.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(40),
                  ),
                  child: const Icon(
                    Icons.monitor_heart_outlined,
                    size: 40,
                    color: AppColors.orange,
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Symptom Tracking Coming Soon',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Monitor common TB symptoms like cough, fever,\nand night sweats to share with your healthcare provider.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 14,
                    color: AppColors.mutedForeground,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 24),
                OutlinedButton.icon(
                  onPressed: () => onViewChange?.call('dashboard'),
                  icon: const Icon(Icons.arrow_back),
                  label: const Text('Back to Dashboard'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
