/// Video-Observed Therapy settings for the signed-in patient, from
/// `GET /mobile/vot`. The clinic controls all of it (Settings → VOT on the
/// web portal), so nothing here is hard-coded in the app.
class VotConfig {
  /// Whether this patient records proof for each dose (VOT) instead of the
  /// plain "I took it" confirmation.
  final bool enrolled;

  /// active | suspended | revoked | null (never assessed).
  final String? status;
  final String? assignedNurseName;

  /// Numbered steps shown before the camera opens.
  final List<String> instructions;

  /// 'video' and/or 'photo'.
  final List<String> allowedMedia;
  final int minVideoSeconds;
  final int maxVideoSeconds;
  final int maxVideoMb;
  final int maxPhotoMb;
  final bool allowResubmitAfterReject;

  const VotConfig({
    required this.enrolled,
    this.status,
    this.assignedNurseName,
    this.instructions = defaultInstructions,
    this.allowedMedia = const ['video', 'photo'],
    this.minVideoSeconds = 5,
    this.maxVideoSeconds = 120,
    this.maxVideoMb = 64,
    this.maxPhotoMb = 10,
    this.allowResubmitAfterReject = true,
  });

  /// Not enrolled — the plain dose confirmation applies.
  static const VotConfig none = VotConfig(enrolled: false);

  /// Used only if the clinic has cleared every instruction line.
  static const List<String> defaultInstructions = [
    "Say your full name and today's date.",
    'Show your prescribed medicine or its packaging to the camera.',
    'Keep your face, hands and medicine in view the whole time.',
    'Put the medicine in your mouth and swallow it with water.',
    'Open your mouth and lift your tongue toward the camera.',
  ];

  bool get allowsVideo => allowedMedia.contains('video');
  bool get allowsPhoto => allowedMedia.contains('photo');

  factory VotConfig.fromJson(Map<String, dynamic> json) {
    final instructions = (json['instructions'] as List<dynamic>? ?? [])
        .map((e) => '$e'.trim())
        .where((e) => e.isNotEmpty)
        .toList();
    final media = (json['allowed_media'] as List<dynamic>? ?? ['video'])
        .map((e) => '$e')
        .toList();

    return VotConfig(
      enrolled: json['enrolled'] as bool? ?? false,
      status: json['status'] as String?,
      assignedNurseName: json['assigned_nurse_name'] as String?,
      instructions: instructions.isEmpty ? defaultInstructions : instructions,
      allowedMedia: media.isEmpty ? const ['video'] : media,
      minVideoSeconds: (json['min_video_seconds'] as num?)?.toInt() ?? 5,
      maxVideoSeconds: (json['max_video_seconds'] as num?)?.toInt() ?? 120,
      maxVideoMb: (json['max_video_mb'] as num?)?.toInt() ?? 64,
      maxPhotoMb: (json['max_photo_mb'] as num?)?.toInt() ?? 10,
      allowResubmitAfterReject:
          json['allow_resubmit_after_reject'] as bool? ?? true,
    );
  }
}

/// A recorded proof waiting to be (or being) uploaded.
class VotProof {
  final String path;

  /// 'video' or 'photo'.
  final String mediaType;
  final int? durationSeconds;

  const VotProof({
    required this.path,
    required this.mediaType,
    this.durationSeconds,
  });

  bool get isVideo => mediaType == 'video';
}

/// What a dose's VOT review state means for the patient, in plain words.
class VotStatusText {
  VotStatusText._();

  static String label(String? status) => switch (status) {
        'awaiting_proof' => 'Proof needed',
        'pending' => 'Waiting for nurse review',
        'verified' => 'Verified by your nurse',
        'rejected' => 'Proof not accepted',
        'resubmission_required' => 'Please record again',
        _ => 'Logged',
      };

  /// Statuses where the patient can (and should) send new proof.
  static bool needsNewProof(String? status) =>
      status == 'awaiting_proof' ||
      status == 'rejected' ||
      status == 'resubmission_required';
}
