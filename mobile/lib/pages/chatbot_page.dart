import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../data/faq_content.dart';
import '../providers/chat_provider.dart';
import '../theme/app_theme.dart';

/// ChatDoti — a patient-facing help assistant. It answers frequently asked
/// questions about TB treatment from a curated, offline knowledge base. The
/// chat is powered by [ChatProvider.ask], a seam that an AI backend can replace
/// later without changing this screen.
class ChatbotPage extends StatelessWidget {
  final ValueChanged<String>? onViewChange;

  const ChatbotPage({super.key, this.onViewChange});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => ChatProvider(),
      child: const _ChatView(),
    );
  }
}

class _ChatView extends StatefulWidget {
  const _ChatView();

  @override
  State<_ChatView> createState() => _ChatViewState();
}

class _ChatViewState extends State<_ChatView> {
  final TextEditingController _input = TextEditingController();
  final ScrollController _scroll = ScrollController();

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _send([String? preset]) async {
    final text = (preset ?? _input.text).trim();
    if (text.isEmpty) return;
    _input.clear();
    FocusScope.of(context).unfocus();
    await context.read<ChatProvider>().send(text);
    _scrollToEnd();
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(
          _scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    final chat = context.watch<ChatProvider>();

    return Column(
      children: [
        _header(p),
        Expanded(
          child: chat.hasConversation
              ? _transcript(p, chat)
              : _emptyState(p),
        ),
        _inputBar(p),
      ],
    );
  }

  Widget _header(AppPalette p) {
    return Container(
      padding: EdgeInsets.fromLTRB(
        16,
        MediaQuery.of(context).padding.top + 10,
        16,
        12,
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [p.primary, p.primaryStrong],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(Icons.forum_rounded, color: p.onPrimary, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'ChatDoti',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: p.textPrimary,
                  ),
                ),
                Text(
                  'Answers about your TB treatment',
                  style: TextStyle(fontSize: 12.5, color: p.textSecondary),
                ),
              ],
            ),
          ),
          if (context.watch<ChatProvider>().hasConversation)
            IconButton(
              tooltip: 'Clear chat',
              onPressed: () => context.read<ChatProvider>().reset(),
              icon: Icon(Icons.refresh_rounded, color: p.textSecondary),
            ),
        ],
      ),
    );
  }

  // Empty state: a short intro + the most common questions to tap.
  Widget _emptyState(AppPalette p) {
    final popular = kFaqEntries.take(6).toList();
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: p.primarySoft,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: p.primaryTint),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.waving_hand_rounded, color: p.primary, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    'Hi! I’m ChatDoti',
                    style: TextStyle(
                      fontSize: 15.5,
                      fontWeight: FontWeight.w700,
                      color: p.textPrimary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                'Ask me about your medicines, reminders, side effects, or how to '
                'record your dose. Tap a question to start.',
                style: TextStyle(
                  fontSize: 13,
                  height: 1.45,
                  color: p.textBody,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        Text(
          'POPULAR QUESTIONS',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.1,
            color: p.textTertiary,
          ),
        ),
        const SizedBox(height: 10),
        ...popular.map((e) => _questionTile(p, e)),
      ],
    );
  }

  Widget _questionTile(AppPalette p, FaqEntry entry) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: p.card,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () => _send(entry.question),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: p.border),
            ),
            child: Row(
              children: [
                Icon(Icons.help_outline_rounded, size: 19, color: p.primary),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    entry.question,
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w500,
                      color: p.textPrimary,
                    ),
                  ),
                ),
                Icon(Icons.chevron_right_rounded, color: p.textTertiary),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _transcript(AppPalette p, ChatProvider chat) {
    return ListView.builder(
      controller: _scroll,
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
      itemCount: chat.turns.length,
      itemBuilder: (context, i) {
        final turn = chat.turns[i];
        return turn.fromUser ? _userBubble(p, turn.text) : _botBubble(p, turn);
      },
    );
  }

  Widget _userBubble(AppPalette p, String text) {
    return Align(
      alignment: Alignment.centerRight,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12, left: 40),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: p.primary,
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(16),
            topRight: Radius.circular(16),
            bottomLeft: Radius.circular(16),
            bottomRight: Radius.circular(4),
          ),
        ),
        child: Text(
          text,
          style: TextStyle(color: p.onPrimary, fontSize: 14, height: 1.35),
        ),
      ),
    );
  }

  Widget _botBubble(AppPalette p, ChatTurn turn) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12, right: 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: p.card,
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(16),
                  topRight: Radius.circular(16),
                  bottomLeft: Radius.circular(4),
                  bottomRight: Radius.circular(16),
                ),
                border: Border.all(color: p.border),
              ),
              child: Text(
                turn.text,
                style: TextStyle(
                  color: p.textBody,
                  fontSize: 14,
                  height: 1.45,
                ),
              ),
            ),
            if (turn.answer != null && turn.answer!.related.isNotEmpty) ...[
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: turn.answer!.related
                    .map(
                      (e) => ActionChip(
                        label: Text(
                          e.question,
                          style: TextStyle(fontSize: 12, color: p.primary),
                        ),
                        backgroundColor: p.primarySoft,
                        side: BorderSide(color: p.primaryTint),
                        onPressed: () => _send(e.question),
                      ),
                    )
                    .toList(),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _inputBar(AppPalette p) {
    return Container(
      padding: EdgeInsets.fromLTRB(
        12,
        10,
        12,
        MediaQuery.of(context).padding.bottom + 10,
      ),
      decoration: BoxDecoration(
        color: p.card,
        border: Border(top: BorderSide(color: p.border)),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _input,
              textInputAction: TextInputAction.send,
              onSubmitted: (_) => _send(),
              decoration: InputDecoration(
                hintText: 'Ask a question…',
                filled: true,
                fillColor: p.subtle,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 12,
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(24),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Material(
            color: p.primary,
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: () => _send(),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Icon(Icons.send_rounded, color: p.onPrimary, size: 22),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
