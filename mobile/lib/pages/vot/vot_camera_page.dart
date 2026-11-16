import 'dart:async';
import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

import '../../models/vot.dart';

/// What the camera page hands back: the raw file and, for video, its length.
class VotCapture {
  final String path;
  final String mediaType;
  final int? durationSeconds;

  const VotCapture({
    required this.path,
    required this.mediaType,
    this.durationSeconds,
  });
}

/// In-app camera for VOT proof — a live preview, front/rear switching, a
/// recording indicator with a timer, and Start/Stop. Recording only (no gallery
/// pick), so an old clip can never be passed off as today's dose.
///
/// Pops with a [VotCapture], or null if the patient backs out.
class VotCameraPage extends StatefulWidget {
  /// 'video' or 'photo'.
  final String mediaType;
  final VotConfig config;

  const VotCameraPage({
    super.key,
    required this.mediaType,
    required this.config,
  });

  @override
  State<VotCameraPage> createState() => _VotCameraPageState();
}

class _VotCameraPageState extends State<VotCameraPage>
    with WidgetsBindingObserver {
  List<CameraDescription> _cameras = [];
  CameraController? _controller;
  int _cameraIndex = 0;

  bool _initializing = true;
  String? _error;

  bool _recording = false;
  bool _busy = false;
  int _elapsed = 0;
  Timer? _ticker;

  bool get _isVideo => widget.mediaType == 'video';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _setUp();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _ticker?.cancel();
    _controller?.dispose();
    super.dispose();
  }

  /// The camera must be released when the app goes to the background and
  /// re-opened on return (required on Android; a recording is abandoned).
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;

    if (state == AppLifecycleState.inactive) {
      _ticker?.cancel();
      _recording = false;
      _elapsed = 0;
      controller.dispose();
      _controller = null;
      if (mounted) setState(() {});
    } else if (state == AppLifecycleState.resumed) {
      _openCamera(_cameraIndex);
    }
  }

  Future<void> _setUp() async {
    try {
      _cameras = await availableCameras();
    } on CameraException catch (e) {
      _fail(_describe(e));
      return;
    }
    if (_cameras.isEmpty) {
      _fail('No camera was found on this phone.');
      return;
    }
    // Start on the front camera: the patient films themselves.
    final front = _cameras.indexWhere(
      (c) => c.lensDirection == CameraLensDirection.front,
    );
    await _openCamera(front == -1 ? 0 : front);
  }

  Future<void> _openCamera(int index) async {
    setState(() {
      _initializing = true;
      _error = null;
    });

    final previous = _controller;
    _controller = null;
    await previous?.dispose();

    final controller = CameraController(
      _cameras[index],
      ResolutionPreset.medium,
      enableAudio: _isVideo,
    );

    try {
      await controller.initialize();
      if (_isVideo) await controller.prepareForVideoRecording();
    } on CameraException catch (e) {
      await controller.dispose();
      _fail(_describe(e));
      return;
    }

    if (!mounted) {
      await controller.dispose();
      return;
    }
    setState(() {
      _controller = controller;
      _cameraIndex = index;
      _initializing = false;
    });
  }

  void _fail(String message) {
    if (!mounted) return;
    setState(() {
      _initializing = false;
      _error = message;
    });
  }

  String _describe(CameraException e) => switch (e.code) {
        'CameraAccessDenied' ||
        'CameraAccessDeniedWithoutPrompt' ||
        'CameraAccessRestricted' =>
          'Camera access is turned off. Allow camera access for DOTS Daily in '
              'your phone settings, then try again.',
        'AudioAccessDenied' ||
        'AudioAccessDeniedWithoutPrompt' ||
        'AudioAccessRestricted' =>
          'Microphone access is turned off. Your nurse needs to hear you say '
              'your name and the date — allow microphone access for DOTS Daily '
              'in your phone settings, then try again.',
        _ => 'The camera could not start (${e.description ?? e.code}). '
            'Please try again.',
      };

  Future<void> _switchCamera() async {
    if (_cameras.length < 2 || _recording || _busy) return;
    await _openCamera((_cameraIndex + 1) % _cameras.length);
  }

  Future<void> _startRecording() async {
    final controller = _controller;
    if (controller == null || _recording || _busy) return;
    setState(() => _busy = true);
    try {
      await controller.startVideoRecording();
      _elapsed = 0;
      _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
        if (!mounted) return;
        setState(() => _elapsed++);
        // The clinic's limit — stop for the patient rather than reject later.
        if (_elapsed >= widget.config.maxVideoSeconds) _stopRecording();
      });
      setState(() => _recording = true);
    } on CameraException catch (e) {
      _showSnack(_describe(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _stopRecording() async {
    final controller = _controller;
    if (controller == null || !_recording || _busy) return;

    if (_elapsed < widget.config.minVideoSeconds) {
      _showSnack(
        'Keep recording — at least ${widget.config.minVideoSeconds} seconds, '
        'so your nurse can see the whole dose.',
      );
      return;
    }

    setState(() => _busy = true);
    _ticker?.cancel();
    try {
      final file = await controller.stopVideoRecording();
      if (!mounted) return;
      Navigator.of(context).pop(
        VotCapture(path: file.path, mediaType: 'video', durationSeconds: _elapsed),
      );
    } on CameraException catch (e) {
      _showSnack(_describe(e));
      setState(() {
        _recording = false;
        _busy = false;
        _elapsed = 0;
      });
    }
  }

  Future<void> _takePhoto() async {
    final controller = _controller;
    if (controller == null || _busy) return;
    setState(() => _busy = true);
    try {
      final file = await controller.takePicture();
      if (!mounted) return;
      Navigator.of(context).pop(
        VotCapture(path: file.path, mediaType: 'photo'),
      );
    } on CameraException catch (e) {
      _showSnack(_describe(e));
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _close() async {
    if (_recording) {
      final leave = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Stop recording?'),
          content: const Text('This recording will be discarded.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Keep recording'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Discard'),
            ),
          ],
        ),
      );
      if (leave != true) return;
      _ticker?.cancel();
      try {
        final file = await _controller?.stopVideoRecording();
        if (file != null) await File(file.path).delete();
      } catch (_) {}
    }
    if (mounted) Navigator.of(context).pop();
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
      );
  }

  String get _timer {
    final m = (_elapsed ~/ 60).toString();
    final s = (_elapsed % 60).toString().padLeft(2, '0');
    final max = widget.config.maxVideoSeconds;
    return '$m:$s / ${max ~/ 60}:${(max % 60).toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !_recording,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _close();
      },
      child: Scaffold(
        backgroundColor: Colors.black,
        body: SafeArea(
          child: Column(
            children: [
              _topBar(),
              Expanded(child: _preview()),
              _controls(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _topBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 16, 8),
      child: Row(
        children: [
          IconButton(
            onPressed: _close,
            tooltip: 'Close camera',
            icon: const Icon(Icons.close_rounded, color: Colors.white),
          ),
          const Spacer(),
          if (_isVideo)
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: _recording
                    ? const Color(0xFFC0412F)
                    : Colors.white.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (_recording) ...[
                    const _BlinkingDot(),
                    const SizedBox(width: 6),
                    const Text(
                      'REC',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
                        letterSpacing: 0.8,
                      ),
                    ),
                    const SizedBox(width: 8),
                  ],
                  Text(
                    _timer,
                    style: const TextStyle(
                      color: Colors.white,
                      fontFeatures: [FontFeature.tabularFigures()],
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _preview() {
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.no_photography_outlined,
                  color: Colors.white70, size: 48),
              const SizedBox(height: 16),
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white, fontSize: 15, height: 1.4),
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: _cameras.isEmpty ? _setUp : () => _openCamera(_cameraIndex),
                child: const Text('Try again'),
              ),
            ],
          ),
        ),
      );
    }

    final controller = _controller;
    if (_initializing || controller == null || !controller.value.isInitialized) {
      return const Center(child: CircularProgressIndicator(color: Colors.white));
    }

    return Center(
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: CameraPreview(controller),
      ),
    );
  }

  Widget _controls() {
    final ready = _controller?.value.isInitialized == true && _error == null;
    final hint = _isVideo
        ? (_recording
            ? 'Tap stop when you have swallowed your medicine'
            : 'Face, hands and medicine in view, then tap record')
        : 'Hold your medicine up to the camera';

    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 12, 24, 28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            hint,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white70, fontSize: 13),
          ),
          const SizedBox(height: 18),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const SizedBox(width: 52),
              _ShutterButton(
                recording: _recording,
                isVideo: _isVideo,
                enabled: ready && !_busy,
                onTap: _isVideo
                    ? (_recording ? _stopRecording : _startRecording)
                    : _takePhoto,
              ),
              SizedBox(
                width: 52,
                child: _cameras.length > 1
                    ? IconButton(
                        onPressed: ready && !_recording && !_busy ? _switchCamera : null,
                        tooltip: 'Switch camera',
                        iconSize: 28,
                        color: Colors.white,
                        disabledColor: Colors.white24,
                        icon: const Icon(Icons.cameraswitch_rounded),
                      )
                    : null,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ShutterButton extends StatelessWidget {
  final bool recording;
  final bool isVideo;
  final bool enabled;
  final VoidCallback onTap;

  const _ShutterButton({
    required this.recording,
    required this.isVideo,
    required this.enabled,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final label = !isVideo
        ? 'Take photo'
        : (recording ? 'Stop recording' : 'Start recording');

    return Semantics(
      button: true,
      label: label,
      child: GestureDetector(
        onTap: enabled ? onTap : null,
        child: Opacity(
          opacity: enabled ? 1 : 0.4,
          child: Container(
            width: 78,
            height: 78,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white, width: 4),
            ),
            alignment: Alignment.center,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              width: recording ? 30 : 62,
              height: recording ? 30 : 62,
              decoration: BoxDecoration(
                color: isVideo ? const Color(0xFFC0412F) : Colors.white,
                borderRadius: BorderRadius.circular(recording ? 6 : 31),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _BlinkingDot extends StatefulWidget {
  const _BlinkingDot();

  @override
  State<_BlinkingDot> createState() => _BlinkingDotState();
}

class _BlinkingDotState extends State<_BlinkingDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 700),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _c,
      child: Container(
        width: 8,
        height: 8,
        decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
      ),
    );
  }
}
