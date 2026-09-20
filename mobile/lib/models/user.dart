class PatientProfile {
  final int id;
  final String? dateOfBirth;
  final String? gender;
  final String? address;
  final String? emergencyContactName;
  final String? emergencyContactPhone;
  final String? occupation;
  final String? nationality;
  final String? healthIdNumber;
  final String? referredBy;
  final String? registeredAt;

  const PatientProfile({
    required this.id,
    this.dateOfBirth,
    this.gender,
    this.address,
    this.emergencyContactName,
    this.emergencyContactPhone,
    this.occupation,
    this.nationality,
    this.healthIdNumber,
    this.referredBy,
    this.registeredAt,
  });

  factory PatientProfile.fromJson(Map<String, dynamic> json) => PatientProfile(
        id: json['id'] as int,
        dateOfBirth: json['date_of_birth'] as String?,
        gender: json['gender'] as String?,
        address: json['address'] as String?,
        emergencyContactName: json['emergency_contact_name'] as String?,
        emergencyContactPhone: json['emergency_contact_phone'] as String?,
        occupation: json['occupation'] as String?,
        nationality: json['nationality'] as String?,
        healthIdNumber: json['health_id_number'] as String?,
        referredBy: json['referred_by'] as String?,
        registeredAt: json['registered_at'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'date_of_birth': dateOfBirth,
        'gender': gender,
        'address': address,
        'emergency_contact_name': emergencyContactName,
        'emergency_contact_phone': emergencyContactPhone,
        'occupation': occupation,
        'nationality': nationality,
        'health_id_number': healthIdNumber,
        'referred_by': referredBy,
        'registered_at': registeredAt,
      };
}

class AppUser {
  final int id;
  final String name;
  final String email;
  final String? phone;
  final String role;
  final String? profilePhotoUrl;
  final bool isActive;
  final String? emailVerifiedAt;
  final String? lastLoginAt;
  final String? createdAt;
  final PatientProfile? patient;

  const AppUser({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    this.role = 'patient',
    this.profilePhotoUrl,
    this.isActive = true,
    this.emailVerifiedAt,
    this.lastLoginAt,
    this.createdAt,
    this.patient,
  });

  /// Full display name (same as [name]).
  String get fullName => name;

  /// First word of the name.
  String get firstName {
    final parts = name.trim().split(' ');
    return parts.isNotEmpty ? parts.first : '';
  }

  /// Last word of the name.
  String get lastName {
    final parts = name.trim().split(' ');
    return parts.length > 1 ? parts.last : '';
  }

  /// Uppercase initials from the first and last name.
  String get initials {
    final parts = name.trim().split(' ');
    final first = parts.isNotEmpty ? parts.first[0].toUpperCase() : '';
    final last = parts.length > 1 ? parts.last[0].toUpperCase() : '';
    return '$first$last';
  }

  bool get isAdmin => role == 'admin';
  bool get isPatient => role == 'patient';

  factory AppUser.fromJson(Map<String, dynamic> json) {
    return AppUser(
      id: json['id'] as int,
      name: json['name'] as String? ?? '',
      email: json['email'] as String? ?? '',
      phone: json['phone'] as String?,
      role: json['role'] as String? ?? 'patient',
      profilePhotoUrl: json['profile_photo_url'] as String?,
      isActive: json['is_active'] as bool? ?? true,
      emailVerifiedAt: json['email_verified_at'] as String?,
      lastLoginAt: json['last_login_at'] as String?,
      createdAt: json['created_at'] as String?,
      patient: json['patient'] != null
          ? PatientProfile.fromJson(json['patient'] as Map<String, dynamic>)
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'email': email,
        'phone': phone,
        'role': role,
        'profile_photo_url': profilePhotoUrl,
        'is_active': isActive,
        'email_verified_at': emailVerifiedAt,
        'last_login_at': lastLoginAt,
        'created_at': createdAt,
        'patient': patient?.toJson(),
      };

  AppUser copyWith({
    String? name,
    String? email,
    String? phone,
    String? profilePhotoUrl,
    bool? isActive,
    String? emailVerifiedAt,
    String? lastLoginAt,
    PatientProfile? patient,
  }) =>
      AppUser(
        id: id,
        name: name ?? this.name,
        email: email ?? this.email,
        phone: phone ?? this.phone,
        role: role,
        profilePhotoUrl: profilePhotoUrl ?? this.profilePhotoUrl,
        isActive: isActive ?? this.isActive,
        emailVerifiedAt: emailVerifiedAt ?? this.emailVerifiedAt,
        lastLoginAt: lastLoginAt ?? this.lastLoginAt,
        createdAt: createdAt,
        patient: patient ?? this.patient,
      );
}
