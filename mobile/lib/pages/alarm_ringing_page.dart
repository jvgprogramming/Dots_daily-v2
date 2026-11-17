import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:wakelock_plus/wakelock_plus.dart';
import '../models/medication.dart';
import '../providers/medications_provider.dart';
import '../services/device_lock_service.dart';
import '../services/notification_service.dart';
import '../theme/app_theme.dart';
import 'app_lock_page.dart';
import 'vot/vot_instructions_page.dart';

/// Result of the ringing screen interaction.
enum AlarmDismissAction { taken, snoozed, dismissed }

/// Full-screen, Alarmy-style alarm experience. Pushed over everything else
/// (also used as the full-screen-intent landing page).
class AlarmRingingPage extends StatefulWidget {
  final Alarm alarm;

  /// When true the screen is only a demonstration, so no dose is logged.
  final bool preview;

  const AlarmRingingPage({
    super.key,
    required this.alarm,
    this.preview = false,
  });

  /// Convenience for pushing the ringing screen from anywhere.
  static Future<AlarmDismissAction?> open(
    BuildContext context,
    Alarm alarm, {
    bool preview = false,
  }) {
    return Navigator.of(context, rootNavigator: true).push(
      PageRouteBuilder(
        opaque: false,
        barrierDismissible: false,
        pageBuilder: (_, _, _) =>
            AlarmRingingPage(alarm: alarm, preview: preview),
        transitionsBuilder: (_, animation, _, child) =>
            FadeTransition(opacity: animation, child: child),
      ),
    );
  }

  @override
  State<AlarmRingingPage> createState() => _AlarmRingingPageState();
}

class _AlarmRingingPageState extends State<AlarmRingingPage>
    with TickerProviderStateMixin {
  late final AnimationController _pulse;
  late final AnimationController _breath;
  Timer? _clock;
  DateTime _now = DateTime.now();

  /// True while the camera/compression round-trip is in progress, so the button
  /// shows a busy state and can't be tapped twice.
  bool _capturing = false;

  @override
  void initState() {
    super.initState();
    // Portrait, immersive: hide status bar like a real alarm.
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    // The screen must not sleep while the alarm is ringing — the patient may
    // still be reaching for the phone or fumbling for the dismiss button.
    WakelockPlus.enable();

    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    )..repeat();
    _breath = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..repeat(reverse: true);
    _clock = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _now = DateTime.now());
    });
  }

  @override
  void dispose() {
    _clock?.cancel();
    _pulse.dispose();
    _breath.dispose();
    WakelockPlus.disable();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  /// "I took my dose" — the only way to clear the alarm as taken.
  ///
  /// A patient enrolled in Video-Observed Therapy records proof for their
  /// nurse (instructions → camera → review → upload); backing out of that
  /// leaves the alarm ringing. Everyone else confirms with one tap. Either way
  /// the dose is saved by the provider (queued if offline), so dismissal never
  /// depends on the network.
  Future<void> _onTakeDose() async {
    if (_capturing) return;

    // The demo/preview never records or logs anything.
    if (widget.preview) {
      await _dismiss(AlarmDismissAction.taken);
      return;
    }

    final meds = context.read<MedicationsProvider>();

    if (meds.isVotEnrolled) {
      setState(() => _capturing = true);
      final submitted = await startVotFlow(context);
      if (!mounted) return;
      setState(() => _capturing = false);

      if (!submitted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Record yourself taking your dose to continue.'),
            behavior: SnackBarBehavior.floating,
          ),
        );
        return;
      }
      await _dismiss(AlarmDismissAction.taken);
      return;
    }

    meds.addDoseLog(
      DoseLog(
        id: DateTime.now().microsecondsSinceEpoch.toString(),
        medicationId: widget.alarm.medicationId,
        medicationName: widget.alarm.medicationName,
        timestamp: DateTime.now(),
        verified: false,
        notes: 'Logged from alarm',
      ),
    );

    await _dismiss(AlarmDismissAction.taken);
  }

  /// One-shot id for a snoozed alarm, kept separate from the daily reminder's
  /// id so re-ringing in 5 minutes never cancels the standing daily schedule.
  static const int _snoozeNotificationId = 0x5D2A80;

  /// Rings again in 5 minutes, then closes. The dose can still be taken any
  /// time today; this is just a short nudge for someone not ready right now.
  Future<void> _snooze() async {
    if (!widget.preview) {
      try {
        await NotificationService().scheduleNotification(
          id: _snoozeNotificationId,
          title: '⏰ Time for your daily dose',
          body: 'Take your medicine on an empty stomach, before eating anything.',
          scheduledDate: DateTime.now().add(const Duration(minutes: 5)),
          payload: 'alarm:${MedicationsProvider.reminderId}',
        );
      } catch (_) {
        // If scheduling fails the daily reminder still stands; don't trap the
        // patient on the ringing screen over it.
      }
    }
    await _dismiss(AlarmDismissAction.snoozed);
  }

  /// Closes the ringing screen (after the lock gate), without logging anything.
  Future<void> _dismiss(AlarmDismissAction action) async {
    // The activity is showWhenLocked, so after the alarm closes the whole app
    // would sit exposed over the keyguard. Park the lock gate underneath this
    // page first (push), then pop — the user only ever sees: alarm → PIN.
    final locked = await DeviceLockService.isDeviceLocked();
    if (locked && mounted) {
      Navigator.of(context, rootNavigator: true).push(
        PageRouteBuilder(
          opaque: true,
          barrierDismissible: false,
          pageBuilder: (_, _, _) => const AppLockPage(),
          transitionsBuilder: (_, animation, _, child) =>
              FadeTransition(opacity: animation, child: child),
        ),
      );
    }

    if (mounted) Navigator.of(context).pop(action);
  }

  /// VOT patients record proof; the label and icon say so. The preview
  /// always shows the recording variant.
  bool get _isVot =>
      widget.preview || context.watch<MedicationsProvider>().isVotEnrolled;

  String _two(int n) => n.toString().padLeft(2, '0');

  String get _timeText {
    final h = _now.hour == 0
        ? 12
        : (_now.hour > 12 ? _now.hour - 12 : _now.hour);
    return '${_two(h)}:${_two(_now.minute)}';
  }

  String get _ampm => _now.hour >= 12 ? 'PM' : 'AM';

  String get _dateText {
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
    const days = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ];
    return '${days[_now.weekday - 1]}, ${months[_now.month - 1]} ${_now.day}';
  }

  @override
  Widget build(BuildContext context) {
    // The alarm cannot be swiped or backed away by accident, but it never traps
    // the patient: the exits are taking the dose, snoozing 5 minutes, or
    // choosing to take it later today (the dose is loggable all day from home).
    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: const Color(0xFF0B1220),
        body: Container(
          width: double.infinity,
          height: double.infinity,
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0xFF0B1220), Color(0xFF10233A), Color(0xFF0B1220)],
            ),
          ),
          child: SafeArea(
            child: LayoutBuilder(
              builder: (context, constraints) {
                // Scrollable + centred: the alarm must stay fully usable and
                // un-clipped on short screens and with large system text.
                return SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      minHeight: constraints.maxHeight,
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const SizedBox(height: 20),

                        // Pulsing med badge
                        AnimatedBuilder(
                          animation: Listenable.merge([_pulse, _breath]),
                          builder: (context, _) {
                            return SizedBox(
                              width: 220,
                              height: 220,
                              child: Stack(
                                alignment: Alignment.center,
                                children: [
                                  _Ripple(
                                    pulse: _pulse.value,
                                    color: AppColors.primary,
                                  ),
                                  _Ripple(
                                    pulse: (_pulse.value + 0.5) % 1.0,
                                    color: AppColors.greenLight,
                                  ),
                                  ScaleTransition(
                                    scale: Tween(begin: 0.94, end: 1.06)
                                        .animate(
                                          CurvedAnimation(
                                            parent: _breath,
                                            curve: Curves.easeInOut,
                                          ),
                                        ),
                                    child: Container(
                                      width: 120,
                                      height: 120,
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        gradient: const LinearGradient(
                                          colors: AppColors.primaryGradient,
                                          begin: Alignment.topLeft,
                                          end: Alignment.bottomRight,
                                        ),
                                        boxShadow: [
                                          BoxShadow(
                                            color: AppColors.primary.withValues(
                                              alpha: 0.55,
                                            ),
                                            blurRadius: 40 + 20 * _breath.value,
                                            spreadRadius: 2,
                                          ),
                                        ],
                                      ),
                                      child: const Icon(
                                        Icons.medication_rounded,
                                        color: Colors.white,
                                        size: 56,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                        const SizedBox(height: 28),

                        // Label pill
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(100),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.15),
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.alarm,
                                color: AppColors.accent,
                                size: 16,
                              ),
                              const SizedBox(width: 6),
                              Flexible(
                                child: Text(
                                  widget.alarm.label,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    letterSpacing: 0.3,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Medication name
                        Text(
                          'Time to take',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.7),
                            fontSize: 15,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          widget.alarm.medicationName,
                          textAlign: TextAlign.center,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 28,
                            fontWeight: FontWeight.w800,
                            height: 1.15,
                          ),
                        ),
                        const SizedBox(height: 24),

                        // Live clock
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Flexible(
                              child: FittedBox(
                                fit: BoxFit.scaleDown,
                                child: Text(
                                  _timeText,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 72,
                                    fontWeight: FontWeight.w200,
                                    letterSpacing: 2,
                                    height: 1.0,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8, height: 72),
                            Padding(
                              padding: const EdgeInsets.only(top: 14),
                              child: Text(
                                _ampm,
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.8),
                                  fontSize: 22,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _dateText,
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.55),
                            fontSize: 14,
                          ),
                        ),

                        const SizedBox(height: 28),

                        // Take dose button
                        SizedBox(
                          width: double.infinity,
                          height: 60,
                          child: ElevatedButton.icon(
                            onPressed: _capturing ? null : _onTakeDose,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.white,
                              foregroundColor: const Color(0xFF0B1220),
                              disabledBackgroundColor: Colors.white70,
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(18),
                              ),
                            ),
                            icon: _capturing
                                ? const SizedBox(
                                    width: 22,
                                    height: 22,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2.5,
                                      color: Color(0xFF0B1220),
                                    ),
                                  )
                                : Icon(
                                    _isVot
                                        ? Icons.videocam_rounded
                                        : Icons.check_circle_rounded,
                                    size: 26,
                                  ),
                            label: Text(
                              _capturing
                                  ? 'Recording…'
                                  : (_isVot
                                      ? 'Record & take my dose'
                                      : 'I took my dose'),
                              style: const TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),

                        // Snooze button
                        SizedBox(
                          width: double.infinity,
                          height: 56,
                          child: OutlinedButton.icon(
                            onPressed: _capturing ? null : _snooze,
                            style: OutlinedButton.styleFrom(
                              foregroundColor: Colors.white,
                              side: BorderSide(
                                color: Colors.white.withValues(alpha: 0.3),
                              ),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(18),
                              ),
                            ),
                            icon: const Icon(Icons.snooze_rounded, size: 24),
                            label: const Text(
                              'Snooze 5 minutes',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 6),

                        // Not ready now? The dose can still be taken any time
                        // today from the home screen — so never trap the alarm.
                        TextButton(
                          onPressed: _capturing
                              ? null
                              : () => _dismiss(AlarmDismissAction.dismissed),
                          style: TextButton.styleFrom(
                            foregroundColor: Colors.white.withValues(alpha: 0.7),
                          ),
                          child: const Text(
                            "I'll take it later today",
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                        const SizedBox(height: 20),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

class _Ripple extends StatelessWidget {
  final double pulse; // 0..1
  final Color color;

  const _Ripple({required this.pulse, required this.color});

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: const Size(220, 220),
      painter: _RipplePainter(pulse: pulse, color: color),
    );
  }
}

class _RipplePainter extends CustomPainter {
  final double pulse;
  final Color color;

  _RipplePainter({required this.pulse, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = 60 + pulse * 50;
    final paint = Paint()
      ..color = color.withValues(alpha: (1 - pulse) * 0.25)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5 - pulse * 1.5;
    canvas.drawCircle(center, radius, paint);
  }

  @override
  bool shouldRepaint(covariant _RipplePainter old) => old.pulse != pulse;
}
