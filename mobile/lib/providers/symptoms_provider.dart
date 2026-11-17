import 'package:flutter/foundation.dart';

import '../data/symptom_catalog.dart';
import '../models/symptom_log.dart';
import '../services/api_service.dart';

/// Backs the Symptom Monitor tab: loads the patient's past reports and submits
/// new ones to `/mobile/symptoms`. Online-only by design — a symptom report is
/// not time-critical like a dose, so a failure surfaces as a clear error rather
/// than being queued.
class SymptomsProvider extends ChangeNotifier {
  final ApiService _api = ApiService.shared;

  List<SymptomLog> _history = [];
  bool _loading = false;
  String? _error;
  bool _disposed = false;

  List<SymptomLog> get history => _history;
  bool get isLoading => _loading;
  String? get error => _error;

  /// Pulls the patient's symptom history. No-op when signed out.
  Future<void> load() async {
    if (_api.token == null || _loading) return;
    _loading = true;
    _safeNotify();
    try {
      final res = await _api.get('/mobile/symptoms');
      final data = res['data'] as Map<String, dynamic>;
      _history = (data['symptoms'] as List<dynamic>? ?? [])
          .map((e) => SymptomLog.fromApiJson(e as Map<String, dynamic>))
          .toList();
      _error = null;
    } catch (_) {
      _error = 'Could not load your symptom history.';
    } finally {
      _loading = false;
      _safeNotify();
    }
  }

  /// Submits a report. Returns true when the clinic flagged it as needing
  /// urgent attention. Throws [ApiException] so the page can show the reason.
  Future<bool> report({
    required List<ReportedSymptom> symptoms,
    String? notes,
    DateTime? date,
  }) async {
    final res = await _api.post('/mobile/symptoms', body: {
      'recorded_date': _dayKey(date ?? DateTime.now()),
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
      'symptoms': symptoms
          .map((s) => {'type': s.slug, 'severity': s.severity.apiValue})
          .toList(),
    });

    final data = res['data'] as Map<String, dynamic>;
    final added = (data['symptoms'] as List<dynamic>? ?? [])
        .map((e) => SymptomLog.fromApiJson(e as Map<String, dynamic>))
        .toList();

    _history = [...added, ..._history];
    _error = null;
    _safeNotify();

    return data['red_flag'] == true;
  }

  static String _dayKey(DateTime day) =>
      '${day.year.toString().padLeft(4, '0')}-'
      '${day.month.toString().padLeft(2, '0')}-'
      '${day.day.toString().padLeft(2, '0')}';

  void _safeNotify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
