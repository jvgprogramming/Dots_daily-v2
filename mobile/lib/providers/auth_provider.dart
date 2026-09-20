import 'package:flutter/foundation.dart';
import '../models/user.dart';
import '../services/api_service.dart';

class AuthProvider extends ChangeNotifier {
  final ApiService _api = ApiService();

  AppUser? _user;
  bool _loading = false;
  String? _error;

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
      _error = e.message;
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
      _error = e.message;
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
