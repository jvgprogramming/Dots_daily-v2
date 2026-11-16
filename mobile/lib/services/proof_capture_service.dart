import 'dart:io';

import 'package:path_provider/path_provider.dart';
import 'package:video_compress/video_compress.dart';

import '../models/vot.dart';

/// Prepares a proof recorded by the in-app camera (VotCameraPage) for upload.
///
/// Videos are compressed on-device so a dose clip lands at a few MB instead of
/// tens; photos are kept as taken. Either way the file is moved into the app
/// documents directory, so a proof queued while offline survives a force-quit
/// and the OS clearing its temp/cache folder.
class ProofCaptureService {
  ProofCaptureService._();
  static final ProofCaptureService instance = ProofCaptureService._();
  factory ProofCaptureService() => instance;

  Future<VotProof> prepare({
    required String rawPath,
    required String mediaType,
    int? durationSeconds,
  }) async {
    final isVideo = mediaType == 'video';
    var sourcePath = rawPath;
    File? compressed;

    if (isVideo) {
      try {
        final info = await VideoCompress.compressVideo(
          rawPath,
          quality: VideoQuality.MediumQuality,
          deleteOrigin: false,
          includeAudio: true,
        );
        if (info?.file != null) {
          compressed = info!.file!;
          sourcePath = compressed.path;
        }
      } catch (_) {
        // Keep the original recording when the compressor is unavailable.
      }
    }

    final dir = await getApplicationDocumentsDirectory();
    final proofsDir = Directory('${dir.path}/proofs');
    if (!await proofsDir.exists()) await proofsDir.create(recursive: true);

    final ext = isVideo ? 'mp4' : _extension(rawPath, fallback: 'jpg');
    final dest =
        '${proofsDir.path}/dose_${DateTime.now().millisecondsSinceEpoch}.$ext';
    final saved = await File(sourcePath).copy(dest);

    // The durable copy exists; drop the camera's and compressor's temp files.
    await _tryDelete(rawPath);
    if (compressed != null) await _tryDelete(compressed.path);

    return VotProof(
      path: saved.path,
      mediaType: mediaType,
      durationSeconds: durationSeconds,
    );
  }

  /// Deletes a recording the patient discarded (retake / cancel).
  Future<void> discard(String? path) async {
    if (path != null) await _tryDelete(path);
  }

  String _extension(String path, {required String fallback}) {
    final dot = path.lastIndexOf('.');
    if (dot == -1 || dot < path.length - 6) return fallback;
    return path.substring(dot + 1).toLowerCase();
  }

  Future<void> _tryDelete(String path) async {
    try {
      final file = File(path);
      if (await file.exists()) await file.delete();
    } catch (_) {
      // A leftover temp file is harmless.
    }
  }
}
