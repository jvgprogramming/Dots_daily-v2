import 'package:flutter/foundation.dart';
import '../models/user.dart';

class AuthProvider extends ChangeNotifier {
  AppUser? _user;

  AppUser? get user => _user;
  bool get isLoggedIn => _user != null;
  bool get isAdmin => _user?.isAdmin ?? false;

  // Mock user for development
  static final mockUser = AppUser(
    id: '1',
    email: 'john.doe@example.com',
    firstName: 'John',
    lastName: 'Doe',
    role: 'user',
    phone: '+1 (555) 123-4567',
    dateOfBirth: '1985-06-15',
  );

  Future<bool> login(String email, String password) async {
    // Mock login - accept any credentials for demo
    await Future.delayed(const Duration(milliseconds: 800));
    _user = mockUser;
    notifyListeners();
    return true;
  }

  Future<bool> signup(String email, String password, {
    required String firstName,
    String? middleName,
    required String lastName,
    String? suffix,
  }) async {
    await Future.delayed(const Duration(milliseconds: 800));
    _user = AppUser(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      email: email,
      firstName: firstName,
      middleName: middleName,
      lastName: lastName,
      suffix: suffix,
      role: 'user',
    );
    notifyListeners();
    return true;
  }

  Future<void> logout() async {
    _user = null;
    notifyListeners();
  }

  void updateProfile({
    String? firstName,
    String? middleName,
    String? lastName,
    String? suffix,
    String? phone,
    String? dateOfBirth,
    String? emergencyContact,
  }) {
    if (_user == null) return;
    _user = _user!.copyWith(
      firstName: firstName,
      middleName: middleName,
      lastName: lastName,
      suffix: suffix,
      phone: phone,
      dateOfBirth: dateOfBirth,
    );
    notifyListeners();
  }
}
