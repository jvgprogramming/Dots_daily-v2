import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../models/medication.dart';
import '../providers/medications_provider.dart';
import '../theme/app_theme.dart';

/// Result of the ringing screen interaction.
enum AlarmDismissAction { taken, snoozed, dismissed }

/// Full-screen, Alarmy-style alarm experience. Pushed over everything else
/// (also used as the full-screen-intent landing page).
class AlarmRingingPage extends StatefulWidget {
  final Alarm alarm;

  const AlarmRingingPage({super.key, required this.alarm});

  /// Convenience for pushing the ringing screen from anywhere.
  static Future<AlarmDismissAction?> open(BuildContext context, Alarm alarm) {
    return Navigator.of(context, rootNavigator: true).push(
      PageRouteBuilder(
        opaque: false,
        barrierDismissible: false,
        pageBuilder: (_, _, _) => AlarmRingingPage(alarm: alarm),
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

  @override
  void initState() {
    super.initState();
    // Portrait, immersive: hide status bar like a real alarm.
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);

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
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  void _finish(AlarmDismissAction action) {
    if (action == AlarmDismissAction.taken) {
      context.read<MedicationsProvider>().addDoseLog(
            DoseLog(
              id: DateTime.now().microsecondsSinceEpoch.toString(),
              medicationId: widget.alarm.medicationId,
              medicationName: widget.alarm.medicationName,
              timestamp: DateTime.now(),
              verified: false,
              notes: 'Logged from alarm',
            ),
          );
    }
    Navigator.of(context).pop(action);
  }

  String _two(int n) => n.toString().padLeft(2, '0');

  String get _timeText {
    final h = _now.hour == 0 ? 12 : (_now.hour > 12 ? _now.hour - 12 : _now.hour);
    return '${_two(h)}:${_two(_now.minute)}';
  }

  String get _ampm => _now.hour >= 12 ? 'PM' : 'AM';

  String get _dateText {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const days = [
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
    ];
    return '${days[_now.weekday - 1]}, ${months[_now.month - 1]} ${_now.day}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
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
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              children: [
                const Spacer(flex: 2),

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
                          _Ripple(pulse: _pulse.value, color: AppColors.primary),
                          _Ripple(
                            pulse: (_pulse.value + 0.5) % 1.0,
                            color: AppColors.cyan,
                          ),
                          ScaleTransition(
                            scale: Tween(begin: 0.94, end: 1.06)
                                .animate(CurvedAnimation(parent: _breath, curve: Curves.easeInOut)),
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
                                    color: AppColors.primary.withValues(alpha: 0.55),
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
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(100),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.alarm, color: AppColors.accent, size: 16),
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
                    Text(
                      _timeText,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 72,
                        fontWeight: FontWeight.w200,
                        letterSpacing: 2,
                        height: 1.0,
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

                const Spacer(flex: 2),

                // Take dose button
                SizedBox(
                  width: double.infinity,
                  height: 60,
                  child: ElevatedButton.icon(
                    onPressed: () => _finish(AlarmDismissAction.taken),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: const Color(0xFF0B1220),
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(18),
                      ),
                    ),
                    icon: const Icon(Icons.check_rounded, size: 26),
                    label: const Text(
                      'I took my dose',
                      style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
                const SizedBox(height: 12),

                // Snooze button
                SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: OutlinedButton.icon(
                    onPressed: () => _finish(AlarmDismissAction.snoozed),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.white,
                      side: BorderSide(color: Colors.white.withValues(alpha: 0.3)),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(18),
                      ),
                    ),
                    icon: const Icon(Icons.snooze_rounded, size: 24),
                    label: const Text(
                      'Snooze 5 minutes',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
              ],
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
