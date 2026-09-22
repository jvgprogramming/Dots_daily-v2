import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/medication.dart';
import '../providers/medications_provider.dart';
import '../providers/auth_provider.dart';
import '../theme/app_theme.dart';
import 'alarm_ringing_page.dart';

/// `February 16, 2026`-style date for the follow-up card.
String _formatFollowUpDate(DateTime date) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December',
  ];
  return '${months[date.month - 1]} ${date.day}, ${date.year}';
}

class DashboardPage extends StatefulWidget {
  final ValueChanged<String>? onViewChange;

  const DashboardPage({super.key, this.onViewChange});

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  /// First day of the month the home calendar shows.
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

  @override
  Widget build(BuildContext context) {
    final meds = context.watch<MedicationsProvider>();
    final auth = context.watch<AuthProvider>();
    final user = auth.user;

    final now = DateTime.now();
    final today =
        '${_weekdayName(now.weekday)}, ${_monthName(now.month)} ${now.day}, ${now.year}';
    final todayAlarms = meds.upcomingAlarms.take(3).toList();

    return RefreshIndicator(
      onRefresh: () => meds.refresh(),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.zero,
        children: [
          // Hero Section
          _buildHeroSection(context, user?.fullName ?? '', today, meds),
          const SizedBox(height: 12),

          // Content section
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Next dose + alarm preview
                _buildNextDoseCard(context, meds),
                const SizedBox(height: 16),

                // Treatment calendar with day-status legend
                _buildTreatmentCalendar(meds),
                const SizedBox(height: 16),

                // Today's doses (upcoming reminders only)
                _buildTodayDoses(context, todayAlarms),
                const SizedBox(height: 32),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeroSection(
    BuildContext context,
    String userName,
    String today,
    MedicationsProvider meds,
  ) {
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: AppColors.primaryGradient,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Stack(
        children: [
          // Decorative circles
          Positioned(
            top: 10,
            right: 20,
            child: Container(
              width: 80,
              height: 80,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0x19FFFFFF),
              ),
            ),
          ),
          Positioned(
            top: 50,
            left: 10,
            child: Container(
              width: 100,
              height: 100,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0x19FFFFFF),
              ),
            ),
          ),
          Positioned(
            bottom: 60,
            right: 60,
            child: Container(
              width: 50,
              height: 50,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0x19FFFFFF),
              ),
            ),
          ),

          Padding(
            // Top inset keeps the avatar row clear of the status bar / notch,
            // the same way the navigation header does.
            padding: EdgeInsets.fromLTRB(
              16,
              MediaQuery.of(context).padding.top + 16,
              16,
              40,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Welcome row
                Row(
                  children: [
                    Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(26),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.15),
                            blurRadius: 8,
                          ),
                        ],
                      ),
                      child: const Icon(
                        Icons.person,
                        color: AppColors.primary,
                        size: 26,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Welcome back,',
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.8),
                              fontSize: 13,
                            ),
                          ),
                          Text(
                            userName,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            today,
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.75),
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                    // Settings icon
                    GestureDetector(
                      onTap: () => widget.onViewChange?.call('profile'),
                      child: Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(21),
                        ),
                        child: const Icon(
                          Icons.settings,
                          color: Colors.white,
                          size: 20,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Treatment status card
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.2),
                    ),
                    borderRadius: BorderRadius.circular(20),
                    color: Colors.white.withValues(alpha: 0.15),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(
                            Icons.shield,
                            size: 16,
                            color: Colors.white,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'TREATMENT STATUS',
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.9),
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 1.2,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      LayoutBuilder(
                        builder: (context, constraints) {
                          final bool isNarrow = constraints.maxWidth < 300;
                          if (isNarrow) {
                            return Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '${meds.progressPercentage}%',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 36,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                Text(
                                  meds.totalScheduledDays != null
                                      ? '${meds.treatmentDays} of ${meds.totalScheduledDays} days taken'
                                      : '${meds.treatmentDays} days taken',
                                  style: TextStyle(
                                    color: Colors.white.withValues(alpha: 0.8),
                                    fontSize: 11,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Row(
                                  children: [
                                    Icon(
                                      Icons.local_fire_department,
                                      size: 14,
                                      color: Colors.white.withValues(
                                        alpha: 0.7,
                                      ),
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      '${meds.doseLogs.length} day streak',
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            );
                          }
                          return Row(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Flexible(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      '${meds.progressPercentage}%',
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 36,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    Text(
                                      meds.totalScheduledDays != null
                                          ? '${meds.treatmentDays} of ${meds.totalScheduledDays} days taken'
                                          : '${meds.treatmentDays} days taken',
                                      style: TextStyle(
                                        color:
                                            Colors.white.withValues(alpha: 0.8),
                                        fontSize: 11,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 6,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                      'STREAK',
                                      style: TextStyle(
                                        color: Colors.white
                                            .withValues(alpha: 0.7),
                                        fontSize: 8,
                                        letterSpacing: 1,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                    const SizedBox(height: 1),
                                    Text(
                                      '${meds.doseLogs.length}d',
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 14,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          );
                        },
                      ),
                      const SizedBox(height: 12),
                      // Progress bar
                      ClipRRect(
                        borderRadius: BorderRadius.circular(6),
                        child: Container(
                          height: 8,
                          color: Colors.white.withValues(alpha: 0.2),
                          child: FractionallySizedBox(
                            alignment: Alignment.centerLeft,
                            widthFactor: (meds.treatmentDays / 180).clamp(
                              0.0,
                              1.0,
                            ),
                            child: Container(
                              decoration: const BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [Colors.white, Color(0xFFBBF7D0)],
                                ),
                                borderRadius: BorderRadius.horizontal(
                                  right: Radius.circular(6),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Center(
                        child: Text(
                          'Complete your full course for successful recovery.',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.75),
                            fontSize: 11,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),

                // Next follow-up card
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.2),
                    ),
                    borderRadius: BorderRadius.circular(20),
                    color: Colors.white.withValues(alpha: 0.15),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(
                            Icons.calendar_today,
                            size: 16,
                            color: Colors.white,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'NEXT FOLLOW-UP',
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.9),
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 1.2,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        meds.nextFollowUpDate != null
                            ? _formatFollowUpDate(meds.nextFollowUpDate!)
                            : 'No follow-up scheduled',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        meds.nextFollowUpStatus == 'overdue'
                            ? 'A follow-up is overdue — contact your clinic.'
                            : meds.nextFollowUpStatus == 'due'
                                ? 'Your check-up is coming up soon.'
                                : 'Keep your review appointments on schedule.',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.8),
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'MEDICATION PLAN',
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.7),
                                fontSize: 9,
                                letterSpacing: 1,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              meds.upcomingMedicationNames.isNotEmpty
                                  ? meds.upcomingMedicationNames
                                  : 'Your medication list will appear here.',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Curved bottom
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: ClipRRect(
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(20),
                topRight: Radius.circular(20),
              ),
              child: Container(
                height: 20,
                color: AppColors.background,
                child: CustomPaint(
                  painter: _CurvePainter(AppColors.background),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNextDoseCard(BuildContext context, MedicationsProvider meds) {
    final next = meds.nextAlarm;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.25)),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.08),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: AppColors.primaryGradient),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(
              Icons.alarm_rounded,
              color: Colors.white,
              size: 26,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'NEXT DOSE',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.1,
                    color: AppColors.mutedForeground,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  next != null ? next.displayTime : 'No alarm set',
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    height: 1.1,
                  ),
                ),
                Text(
                  next != null
                      ? '${next.label} • ${next.medicationName}'
                      : 'Tap Reminder to set your time',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.mutedForeground,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          IconButton.outlined(
            onPressed: next == null
                ? null
                : () => AlarmRingingPage.open(context, next),
            tooltip: 'Preview alarm',
            icon: const Icon(Icons.play_circle_outline_rounded),
          ),
        ],
      ),
    );
  }

  // ---------- Treatment calendar ----------

  /// The month grid from the Calendar tab, simplified: the same taken /
  /// pending / missed coloring the clinic sees, with a legend underneath.
  Widget _buildTreatmentCalendar(MedicationsProvider meds) {
    final firstOfMonth = DateTime(_month.year, _month.month);
    final daysInMonth = DateTime(_month.year, _month.month + 1, 0).day;
    final leadingBlanks = firstOfMonth.weekday % 7; // Sunday-first

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.25)),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.08),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.calendar_month_rounded,
                size: 18,
                color: AppColors.primary,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  _monthLabel,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              _MiniMonthButton(
                icon: Icons.chevron_left_rounded,
                onTap: () => _changeMonth(-1),
              ),
              const SizedBox(width: 8),
              _MiniMonthButton(
                icon: Icons.chevron_right_rounded,
                onTap: _canGoForward ? () => _changeMonth(1) : null,
              ),
            ],
          ),
          const SizedBox(height: 14),
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
          const SizedBox(height: 6),
          GridView.count(
            crossAxisCount: 7,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 4,
            crossAxisSpacing: 4,
            childAspectRatio: 1.0,
            children: [
              for (var i = 0; i < leadingBlanks; i++) const SizedBox.shrink(),
              for (var day = 1; day <= daysInMonth; day++)
                _buildDayCell(meds, DateTime(_month.year, _month.month, day)),
            ],
          ),
          const SizedBox(height: 12),
          const Wrap(
            spacing: 14,
            runSpacing: 8,
            children: [
              _LegendDot(
                color: AppColors.primary,
                label: 'Taken',
              ),
              _LegendDot(
                color: AppColors.amber,
                label: 'Pending',
                ring: true,
              ),
              _LegendDot(color: AppColors.destructive, label: 'Missed'),
              _LegendDot(color: AppColors.primaryDark, label: 'Today', ring: true),
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

    final doses = meds.dosesOnDay(day);
    final taken = doses.isNotEmpty;
    final unverified = doses.any((log) => !log.verified);
    final missed = !taken && !isFuture && !beforeStart;

    Color background = Colors.transparent;
    Color foreground = AppColors.foreground;
    Color borderColor = Colors.transparent;

    if (taken && !unverified) {
      background = AppColors.primary;
      foreground = Colors.white;
    } else if (unverified) {
      background = AppColors.amber.withValues(alpha: 0.18);
      foreground = AppColors.amber;
      borderColor = AppColors.amber.withValues(alpha: 0.6);
    } else if (missed) {
      background = AppColors.destructive.withValues(alpha: 0.08);
      foreground = AppColors.mutedForeground;
      borderColor = AppColors.destructive.withValues(alpha: 0.4);
    } else {
      // Future days and days before the regimen started.
      foreground = AppColors.mutedForeground.withValues(alpha: 0.45);
    }

    return Container(
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(9),
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
            child: Text(
              '${day.day}',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: foreground,
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// A slim row of today's remaining doses, kept because the hero card
  /// replaced the old schedule section.
  Widget _buildTodayDoses(BuildContext context, List<Alarm> alarms) {
    if (alarms.isEmpty) {
      return const SizedBox.shrink();
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'TODAY',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.1,
              color: AppColors.mutedForeground,
            ),
          ),
          const SizedBox(height: 8),
          ...alarms.map(
            (alarm) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                children: [
                  const Icon(
                    Icons.access_time,
                    size: 16,
                    color: AppColors.primary,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '${alarm.displayTime} · ${alarm.medicationName}',
                      style: const TextStyle(fontSize: 13),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  TextButton(
                    onPressed: () => widget.onViewChange?.call('reminder'),
                    child: const Text('Details'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _weekdayName(int weekday) {
    const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return names[weekday - 1];
  }

  String _monthName(int month) {
    const names = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return names[month - 1];
  }

  String get _monthLabel {
    return '${_monthName(_month.month)} ${_month.year}';
  }
}

class _MiniMonthButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;

  const _MiniMonthButton({required this.icon, this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.primary.withValues(alpha: onTap == null ? 0.06 : 0.12),
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: SizedBox(
          width: 32,
          height: 32,
          child: Icon(
            icon,
            color: AppColors.primary,
            size: 20,
          ),
        ),
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
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: ring ? Colors.transparent : color,
            shape: BoxShape.circle,
            border: ring ? Border.all(color: color, width: 2) : null,
          ),
        ),
        const SizedBox(width: 5),
        Text(
          label,
          style: const TextStyle(
            fontSize: 11.5,
            color: AppColors.mutedForeground,
          ),
        ),
      ],
    );
  }
}

class _CurvePainter extends CustomPainter {
  final Color color;

  _CurvePainter(this.color);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    final path = Path()
      ..moveTo(0, size.height)
      ..quadraticBezierTo(size.width / 2, -size.height, size.width, size.height)
      ..lineTo(size.width, 0)
      ..lineTo(0, 0)
      ..close();

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
