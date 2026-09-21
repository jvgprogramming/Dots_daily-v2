import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/medication.dart';
import '../providers/medications_provider.dart';
import '../services/notification_service.dart';
import '../theme/app_theme.dart';

class AlarmsPage extends StatefulWidget {
  final ValueChanged<String>? onViewChange;

  const AlarmsPage({super.key, this.onViewChange});

  @override
  State<AlarmsPage> createState() => _AlarmsPageState();
}

class _AlarmsPageState extends State<AlarmsPage> {
  @override
  Widget build(BuildContext context) {
    final meds = context.watch<MedicationsProvider>();
    final alarms = List<Alarm>.from(meds.alarms)
      ..sort((a, b) => a.time.compareTo(b.time));

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: RefreshIndicator(
        onRefresh: () async {},
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            _buildClockHeader(meds),
            const SizedBox(height: 16),
            _buildAddButton(context),
            const SizedBox(height: 20),

            // Section title
            Padding(
              padding: const EdgeInsets.only(left: 4, bottom: 10),
              child: Row(
                children: [
                  const Text(
                    'Your alarms',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: AppColors.foreground,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    '${meds.activeAlarmCount} active',
                    style: TextStyle(
                      fontSize: 13,
                      color: AppColors.mutedForeground,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),

            if (alarms.isEmpty)
              _buildEmptyState(context)
            else
              ...alarms.map((alarm) => _AlarmCard(
                    alarm: alarm,
                    onToggle: () async {
                      meds.toggleAlarm(alarm.id);
                      if (alarm.enabled) {
                        await NotificationService().cancel(_hashId(alarm.id));
                      } else {
                        await _scheduleAlarmNotification(alarm);
                      }
                    },
                    onTap: () => _showAlarmSheet(context, existing: alarm),
                    onDelete: () async {
                      meds.deleteAlarm(alarm.id);
                      await NotificationService().cancel(_hashId(alarm.id));
                    },
                  )),

            const SizedBox(height: 24),
            _buildTipsCard(),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  // ---------- Header with live clock ----------

  Widget _buildClockHeader(MedicationsProvider meds) {
    final next = meds.nextAlarm;
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
          Row(
            children: [
              const Icon(Icons.alarm_on_rounded, color: Colors.white, size: 20),
              const SizedBox(width: 8),
              const Text(
                'MEDICATION ALARMS',
                style: TextStyle(
                  color: Colors.white70,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                ),
              ),
              const Spacer(),
              Text(
                _formatClock(),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  fontFeatures: [FontFeature.tabularFigures()],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      next != null ? next.displayTime : '--:-- --',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 40,
                        height: 1.0,
                        fontWeight: FontWeight.w300,
                        fontFeatures: [FontFeature.tabularFigures()],
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      next != null
                          ? 'Next: ${next.medicationName}'
                          : 'No alarms scheduled',
                      style: const TextStyle(color: Colors.white70, fontSize: 13),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
                ),
                child: const Icon(
                  Icons.notifications_active_rounded,
                  color: Colors.white,
                  size: 26,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _formatClock() {
    final now = DateTime.now();
    final h = now.hour == 0 ? 12 : (now.hour > 12 ? now.hour - 12 : now.hour);
    return '${h.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')} '
        '${now.hour >= 12 ? 'PM' : 'AM'}';
  }

  // ---------- Add button ----------

  Widget _buildAddButton(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: FilledButton.icon(
        onPressed: () => _showAlarmSheet(context),
        icon: const Icon(Icons.add_alarm_rounded),
        label: const Text(
          'Add new alarm',
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
        ),
        style: FilledButton.styleFrom(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
      ),
    );
  }

  // ---------- Empty state ----------

  Widget _buildEmptyState(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(32),
            ),
            child: const Icon(Icons.add_alarm, color: AppColors.primary, size: 30),
          ),
          const SizedBox(height: 14),
          const Text(
            'No alarms yet',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 6),
          const Text(
            'Create your first alarm so you never\nmiss a dose of your treatment.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, color: AppColors.mutedForeground, height: 1.4),
          ),
        ],
      ),
    );
  }

  // ---------- Tips card ----------

  Widget _buildTipsCard() {
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
              Icon(Icons.tips_and_updates_outlined, size: 18, color: AppColors.primary),
              SizedBox(width: 8),
              Text(
                'Alarms ring even when the app is closed',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Alarms use Android exact alarms with a full-screen alert and looping '
            'alarm sound. Allow "Alarms & reminders" and notifications when '
            'prompted. Snoozing reschedules the alarm 5 minutes ahead.',
            style: TextStyle(
              fontSize: 12.5,
              color: AppColors.mutedForeground,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  // ---------- Notification scheduling ----------

  int _hashId(String id) => id.hashCode & 0x7FFFFFFF;

  Future<void> _scheduleAlarmNotification(Alarm alarm) async {
    final (h, m) = alarm.timeParts;
    final service = NotificationService();
    try {
      await service.scheduleWeeklyAlarm(
        id: _hashId(alarm.id),
        title: '⏰ ${alarm.label}',
        body: 'Time to take ${alarm.medicationName}',
        hour: h,
        minute: m,
        dayNames: alarm.days,
        payload: 'alarm:${alarm.id}',
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not schedule alarm: $e')),
        );
      }
    }
  }

  // ---------- Add/Edit alarm bottom sheet ----------

  Future<void> _showAlarmSheet(BuildContext context, {Alarm? existing}) async {
    final meds = context.read<MedicationsProvider>();
    final isEdit = existing != null;

    final result = await showModalBottomSheet<Alarm>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => _AlarmEditorSheet(existing: existing),
    );

    if (result == null) return;

    if (isEdit) {
      // Remove old schedule; a changed id (time-based) needs cancelling too.
      await NotificationService().cancel(_hashId(existing.id));
      meds.deleteAlarm(existing.id);
    }

    meds.upsertAlarm(result);

    if (result.enabled) {
      await _scheduleAlarmNotification(result);
    }
  }
}

// =====================================================================
// Alarm list card
// =====================================================================

class _AlarmCard extends StatelessWidget {
  final Alarm alarm;
  final VoidCallback onToggle;
  final VoidCallback onTap;
  final VoidCallback onDelete;

  const _AlarmCard({
    required this.alarm,
    required this.onToggle,
    required this.onTap,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final color = alarm.enabled ? AppColors.primary : Colors.grey.shade400;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: alarm.enabled ? AppColors.primary.withValues(alpha: 0.25) : AppColors.border,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: onTap,
          onLongPress: onDelete,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                // Time + info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        alarm.displayTime,
                        style: TextStyle(
                          fontSize: 30,
                          fontWeight: FontWeight.w600,
                          height: 1.0,
                          color: color,
                          fontFeatures: const [FontFeature.tabularFigures()],
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '${alarm.label} • ${alarm.medicationName}',
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        alarm.repeatSummary,
                        style: TextStyle(fontSize: 12, color: AppColors.mutedForeground),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Switch.adaptive(
                  value: alarm.enabled,
                  activeThumbColor: AppColors.primary,
                  onChanged: (_) => onToggle(),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// =====================================================================
// Add/Edit sheet
// =====================================================================

class _AlarmEditorSheet extends StatefulWidget {
  final Alarm? existing;

  const _AlarmEditorSheet({this.existing});
  @override
  State<_AlarmEditorSheet> createState() => _AlarmEditorSheetState();
}

class _AlarmEditorSheetState extends State<_AlarmEditorSheet> {
  static const _dayCodes = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  late TimeOfDay _time;
  late TextEditingController _label;
  late String _medication;
  late List<String> _days;
  late bool _enabled;

  static const _allMeds = [
    'Rifampicin 600mg',
    'Isoniazid 300mg',
    'Pyrazinamide 1500mg',
    'Ethambutol 1200mg',
    'Pyridoxine (Vitamin B6) 25mg',
  ];

  @override
  void initState() {
    super.initState();
    final a = widget.existing;
    _time = a != null ? _parse(a.time) : const TimeOfDay(hour: 8, minute: 0);
    _label = TextEditingController(text: a?.label ?? 'Medication reminder');
    _medication = a?.medicationName ?? _allMeds.first;
    if (a != null && !_allMeds.contains(a.medicationName)) _medication = a.medicationName;
    _days = a != null ? List.from(a.days) : List.from(_dayCodes);
    _enabled = a?.enabled ?? true;
  }

  TimeOfDay _parse(String time) {
    final (h, m) = Alarm(
      id: 'parse',
      medicationId: '',
      medicationName: '',
      time: time,
      enabled: false,
    ).timeParts;
    return TimeOfDay(hour: h, minute: m);
  }

  @override
  void dispose() {
    _label.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: Container(
        decoration: const BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Grabber + title
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.mutedForeground.withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 14),
            Text(
              widget.existing != null ? 'Edit alarm' : 'New alarm',
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 18),

            // Time selector (big tappable display)
            GestureDetector(
              onTap: _pickTime,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 18),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.06),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.primary.withValues(alpha: 0.25)),
                ),
                child: Column(
                  children: [
                    Text(
                      _fmt(_time),
                      style: const TextStyle(
                        fontSize: 44,
                        fontWeight: FontWeight.w300,
                        color: AppColors.foreground,
                        fontFeatures: [FontFeature.tabularFigures()],
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Tap to change time',
                      style: TextStyle(fontSize: 11, color: AppColors.mutedForeground),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Label
            const Text('Label', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            TextField(
              controller: _label,
              decoration: const InputDecoration(hintText: 'e.g. Morning dose'),
            ),
            const SizedBox(height: 16),

            // Medication picker
            const Text('Medication', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              initialValue: _medication,
              items: _allMeds
                  .map((m) => DropdownMenuItem(value: m, child: Text(m)))
                  .toList(),
              onChanged: (v) => setState(() => _medication = v ?? _medication),
              decoration: const InputDecoration(prefixIcon: Icon(Icons.medication_rounded)),
            ),
            const SizedBox(height: 16),

            // Repeat days
            Row(
              children: [
                const Text('Repeat', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                const Spacer(),
                TextButton(
                  onPressed: () => setState(() => _days = List.from(_dayCodes)),
                  child: const Text('Every day'),
                ),
                TextButton(
                  onPressed: () => setState(() => _days = []),
                  child: const Text('Once'),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Row(
              children: List.generate(7, (i) {
                final code = _dayCodes[i];
                final selected = _days.contains(code);
                return Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() {
                      selected ? _days.remove(code) : _days.add(code);
                    }),
                    child: Container(
                      margin: EdgeInsets.only(right: i == 6 ? 0 : 6),
                      height: 38,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: selected ? AppColors.primary : AppColors.surface,
                        border: Border.all(
                          color: selected ? AppColors.primary : AppColors.border,
                        ),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        code[0], // M T W T F S S
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: selected ? Colors.white : AppColors.mutedForeground,
                        ),
                      ),
                    ),
                  ),
                );
              }),
            ),
            const SizedBox(height: 16),

            // Enabled toggle
            Row(
              children: [
                const Text('Enabled', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                const Spacer(),
                Switch.adaptive(
                  value: _enabled,
                  activeThumbColor: AppColors.primary,
                  onChanged: (v) => setState(() => _enabled = v),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Actions
            Row(
              children: [
                if (widget.existing != null)
                  IconButton(
                    onPressed: () => Navigator.pop(context, null),
                    icon: const Icon(Icons.delete_outline, color: AppColors.destructive),
                    tooltip: 'Delete',
                  ),
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context, null),
                    child: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  flex: 2,
                  child: FilledButton(
                    onPressed: _save,
                    child: Text(widget.existing != null ? 'Save changes' : 'Create alarm'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _fmt(TimeOfDay t) {
    final h = t.hour == 0 ? 12 : (t.hour > 12 ? t.hour - 12 : t.hour);
    return '${h.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')} '
        '${t.hour >= 12 ? 'PM' : 'AM'}';
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _time,
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme: Theme.of(context).colorScheme.copyWith(primary: AppColors.primary),
        ),
        child: child!,
      ),
    );
    if (picked != null) setState(() => _time = picked);
  }

  void _save() {
    final time24 =
        '${_time.hour.toString().padLeft(2, '0')}:${_time.minute.toString().padLeft(2, '0')}';
    final label = _label.text.trim().isEmpty ? 'Medication reminder' : _label.text.trim();

    final alarm = Alarm(
      id: widget.existing?.id ?? 'custom-${DateTime.now().millisecondsSinceEpoch}',
      medicationId: widget.existing?.medicationId ?? 'custom',
      medicationName: _medication,
      time: time24,
      enabled: _enabled,
      days: _days,
      label: label,
    );
    Navigator.pop(context, alarm);
  }
}
