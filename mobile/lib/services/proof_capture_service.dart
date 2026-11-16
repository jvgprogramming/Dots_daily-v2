import 'dart:io';

import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:video_compress/video_compress.dart';

/// Captures the patient's proof-of-intake video for a dose.
///
/// Opens the camera recorder directly (no gallery pick, so an old clip can't be
/// submitted — important for DOTS integrity), caps the length, compresses the
/// result on-device, and stores it under the app documents directory so a
/// queued/offline clip survives a force-quit and OS temp cleanup.
class ProofCaptureService {
  ProofCaptureService._();
  static final ProofCaptureService instance = ProofCaptureService._();
  factory ProofCaptureService() => instance;

  final ImagePicker _picker = ImagePicker();

  /// Records and returns a durable local path to the compressed clip, or null
  /// if the patient backed out of recording (the caller must then NOT mark the
  /// dose as taken / dismiss the alarm).
  Future<String?> record({
    Duration maxDuration = const Duration(seconds: 30),
  }) async {
    final XFile? raw = await _picker.pickVideo(
      source: ImageSource.camera,
      maxDuration: maxDuration,
      preferredCameraDevice: CameraDevice.front,
    );
    if (raw == null) return null;

    // Compress on-device; fall back to the raw file if compression fails.
    String sourcePath = raw.path;
    File? compressedFile;
    try {
      final info = await VideoCompress.compressVideo(
        raw.path,
        quality: VideoQuality.LowQuality,
        deleteOrigin: true,
        includeAudio: true,
      );
      final file = info?.file;
      if (file != null) {
        compressedFile = file;
        sourcePath = file.path;
      }
    } catch (_) {
      // Keep the raw recording when the compressor is unavailable.
    }

    // Move into app-docs under a stable name.
    try {
      final dir = await getApplicationDocumentsDirectory();
      final proofsDir = Directory('${dir.path}/proof_videos');
      if (!await proofsDir.exists()) {
        await proofsDir.create(recursive: true);
      }
      final dest =
          '${proofsDir.path}/dose_${DateTime.now().millisecondsSinceEpoch}.mp4';
      final saved = await File(sourcePath).copy(dest);

      // Drop the compressor's cache copy once it's safely moved.
      if (compressedFile != null && compressedFile.path != saved.path) {
        try {
          await compressedFile.delete();
        } catch (_) {}
      }
      return saved.path;
    } catch (_) {
      // If the move failed, hand back whatever path we do have.
      return sourcePath;
    }
  }
}
