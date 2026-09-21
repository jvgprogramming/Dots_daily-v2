import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/medications_provider.dart';
import '../services/notification_service.dart';
import '../theme/app_theme.dart';
import 'alarm_demo_page.dart';

/// TB patients take all of their medicines together, once a day, before
/// breakfast — so instead of a list of alarms this screen simply lets the
/// patient pick the one time they want to be reminded each day.
class ReminderPage extends StatefulWidget {
  final ValueChanged<String>? onViewChange;

  const ReminderPage({super.key, this.onViewChange});

  @override
  State<ReminderPage> createState() => _ReminderPageState();
}

class _ReminderPageState extends State<ReminderPage> {
  TimeOfDay _time = const TimeOfDay(hour: 7, minute: 0);
  bool _enabled = true;
  bool _saving = false;
  Timer? _clock;

  int get _notificationId =>
      MedicationsProvider.reminderId.hashCode & 0x7FFFFFFF;

  @override
  void initState() {
    super.initState();

    final reminder = context.read<MedicationsProvider>().reminder;
    final (hour, minute) = reminder.timeParts;
    _time = TimeOfDay(hour: hour, minute: minute);
    _enabled = reminder.enabled;

    // Re-arm the saved reminder whenever this screen opens so the alarm keeps
    // firing even after the app or the device restarted.
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      try {
        await _applySchedule(_time, _enabled);
      } catch (e) {
        debugPrint('Could not restore the daily reminder: $e');
      }
    });

    // Keeps the "rings in …" line ticking.
    _clock = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _clock?.cancel();
    super.dispose();
  }

  // ---------- UI ----------

  @override
  Widget build(BuildContext context) {
    final meds = context.watch<MedicationsProvider>();

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
        children: [
          _buildHeader(),
          const SizedBox(height: 16),
          _buildTimeCard(),
          const SizedBox(height: 12),
          _buildEnabledCard(),
          const SizedBox(height: 18),
          _buildSaveButton(),
          const SizedBox(height: 10),
          _buildDemoButton(),
          const SizedBox(height: 22),
          _buildMedicinesCard(meds),
        ],
      ),
    );
  }

  Widget _buildHeader() {
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
              Expanded(
                child: Text(
                  'DAILY MEDICATION REMINDER',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.1,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            _fmt(_time),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 42,
              height: 1.0,
              fontWeight: FontWeight.w300,
              fontFeatures: [FontFeature.tabularFigures()],
            ),
          ),
          const SizedBox(height: 8),
          Text(
            _nextLabel(),
            style: const TextStyle(color: Colors.white70, fontSize: 13),
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Text(
              'Take your medicine before breakfast.',
              style: TextStyle(
                color: Colors.white,
                fontSize: 12.5,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTimeCard() {
    return GestureDetector(
      onTap: _pickTime,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 22, horizontal: 20),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.primary.withValues(alpha: 0.25)),
        ),
        child: Column(
          children: [
            Text(
              'REMIND ME AT',
              style: TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.2,
                color: AppColors.mutedForeground,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _fmt(_time),
              style: const TextStyle(
                fontSize: 46,
                fontWeight: FontWeight.w300,
                color: AppColors.foreground,
                fontFeatures: [FontFeature.tabularFigures()],
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Tap to choose a different time',
              style: TextStyle(
                fontSize: 11.5,
                color: AppColors.mutedForeground,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEnabledCard() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 6, 10, 6),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Remind me every day',
                  style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                Text(
                  'You get one reminder each morning.',
                  style: TextStyle(
                    fontSize: 12,
                    color: AppColors.mutedForeground,
                  ),
                ),
              ],
            ),
          ),
          Switch.adaptive(
            value: _enabled,
            activeThumbColor: AppColors.primary,
            onChanged: (v) => setState(() => _enabled = v),
          ),
        ],
      ),
    );
  }

  Widget _buildSaveButton() {
    return SizedBox(
      width: double.infinity,
      height: 54,
      child: FilledButton.icon(
        onPressed: _saving ? null : _save,
        icon: _saving
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Colors.white,
                ),
              )
            : const Icon(Icons.check_rounded),
        label: Text(
          _saving ? 'Saving…' : 'Save reminder',
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
        ),
        style: FilledButton.styleFrom(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
      ),
    );
  }

  Widget _buildDemoButton() {
    return SizedBox(
      width: double.infinity,
      height: 50,
      child: OutlinedButton.icon(
        onPressed: () => Navigator.of(
          context,
        ).push(MaterialPageRoute(builder: (_) => const AlarmDemoPage())),
        icon: const Icon(Icons.play_circle_outline_rounded),
        label: const Text(
          'See how your alarm works',
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        ),
        style: OutlinedButton.styleFrom(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
      ),
    );
  }

  Widget _buildMedicinesCard(MedicationsProvider meds) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Medicine in this reminder',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          Text(
            'Taken at your reminder time, before breakfast.',
            style: TextStyle(fontSize: 12, color: AppColors.mutedForeground),
          ),
          const SizedBox(height: 12),
          ...meds.medications.map(
            (m) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.medication_rounded,
                      size: 17,
                      color: AppColors.primary,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      m.name,
                      style: const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w500,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ---------- Behaviour ----------

  String _fmt(TimeOfDay t) {
    final h = t.hour == 0 ? 12 : (t.hour > 12 ? t.hour - 12 : t.hour);
    return '${h.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')} '
        '${t.hour >= 12 ? 'PM' : 'AM'}';
  }

  DateTime _nextOccurrence() {
    final now = DateTime.now();
    var next = DateTime(now.year, now.month, now.day, _time.hour, _time.minute);
    if (!next.isAfter(now)) next = next.add(const Duration(days: 1));
    return next;
  }

  String _nextLabel() {
    if (!_enabled) return 'Reminder is turned off';
    final diff = _nextOccurrence().difference(DateTime.now());
    final hours = diff.inHours;
    final minutes = diff.inMinutes % 60;
    if (hours >= 1) {
      return 'Rings in ${hours}h ${minutes.toString().padLeft(2, '0')}m';
    }
    return 'Rings in $minutes min';
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _time,
      helpText: 'Reminder time',
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme: Theme.of(
            context,
          ).colorScheme.copyWith(primary: AppColors.primary),
        ),
        child: child!,
      ),
    );
    if (picked != null) setState(() => _time = picked);
  }

  Future<void> _save() async {
    setState(() => _saving = true);

    final time24 =
        '${_time.hour.toString().padLeft(2, '0')}:'
        '${_time.minute.toString().padLeft(2, '0')}';
    context.read<MedicationsProvider>().updateReminder(
      time: time24,
      enabled: _enabled,
    );

    try {
      await _applySchedule(_time, _enabled);
      if (!mounted) return;
      _showSnack(
        _enabled
            ? 'Reminder saved for ${_fmt(_time)} every day'
            : 'Daily reminder turned off',
      );
    } catch (e) {
      if (!mounted) return;
      _showSnack('Could not schedule the reminder: $e', error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  /// (Re)schedules the single daily reminder notification.
  Future<void> _applySchedule(TimeOfDay time, bool enabled) async {
    final service = NotificationService();
    await service.cancel(_notificationId);
    if (!enabled) return;

    await service.scheduleDailyAlarm(
      id: _notificationId,
      title: '⏰ Time to take your medicines',
      body: 'Take your medicine now, before breakfast.',
      hour: time.hour,
      minute: time.minute,
      payload: 'alarm:${MedicationsProvider.reminderId}',
    );
  }

  void _showSnack(String message, {bool error = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: error ? AppColors.destructive : AppColors.emerald,
      ),
    );
  }
}
