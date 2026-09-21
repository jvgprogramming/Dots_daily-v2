import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/medications_provider.dart';
import '../services/notification_service.dart';
import '../theme/app_theme.dart';
import 'alarm_ringing_page.dart';

/// Walks the patient through what actually happens when the daily reminder
/// goes off and lets them trigger the real thing on their own phone.
class AlarmDemoPage extends StatefulWidget {
  const AlarmDemoPage({super.key});

  @override
  State<AlarmDemoPage> createState() => _AlarmDemoPageState();
}

class _AlarmDemoPageState extends State<AlarmDemoPage> {
  static const int _demoNotificationId = 515151;

  bool _sending = false;
  Timer? _countdown;
  int _secondsLeft = 0;

  @override
  void dispose() {
    _countdown?.cancel();
    super.dispose();
  }

  String get _reminderTime =>
      context.watch<MedicationsProvider>().reminder.displayTime;

  // ---------- actions ----------

  Future<void> _previewAlarm() async {
    final alarm = context.read<MedicationsProvider>().reminder;
    await AlarmRingingPage.open(context, alarm, preview: true);
  }

  Future<void> _sendRealAlarm() async {
    _countdown?.cancel();
    setState(() {
      _sending = true;
      _secondsLeft = 10;
    });

    try {
      await NotificationService().scheduleNotification(
        id: _demoNotificationId,
        title: '⏰ Time to take your medicines',
        body: 'Take your medicine now, before breakfast.',
        scheduledDate: DateTime.now().add(const Duration(seconds: 10)),
        payload: 'alarm:${MedicationsProvider.reminderId}',
      );
      _startCountdown();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Could not schedule the test alarm: $e'),
          backgroundColor: AppColors.destructive,
        ),
      );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _startCountdown() {
    setState(() => _secondsLeft = 10);
    _countdown = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      setState(() => _secondsLeft--);
      if (_secondsLeft <= 0) timer.cancel();
    });
  }

  // ---------- UI ----------

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('How your alarm works'),
        backgroundColor: Colors.transparent,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          _buildHero(),
          const SizedBox(height: 18),
          ..._steps.map(_buildStep),
          const SizedBox(height: 6),
          if (_secondsLeft > 0) ...[
            _buildCountdown(),
            const SizedBox(height: 12),
          ],
          SizedBox(
            width: double.infinity,
            height: 54,
            child: FilledButton.icon(
              onPressed: _sending ? null : _sendRealAlarm,
              icon: _sending
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.notifications_active_rounded),
              label: const Text(
                'Send a real alarm in 10 seconds',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
              ),
              style: FilledButton.styleFrom(
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: OutlinedButton.icon(
              onPressed: _previewAlarm,
              icon: const Icon(Icons.fullscreen_rounded),
              label: const Text(
                'See the alarm screen now',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
              ),
              style: OutlinedButton.styleFrom(
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
            ),
          ),
          const SizedBox(height: 20),
          _buildTipCard(),
        ],
      ),
    );
  }

  Widget _buildHero() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: AppColors.primaryGradient,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.25),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.alarm_on_rounded, color: Colors.white, size: 20),
              SizedBox(width: 8),
              Text(
                'TEST YOUR ALARM',
                style: TextStyle(
                  color: Colors.white70,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.1,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            _reminderTime,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 40,
              height: 1.0,
              fontWeight: FontWeight.w300,
              fontFeatures: [FontFeature.tabularFigures()],
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'This is when your alarm will ring every day. '
            'Run the test below to hear it and see it.',
            style: TextStyle(color: Colors.white70, fontSize: 13, height: 1.4),
          ),
        ],
      ),
    );
  }

  Widget _buildStep(_Step step) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(step.icon, size: 20, color: AppColors.primary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  step.title,
                  style: const TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  step.body,
                  style: TextStyle(
                    fontSize: 12.5,
                    height: 1.45,
                    color: AppColors.mutedForeground,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCountdown() {
    final done = _secondsLeft <= 0;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.amber.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.amber.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          Icon(
            done ? Icons.notifications_active_rounded : Icons.timer_outlined,
            size: 20,
            color: AppColors.amber,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              done
                  ? 'Alarm sent! Lock your phone or go to the home screen now.'
                  : 'Ringing in $_secondsLeft second${_secondsLeft == 1 ? '' : 's'} — '
                        'lock your phone or go to the home screen now.',
              style: const TextStyle(
                fontSize: 12.5,
                height: 1.4,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTipCard() {
    return Container(
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
              Icon(Icons.volume_up_rounded, size: 18, color: AppColors.primary),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'If you cannot hear the alarm',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '• Turn the alarm volume up on your phone\n'
            '• Allow notifications and "Alarms & reminders" when your phone asks\n'
            '• Turn off Do Not Disturb, or allow alarms through it\n'
            '• Keep the phone off battery saver',
            style: TextStyle(
              fontSize: 12.5,
              height: 1.6,
              color: AppColors.mutedForeground,
            ),
          ),
        ],
      ),
    );
  }
}

class _Step {
  final IconData icon;
  final String title;
  final String body;

  const _Step(this.icon, this.title, this.body);
}

const List<_Step> _steps = [
  _Step(
    Icons.alarm_rounded,
    '1. Your phone rings',
    'At your reminder time the alarm sound plays and your phone vibrates, '
        'even if your phone is on silent mode.',
  ),
  _Step(
    Icons.fullscreen_rounded,
    '2. A full-screen alert appears',
    'The alert takes over the whole screen so you cannot miss it — your '
        'phone can even be locked or the app closed.',
  ),
  _Step(
    Icons.check_circle_rounded,
    '3. Log your dose',
    'Tap "I took my dose" to record it, or "Snooze 5 minutes" if you need a '
        'little more time before breakfast.',
  ),
];
