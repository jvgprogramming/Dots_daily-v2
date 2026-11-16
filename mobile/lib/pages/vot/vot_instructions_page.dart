import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/medication.dart';
import '../../providers/medications_provider.dart';
import '../../theme/app_theme.dart';
import 'vot_camera_page.dart';
import 'vot_review_page.dart';

/// Entry point of the Video-Observed Therapy flow:
/// instructions → camera → review/retake → upload → confirmation.
///
/// Resolves to true once the proof was submitted (or safely queued), false if
/// the patient backed out — callers such as the alarm keep ringing then.
Future<bool> startVotFlow(
  BuildContext context, {
  DoseLog? existing,
  DateTime? forDay,
}) async {
  final result = await Navigator.of(context, rootNavigator: true).push<bool>(
    MaterialPageRoute(
      builder: (_) => VotInstructionsPage(existing: existing, forDay: forDay),
    ),
  );
  return result ?? false;
}

/// Explains what the recording must show (the clinic's own protocol, from
/// Settings → VOT) before the camera opens.
class VotInstructionsPage extends StatelessWidget {
  final DoseLog? existing;
  final DateTime? forDay;

  const VotInstructionsPage({super.key, this.existing, this.forDay});

  /// Camera → review, looping on "Retake", until submitted or abandoned.
  Future<void> _record(BuildContext context, String mediaType) async {
    final config = context.read<MedicationsProvider>().vot;
    final navigator = Navigator.of(context);

    while (true) {
      final capture = await navigator.push<VotCapture>(
        MaterialPageRoute(
          builder: (_) => VotCameraPage(mediaType: mediaType, config: config),
        ),
      );
      if (capture == null) return; // closed the camera → back to instructions

      final result = await navigator.push<VotReviewResult>(
        MaterialPageRoute(
          builder: (_) => VotReviewPage(
            capture: capture,
            config: config,
            existing: existing,
            forDay: forDay,
          ),
        ),
      );

      if (result == VotReviewResult.retake) continue;
      if (result == VotReviewResult.submitted || result == VotReviewResult.queued) {
        navigator.pop(true);
      }
      // Backed out of the review screen without choosing: stay here.
      return;
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final config = context.watch<MedicationsProvider>().vot;
    final reason = existing?.reviewReason;

    return Scaffold(
      backgroundColor: p.background,
      appBar: AppBar(
        title: const Text('Record your dose'),
        backgroundColor: Colors.transparent,
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
                children: [
                  if (reason != null && reason.trim().isNotEmpty) ...[
                    _NurseNote(reason: reason),
                    const SizedBox(height: 16),
                  ],
                  Text(
                    'Before you start',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                      color: p.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    config.assignedNurseName != null
                        ? 'Your recording goes to ${config.assignedNurseName}, '
                            'your nurse, who checks that you took your dose.'
                        : 'Your recording goes to your clinic’s nurse, who '
                            'checks that you took your dose.',
                    style: TextStyle(fontSize: 14, height: 1.45, color: p.textSecondary),
                  ),
                  const SizedBox(height: 20),
                  for (var i = 0; i < config.instructions.length; i++)
                    _Step(number: i + 1, text: config.instructions[i]),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: p.infoBg,
                      borderRadius: BorderRadius.circular(AppRadius.md),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.lock_outline_rounded, size: 18, color: p.info),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Only your clinic’s healthcare workers can see this '
                            'recording. Videos can be ${config.minVideoSeconds}–'
                            '${config.maxVideoSeconds} seconds long.',
                            style: TextStyle(fontSize: 12.5, height: 1.4, color: p.info),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
              child: Column(
                children: [
                  if (config.allowsVideo)
                    SizedBox(
                      width: double.infinity,
                      height: 54,
                      child: FilledButton.icon(
                        onPressed: () => _record(context, 'video'),
                        style: FilledButton.styleFrom(
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        icon: const Icon(Icons.videocam_rounded),
                        label: const Text(
                          'Open camera and record',
                          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ),
                  if (config.allowsVideo && config.allowsPhoto) const SizedBox(height: 10),
                  if (config.allowsPhoto)
                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: config.allowsVideo
                          ? OutlinedButton.icon(
                              onPressed: () => _record(context, 'photo'),
                              style: OutlinedButton.styleFrom(
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                              ),
                              icon: const Icon(Icons.photo_camera_outlined),
                              label: const Text('Take a photo instead'),
                            )
                          : FilledButton.icon(
                              onPressed: () => _record(context, 'photo'),
                              style: FilledButton.styleFrom(
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                              ),
                              icon: const Icon(Icons.photo_camera_rounded),
                              label: const Text('Open camera'),
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
}

class _Step extends StatelessWidget {
  final int number;
  final String text;

  const _Step({required this.number, required this.text});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 30,
            height: 30,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: p.primarySoft, shape: BoxShape.circle),
            child: Text(
              '$number',
              style: TextStyle(fontWeight: FontWeight.w700, color: p.primaryStrong),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(top: 5),
              child: Text(
                text,
                style: TextStyle(fontSize: 15, height: 1.4, color: p.textBody),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The nurse's reason when they asked for this dose to be recorded again.
class _NurseNote extends StatelessWidget {
  final String reason;

  const _NurseNote({required this.reason});

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: p.warningBg,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: p.warning.withValues(alpha: 0.35)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.chat_bubble_outline_rounded, size: 18, color: p.warning),
          const SizedBox(width: 10),
          Expanded(
            child: Text.rich(
              TextSpan(
                children: [
                  const TextSpan(
                    text: 'Your nurse asked for a new recording: ',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                  TextSpan(text: reason),
                ],
              ),
              style: TextStyle(fontSize: 13.5, height: 1.4, color: p.textPrimary),
            ),
          ),
        ],
      ),
    );
  }
}
