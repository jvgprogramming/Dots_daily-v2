import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../theme/app_theme.dart';

class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    final patient = user?.patient;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Profile'),
        backgroundColor: Colors.transparent,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
          // Profile header
          Center(
            child: Column(
              children: [
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: AppColors.primaryGradient,
                    ),
                    borderRadius: BorderRadius.circular(40),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.primary.withValues(alpha: 0.3),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Center(
                    child: Text(
                      user?.initials ?? '',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  user?.fullName ?? '',
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: AppColors.foreground,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  user?.email ?? '',
                  style: const TextStyle(
                    fontSize: 14,
                    color: AppColors.mutedForeground,
                  ),
                ),
                if (user?.phone != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    user!.phone!,
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppColors.mutedForeground,
                    ),
                  ),
                ],
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    user?.role == 'admin' ? 'Administrator' : 'Patient',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Personal Information section
          if (patient != null) ...[
            _buildSectionHeader(context, Icons.person_outline, 'Personal Information'),
            const SizedBox(height: 8),
            _buildInfoCard(context, [
              _InfoItem(
                label: 'Date of Birth',
                value: patient.dateOfBirth != null
                    ? _formatDate(patient.dateOfBirth!)
                    : 'Not set',
              ),
              _InfoItem(
                label: 'Gender',
                value: patient.gender != null
                    ? _capitalize(patient.gender!)
                    : 'Not set',
              ),
              _InfoItem(
                label: 'Occupation',
                value: patient.occupation ?? 'Not set',
              ),
              _InfoItem(
                label: 'Nationality',
                value: patient.nationality ?? 'Not set',
              ),
            ]),
            const SizedBox(height: 16),

            // Contact & Address
            _buildSectionHeader(context, Icons.location_on_outlined, 'Address & Contact'),
            const SizedBox(height: 8),
            _buildInfoCard(context, [
              _InfoItem(
                label: 'Address',
                value: patient.address ?? 'Not set',
              ),
              _InfoItem(
                label: 'Emergency Contact',
                value: patient.emergencyContactName ?? 'Not set',
              ),
              _InfoItem(
                label: 'Emergency Phone',
                value: patient.emergencyContactPhone ?? 'Not set',
              ),
            ]),
            const SizedBox(height: 16),

            // Medical Info
            _buildSectionHeader(context, Icons.medical_services_outlined, 'Medical Information'),
            const SizedBox(height: 8),
            _buildInfoCard(context, [
              _InfoItem(
                label: 'Health ID Number',
                value: patient.healthIdNumber ?? 'Not set',
              ),
              _InfoItem(
                label: 'Referred By',
                value: patient.referredBy ?? 'Not set',
              ),
              _InfoItem(
                label: 'Registered',
                value: patient.registeredAt != null
                    ? _formatDate(patient.registeredAt!)
                    : 'Not set',
              ),
            ]),
          ] else ...[
            // No patient profile linked
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                border: Border.all(color: AppColors.border),
                borderRadius: BorderRadius.circular(16),
                color: AppColors.surface,
              ),
              child: Column(
                children: [
                  Icon(
                    Icons.person_outline,
                    size: 48,
                    color: AppColors.mutedForeground.withValues(alpha: 0.5),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'No patient profile linked',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                      color: AppColors.mutedForeground,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Contact an administrator to link your account.',
                    style: TextStyle(
                      fontSize: 13,
                      color: AppColors.mutedForeground,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 16),

          // Account info
          _buildSectionHeader(context, Icons.info_outline, 'Account'),
          const SizedBox(height: 8),
          _buildInfoCard(context, [
            _InfoItem(
              label: 'Account Status',
              value: user?.isActive == true ? 'Active' : 'Inactive',
              valueColor: user?.isActive == true ? AppColors.emerald : AppColors.destructive,
            ),
            _InfoItem(
              label: 'Email Verified',
              value: user?.emailVerifiedAt != null ? 'Yes' : 'No',
            ),
            if (user?.lastLoginAt != null)
              _InfoItem(
                label: 'Last Login',
                value: _formatDateTime(user!.lastLoginAt!),
              ),
          ]),

          const SizedBox(height: 32),
        ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(BuildContext context, IconData icon, String title) {
    return Row(
      children: [
        Icon(icon, size: 18, color: AppColors.primary),
        const SizedBox(width: 8),
        Text(
          title,
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: AppColors.foreground,
          ),
        ),
      ],
    );
  }

  Widget _buildInfoCard(BuildContext context, List<_InfoItem> items) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: items.map((item) {
          final isLast = item == items.last;
          return Padding(
            padding: EdgeInsets.only(bottom: isLast ? 0 : 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 120,
                  child: Text(
                    item.label,
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.mutedForeground,
                    ),
                  ),
                ),
                Expanded(
                  child: Text(
                    item.value,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: item.valueColor ?? AppColors.foreground,
                    ),
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  String _formatDate(String dateStr) {
    try {
      final date = DateTime.parse(dateStr);
      final months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];
      return '${months[date.month - 1]} ${date.day}, ${date.year}';
    } catch (_) {
      return dateStr;
    }
  }

  String _formatDateTime(String dateStr) {
    try {
      final date = DateTime.parse(dateStr);
      final months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];
      final hour = date.hour > 12 ? date.hour - 12 : (date.hour == 0 ? 12 : date.hour);
      final amPm = date.hour >= 12 ? 'PM' : 'AM';
      final min = date.minute.toString().padLeft(2, '0');
      return '${months[date.month - 1]} ${date.day}, ${date.year} $hour:$min $amPm';
    } catch (_) {
      return dateStr;
    }
  }

  String _capitalize(String s) {
    if (s.isEmpty) return s;
    return s[0].toUpperCase() + s.substring(1);
  }
}

class _InfoItem {
  final String label;
  final String value;
  final Color? valueColor;

  const _InfoItem({
    required this.label,
    required this.value,
    this.valueColor,
  });
}
