import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/medication.dart';
import 'package:mobile/models/vot.dart';

/// Video-Observed Therapy: the clinic's settings and the review state the app
/// reads back from the backend.
void main() {
  test('VOT settings come from the backend, with safe fallbacks', () {
    final config = VotConfig.fromJson({
      'enrolled': true,
      'status': 'active',
      'assigned_nurse_name': 'Nurse Joy',
      'instructions': ['Say your name.', '  ', 'Swallow with water.'],
      'allowed_media': ['video'],
      'min_video_seconds': 8,
      'max_video_seconds': 90,
      'allow_resubmit_after_reject': false,
    });

    expect(config.enrolled, isTrue);
    expect(config.assignedNurseName, 'Nurse Joy');
    // Blank lines from the settings textarea are dropped.
    expect(config.instructions, ['Say your name.', 'Swallow with water.']);
    expect(config.allowsVideo, isTrue);
    expect(config.allowsPhoto, isFalse);
    expect(config.minVideoSeconds, 8);
    expect(config.maxVideoSeconds, 90);
    expect(config.allowResubmitAfterReject, isFalse);

    // A clinic that cleared every instruction still gets a usable protocol.
    expect(
      VotConfig.fromJson({'enrolled': true, 'instructions': []}).instructions,
      VotConfig.defaultInstructions,
    );
    expect(VotConfig.none.enrolled, isFalse);
  });

  test('a dose carries its review state and the nurse\'s reason', () {
    final log = DoseLog.fromApiJson({
      'id': 12,
      'scheduled_date': '2026-11-16',
      'scheduled_time': '07:00',
      'taken_at': '2026-11-16T07:05:00+08:00',
      'status': 'taken',
      'verified': false,
      'verification_status': 'resubmission_required',
      'review_reason': 'Video cut off before swallowing.',
    });

    expect(log.verificationStatus, 'resubmission_required');
    expect(log.reviewReason, 'Video cut off before swallowing.');
    expect(log.scheduledDate, '2026-11-16');
    expect(VotStatusText.needsNewProof(log.verificationStatus), isTrue);
    expect(VotStatusText.needsNewProof('pending'), isFalse);
    expect(VotStatusText.needsNewProof('verified'), isFalse);
  });

  test('a proof queued offline survives a restart', () {
    final queued = DoseLog(
      id: 'vot-1',
      medicationId: '1',
      medicationName: 'Drug Intake',
      timestamp: DateTime(2026, 11, 16, 7, 5),
      verified: false,
      scheduledDate: '2026-11-16',
      localVideoPath: '/proofs/dose_1.mp4',
      localProofType: 'video',
      localProofSeconds: 34,
    );

    final restored = DoseLog.fromJson(queued.toJson());

    expect(restored.hasQueuedProof, isTrue);
    expect(restored.localProofType, 'video');
    expect(restored.localProofSeconds, 34);
    expect(restored.scheduledDate, '2026-11-16');

    // Once uploaded the local file reference is cleared.
    expect(restored.copyWith(clearLocalVideoPath: true).hasQueuedProof, isFalse);
  });
}
