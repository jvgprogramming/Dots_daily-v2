import 'package:flutter/foundation.dart';

import '../data/faq_content.dart';

/// The result of asking DOTi a question.
class ChatAnswer {
  final String text;

  /// Suggested related questions the patient can tap next.
  final List<FaqEntry> related;

  /// False when nothing relevant was found (the UI shows a gentle fallback).
  final bool matched;

  const ChatAnswer({
    required this.text,
    this.related = const [],
    this.matched = true,
  });
}

/// One line in the chat transcript.
class ChatTurn {
  final bool fromUser;
  final String text;
  final ChatAnswer? answer;

  ChatTurn.user(this.text)
      : fromUser = true,
        answer = null;

  ChatTurn.bot(ChatAnswer a)
      : fromUser = false,
        text = a.text,
        answer = a;
}

/// Ask DOTi's brain.
///
/// Today it answers from the curated [kFaqEntries] by keyword overlap — offline,
/// free, and safe. [ask] is the single seam: to add a real AI assistant later,
/// replace the body of [ask] with an [ApiService] call and keep returning a
/// [ChatAnswer]. The transcript UI and everything else stays unchanged.
class ChatProvider extends ChangeNotifier {
  final List<ChatTurn> _turns = [];

  List<ChatTurn> get turns => List.unmodifiable(_turns);

  bool get hasConversation => _turns.isNotEmpty;

  /// Adds the patient's message and Ask DOTi's reply to the transcript.
  Future<void> send(String query) async {
    final q = query.trim();
    if (q.isEmpty) return;

    _turns.add(ChatTurn.user(q));
    notifyListeners();

    final answer = await ask(q);
    _turns.add(ChatTurn.bot(answer));
    notifyListeners();
  }

  void reset() {
    _turns.clear();
    notifyListeners();
  }

  /// THE SEAM — returns the best answer for [query]. Swap this body for an LLM
  /// call later without touching the UI.
  Future<ChatAnswer> ask(String query) async {
    final ranked = _rank(query);

    if (ranked.isEmpty) {
      return ChatAnswer(
        text:
            'I’m not sure about that one yet. Try the common questions '
            'below, or ask your clinic for medical advice.',
        related: kFaqEntries.take(3).toList(),
        matched: false,
      );
    }

    return ChatAnswer(
      text: ranked.first.answer,
      related: ranked.skip(1).take(3).toList(),
    );
  }

  /// Live search over the FAQ for the browse view. Empty query → all entries.
  List<FaqEntry> search(String query) {
    if (query.trim().isEmpty) return kFaqEntries;
    return _rank(query);
  }

  /// Ranks FAQ entries by how many query terms they contain.
  List<FaqEntry> _rank(String query) {
    final terms = query
        .toLowerCase()
        .split(RegExp(r'[^a-z0-9]+'))
        .where((t) => t.length > 2)
        .toList();
    if (terms.isEmpty) return const [];

    final scored = <MapEntry<FaqEntry, int>>[];
    for (final entry in kFaqEntries) {
      final hay = entry.searchText;
      var score = 0;
      for (final term in terms) {
        if (hay.contains(term)) score++;
      }
      if (score > 0) scored.add(MapEntry(entry, score));
    }
    scored.sort((a, b) => b.value.compareTo(a.value));
    return scored.map((e) => e.key).toList();
  }
}
