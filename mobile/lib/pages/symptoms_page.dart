import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../data/symptom_catalog.dart';
import '../models/symptom_log.dart';
import '../providers/symptoms_provider.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';

/// Symptom Monitor — the patient reports TB symptoms and medication side
/// effects so their clinic can watch for adverse reactions and treatment
/// response. A dangerous or "severe" report warns the patient to seek care and
/// alerts the clinic (handled by the backend).
class SymptomsPage extends StatefulWidget {
  final ValueChanged<String>? onViewChange;

  const SymptomsPage({super.key, this.onViewChange});

  @override
  State<SymptomsPage> createState() => _SymptomsPageState();
}

class _SymptomsPageState extends State<SymptomsPage> {
  /// Slug → the severity the patient picked for it.
  final Map<String, SymptomSeverity> _selected = {};
  final TextEditingController _notes = TextEditingController();
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<SymptomsProvider>();
      if (provider.history.isEmpty) provider.load();
    });
  }

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_selected.isEmpty || _submitting) return;
    final provider = context.read<SymptomsProvider>();
    final messenger = ScaffoldMessenger.of(context);

    setState(() => _submitting = true);
    try {
      final redFlag = await provider.report(
        symptoms: _selected.entries
            .map((e) => ReportedSymptom(e.key, e.value))
            .toList(),
        notes: _notes.text,
      );
      if (!mounted) return;
      setState(() {
        _selected.clear();
        _notes.clear();
        _submitting = false;
      });
      if (redFlag) {
        await _showUrgentDialog();
      } else {
        messenger.showSnackBar(
          const SnackBar(content: Text('Thanks — your clinic can now see this report.')),
        );
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      messenger.showSnackBar(
        SnackBar(content: Text(e.displayMessage), backgroundColor: context.palette.danger),
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => _submitting = false);
      messenger.showSnackBar(
        const SnackBar(content: Text('Could not send your report. Please check your connection and try again.')),
      );
    }
  }

  Future<void> _showUrgentDialog() async {
    final p = context.palette;
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        icon: Icon(Icons.warning_amber_rounded, color: p.danger, size: 40),
        title: const Text('Please contact your clinic'),
        content: const Text(
          'Some of what you reported can be serious. Your report was sent to '
          'your DOTS center, but please contact them or seek care now — do not '
          'wait for your next visit.',
          textAlign: TextAlign.center,
        ),
        actions: [
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('I understand'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final provider = context.watch<SymptomsProvider>();

    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(
        16,
        MediaQuery.of(context).padding.top + 8,
        16,
        28,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Symptom Monitor',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: p.textPrimary),
          ),
          const SizedBox(height: 4),
          Text(
            'Tell your clinic how you feel — your TB symptoms and any side '
            'effects from your medicine.',
            style: TextStyle(fontSize: 13.5, height: 1.4, color: p.textSecondary),
          ),
          const SizedBox(height: 16),
          _infoCard(p),
          const SizedBox(height: 20),
          for (final group in symptomCatalog) ...[
            _groupTitle(p, group.title),
            const SizedBox(height: 10),
            ...group.items.map((item) => _symptomTile(p, item)),
            const SizedBox(height: 18),
          ],
          _notesField(p),
          const SizedBox(height: 16),
          _submitButton(p),
          const SizedBox(height: 28),
          _historySection(p, provider),
        ],
      ),
    );
  }

  Widget _infoCard(AppPalette p) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: p.infoBg,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.info_outline_rounded, size: 18, color: p.info),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Tap anything you feel and choose how strong it is. This does not '
              'replace a visit — if you feel very unwell, contact your clinic.',
              style: TextStyle(fontSize: 12.5, height: 1.4, color: p.info),
            ),
          ),
        ],
      ),
    );
  }

  Widget _groupTitle(AppPalette p, String title) {
    return Text(
      title,
      style: TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.3,
        color: p.textTertiary,
      ),
    );
  }

  Widget _symptomTile(AppPalette p, SymptomItem item) {
    final selected = _selected.containsKey(item.slug);
    final severity = _selected[item.slug];

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: selected ? p.primarySoft : p.card,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(
          color: selected ? p.primary : p.borderLight,
          width: selected ? 1.4 : 1,
        ),
      ),
      child: Column(
        children: [
          InkWell(
            borderRadius: BorderRadius.circular(AppRadius.lg),
            onTap: () {
              setState(() {
                if (selected) {
                  _selected.remove(item.slug);
                } else {
                  _selected[item.slug] = SymptomSeverity.mild;
                }
              });
            },
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: selected ? p.primary.withValues(alpha: 0.14) : p.subtle,
                      borderRadius: BorderRadius.circular(AppRadius.md),
                    ),
                    child: Icon(item.icon,
                        size: 20, color: selected ? p.primaryStrong : p.textSecondary),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.label,
                          style: TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w600,
                            color: p.textPrimary,
                          ),
                        ),
                        if (item.redFlag)
                          Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Text(
                              'Tell your clinic if you feel this',
                              style: TextStyle(fontSize: 11.5, color: p.warning),
                            ),
                          ),
                      ],
                    ),
                  ),
                  Icon(
                    selected ? Icons.check_circle_rounded : Icons.circle_outlined,
                    color: selected ? p.primary : p.borderStrong,
                  ),
                ],
              ),
            ),
          ),
          if (selected)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              child: Row(
                children: [
                  for (final level in SymptomSeverity.values) ...[
                    Expanded(child: _severityChip(p, item.slug, level, severity == level)),
                    if (level != SymptomSeverity.severe) const SizedBox(width: 8),
                  ],
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _severityChip(AppPalette p, String slug, SymptomSeverity level, bool on) {
    final tone = _severityTone(p, level);
    return GestureDetector(
      onTap: () => setState(() => _selected[slug] = level),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: on ? tone.withValues(alpha: 0.16) : p.card,
          borderRadius: BorderRadius.circular(AppRadius.sm),
          border: Border.all(color: on ? tone : p.border),
        ),
        child: Text(
          level.label,
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
            color: on ? tone : p.textSecondary,
          ),
        ),
      ),
    );
  }

  Color _severityTone(AppPalette p, SymptomSeverity level) => switch (level) {
        SymptomSeverity.mild => p.success,
        SymptomSeverity.moderate => p.warning,
        SymptomSeverity.severe => p.danger,
      };

  Widget _notesField(AppPalette p) {
    return TextField(
      controller: _notes,
      maxLines: 3,
      maxLength: 1000,
      style: TextStyle(color: p.textPrimary, fontSize: 14),
      decoration: InputDecoration(
        hintText: 'Anything else you want your clinic to know? (optional)',
        hintStyle: TextStyle(color: p.textTertiary, fontSize: 13.5),
        filled: true,
        fillColor: p.card,
        counterText: '',
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          borderSide: BorderSide(color: p.borderLight),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          borderSide: BorderSide(color: p.borderLight),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          borderSide: BorderSide(color: p.primary),
        ),
      ),
    );
  }

  Widget _submitButton(AppPalette p) {
    final count = _selected.length;
    final enabled = count > 0 && !_submitting;
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: FilledButton.icon(
        onPressed: enabled ? _submit : null,
        style: FilledButton.styleFrom(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
        icon: _submitting
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
              )
            : const Icon(Icons.send_rounded, size: 20),
        label: Text(
          _submitting
              ? 'Sending…'
              : count == 0
                  ? 'Select how you feel'
                  : 'Report ${count == 1 ? '1 symptom' : '$count symptoms'}',
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
        ),
      ),
    );
  }

  Widget _historySection(AppPalette p, SymptomsProvider provider) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Your recent reports',
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: p.textPrimary),
        ),
        const SizedBox(height: 12),
        if (provider.isLoading && provider.history.isEmpty)
          const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator()))
        else if (provider.history.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: p.card,
              borderRadius: BorderRadius.circular(AppRadius.lg),
              border: Border.all(color: p.borderLight),
            ),
            child: Text(
              'Nothing reported yet. When you tell your clinic how you feel, it '
              'will show here.',
              style: TextStyle(fontSize: 13, height: 1.4, color: p.textSecondary),
            ),
          )
        else
          ...provider.history.take(30).map((log) => _historyTile(p, log)),
      ],
    );
  }

  Widget _historyTile(AppPalette p, SymptomLog log) {
    final tone = switch (log.severity) {
      'severe' => p.danger,
      'moderate' => p.warning,
      _ => p.success,
    };
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: p.card,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: p.borderLight),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  log.label,
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: p.textPrimary),
                ),
                const SizedBox(height: 2),
                Text(
                  _formatDate(log.recordedDate),
                  style: TextStyle(fontSize: 12, color: p.textTertiary),
                ),
              ],
            ),
          ),
          if (log.redFlag)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Icon(Icons.flag_rounded, size: 16, color: p.danger),
            ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: tone.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              _severityLabel(log.severity),
              style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: tone),
            ),
          ),
        ],
      ),
    );
  }

  String _severityLabel(String s) => switch (s) {
        'severe' => 'Severe',
        'moderate' => 'Moderate',
        'mild' => 'Mild',
        _ => s,
      };

  String _formatDate(DateTime d) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return '${months[d.month - 1]} ${d.day}, ${d.year}';
  }
}
