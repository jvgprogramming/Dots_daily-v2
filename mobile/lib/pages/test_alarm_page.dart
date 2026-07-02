import 'dart:math';
import 'package:flutter/material.dart';
import '../services/notification_service.dart';
import '../theme/app_theme.dart';

class TestAlarmPage extends StatefulWidget {
  final ValueChanged<String>? onViewChange;

  const TestAlarmPage({super.key, this.onViewChange});

  @override
  State<TestAlarmPage> createState() => _TestAlarmPageState();
}

class _TestAlarmPageState extends State<TestAlarmPage> {
  final _notificationService = NotificationService();
  bool _sending = false;
  final List<Map<String, dynamic>> _alarmHistory = [];
  static int _nextNotificationId = 0;

  /// Generates a unique notification ID that fits within the 32-bit signed integer limit.
  static int _nextId() {
    _nextNotificationId = (_nextNotificationId + 1) & 0x7FFFFFFF;
    return _nextNotificationId;
  }

  static const _testMedications = [
    'Rifampicin 600mg',
    'Isoniazid 300mg',
    'Pyrazinamide 1500mg',
    'Ethambutol 1200mg',
    'Pyridoxine B6 25mg',
  ];

  static const _testTimes = [
    '07:00 AM',
    '08:00 AM',
    '12:00 PM',
    '06:00 PM',
    '09:00 PM',
  ];

  @override
  void initState() {
    super.initState();
    _initializeNotifications();
  }

  Future<void> _initializeNotifications() async {
    await _notificationService.initialize();
  }

  Future<void> _sendTestNotification({bool immediate = true}) async {
    setState(() => _sending = true);

    final random = Random();
    final medName = _testMedications[random.nextInt(_testMedications.length)];
    final time = _testTimes[random.nextInt(_testTimes.length)];
    final alarmId = _nextId();

    try {
      if (immediate) {
        await _notificationService.showNotification(
          id: alarmId,
          title: '💊 Medication Reminder',
          body: 'Time to take $medName',
          payload: 'medication:$medName',
        );
      } else {
        // Schedule 10 seconds from now
        final scheduledTime = DateTime.now().add(const Duration(seconds: 10));
        await _notificationService.scheduleNotification(
          id: alarmId,
          title: '⏰ Scheduled Alarm Test',
          body: 'Take $medName - $time',
          scheduledDate: scheduledTime,
          payload: 'medication:$medName',
        );
      }

      setState(() {
        _alarmHistory.insert(0, {
          'id': alarmId.toString(),
          'medication': medName,
          'time': time,
          'type': immediate ? 'Instant' : 'Scheduled (10s)',
          'timestamp': DateTime.now(),
        });
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Notification failed: $e'),
            backgroundColor: AppColors.destructive,
          ),
        );
      }
    }

    setState(() => _sending = false);
  }

  Future<void> _scheduleDailyTest() async {
    setState(() => _sending = true);

    // Schedule 3 test alarms every 30 seconds for demo
    for (int i = 0; i < 3; i++) {
      final medName = _testMedications[i];
      final alarmId = _nextId();
      final scheduledTime = DateTime.now().add(Duration(seconds: 10 + (i * 30)));

      try {
        await _notificationService.scheduleNotification(
          id: alarmId,
          title: '💊 Daily Dose Reminder',
          body: 'Time to take $medName',
          scheduledDate: scheduledTime,
          payload: 'medication:$medName',
        );

        setState(() {
          _alarmHistory.insert(0, {
            'id': alarmId.toString(),
            'medication': medName,
            'time': '${scheduledTime.hour.toString().padLeft(2, '0')}:${scheduledTime.minute.toString().padLeft(2, '0')}',
            'type': 'Scheduled (+${10 + (i * 30)}s)',
            'timestamp': DateTime.now(),
          });
        });
      } catch (e) {
        debugPrint('Scheduling failed for $medName: $e');
      }
    }

    setState(() => _sending = false);
  }

  Future<void> _cancelAllAlarms() async {
    await _notificationService.cancelAll();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('All notifications cancelled'),
          backgroundColor: AppColors.emerald,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: AppColors.primaryGradient,
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: const Icon(
                        Icons.notifications_active,
                        color: Colors.white,
                        size: 24,
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Test Alarms',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          'Verify notifications work on your device',
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),

          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Action buttons
                Row(
                  children: [
                    Expanded(
                      child: _ActionCard(
                        icon: Icons.notifications,
                        label: 'Instant Alarm',
                        subtitle: 'Show now',
                        color: AppColors.primary,
                        loading: _sending,
                        onTap: () => _sendTestNotification(immediate: true),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _ActionCard(
                        icon: Icons.timer,
                        label: 'Scheduled',
                        subtitle: 'In 10 seconds',
                        color: AppColors.amber,
                        loading: _sending,
                        onTap: () => _sendTestNotification(immediate: false),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _ActionCard(
                        icon: Icons.repeat,
                        label: 'Batch (3x)',
                        subtitle: 'Every 30s',
                        color: AppColors.emerald,
                        loading: _sending,
                        onTap: _scheduleDailyTest,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _ActionCard(
                        icon: Icons.cancel_schedule_send,
                        label: 'Cancel All',
                        subtitle: 'Clear pending',
                        color: AppColors.destructive,
                        loading: false,
                        onTap: _cancelAllAlarms,
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 24),

                // Alarm history
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Alarm History',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (_alarmHistory.isNotEmpty)
                      TextButton(
                        onPressed: () => setState(() => _alarmHistory.clear()),
                        child: const Text('Clear'),
                      ),
                  ],
                ),
                const SizedBox(height: 8),

                if (_alarmHistory.isEmpty)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(32),
                    decoration: BoxDecoration(
                      border: Border.all(color: AppColors.border),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Column(
                      children: [
                        Icon(Icons.notifications_off_outlined,
                            size: 48, color: AppColors.mutedForeground),
                        SizedBox(height: 12),
                        Text(
                          'No alarms triggered yet',
                          style: TextStyle(
                            fontSize: 15,
                            color: AppColors.mutedForeground,
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          'Tap one of the buttons above to test',
                          style: TextStyle(
                            fontSize: 12,
                            color: AppColors.mutedForeground,
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  ..._alarmHistory.map((alarm) => Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          border: Border.all(color: AppColors.border),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: AppColors.primary.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: const Icon(
                                Icons.notifications,
                                color: AppColors.primary,
                                size: 20,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    alarm['medication'] as String,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w500,
                                      fontSize: 14,
                                    ),
                                  ),
                                  Text(
                                    '${alarm['type']} - ${alarm['time']}',
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: AppColors.mutedForeground,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.emerald.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: const Text(
                                'Sent',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: AppColors.emerald,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      )),

                const SizedBox(height: 24),

                // Instructions card
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.muted.withValues(alpha: 0.3),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.info_outline,
                              size: 18, color: AppColors.primary),
                          SizedBox(width: 8),
                          Text(
                            'How to test',
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        '• "Instant Alarm" sends a notification immediately\n'
                        '• "Scheduled" sends one after 10 seconds\n'
                        '• "Batch" sends 3 alarms, each 30 seconds apart\n'
                        '• "Cancel All" removes all pending scheduled alarms\n\n'
                        'Make sure your phone is not on silent/DND mode.\n'
                        'On Android 13+, you need to grant notification permission.',
                        style: TextStyle(
                          fontSize: 12,
                          color: AppColors.mutedForeground,
                          height: 1.5,
                        ),
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          onPressed: () => widget.onViewChange?.call('dashboard'),
                          icon: const Icon(Icons.arrow_back, size: 18),
                          label: const Text('Back to Dashboard'),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 32),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String subtitle;
  final Color color;
  final bool loading;
  final VoidCallback onTap;

  const _ActionCard({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.color,
    required this.loading,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: loading ? null : onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            loading
                ? SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: color,
                    ),
                  )
                : Icon(icon, color: color, size: 28),
            const SizedBox(height: 8),
            Text(
              label,
              style: TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 14,
                color: color,
              ),
            ),
            Text(
              subtitle,
              style: const TextStyle(
                fontSize: 11,
                color: AppColors.mutedForeground,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
