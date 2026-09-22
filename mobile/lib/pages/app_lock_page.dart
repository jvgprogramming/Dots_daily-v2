import 'package:flutter/material.dart';
import '../services/device_lock_service.dart';

/// Full-screen gate shown when the app was reached over the lock screen.
///
/// The alarm flow intentionally shows the ringing page without any PIN — a
/// groggy patient must always be able to log the dose. But once that page is
/// gone, nothing else in the app should be reachable until the device is
/// actually unlocked, so this screen demands the device PIN (or biometrics).
class AppLockPage extends StatefulWidget {
  const AppLockPage({super.key});

  @override
  State<AppLockPage> createState() => _AppLockPageState();
}

class _AppLockPageState extends State<AppLockPage> {
  bool _checking = true;
  bool _authenticating = false;
  String? _message;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _gate());
  }

  Future<void> _gate() async {
    final locked = await DeviceLockService.isDeviceLocked();
    if (!mounted) return;

    // The phone was unlocked while the alarm rang (or the platform has no
    // keyguard report) — nothing to gate.
    if (!locked) {
      Navigator.of(context).pop();
      return;
    }

    final secure = await DeviceLockService.isDeviceSecure();
    if (!mounted) return;
    if (!secure) {
      setState(() {
        _checking = false;
        _message =
            'This phone has no screen lock. Set a PIN in Android settings to '
            'protect your data.';
      });
      return;
    }

    await _prompt();
  }

  Future<void> _prompt() async {
    if (_authenticating) return;
    setState(() {
      _authenticating = true;
      _message = null;
    });

    final ok = await DeviceLockService.authenticate(
      reason: 'Your alarm was dismissed on the lock screen — verify it is you',
    );
    if (!mounted) return;

    if (ok) {
      Navigator.of(context).pop();
      return;
    }

    setState(() => _authenticating = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0B1220),
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 88,
                  height: 88,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white.withValues(alpha: 0.06),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.15),
                    ),
                  ),
                  child: const Icon(
                    Icons.lock_rounded,
                    color: Colors.white,
                    size: 40,
                  ),
                ),
                const SizedBox(height: 24),
                const Text(
                  'App locked',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 24,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _message ??
                      'The alarm was handled on the lock screen.\nVerify it is you to continue.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.65),
                    fontSize: 14,
                    height: 1.45,
                  ),
                ),
                const SizedBox(height: 32),
                if (!_checking)
                  SizedBox(
                    width: double.infinity,
                    height: 54,
                    child: ElevatedButton.icon(
                      onPressed: _authenticating ? null : _prompt,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: const Color(0xFF0B1220),
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      icon: _authenticating
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.key_rounded, size: 22),
                      label: Text(
                        _authenticating ? 'Verifying…' : 'Unlock with PIN',
                        style: const TextStyle(
                          fontSize: 15.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
