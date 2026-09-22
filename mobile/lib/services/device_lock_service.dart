import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';
import 'package:local_auth_android/local_auth_android.dart';
import 'package:local_auth_darwin/local_auth_darwin.dart';

/// Device lock state + authentication, shared by the alarm lock gate.
///
/// The app renders over the lock screen while an alarm rings (MainActivity is
/// `showWhenLocked`), so once the alarm closes Dart must ask the OS whether
/// the keyguard is still up and demand the device PIN before the app's data
/// can be reached.
class DeviceLockService {
  static final LocalAuthentication _auth = LocalAuthentication();

  static const MethodChannel _channel = MethodChannel('dotsdaily.dev/lock');

  /// True while the system lock screen (keyguard) is showing.
  ///
  /// False on platforms without the channel (iOS, tests, desktop), so the
  /// gate never engages by accident — there the OS itself protects the app.
  static Future<bool> isDeviceLocked() async {
    try {
      return await _channel.invokeMethod<bool>('isDeviceLocked') ?? false;
    } on PlatformException {
      return false;
    } on MissingPluginException {
      return false;
    }
  }

  /// Whether the device has a secure lock (PIN, pattern, password or bio).
  ///
  /// If not, there is nothing to verify against and the gate must not ask.
  static Future<bool> isDeviceSecure() async {
    try {
      return await _channel.invokeMethod<bool>('isDeviceSecure') ?? false;
    } on PlatformException {
      return false;
    } on MissingPluginException {
      return false;
    }
  }

  /// Prompts the user with the system PIN/biometric dialog.
  ///
  /// [reason] is shown by the OS on its own dialog. Returns false when the
  /// user cancels, fails, or no secure lock exists.
  static Future<bool> authenticate({String reason = 'Unlock DOTS Daily'}) async {
    try {
      return await _auth.authenticate(
        localizedReason: reason,
        authMessages: const <AuthMessages>[
          // Android strings — the PIN entry is the interesting one here.
          AndroidAuthMessages(
            biometricHint: '',
            signInTitle: 'App locked',
          ),
          IOSAuthMessages(lockOut: 'Please unlock your phone and try again.'),
        ],
        options: const AuthenticationOptions(
          biometricOnly: false,
          stickyAuth: true,
          useErrorDialogs: true,
        ),
      );
    } on PlatformException {
      return false;
    } on MissingPluginException {
      return false;
    }
  }
}
