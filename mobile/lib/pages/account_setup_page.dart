import 'dart:async';

import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/motion.dart';

/// Why the patient is here: first-time activation, or a forgotten password.
/// Both run the same three steps; only the wording differs.
enum AccountSetupMode { activate, reset }

/// Activate an account (or reset a password) with an emailed 6-digit code.
///
/// A health worker registers the patient's email but never sets their
/// password. Here the patient proves the email is theirs and picks their own
/// password, then lands straight on the home screen — signed in.
///
///   email  →  code (6 boxes, auto-submits)  →  new password  →  signed in
class AccountSetupPage extends StatefulWidget {
  final String initialEmail;
  final AccountSetupMode mode;

  /// Skip the email step and send the code right away (used when sign-in
  /// already told us this account needs activating).
  final bool sendCodeOnOpen;

  const AccountSetupPage({
    super.key,
    this.initialEmail = '',
    this.mode = AccountSetupMode.activate,
    this.sendCodeOnOpen = false,
  });

  @override
  State<AccountSetupPage> createState() => _AccountSetupPageState();
}

class _AccountSetupPageState extends State<AccountSetupPage> {
  static const _codeLength = 6;

  late final TextEditingController _email =
      TextEditingController(text: widget.initialEmail.trim());
  final _code = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  final _codeFocus = FocusNode();

  int _step = 0; // 0 email · 1 code · 2 password
  bool _busy = false;
  bool _obscure = true;
  String? _error;
  int _shake = 0;
  String? _setupToken;

  int _resendIn = 0;
  Timer? _resendTimer;

  bool get _activating => widget.mode == AccountSetupMode.activate;

  @override
  void initState() {
    super.initState();
    _password.addListener(_refresh);
    _confirm.addListener(_refresh);
    if (widget.sendCodeOnOpen && _email.text.isNotEmpty) {
      _step = 1;
      WidgetsBinding.instance.addPostFrameCallback((_) => _sendCode());
    }
  }

  @override
  void dispose() {
    _resendTimer?.cancel();
    _email.dispose();
    _code.dispose();
    _password.dispose();
    _confirm.dispose();
    _codeFocus.dispose();
    super.dispose();
  }

  void _refresh() => setState(() {});

  void _fail(String message) {
    setState(() {
      _error = message;
      _shake++;
      _busy = false;
    });
    HapticFeedback.mediumImpact();
  }

  void _startResendTimer(int seconds) {
    _resendTimer?.cancel();
    setState(() => _resendIn = seconds);
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return t.cancel();
      setState(() => _resendIn = (_resendIn - 1).clamp(0, 999));
      if (_resendIn == 0) t.cancel();
    });
  }

  // ---------- Steps ----------

  Future<void> _sendCode() async {
    final email = _email.text.trim();
    if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email)) {
      return _fail('Enter the email address your health center registered.');
    }

    setState(() {
      _busy = true;
      _error = null;
    });
    // The server sends a wait time both on success and on "please wait"; a
    // "please wait" still means a code is already on its way, so move on.
    var codeOnItsWay = false;
    final error = await context.read<AuthProvider>().requestCode(
      email,
      onResendIn: (seconds) {
        codeOnItsWay = true;
        _startResendTimer(seconds);
      },
    );
    if (!mounted) return;

    if (error != null && !codeOnItsWay) return _fail(error);

    setState(() {
      _busy = false;
      _step = 1;
      _code.clear();
      _error = null;
    });
    _codeFocus.requestFocus();
  }

  Future<void> _verifyCode() async {
    if (_code.text.length != _codeLength || _busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    final result = await context
        .read<AuthProvider>()
        .verifyCode(_email.text, _code.text);
    if (!mounted) return;

    if (result.token == null) {
      _code.clear();
      _codeFocus.requestFocus();
      return _fail(result.error ?? 'That code did not work. Try again.');
    }

    FocusScope.of(context).unfocus();
    setState(() {
      _setupToken = result.token;
      _busy = false;
      _step = 2;
    });
  }

  Future<void> _finish() async {
    if (_password.text.length < 8) {
      return _fail('Your password needs at least 8 characters.');
    }
    if (_password.text != _confirm.text) {
      return _fail('The two passwords do not match.');
    }

    setState(() {
      _busy = true;
      _error = null;
    });
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    final error = await context
        .read<AuthProvider>()
        .completeSetup(_email.text, _setupToken!, _password.text);
    if (!mounted) return;

    if (error != null) {
      // The code window ran out: start again from a fresh code.
      if (error.contains('expired')) {
        setState(() {
          _step = 0;
          _setupToken = null;
        });
      }
      return _fail(error);
    }

    // Signed in: the app shell underneath already switched to home.
    navigator.popUntil((route) => route.isFirst);
    messenger.showSnackBar(
      SnackBar(
        content: Text(
          _activating
              ? 'Welcome! Your account is ready.'
              : 'Password changed. You are signed in.',
        ),
        backgroundColor: AppColors.emerald,
      ),
    );
  }

  /// Back steps through the flow before leaving it.
  void _back() {
    if (_step == 0) {
      Navigator.of(context).maybePop();
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _step = 0;
      _error = null;
      _setupToken = null;
      _code.clear();
    });
  }

  // ---------- UI ----------

  @override
  Widget build(BuildContext context) {
    final p = context.palette;

    return PopScope(
      canPop: _step == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _back();
      },
      child: Scaffold(
        backgroundColor: p.background,
        body: Stack(
          children: [
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              height: MediaQuery.of(context).size.height * 0.42,
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: p.heroGradient,
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: const BorderRadius.vertical(
                    bottom: Radius.circular(36),
                  ),
                ),
              ),
            ),
            const Positioned(top: -60, right: -40, child: _Glow(size: 180)),
            const Positioned(top: 120, left: -50, child: _Glow(size: 120)),
            SafeArea(
              child: Column(
                children: [
                  Align(
                    alignment: Alignment.centerLeft,
                    child: IconButton(
                      onPressed: _busy ? null : _back,
                      icon: const Icon(Icons.arrow_back_rounded),
                      color: Colors.white,
                      tooltip: 'Back',
                    ),
                  ),
                  Expanded(
                    child: Center(
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 420),
                          child: Column(
                            children: [
                              _buildHeader(),
                              const SizedBox(height: 28),
                              FadeSlideIn(
                                index: 2,
                                offset: 28,
                                child: ShakeOnChange(
                                  trigger: _shake,
                                  child: _buildCard(p),
                                ),
                              ),
                              const SizedBox(height: 20),
                              _buildFooter(p),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    final icon = switch (_step) {
      0 => _activating ? Icons.person_add_alt_1_rounded : Icons.lock_reset_rounded,
      1 => Icons.mark_email_unread_rounded,
      _ => Icons.password_rounded,
    };

    return FadeSlideIn(
      child: Column(
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.15),
                  blurRadius: 18,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: AnimatedSwitcher(
              duration: Motion.medium,
              transitionBuilder: (child, a) =>
                  ScaleTransition(scale: a, child: child),
              child: Icon(
                icon,
                key: ValueKey(icon),
                size: 32,
                color: AppColors.primary,
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            _activating ? 'Activate your account' : 'Reset your password',
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Step ${_step + 1} of 3',
            style: TextStyle(
              fontSize: 13,
              color: Colors.white.withValues(alpha: 0.8),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCard(AppPalette p) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: p.card,
        borderRadius: BorderRadius.circular(AppRadius.xxl),
        border: Border.all(color: p.borderLight),
        boxShadow: p.elevatedShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _StepBar(step: _step),
          const SizedBox(height: 18),
          AnimatedSwitcher(
            duration: Motion.medium,
            switchInCurve: Motion.emphasized,
            transitionBuilder: (child, a) => FadeTransition(
              opacity: a,
              child: SlideTransition(
                position: Tween(
                  begin: const Offset(0.06, 0),
                  end: Offset.zero,
                ).animate(a),
                child: child,
              ),
            ),
            layoutBuilder: (current, previous) => Stack(
              alignment: Alignment.topLeft,
              children: [...previous, ?current],
            ),
            child: KeyedSubtree(
              key: ValueKey(_step),
              child: switch (_step) {
                0 => _buildEmailStep(p),
                1 => _buildCodeStep(p),
                _ => _buildPasswordStep(p),
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _title(AppPalette p, String title, Widget subtitle) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w700,
            color: p.textPrimary,
            letterSpacing: -0.3,
          ),
        ),
        const SizedBox(height: 4),
        DefaultTextStyle.merge(
          style: TextStyle(fontSize: 13, height: 1.4, color: p.textSecondary),
          child: subtitle,
        ),
        const SizedBox(height: 20),
      ],
    );
  }

  Widget _buildEmailStep(AppPalette p) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _title(
          p,
          _activating ? 'Confirm your email' : 'Forgot your password?',
          Text(
            _activating
                ? 'Enter the email your health center registered. We will send '
                    'you a code so you can create your own password.'
                : 'Enter your email and we will send you a code to choose a '
                    'new password.',
          ),
        ),
        TextField(
          controller: _email,
          autofocus: _email.text.isEmpty,
          decoration: const InputDecoration(
            labelText: 'Email',
            hintText: 'you@example.com',
            prefixIcon: Icon(Icons.email_outlined),
          ),
          keyboardType: TextInputType.emailAddress,
          autofillHints: const [AutofillHints.email],
          textInputAction: TextInputAction.send,
          onChanged: (_) => setState(() => _error = null),
          onSubmitted: (_) => _sendCode(),
        ),
        _ErrorText(_error),
        const SizedBox(height: 20),
        _PrimaryButton(
          label: 'Send code',
          icon: Icons.send_rounded,
          busy: _busy,
          onPressed: _sendCode,
        ),
      ],
    );
  }

  Widget _buildCodeStep(AppPalette p) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _title(
          p,
          'Check your email',
          Text.rich(
            TextSpan(
              children: [
                const TextSpan(text: 'We sent a 6-digit code to '),
                TextSpan(
                  text: _email.text.trim(),
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: p.textPrimary,
                  ),
                ),
                const TextSpan(text: '. It may take a minute to arrive.'),
              ],
            ),
          ),
        ),
        _CodeBoxes(
          controller: _code,
          focusNode: _codeFocus,
          length: _codeLength,
          hasError: _error != null,
          enabled: !_busy,
          onChanged: (_) {
            if (_error != null) setState(() => _error = null);
          },
          onCompleted: _verifyCode,
        ),
        _ErrorText(_error),
        const SizedBox(height: 20),
        _PrimaryButton(
          label: 'Continue',
          icon: Icons.arrow_forward_rounded,
          busy: _busy,
          onPressed: _code.text.length == _codeLength ? _verifyCode : null,
        ),
        const SizedBox(height: 12),
        // Wraps onto two lines on narrow phones instead of overflowing.
        Wrap(
          alignment: WrapAlignment.spaceBetween,
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 8,
          children: [
            TextButton(
              onPressed: _busy ? null : _back,
              child: const Text('Change email'),
            ),
            TextButton(
              onPressed: _busy || _resendIn > 0 ? null : _sendCode,
              child: Text(
                _resendIn > 0 ? 'Resend code in ${_resendIn}s' : 'Resend code',
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildPasswordStep(AppPalette p) {
    final longEnough = _password.text.length >= 8;
    final matches = _confirm.text.isNotEmpty && _password.text == _confirm.text;

    InputDecoration field(String label, IconData icon) => InputDecoration(
          labelText: label,
          prefixIcon: Icon(icon),
          suffixIcon: IconButton(
            icon: Icon(
              _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
              color: p.textTertiary,
            ),
            onPressed: () => setState(() => _obscure = !_obscure),
          ),
        );

    return AutofillGroup(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _title(
            p,
            _activating ? 'Create your password' : 'Choose a new password',
            const Text(
              'Only you will know it. You will use it with your email to sign in.',
            ),
          ),
          TextField(
            controller: _password,
            autofocus: true,
            obscureText: _obscure,
            autofillHints: const [AutofillHints.newPassword],
            textInputAction: TextInputAction.next,
            decoration: field('New password', Icons.lock_outlined),
            onChanged: (_) => _error = null,
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _confirm,
            obscureText: _obscure,
            autofillHints: const [AutofillHints.newPassword],
            textInputAction: TextInputAction.done,
            decoration: field('Type it again', Icons.lock_reset_outlined),
            onChanged: (_) => _error = null,
            onSubmitted: (_) => _finish(),
          ),
          const SizedBox(height: 12),
          _Check(ok: longEnough, label: 'At least 8 characters'),
          const SizedBox(height: 4),
          _Check(ok: matches, label: 'Both passwords match'),
          _ErrorText(_error),
          const SizedBox(height: 20),
          _PrimaryButton(
            label: _activating ? 'Finish and sign in' : 'Save and sign in',
            icon: Icons.check_rounded,
            busy: _busy,
            onPressed: longEnough && matches ? _finish : null,
          ),
        ],
      ),
    );
  }

  Widget _buildFooter(AppPalette p) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.shield_outlined, size: 14, color: p.textTertiary),
        const SizedBox(width: 6),
        Flexible(
          child: Text(
            'Never share your code, even with clinic staff',
            style: TextStyle(fontSize: 12, color: p.textTertiary),
          ),
        ),
      ],
    );
  }
}

// =====================================================================
// Pieces
// =====================================================================

/// Six digit boxes over one invisible text field, so paste, the keyboard's
/// one-time-code suggestion and backspace all just work.
class _CodeBoxes extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode focusNode;
  final int length;
  final bool hasError;
  final bool enabled;
  final ValueChanged<String> onChanged;
  final VoidCallback onCompleted;

  const _CodeBoxes({
    required this.controller,
    required this.focusNode,
    required this.length,
    required this.hasError,
    required this.enabled,
    required this.onChanged,
    required this.onCompleted,
  });

  @override
  Widget build(BuildContext context) {
    final p = context.palette;

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: focusNode.requestFocus,
      child: Stack(
        children: [
          ListenableBuilder(
            listenable: Listenable.merge([controller, focusNode]),
            builder: (context, _) {
              final text = controller.text;
              return Row(
                children: [
                  for (var i = 0; i < length; i++) ...[
                    if (i > 0) const SizedBox(width: 8),
                    Expanded(
                      child: _box(
                        p,
                        digit: i < text.length ? text[i] : '',
                        active: focusNode.hasFocus &&
                            (i == text.length ||
                                (i == length - 1 && text.length == length)),
                      ),
                    ),
                  ],
                ],
              );
            },
          ),
          Positioned.fill(
            child: Opacity(
              opacity: 0,
              child: TextField(
                controller: controller,
                focusNode: focusNode,
                enabled: enabled,
                autofocus: true,
                keyboardType: TextInputType.number,
                autofillHints: const [AutofillHints.oneTimeCode],
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(length),
                ],
                showCursor: false,
                enableInteractiveSelection: false,
                decoration: const InputDecoration(
                  border: InputBorder.none,
                  counterText: '',
                ),
                onChanged: (value) {
                  onChanged(value);
                  if (value.length == length) onCompleted();
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _box(AppPalette p, {required String digit, required bool active}) {
    final Color border = hasError
        ? p.danger
        : active
            ? p.primary
            : digit.isNotEmpty
                ? p.primaryTint
                : p.border;

    return AnimatedContainer(
      duration: Motion.fast,
      height: 56,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: digit.isNotEmpty ? p.primarySoft.withValues(alpha: 0.5) : p.subtle,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: border, width: active ? 2 : 1.2),
      ),
      child: AnimatedSwitcher(
        duration: Motion.fast,
        transitionBuilder: (child, a) => ScaleTransition(scale: a, child: child),
        child: Text(
          digit,
          key: ValueKey(digit),
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w700,
            color: p.textPrimary,
          ),
        ),
      ),
    );
  }
}

/// Thin three-segment progress bar at the top of the card.
class _StepBar extends StatelessWidget {
  final int step;

  const _StepBar({required this.step});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Row(
      children: [
        for (var i = 0; i < 3; i++) ...[
          if (i > 0) const SizedBox(width: 6),
          Expanded(
            child: AnimatedContainer(
              duration: Motion.medium,
              curve: Motion.emphasized,
              height: 4,
              decoration: BoxDecoration(
                color: i <= step ? p.primary : p.borderLight,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _Check extends StatelessWidget {
  final bool ok;
  final String label;

  const _Check({required this.ok, required this.label});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Row(
      children: [
        AnimatedSwitcher(
          duration: Motion.fast,
          transitionBuilder: (child, a) => ScaleTransition(scale: a, child: child),
          child: Icon(
            ok ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
            key: ValueKey(ok),
            size: 16,
            color: ok ? p.success : p.textTertiary,
          ),
        ),
        const SizedBox(width: 8),
        Text(
          label,
          style: TextStyle(
            fontSize: 12.5,
            color: ok ? p.textPrimary : p.textSecondary,
          ),
        ),
      ],
    );
  }
}

class _ErrorText extends StatelessWidget {
  final String? message;

  const _ErrorText(this.message);

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return AnimatedSize(
      duration: Motion.fast,
      alignment: Alignment.topLeft,
      child: message == null
          ? const SizedBox(width: double.infinity)
          : Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.error_outline_rounded, size: 16, color: p.danger),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      message!,
                      style: TextStyle(fontSize: 12.5, height: 1.35, color: p.danger),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}

class _PrimaryButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool busy;
  final VoidCallback? onPressed;

  const _PrimaryButton({
    required this.label,
    required this.icon,
    required this.busy,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    final enabled = !busy && onPressed != null;
    return PressableScale(
      enabled: enabled,
      child: SizedBox(
        width: double.infinity,
        height: 50,
        child: ElevatedButton(
          onPressed: enabled ? onPressed : null,
          child: AnimatedSwitcher(
            duration: Motion.fast,
            child: busy
                ? const SizedBox(
                    key: ValueKey('busy'),
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : Row(
                    key: ValueKey(label),
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(label),
                      const SizedBox(width: 8),
                      Icon(icon, size: 18),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

class _Glow extends StatelessWidget {
  final double size;

  const _Glow({required this.size});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.white.withValues(alpha: 0.07),
      ),
    );
  }
}
