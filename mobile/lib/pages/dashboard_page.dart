import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/medication.dart';
import '../providers/medications_provider.dart';
import '../providers/auth_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/motion.dart';
import 'alarm_ringing_page.dart';
import 'vot/vot_instructions_page.dart';

/// `February 16, 2026`-style date for the follow-up card.
String _formatFollowUpDate(DateTime date) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December',
  ];
  return '${months[date.month - 1]} ${date.day}, ${date.year}';
}

/// White at [alpha] — the translucent "glass" used on the green hero.
Color _glass(double alpha) => Colors.white.withValues(alpha: alpha);

class DashboardPage extends StatefulWidget {
  final ValueChanged<String>? onViewChange;

  const DashboardPage({super.key, this.onViewChange});

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  /// First day of the month the home calendar shows.
  late DateTime _month;

  /// Direction of the last month change (-1 back, 1 forward), so the grid
  /// slides in from the matching side.
  int _monthDirection = 0;

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
    setState(() {
      _monthDirection = delta;
      _month = DateTime(_month.year, _month.month + delta);
    });
  }

  BoxDecoration _cardDecoration(AppPalette p) => BoxDecoration(
        color: p.card,
        borderRadius: BorderRadius.circular(AppRadius.xl),
        border: Border.all(color: p.borderLight),
        boxShadow: p.cardShadow,
      );

  @override
  Widget build(BuildContext context) {
    final meds = context.watch<MedicationsProvider>();
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    final p = context.palette;

    final now = DateTime.now();
    final today =
        '${_weekdayName(now.weekday)}, ${_monthName(now.month)} ${now.day}, ${now.year}';
    final todayAlarms = meds.upcomingAlarms.take(3).toList();

    return RefreshIndicator(
      color: p.primary,
      backgroundColor: p.card,
      onRefresh: () => meds.refresh(),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.zero,
        children: [
          _buildHeroSection(context, p, user?.fullName ?? '', today, meds),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                FadeSlideIn(index: 2, child: _buildTodayDoseCard(context, p, meds)),
                if (meds.canLogDoses) const SizedBox(height: 16),
                FadeSlideIn(index: 3, child: _buildNextDoseCard(context, p, meds)),
                const SizedBox(height: 16),
                if (meds.isVotEnrolled) ...[
                  FadeSlideIn(index: 3, child: _buildVotCard(context, p, meds)),
                  const SizedBox(height: 16),
                ],
                FadeSlideIn(index: 4, child: _buildTreatmentCalendar(p, meds)),
                const SizedBox(height: 16),
                FadeSlideIn(index: 5, child: _buildTodayDoses(p, todayAlarms)),
                const SizedBox(height: 32),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ---------- Hero ----------

  Widget _buildHeroSection(
    BuildContext context,
    AppPalette p,
    String userName,
    String today,
    MedicationsProvider meds,
  ) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: p.heroGradient,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Stack(
        children: [
          const Positioned(top: -30, right: -20, child: _HeroCircle(size: 140)),
          const Positioned(top: 90, left: -40, child: _HeroCircle(size: 110)),
          const Positioned(bottom: 70, right: 50, child: _HeroCircle(size: 50)),

          Padding(
            // Top inset keeps the avatar row clear of the status bar / notch.
            padding: EdgeInsets.fromLTRB(
              16,
              MediaQuery.of(context).padding.top + 16,
              16,
              40,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                FadeSlideIn(child: _buildWelcomeRow(p, userName, today)),
                const SizedBox(height: 18),
                FadeSlideIn(index: 1, child: _buildStatusCard(meds)),
                const SizedBox(height: 12),
                FadeSlideIn(index: 2, child: _buildFollowUpCard(meds)),
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
                color: p.background,
                child: CustomPaint(painter: _CurvePainter(p.background)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWelcomeRow(AppPalette p, String userName, String today) {
    final initial = userName.trim().isNotEmpty
        ? userName.trim()[0].toUpperCase()
        : null;

    return Row(
      children: [
        Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(
            color: Colors.white,
            shape: BoxShape.circle,
            border: Border.all(color: _glass(0.35), width: 3),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.18),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          alignment: Alignment.center,
          child: initial != null
              ? Text(
                  initial,
                  style: TextStyle(
                    color: AppPalette.light.brandAction,
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                  ),
                )
              : Icon(Icons.person, color: AppPalette.light.brandAction),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Welcome back,',
                style: TextStyle(color: _glass(0.75), fontSize: 13),
              ),
              Text(
                userName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.3,
                ),
              ),
              Text(
                today,
                style: TextStyle(color: _glass(0.7), fontSize: 12),
              ),
            ],
          ),
        ),
        PressableScale(
          pressedScale: 0.9,
          child: Material(
            color: _glass(0.16),
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: () => widget.onViewChange?.call('profile'),
              child: const SizedBox(
                width: 42,
                height: 42,
                child: Icon(Icons.settings_rounded, color: Colors.white, size: 20),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildStatusCard(MedicationsProvider meds) {
    final daysLabel = meds.totalScheduledDays != null
        ? '${meds.treatmentDays} of ${meds.totalScheduledDays} days taken'
        : '${meds.treatmentDays} days taken';
    final progress = (meds.treatmentDays / 180).clamp(0.0, 1.0);

    return _GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _HeroLabel(icon: Icons.shield_rounded, text: 'TREATMENT STATUS'),
          const SizedBox(height: 12),
          LayoutBuilder(
            builder: (context, constraints) {
              final percent = AnimatedCount(
                value: meds.progressPercentage,
                suffix: '%',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 38,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -1,
                  height: 1.05,
                ),
              );
              final days = Text(
                daysLabel,
                style: TextStyle(color: _glass(0.8), fontSize: 12),
              );
              final streak = _StreakChip(days: meds.doseLogs.length);

              if (constraints.maxWidth < 300) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [percent, days, const SizedBox(height: 8), streak],
                );
              }
              return Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [percent, days],
                    ),
                  ),
                  const SizedBox(width: 8),
                  streak,
                ],
              );
            },
          ),
          const SizedBox(height: 14),
          // Progress bar that fills from empty when the screen opens.
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: Container(
              height: 8,
              color: _glass(0.18),
              child: TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: progress),
                duration: Motion.reduced(context)
                    ? Duration.zero
                    : const Duration(milliseconds: 1100),
                curve: Motion.emphasized,
                builder: (context, value, _) => FractionallySizedBox(
                  alignment: Alignment.centerLeft,
                  widthFactor: value,
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFFA7E2BE), Colors.white],
                      ),
                      borderRadius: BorderRadius.circular(6),
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            'Complete your full course for successful recovery.',
            style: TextStyle(color: _glass(0.75), fontSize: 11.5),
          ),
        ],
      ),
    );
  }

  Widget _buildFollowUpCard(MedicationsProvider meds) {
    final status = meds.nextFollowUpStatus;
    final isOverdue = status == 'overdue';

    return _GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: _HeroLabel(
                  icon: Icons.event_rounded,
                  text: 'NEXT FOLLOW-UP',
                ),
              ),
              if (status == 'overdue' || status == 'due')
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: isOverdue
                        ? const Color(0xFFFCEFEC)
                        : const Color(0xFFFBF3E2),
                    borderRadius: BorderRadius.circular(99),
                  ),
                  child: Text(
                    isOverdue ? 'Overdue' : 'Soon',
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w700,
                      color: isOverdue
                          ? const Color(0xFF8C3226)
                          : const Color(0xFF7C5713),
                    ),
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
              fontWeight: FontWeight.w700,
              letterSpacing: -0.3,
            ),
          ),
          Text(
            isOverdue
                ? 'A follow-up is overdue — contact your clinic.'
                : status == 'due'
                    ? 'Your check-up is coming up soon.'
                    : 'Keep your review appointments on schedule.',
            style: TextStyle(color: _glass(0.8), fontSize: 12),
          ),
          const SizedBox(height: 10),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: _glass(0.12),
              borderRadius: BorderRadius.circular(AppRadius.md + 2),
            ),
            child: Row(
              children: [
                Icon(Icons.medication_rounded, size: 18, color: _glass(0.85)),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'MEDICATION PLAN',
                        style: TextStyle(
                          color: _glass(0.7),
                          fontSize: 9.5,
                          letterSpacing: 1,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 2),
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
    );
  }

  // ---------- Next dose ----------

  // ---------- Today's dose (the main action) ----------

  /// The one clear "what do I do today" card: take today's dose, or — once it
  /// is logged — its current state. The dose can be taken any time during the
  /// day, so this lives on the home screen, not only on the alarm.
  Widget _buildTodayDoseCard(
    BuildContext context,
    AppPalette p,
    MedicationsProvider meds,
  ) {
    // No regimen assigned yet → nothing to take; keep the home screen clean.
    if (!meds.canLogDoses) return const SizedBox.shrink();

    if (meds.hasTakenToday) {
      return _todayDoneCard(p, meds);
    }
    return _todayActionCard(context, p, meds);
  }

  /// Not taken yet: a big primary action. VOT patients record proof; everyone
  /// else confirms with one tap.
  Widget _todayActionCard(
    BuildContext context,
    AppPalette p,
    MedicationsProvider meds,
  ) {
    final isVot = meds.isVotEnrolled;

    Future<void> onPressed() async {
      if (isVot) {
        final sent = await startVotFlow(context);
        if (sent && context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Dose recorded — your nurse will review it.')),
          );
        }
      } else {
        meds.logDoseOn(DateTime.now(), notes: 'Logged from home');
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Nice! Today\'s dose is logged.')),
          );
        }
      }
    }

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [p.brandAction, p.primary],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(AppRadius.xl),
        boxShadow: [
          BoxShadow(
            color: p.primary.withValues(alpha: 0.30),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionLabel("TODAY'S DOSE", color: _glass(0.8)),
          const SizedBox(height: 6),
          const Text(
            'You haven\'t taken it yet',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: Colors.white,
              height: 1.15,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            isVot
                ? 'Record yourself taking your medicine — any time today, preferably before lunch.'
                : 'Take your medicine any time today — preferably before lunch — then tap below.',
            style: TextStyle(fontSize: 13, height: 1.4, color: _glass(0.85)),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton.icon(
              onPressed: onPressed,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: p.primaryStrong,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              icon: Icon(
                isVot ? Icons.videocam_rounded : Icons.check_circle_rounded,
                size: 22,
              ),
              label: Text(
                isVot ? 'Record & take my dose' : 'Mark dose as taken',
                style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Already taken: confirmation + where it stands (plain log, or VOT review).
  Widget _todayDoneCard(AppPalette p, MedicationsProvider meds) {
    final today = DateTime.now();
    final votStatus = meds.todaysVotStatus;

    IconData icon = Icons.check_circle_rounded;
    Color tone = p.success;
    Color toneBg = p.successBg;
    String title = 'Dose taken today';
    String subtitle = 'Logged — your clinic can see it. See you tomorrow!';

    if (meds.isDayFlagged(today)) {
      icon = Icons.flag_rounded;
      tone = p.warning;
      toneBg = p.warningBg;
      title = 'Dose under review';
      subtitle = 'Your clinic is reviewing today\'s dose.';
    } else if (votStatus == 'uploading') {
      icon = Icons.cloud_upload_outlined;
      tone = p.warning;
      toneBg = p.warningBg;
      title = 'Recorded — uploading';
      subtitle = 'Your recording will reach your nurse once you\'re online.';
    } else if (votStatus == 'pending') {
      icon = Icons.hourglass_top_rounded;
      tone = p.warning;
      toneBg = p.warningBg;
      title = 'Waiting for nurse review';
      subtitle = 'You recorded today\'s dose — your nurse will verify it.';
    } else if (votStatus == 'verified') {
      icon = Icons.verified_rounded;
      title = 'Verified by your nurse';
      subtitle = 'Today\'s dose is confirmed. Well done!';
    } else if (votStatus == 'rejected' || votStatus == 'resubmission_required') {
      icon = Icons.error_outline_rounded;
      tone = p.danger;
      toneBg = p.dangerBg;
      title = 'A new recording is needed';
      subtitle = 'Your nurse asked for a new recording — see the card below.';
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: _cardDecoration(p),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: toneBg,
              borderRadius: BorderRadius.circular(AppRadius.lg),
            ),
            child: Icon(icon, color: tone, size: 26),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _SectionLabel("TODAY'S DOSE", color: p.textTertiary),
                const SizedBox(height: 3),
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: p.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: TextStyle(fontSize: 12.5, height: 1.35, color: p.textSecondary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNextDoseCard(
    BuildContext context,
    AppPalette p,
    MedicationsProvider meds,
  ) {
    final next = meds.nextAlarm;

    return PressableScale(
      enabled: next != null,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: _cardDecoration(p),
        child: Row(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [p.brandAction, p.primary],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(AppRadius.lg),
                boxShadow: [
                  BoxShadow(
                    color: p.primary.withValues(alpha: 0.3),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
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
                  _SectionLabel('NEXT DOSE', color: p.textTertiary),
                  const SizedBox(height: 3),
                  Text(
                    next != null ? next.displayTime : 'No alarm set',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                      height: 1.1,
                      letterSpacing: -0.4,
                      color: p.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    next != null
                        ? '${next.label} • ${next.medicationName}'
                        : 'Tap Reminder to set your time',
                    style: TextStyle(fontSize: 12, color: p.textSecondary),
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filledTonal(
              onPressed: next == null
                  ? null
                  : () => AlarmRingingPage.open(context, next),
              tooltip: 'Preview alarm',
              style: IconButton.styleFrom(
                backgroundColor: p.primarySoft,
                foregroundColor: p.primaryStrong,
              ),
              icon: const Icon(Icons.play_arrow_rounded),
            ),
          ],
        ),
      ),
    );
  }

  // ---------- Video-Observed Therapy ----------

  /// Where today's recorded dose stands with the nurse — or, when the nurse
  /// asked for it, a direct way to record again.
  Widget _buildVotCard(BuildContext context, AppPalette p, MedicationsProvider meds) {
    final needing = meds.doseNeedingProof;
    final today = meds.votStatusOn(DateTime.now());

    final Color tone;
    final Color toneBg;
    final IconData icon;
    final String title;
    final String body;

    if (needing != null) {
      tone = p.warning;
      toneBg = p.warningBg;
      icon = Icons.replay_rounded;
      title = needing.verificationStatus == 'awaiting_proof'
          ? 'Proof needed for ${needing.formattedDate}'
          : 'Please record ${needing.formattedDate} again';
      body = needing.reviewReason?.trim().isNotEmpty == true
          ? 'Your nurse: ${needing.reviewReason}'
          : 'Your nurse needs a recording of this dose.';
    } else if (today == 'verified') {
      tone = p.success;
      toneBg = p.successBg;
      icon = Icons.verified_rounded;
      title = 'Today’s dose was verified';
      body = 'Your nurse confirmed your recording. Great job!';
    } else if (today == 'pending') {
      tone = p.info;
      toneBg = p.infoBg;
      icon = Icons.hourglass_top_rounded;
      title = 'Waiting for nurse review';
      body = 'Today’s recording was sent. It already counts toward your '
          'treatment while your nurse checks it.';
    } else if (today == 'uploading') {
      tone = p.textSecondary;
      toneBg = p.subtle;
      icon = Icons.cloud_upload_outlined;
      title = 'Recording not sent yet';
      body = 'It will upload automatically when you are back online.';
    } else {
      tone = p.primaryStrong;
      toneBg = p.primarySoft;
      icon = Icons.videocam_rounded;
      title = 'Video-observed therapy';
      body = 'Record yourself taking each dose when your alarm rings.';
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: _cardDecoration(p),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: toneBg,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Icon(icon, color: tone, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _SectionLabel('NURSE REVIEW', color: p.textTertiary),
                    const SizedBox(height: 3),
                    Text(
                      title,
                      style: TextStyle(
                        fontSize: 15.5,
                        fontWeight: FontWeight.w700,
                        color: p.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      body,
                      style: TextStyle(fontSize: 12.5, height: 1.4, color: p.textSecondary),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (needing != null) ...[
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () async {
                  final sent = await startVotFlow(context, existing: needing);
                  if (sent && context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Proof sent — your nurse will review it.')),
                    );
                  }
                },
                icon: const Icon(Icons.videocam_rounded, size: 18),
                label: const Text('Record again'),
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ---------- Treatment calendar ----------

  /// The month grid from the Calendar tab, simplified: the same taken /
  /// pending / missed coloring the clinic sees, with a legend underneath.
  Widget _buildTreatmentCalendar(AppPalette p, MedicationsProvider meds) {
    final firstOfMonth = DateTime(_month.year, _month.month);
    final daysInMonth = DateTime(_month.year, _month.month + 1, 0).day;
    final leadingBlanks = firstOfMonth.weekday % 7; // Sunday-first

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: _cardDecoration(p),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: p.primarySoft,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Icon(
                  Icons.calendar_month_rounded,
                  size: 18,
                  color: p.primaryStrong,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: AnimatedSwitcher(
                  duration: Motion.medium,
                  layoutBuilder: (current, previous) => Stack(
                    alignment: Alignment.centerLeft,
                    children: [...previous, ?current],
                  ),
                  child: Text(
                    _monthLabel,
                    key: ValueKey(_month),
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: p.textPrimary,
                    ),
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
                        color: p.textTertiary,
                      ),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6),
          // The grid slides in from the side of the month change.
          AnimatedSwitcher(
            duration: Motion.reduced(context) ? Duration.zero : Motion.medium,
            switchInCurve: Motion.emphasized,
            switchOutCurve: Curves.easeIn,
            layoutBuilder: (current, previous) => Stack(
              alignment: Alignment.topCenter,
              children: [...previous, ?current],
            ),
            transitionBuilder: (child, animation) {
              final incoming = child.key == ValueKey(_month);
              final dx = 0.12 * _monthDirection * (incoming ? 1 : -1);
              return FadeTransition(
                opacity: animation,
                child: SlideTransition(
                  position: Tween<Offset>(
                    begin: Offset(dx, 0),
                    end: Offset.zero,
                  ).animate(animation),
                  child: child,
                ),
              );
            },
            child: GridView.count(
              key: ValueKey(_month),
              crossAxisCount: 7,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 4,
              crossAxisSpacing: 4,
              childAspectRatio: 1.0,
              children: [
                for (var i = 0; i < leadingBlanks; i++) const SizedBox.shrink(),
                for (var day = 1; day <= daysInMonth; day++)
                  _buildDayCell(p, meds, DateTime(_month.year, _month.month, day)),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Divider(height: 1, color: p.borderLight),
          const SizedBox(height: 12),
          Wrap(
            spacing: 14,
            runSpacing: 8,
            children: [
              _LegendDot(color: p.primary, label: 'Taken'),
              _LegendDot(color: p.warning, label: 'Flagged', ring: true),
              _LegendDot(color: p.danger, label: 'Missed'),
              _LegendDot(color: p.primaryStrong, label: 'Today', ring: true),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDayCell(AppPalette p, MedicationsProvider meds, DateTime day) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final isToday = day == today;
    final isFuture = day.isAfter(today);
    final beforeStart = day.isBefore(meds.regimenStart);

    final doses = meds.dosesOnDay(day);
    final taken = doses.isNotEmpty;
    // Flagged, or a VOT dose that still needs (new) proof.
    final flagged = taken && meds.isDayHeld(day);
    final missed = !taken && !isFuture && !beforeStart;

    Color background = Colors.transparent;
    Color foreground = p.textPrimary;
    Color borderColor = Colors.transparent;

    if (taken && !flagged) {
      background = p.primary;
      foreground = p.onPrimary;
    } else if (flagged) {
      background = p.warningBg;
      foreground = p.warning;
      borderColor = p.warning.withValues(alpha: 0.6);
    } else if (missed) {
      background = p.dangerBg;
      foreground = p.danger;
      borderColor = p.danger.withValues(alpha: 0.35);
    } else {
      // Future days and days before the regimen started.
      foreground = p.textMuted;
    }

    return Container(
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(AppRadius.md - 1),
        border: Border.all(
          color: isToday ? p.primaryStrong : borderColor,
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
                fontWeight: isToday ? FontWeight.w800 : FontWeight.w600,
                color: foreground,
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ---------- Today ----------

  /// A slim list of today's remaining doses.
  Widget _buildTodayDoses(AppPalette p, List<Alarm> alarms) {
    if (alarms.isEmpty) {
      return const SizedBox.shrink();
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 14, 8, 6),
      decoration: _cardDecoration(p),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionLabel('TODAY', color: p.textTertiary),
          const SizedBox(height: 6),
          for (var i = 0; i < alarms.length; i++)
            FadeSlideIn(
              index: 6 + i,
              offset: 10,
              child: Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(
                  children: [
                    Container(
                      width: 30,
                      height: 30,
                      decoration: BoxDecoration(
                        color: p.primarySoft,
                        borderRadius: BorderRadius.circular(AppRadius.sm + 2),
                      ),
                      child: Icon(
                        Icons.access_time_rounded,
                        size: 16,
                        color: p.primaryStrong,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text.rich(
                        TextSpan(
                          children: [
                            TextSpan(
                              text: alarms[i].displayTime,
                              style: TextStyle(
                                fontWeight: FontWeight.w700,
                                color: p.textPrimary,
                              ),
                            ),
                            TextSpan(
                              text: '  ·  ${alarms[i].medicationName}',
                              style: TextStyle(color: p.textSecondary),
                            ),
                          ],
                        ),
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

/// Translucent card that sits on the green hero.
class _GlassCard extends StatelessWidget {
  final Widget child;

  const _GlassCard({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _glass(0.12),
        borderRadius: BorderRadius.circular(AppRadius.xl),
        border: Border.all(color: _glass(0.18)),
      ),
      child: child,
    );
  }
}

/// Small caps label with an icon, for cards on the hero.
class _HeroLabel extends StatelessWidget {
  final IconData icon;
  final String text;

  const _HeroLabel({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 15, color: Colors.white),
        const SizedBox(width: 8),
        Flexible(
          child: Text(
            text,
            style: TextStyle(
              color: _glass(0.9),
              fontSize: 11,
              fontWeight: FontWeight.w600,
              letterSpacing: 1.2,
            ),
          ),
        ),
      ],
    );
  }
}

class _StreakChip extends StatelessWidget {
  final int days;

  const _StreakChip({required this.days});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: _glass(0.14),
        borderRadius: BorderRadius.circular(AppRadius.md + 2),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.local_fire_department_rounded,
            size: 16,
            color: Color(0xFFFFC56B),
          ),
          const SizedBox(width: 4),
          AnimatedCount(
            value: days,
            suffix: ' day streak',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 12.5,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String text;
  final Color color;

  const _SectionLabel(this.text, {required this.color});

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: TextStyle(
        fontSize: 10.5,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.1,
        color: color,
      ),
    );
  }
}

class _HeroCircle extends StatelessWidget {
  final double size;

  const _HeroCircle({required this.size});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(shape: BoxShape.circle, color: _glass(0.07)),
    );
  }
}

class _MiniMonthButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;

  const _MiniMonthButton({required this.icon, this.onTap});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final enabled = onTap != null;

    return AnimatedOpacity(
      duration: Motion.fast,
      opacity: enabled ? 1 : 0.4,
      child: Material(
        color: p.primarySoft,
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppRadius.md),
          child: SizedBox(
            width: 32,
            height: 32,
            child: Icon(icon, color: p.primaryStrong, size: 20),
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
          style: TextStyle(fontSize: 11.5, color: context.palette.textSecondary),
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
  bool shouldRepaint(covariant _CurvePainter oldDelegate) =>
      oldDelegate.color != color;
}
