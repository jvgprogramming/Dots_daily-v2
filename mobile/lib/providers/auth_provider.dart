import 'package:flutter/foundation.dart';
import '../models/user.dart';
import '../services/api_service.dart';

class AuthProvider extends ChangeNotifier {
  /// Deliberately the shared client, not a fresh one: the token set on login has
  /// to be the same one [MedicationsProvider] sends dose writes with. A private
  /// instance here silently strands every dose on the phone.
  final ApiService _api = ApiService.shared;

  AppUser? _user;
  bool _loading = false;
  String? _error;
  bool _needsActivation = false;

  /// The last sign-in attempt was for an account the patient hasn't activated
  /// yet (staff registered it), so the app should start activation instead.
  bool get needsActivation => _needsActivation;

  AppUser? get user => _user;
  bool get isLoggedIn => _user != null;
  bool get isAdmin => _user?.isAdmin ?? false;
  bool get loading => _loading;
  String? get error => _error;
  String? get token => _api.token;

  /// Log in with email and password.
  Future<bool> login(String email, String password) async {
    _loading = true;
    _error = null;
    _needsActivation = false;
    notifyListeners();

    try {
      final response = await _api.post(
        '/mobile/login',
        body: {
          'email': email,
          'password': password,
        },
        withAuth: false,
      );

      final data = response['data'] as Map<String, dynamic>;
      final token = data['token'] as String;
      final userJson = data['user'] as Map<String, dynamic>;

      _api.setToken(token);
      _user = AppUser.fromJson(userJson);
      _loading = false;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _needsActivation = e.reason == 'activation_required';
      _error = e.displayMessage;
      _loading = false;
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'Connection failed. Please check your network.';
      _loading = false;
      notifyListeners();
      return false;
    }
  }

  // ---------- Account activation / password reset (emailed code) ----------
  //
  // Each step returns an error message to show, or null when it worked.

  /// Step 1: email a 6-digit code. [onResendIn] gets the seconds to wait
  /// before another code can be asked for.
  Future<String?> requestCode(
    String email, {
    void Function(int seconds)? onResendIn,
  }) async {
    try {
      final response = await _api.post(
        '/mobile/otp/request',
        body: {'email': email.trim()},
        withAuth: false,
      );
      final data = response['data'] as Map<String, dynamic>?;
      onResendIn?.call((data?['resend_in'] as num?)?.toInt() ?? 60);
      return null;
    } on ApiException catch (e) {
      final wait = (e.data?['resend_in'] as num?)?.toInt();
      if (wait != null) onResendIn?.call(wait);
      return e.displayMessage;
    } catch (_) {
      return 'Connection failed. Please check your network.';
    }
  }

  /// Step 2: check the code. Returns the setup token on success.
  Future<({String? token, String? error})> verifyCode(
    String email,
    String code,
  ) async {
    try {
      final response = await _api.post(
        '/mobile/otp/verify',
        body: {'email': email.trim(), 'code': code},
        withAuth: false,
      );
      final data = response['data'] as Map<String, dynamic>;
      return (token: data['setup_token'] as String, error: null);
    } on ApiException catch (e) {
      return (token: null, error: e.displayMessage);
    } catch (_) {
      return (token: null, error: 'Connection failed. Please check your network.');
    }
  }

  /// Step 3: set the patient's own password; signs them straight in.
  Future<String?> completeSetup(
    String email,
    String setupToken,
    String password,
  ) async {
    try {
      final response = await _api.post(
        '/mobile/otp/complete',
        body: {
          'email': email.trim(),
          'setup_token': setupToken,
          'password': password,
          'password_confirmation': password,
        },
        withAuth: false,
      );
      final data = response['data'] as Map<String, dynamic>;
      _api.setToken(data['token'] as String);
      _user = AppUser.fromJson(data['user'] as Map<String, dynamic>);
      _needsActivation = false;
      _error = null;
      notifyListeners();
      return null;
    } on ApiException catch (e) {
      return e.displayMessage;
    } catch (_) {
      return 'Connection failed. Please check your network.';
    }
  }

  /// Register a new patient account.
  Future<bool> signup(String email, String password, {
    required String name,
    String? phone,
  }) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.post(
        '/register',
        body: {
          'name': name,
          'email': email,
          'phone': phone,
          'password': password,
          'password_confirmation': password,
        },
        withAuth: false,
      );

      final data = response['data'] as Map<String, dynamic>;
      final token = data['token'] as String;
      final userJson = data['user'] as Map<String, dynamic>;

      _api.setToken(token);
      _user = AppUser.fromJson(userJson);
      _loading = false;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.displayMessage;
      _loading = false;
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'Connection failed. Please check your network.';
      _loading = false;
      notifyListeners();
      return false;
    }
  }

  /// Log out and clear the session.
  Future<void> logout() async {
    _loading = true;
    notifyListeners();

    try {
      await _api.post('/mobile/logout');
    } catch (_) {
      // Even if the API call fails, clear local state
    }

    _api.setToken(null);
    _user = null;
    _error = null;
    _loading = false;
    notifyListeners();
  }

  /// Fetch the latest profile from the server.
  Future<bool> refreshProfile() async {
    if (_user == null) return false;

    try {
      final response = await _api.get('/mobile/profile');
      final data = response['data'] as Map<String, dynamic>;
      final userJson = data['user'] as Map<String, dynamic>;
      _user = AppUser.fromJson(userJson);
      notifyListeners();
      return true;
    } catch (_) {
      return false;
    }
  }
}
