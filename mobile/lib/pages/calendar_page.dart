import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/medication.dart';
import '../providers/medications_provider.dart';
import '../theme/app_theme.dart';

const List<String> _monthsShort = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/// Month view of every day the patient logged their medicine, so adherence is
/// obvious at a glance and any day can be opened for the details.
class CalendarPage extends StatefulWidget {
  final ValueChanged<String>? onViewChange;

  const CalendarPage({super.key, this.onViewChange});

  @override
  State<CalendarPage> createState() => _CalendarPageState();
}

class _CalendarPageState extends State<CalendarPage> {
  /// First day of the visible month.
  late DateTime _month;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _month = DateTime(now.year, now.month);
  }

  bool get _canGoForward {
    final now = DateTime.now();
    return _month.isBefore(DateTime(now.year, now.month));
  }

  void _changeMonth(int delta) {
    if (delta > 0 && !_canGoForward) return;
    setState(() => _month = DateTime(_month.year, _month.month + delta));
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
          _buildHeader(meds),
          const SizedBox(height: 16),
          if (meds.syncError != null || meds.unsyncedCount > 0) ...[
            _buildSyncNotice(meds),
            const SizedBox(height: 16),
          ],
          _buildSummary(meds),
          const SizedBox(height: 16),
          _buildMonthGrid(meds),
          const SizedBox(height: 16),
          _buildLegend(),
        ],
      ),
    );
  }

  Widget _buildHeader(MedicationsProvider meds) {
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
              Icon(Icons.calendar_month_rounded, color: Colors.white, size: 20),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'TREATMENT CALENDAR',
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
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: Text(
                  _monthLabel,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 26,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              _MonthButton(
                icon: Icons.chevron_left_rounded,
                onTap: () => _changeMonth(-1),
              ),
              const SizedBox(width: 8),
              _MonthButton(
                icon: Icons.chevron_right_rounded,
                onTap: _canGoForward ? () => _changeMonth(1) : null,
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            '${meds.takenCountInMonth(_month)} days logged this month',
            style: const TextStyle(color: Colors.white70, fontSize: 13),
          ),
        ],
      ),
    );
  }

  /// Reports an unreachable backend or doses still waiting to sync.
  ///
  /// The app keeps working on local data when the server is away, so without
  /// this the calendar would quietly show doses the web app never received.
  Widget _buildSyncNotice(MedicationsProvider meds) {
    final pending = meds.unsyncedCount;
    final message =
        meds.syncError ??
        'Syncing $pending ${pending == 1 ? 'dose' : 'doses'}…';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.amber.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.amber.withValues(alpha: 0.45)),
      ),
      child: Row(
        children: [
          const Icon(Icons.cloud_off_rounded, size: 18, color: AppColors.amber),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(fontSize: 12.5, height: 1.35),
            ),
          ),
          if (pending > 0)
            TextButton(
              onPressed: meds.isSyncing ? null : () => meds.refresh(),
              child: const Text('Retry'),
            ),
        ],
      ),
    );
  }

  Widget _buildSummary(MedicationsProvider meds) {
    return Row(
      children: [
        Expanded(
          child: _SummaryTile(
            label: 'Taken',
            value: '${meds.takenCountInMonth(_month)}',
            color: AppColors.primary,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _SummaryTile(
            label: 'Missed',
            value: '${meds.missedCountInMonth(_month)}',
            color: AppColors.destructive,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _SummaryTile(
            label: 'Adherence',
            value: '${meds.adherenceInMonth(_month).round()}%',
            color: AppColors.amber,
          ),
        ),
      ],
    );
  }

  Widget _buildMonthGrid(MedicationsProvider meds) {
    final firstOfMonth = DateTime(_month.year, _month.month);
    final daysInMonth = DateTime(_month.year, _month.month + 1, 0).day;
    final leadingBlanks = firstOfMonth.weekday % 7; // Sunday-first

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 14, 12, 16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          Row(
            children: [
              for (final label in const ['S', 'M', 'T', 'W', 'T', 'F', 'S'])
                Expanded(
                  child: Center(
                    child: Text(
                      label,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: AppColors.mutedForeground,
                      ),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          GridView.count(
            crossAxisCount: 7,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 5,
            crossAxisSpacing: 5,
            childAspectRatio: 0.92,
            children: [
              for (var i = 0; i < leadingBlanks; i++) const SizedBox.shrink(),
              for (var day = 1; day <= daysInMonth; day++)
                _buildDayCell(meds, DateTime(_month.year, _month.month, day)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDayCell(MedicationsProvider meds, DateTime day) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final isToday = day == today;
    final isFuture = day.isAfter(today);
    final beforeStart = day.isBefore(meds.regimenStart);

    final logs = meds.logsOnDay(day);
    // A day the backend recorded as `missed` carries a log row but no dose, so it
    // has to render as missed rather than as a logged one.
    final doses = logs.where((log) => !log.isMissed).toList();
    final taken = doses.isNotEmpty;
    final unverified = doses.any((log) => !log.verified);
    final missed = !taken && !isFuture && !beforeStart;

    Color background = Colors.transparent;
    Color foreground = AppColors.foreground;
    Color borderColor = Colors.transparent;
    Widget? marker;

    if (taken && !unverified) {
      background = AppColors.primary;
      foreground = Colors.white;
      marker = const Icon(Icons.check_rounded, size: 10, color: Colors.white);
    } else if (unverified) {
      background = AppColors.amber.withValues(alpha: 0.18);
      foreground = AppColors.amber;
      borderColor = AppColors.amber.withValues(alpha: 0.6);
      marker = const Icon(
        Icons.schedule_rounded,
        size: 10,
        color: AppColors.amber,
      );
    } else if (missed) {
      background = AppColors.destructive.withValues(alpha: 0.08);
      foreground = AppColors.mutedForeground;
      borderColor = AppColors.destructive.withValues(alpha: 0.4);
    } else {
      // Future days and days before the regimen started.
      foreground = AppColors.mutedForeground.withValues(alpha: 0.45);
    }

    return Material(
      color: Colors.transparent,
      child: InkWell(
        // Future days and days before the regimen started have no history.
        onTap: (isFuture || beforeStart)
            ? null
            : () => _showDaySheet(day, doses),
        borderRadius: BorderRadius.circular(10),
        child: Container(
          decoration: BoxDecoration(
            color: background,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isToday ? AppColors.primaryDark : borderColor,
              width: isToday ? 2 : 1,
            ),
          ),
          // Scales down rather than overflowing when the system text size is
          // large or the phone is narrow.
          child: Center(
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Padding(
                padding: const EdgeInsets.all(2),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '${day.day}',
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: foreground,
                      ),
                    ),
                    ?marker,
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLegend() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: const Wrap(
        spacing: 18,
        runSpacing: 10,
        children: [
          _LegendDot(color: AppColors.primary, label: 'Taken'),
          _LegendDot(color: AppColors.amber, label: 'Not verified'),
          _LegendDot(color: AppColors.destructive, label: 'Missed'),
          _LegendDot(color: AppColors.primaryDark, label: 'Today', ring: true),
        ],
      ),
    );
  }

  // ---------- Day detail ----------

  /// [doses] are only the doses actually taken — a day the backend marked
  /// `missed` correctly arrives here empty, so it offers the backfill action.
  Future<void> _showDaySheet(DateTime day, List<DoseLog> doses) async {
    // Without an assigned regimen the backend would have nothing to record the
    // dose against, so the action is withheld rather than failing on tap.
    final canLog = context.read<MedicationsProvider>().canLogDoses;

    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.surface,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (sheetContext) => SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _longDate(day),
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  doses.isEmpty
                      ? 'No dose logged for this day'
                      : '${doses.length} dose${doses.length == 1 ? '' : 's'} logged',
                  style: TextStyle(
                    fontSize: 13,
                    color: AppColors.mutedForeground,
                  ),
                ),
                const SizedBox(height: 16),
                if (doses.isEmpty) ...[
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.destructive.withValues(alpha: 0.06),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: AppColors.destructive.withValues(alpha: 0.3),
                      ),
                    ),
                    child: const Text(
                      'You did not record taking your medicine on this day.',
                      style: TextStyle(
                        fontSize: 13,
                        color: AppColors.foreground,
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: FilledButton.icon(
                      onPressed: canLog
                          ? () => _logMissedDose(sheetContext, day)
                          : null,
                      icon: const Icon(Icons.add_task_rounded, size: 20),
                      label: const Text(
                        'Log this dose',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      style: FilledButton.styleFrom(
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    canLog
                        ? 'Use this if you took your medicine but forgot to log '
                              'it. It is saved as pending until it is verified.'
                        : 'No active treatment regimen is assigned to your '
                              'account yet, so a dose cannot be logged.',
                    style: TextStyle(
                      fontSize: 12,
                      height: 1.4,
                      color: AppColors.mutedForeground,
                    ),
                  ),
                ] else
                  ...doses.map(_buildLogTile),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLogTile(DoseLog log) {
    final verified = log.verified;
    final color = verified ? AppColors.emerald : AppColors.amber;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Icon(
              verified ? Icons.check_circle_rounded : Icons.schedule_rounded,
              color: color,
              size: 18,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  log.medicationName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 13.5,
                  ),
                ),
                const SizedBox(height: 1),
                Text(
                  log.formattedDateTime,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 12,
                    color: AppColors.mutedForeground,
                  ),
                ),
                if (log.notes != null && log.notes!.trim().isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    log.notes!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.mutedForeground,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              verified ? 'Verified' : 'Pending',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: color,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ---------- Formatting ----------

  String get _monthLabel {
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    return '${months[_month.month - 1]} ${_month.year}';
  }

  String _longDate(DateTime day) {
    const weekdays = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ];
    return '${weekdays[day.weekday - 1]}, ${_monthsShort[day.month - 1]} '
        '${day.day}, ${day.year}';
  }

  String _monthDay(DateTime day) => '${_monthsShort[day.month - 1]} ${day.day}';

  /// Records a dose the patient forgot to log, then refreshes the month view.
  void _logMissedDose(BuildContext sheetContext, DateTime day) {
    final log = context.read<MedicationsProvider>().logDoseOn(day);
    Navigator.of(sheetContext).pop();

    if (log == null || !mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Dose logged for ${_monthDay(day)}'),
        backgroundColor: AppColors.emerald,
      ),
    );
  }
}

// =====================================================================
// Small pieces
// =====================================================================

class _MonthButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;

  const _MonthButton({required this.icon, this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: onTap == null ? 0.08 : 0.2),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: SizedBox(
          width: 38,
          height: 38,
          child: Icon(
            icon,
            color: Colors.white.withValues(alpha: onTap == null ? 0.4 : 1),
            size: 22,
          ),
        ),
      ),
    );
  }
}

class _SummaryTile extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _SummaryTile({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              color: AppColors.mutedForeground,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

class _LegendDot extends StatelessWidget {
  final Color color;
  final String label;
  final bool ring;

  const _LegendDot({
    required this.color,
    required this.label,
    this.ring = false,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 14,
          height: 14,
          decoration: BoxDecoration(
            color: ring ? Colors.transparent : color,
            shape: BoxShape.circle,
            border: ring ? Border.all(color: color, width: 2) : null,
          ),
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            color: AppColors.mutedForeground,
          ),
        ),
      ],
    );
  }
}
