import 'dart:io';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:video_player/video_player.dart';

import '../../models/medication.dart';
import '../../models/vot.dart';
import '../../providers/medications_provider.dart';
import '../../services/api_service.dart';
import '../../services/proof_capture_service.dart';
import '../../theme/app_theme.dart';
import 'vot_camera_page.dart';

/// How the review page was left.
enum VotReviewResult { retake, submitted, queued }

/// Play back the proof, then retake it or submit it.
///
/// Submitting compresses the clip, uploads it with a progress bar and, on
/// success, shows the confirmation. If the upload fails the patient can retry
/// or keep it to send automatically later — a recorded dose is never lost.
class VotReviewPage extends StatefulWidget {
  final VotCapture capture;
  final VotConfig config;
  final DoseLog? existing;
  final DateTime? forDay;

  const VotReviewPage({
    super.key,
    required this.capture,
    required this.config,
    this.existing,
    this.forDay,
  });

  @override
  State<VotReviewPage> createState() => _VotReviewPageState();
}

enum _Stage { review, preparing, uploading, failed, done }

class _VotReviewPageState extends State<VotReviewPage> {
  VideoPlayerController? _player;
  bool _playerFailed = false;

  _Stage _stage = _Stage.review;
  double _progress = 0;
  String? _error;
  bool _canQueue = false;
  bool _queued = false;

  /// The compressed, durable copy — made once, reused by every retry.
  VotProof? _proof;

  bool get _isVideo => widget.capture.mediaType == 'video';

  @override
  void initState() {
    super.initState();
    if (_isVideo) _initPlayer();
  }

  Future<void> _initPlayer() async {
    final player = VideoPlayerController.file(File(widget.capture.path));
    try {
      await player.initialize();
      await player.setLooping(true);
      if (!mounted) {
        await player.dispose();
        return;
      }
      setState(() => _player = player);
    } catch (_) {
      await player.dispose();
      if (mounted) setState(() => _playerFailed = true);
    }
  }

  @override
  void dispose() {
    _player?.dispose();
    super.dispose();
  }

  Future<void> _retake() async {
    await _player?.pause();
    await ProofCaptureService().discard(widget.capture.path);
    if (mounted) Navigator.of(context).pop(VotReviewResult.retake);
  }

  Future<void> _submit() async {
    // Read before any await: the context may not be usable afterwards.
    final meds = context.read<MedicationsProvider>();
    await _player?.pause();
    if (!mounted) return;
    setState(() {
      _error = null;
      _progress = 0;
      _stage = _Stage.preparing;
    });

    try {
      _proof ??= await ProofCaptureService().prepare(
        rawPath: widget.capture.path,
        mediaType: widget.capture.mediaType,
        durationSeconds: widget.capture.durationSeconds,
      );
    } catch (_) {
      _fail('Your recording could not be prepared. Please record it again.',
          canQueue: false);
      return;
    }

    // Check the size the server will enforce before spending data on it.
    final maxMb = _isVideo ? widget.config.maxVideoMb : widget.config.maxPhotoMb;
    final bytes = await File(_proof!.path).length();
    if (bytes > maxMb * 1024 * 1024) {
      _fail(
        'This ${_isVideo ? 'video' : 'photo'} is too large to send '
        '(limit $maxMb MB). Please record a shorter one.',
        canQueue: false,
      );
      return;
    }

    if (!mounted) return;
    setState(() => _stage = _Stage.uploading);

    try {
      await meds.submitVotProof(
        _proof!,
        existing: widget.existing,
        forDay: widget.forDay,
        onProgress: (p) {
          if (mounted) setState(() => _progress = p);
        },
      );
      if (mounted) setState(() => _stage = _Stage.done);
    } on ApiException catch (e) {
      // statusCode 0 = no connection / timeout: worth keeping for later.
      final offline = e.statusCode == 0 || e.statusCode >= 500;
      if (e.statusCode == 409) {
        _fail('Proof for this dose was already sent. Your nurse will review it.',
            canQueue: false);
      } else {
        _fail(
          offline
              ? 'Could not upload right now. Check your internet connection.'
              : e.displayMessage,
          canQueue: offline,
        );
      }
    }
  }

  Future<void> _queue() async {
    if (_proof == null) return;
    await context.read<MedicationsProvider>().queueVotProof(
          _proof!,
          existing: widget.existing,
          forDay: widget.forDay,
        );
    if (mounted) {
      setState(() {
        _queued = true;
        _stage = _Stage.done;
      });
    }
  }

  void _fail(String message, {required bool canQueue}) {
    if (!mounted) return;
    setState(() {
      _error = message;
      _canQueue = canQueue;
      _stage = _Stage.failed;
    });
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final busy = _stage == _Stage.preparing || _stage == _Stage.uploading;

    return PopScope(
      // Never leave mid-upload, and leave "done" only through its button.
      canPop: !busy && _stage != _Stage.done,
      child: Scaffold(
        backgroundColor: p.background,
        appBar: _stage == _Stage.done
            ? null
            : AppBar(
                title: Text(_isVideo ? 'Check your video' : 'Check your photo'),
                backgroundColor: Colors.transparent,
                automaticallyImplyLeading: !busy,
              ),
        body: SafeArea(
          child: _stage == _Stage.done ? _doneView(p) : _reviewView(p, busy),
        ),
      ),
    );
  }

  Widget _reviewView(AppPalette p, bool busy) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
      child: Column(
        children: [
          Expanded(child: _media(p)),
          const SizedBox(height: 14),
          if (_isVideo && widget.capture.durationSeconds != null)
            Text(
              'Length ${_fmt(widget.capture.durationSeconds!)}',
              style: TextStyle(color: p.textSecondary, fontSize: 13),
            ),
          const SizedBox(height: 14),
          if (busy) _progressPanel(p) else ...[
            if (_stage == _Stage.failed && _error != null) _errorPanel(p),
            _actions(p),
          ],
        ],
      ),
    );
  }

  Widget _media(AppPalette p) {
    final radius = BorderRadius.circular(AppRadius.lg);
    if (!_isVideo) {
      return ClipRRect(
        borderRadius: radius,
        child: Image.file(File(widget.capture.path), fit: BoxFit.contain),
      );
    }

    final player = _player;
    if (_playerFailed) {
      return Center(
        child: Text(
          'The video cannot be played back on this phone, but it was recorded '
          'and can still be sent.',
          textAlign: TextAlign.center,
          style: TextStyle(color: p.textSecondary),
        ),
      );
    }
    if (player == null) return const Center(child: CircularProgressIndicator());

    return Center(
      child: ClipRRect(
        borderRadius: radius,
        child: AspectRatio(
          aspectRatio: player.value.aspectRatio,
          child: Stack(
            alignment: Alignment.center,
            children: [
              VideoPlayer(player),
              ValueListenableBuilder<VideoPlayerValue>(
                valueListenable: player,
                builder: (_, value, _) => Material(
                  color: Colors.black38,
                  shape: const CircleBorder(),
                  child: IconButton(
                    iconSize: 44,
                    color: Colors.white,
                    tooltip: value.isPlaying ? 'Pause' : 'Play',
                    onPressed: () => value.isPlaying ? player.pause() : player.play(),
                    icon: Icon(value.isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded),
                  ),
                ),
              ),
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: VideoProgressIndicator(player, allowScrubbing: true),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _progressPanel(AppPalette p) {
    final preparing = _stage == _Stage.preparing;
    return Column(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: LinearProgressIndicator(
            minHeight: 8,
            value: preparing ? null : _progress,
            backgroundColor: p.primarySoft,
            color: p.primary,
          ),
        ),
        const SizedBox(height: 10),
        Text(
          preparing
              ? 'Preparing your ${_isVideo ? 'video' : 'photo'}…'
              : 'Uploading… ${(_progress * 100).round()}%',
          style: TextStyle(color: p.textSecondary, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 4),
        Text(
          'Please keep the app open.',
          style: TextStyle(color: p.textTertiary, fontSize: 12),
        ),
      ],
    );
  }

  Widget _errorPanel(AppPalette p) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: p.dangerBg,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.error_outline_rounded, color: p.danger, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(_error!, style: TextStyle(color: p.danger, height: 1.35)),
          ),
        ],
      ),
    );
  }

  Widget _actions(AppPalette p) {
    final failed = _stage == _Stage.failed;
    final shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(14));

    return Column(
      children: [
        SizedBox(
          width: double.infinity,
          height: 52,
          child: FilledButton.icon(
            onPressed: _submit,
            style: FilledButton.styleFrom(shape: shape),
            icon: Icon(failed ? Icons.refresh_rounded : Icons.send_rounded),
            label: Text(
              failed ? 'Try again' : 'Submit to my nurse',
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
            ),
          ),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _retake,
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                  shape: shape,
                ),
                icon: const Icon(Icons.replay_rounded),
                label: const Text('Retake'),
              ),
            ),
            if (failed && _canQueue) ...[
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _queue,
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(48),
                    shape: shape,
                  ),
                  icon: const Icon(Icons.schedule_send_rounded),
                  label: const Text('Send later'),
                ),
              ),
            ],
          ],
        ),
      ],
    );
  }

  Widget _doneView(AppPalette p) {
    final noun = _isVideo ? 'video' : 'photo';
    final title = _queued
        ? 'Saved on your phone'
        : 'Your medication $noun has been submitted successfully.';
    final body = _queued
        ? 'It will be sent to your nurse automatically when you are back '
            'online. Keep the app installed until then.'
        : 'Your dose is now waiting for your nurse to verify it. You will get '
            'a notification when it has been reviewed.';

    return Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 96,
            height: 96,
            decoration: BoxDecoration(
              color: _queued ? p.warningBg : p.successBg,
              shape: BoxShape.circle,
            ),
            child: Icon(
              _queued ? Icons.cloud_upload_outlined : Icons.check_rounded,
              size: 52,
              color: _queued ? p.warning : p.success,
            ),
          ),
          const SizedBox(height: 24),
          Text(
            title,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              height: 1.3,
              color: p.textPrimary,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            body,
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 14.5, height: 1.45, color: p.textSecondary),
          ),
          if (!_queued) ...[
            const SizedBox(height: 18),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: p.warningBg,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.hourglass_top_rounded, size: 16, color: p.warning),
                  const SizedBox(width: 6),
                  Text(
                    'Pending verification',
                    style: TextStyle(color: p.warning, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 36),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: FilledButton(
              onPressed: () => Navigator.of(context).pop(
                _queued ? VotReviewResult.queued : VotReviewResult.submitted,
              ),
              style: FilledButton.styleFrom(
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: const Text('Done', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }

  String _fmt(int seconds) =>
      '${seconds ~/ 60}:${(seconds % 60).toString().padLeft(2, '0')}';
}
