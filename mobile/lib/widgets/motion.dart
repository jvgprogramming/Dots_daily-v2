import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Shared animation timings, so motion feels the same on every screen.
class Motion {
  static const Duration fast = Duration(milliseconds: 160);
  static const Duration medium = Duration(milliseconds: 320);
  static const Duration slow = Duration(milliseconds: 520);
  static const Duration stagger = Duration(milliseconds: 70);

  static const Curve emphasized = Curves.easeOutCubic;

  /// True when the user turned on "Remove animations" in the phone's
  /// accessibility settings. Animations should then jump to their end state.
  static bool reduced(BuildContext context) =>
      MediaQuery.maybeDisableAnimationsOf(context) ?? false;
}

/// Fades its child in while sliding it up a few pixels. Give siblings an
/// increasing [index] to make them appear one after another.
class FadeSlideIn extends StatefulWidget {
  final Widget child;
  final int index;
  final double offset;
  final Duration duration;

  const FadeSlideIn({
    super.key,
    required this.child,
    this.index = 0,
    this.offset = 18,
    this.duration = Motion.slow,
  });

  @override
  State<FadeSlideIn> createState() => _FadeSlideInState();
}

class _FadeSlideInState extends State<FadeSlideIn>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: widget.duration,
  );
  late final Animation<double> _curve = CurvedAnimation(
    parent: _controller,
    curve: Motion.emphasized,
  );
  Timer? _delay;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context)) {
      _controller.value = 1;
      return;
    }
    // A Timer (not Future.delayed) so it can be cancelled if the widget is
    // removed before the delay ends.
    _delay = Timer(Motion.stagger * widget.index, () {
      if (mounted) _controller.forward();
    });
  }

  @override
  void dispose() {
    _delay?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _curve,
      child: widget.child,
      builder: (context, child) => Opacity(
        opacity: _curve.value,
        child: Transform.translate(
          offset: Offset(0, widget.offset * (1 - _curve.value)),
          child: child,
        ),
      ),
    );
  }
}

/// Shrinks its child slightly while a finger is down, for tactile cards.
///
/// Uses a raw [Listener] rather than a gesture detector, so taps still reach
/// any buttons or InkWells inside the child.
class PressableScale extends StatefulWidget {
  final Widget child;
  final double pressedScale;
  final bool enabled;

  const PressableScale({
    super.key,
    required this.child,
    this.pressedScale = 0.97,
    this.enabled = true,
  });

  @override
  State<PressableScale> createState() => _PressableScaleState();
}

class _PressableScaleState extends State<PressableScale> {
  bool _down = false;

  void _set(bool value) {
    if (!widget.enabled || _down == value) return;
    setState(() => _down = value);
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      onPointerDown: (_) => _set(true),
      onPointerUp: (_) => _set(false),
      onPointerCancel: (_) => _set(false),
      child: AnimatedScale(
        scale: _down ? widget.pressedScale : 1,
        duration: Motion.fast,
        curve: Curves.easeOut,
        child: widget.child,
      ),
    );
  }
}

/// Counts up to [value] on first build, and animates between values after.
class AnimatedCount extends StatelessWidget {
  final num value;
  final TextStyle? style;
  final String suffix;
  final Duration duration;

  const AnimatedCount({
    super.key,
    required this.value,
    this.style,
    this.suffix = '',
    this.duration = const Duration(milliseconds: 900),
  });

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: value.toDouble()),
      duration: Motion.reduced(context) ? Duration.zero : duration,
      curve: Motion.emphasized,
      builder: (context, v, _) => Text('${v.round()}$suffix', style: style),
    );
  }
}

/// Shakes its child sideways each time [trigger] changes, e.g. to flag a
/// failed sign-in.
class ShakeOnChange extends StatefulWidget {
  final Object? trigger;
  final Widget child;

  const ShakeOnChange({super.key, required this.trigger, required this.child});

  @override
  State<ShakeOnChange> createState() => _ShakeOnChangeState();
}

class _ShakeOnChangeState extends State<ShakeOnChange>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 420),
  );

  @override
  void didUpdateWidget(covariant ShakeOnChange oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.trigger != oldWidget.trigger && !Motion.reduced(context)) {
      _controller.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      child: widget.child,
      builder: (context, child) {
        // Three swings that die out: sin gives the back-and-forth,
        // (1 - t) shrinks each swing.
        final t = _controller.value;
        final dx = math.sin(t * math.pi * 6) * 10 * (1 - t);
        return Transform.translate(offset: Offset(dx, 0), child: child);
      },
    );
  }
}
