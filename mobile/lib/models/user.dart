class AppUser {
  final String id;
  final String email;
  final String firstName;
  final String? middleName;
  final String lastName;
  final String? suffix;
  final String role;
  final String? phone;
  final String? dateOfBirth;
  final String? emergencyContact;
  final String? avatar;

  const AppUser({
    required this.id,
    required this.email,
    required this.firstName,
    this.middleName,
    required this.lastName,
    this.suffix,
    this.role = 'user',
    this.phone,
    this.dateOfBirth,
    this.emergencyContact,
    this.avatar,
  });

  String get fullName {
    final parts = [firstName, middleName, lastName];
    final name = parts.where((p) => p != null && p.isNotEmpty).join(' ');
    if (suffix != null && suffix!.isNotEmpty) {
      return '$name ${suffix!}';
    }
    return name;
  }

  String get initials {
    final first = firstName.isNotEmpty ? firstName[0].toUpperCase() : '';
    final last = lastName.isNotEmpty ? lastName[0].toUpperCase() : '';
    return '$first$last';
  }

  bool get isAdmin => role == 'admin';

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'firstName': firstName,
        'middleName': middleName,
        'lastName': lastName,
        'suffix': suffix,
        'role': role,
        'phone': phone,
        'dateOfBirth': dateOfBirth,
        'emergencyContact': emergencyContact,
      };

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
        id: json['id'] as String,
        email: json['email'] as String,
        firstName: json['firstName'] as String? ?? '',
        middleName: json['middleName'] as String?,
        lastName: json['lastName'] as String? ?? '',
        suffix: json['suffix'] as String?,
        role: json['role'] as String? ?? 'user',
        phone: json['phone'] as String?,
        dateOfBirth: json['dateOfBirth'] as String?,
        emergencyContact: json['emergencyContact'] as String?,
      );

  AppUser copyWith({
    String? firstName,
    String? middleName,
    String? lastName,
    String? suffix,
    String? phone,
    String? dateOfBirth,
    String? emergencyContact,
  }) =>
      AppUser(
        id: id,
        email: email,
        firstName: firstName ?? this.firstName,
        middleName: middleName ?? this.middleName,
        lastName: lastName ?? this.lastName,
        suffix: suffix ?? this.suffix,
        role: role,
        phone: phone ?? this.phone,
        dateOfBirth: dateOfBirth ?? this.dateOfBirth,
        emergencyContact: emergencyContact ?? this.emergencyContact,
      );
}
