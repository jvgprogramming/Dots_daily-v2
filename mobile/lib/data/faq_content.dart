/// Curated, offline answers for ChatDoti — the patient-facing help assistant.
///
/// This is intentionally a static knowledge base (no network, no LLM) so it is
/// dependable, free, and safe to show a TB patient. The chat layer reads this
/// list through a single `ask()` seam, so an AI backend can be added later
/// without changing the data or the UI.
library;

/// One answerable question.
class FaqEntry {
  final String category;
  final String question;
  final String answer;

  /// Extra words that should match this entry in search beyond the words
  /// already in [question] (synonyms, common phrasings).
  final List<String> keywords;

  const FaqEntry({
    required this.category,
    required this.question,
    required this.answer,
    this.keywords = const [],
  });

  /// Lower-cased haystack used for keyword ranking.
  String get searchText =>
      '$question $answer ${keywords.join(' ')} $category'.toLowerCase();
}

/// Ordered so the most common concerns surface first.
const List<FaqEntry> kFaqEntries = [
  // ---- About DOTS Daily ----
  FaqEntry(
    category: 'About DOTS Daily',
    question: 'What is DOTS and why do I use this app?',
    answer:
        'DOTS stands for Directly Observed Treatment, Short-course — the '
        'standard way TB is treated. Normally a health worker watches you take '
        'your medicine. When they cannot be there in person, this app lets you '
        'record a short video as you take your dose, so your nurse can confirm '
        'it later. Taking every dose is what cures TB and stops it coming back.',
    keywords: ['dots', 'directly observed', 'tuberculosis', 'purpose', 'why'],
  ),
  FaqEntry(
    category: 'About DOTS Daily',
    question: 'Is my information private?',
    answer:
        'Your dose records and videos are shared only with the clinic staff '
        'responsible for your treatment. They are used to track your progress '
        'and help you finish your treatment safely.',
    keywords: ['privacy', 'private', 'data', 'who can see', 'confidential'],
  ),

  // ---- Your Medicines ----
  FaqEntry(
    category: 'Your Medicines',
    question: 'When should I take my medicine?',
    answer:
        'Take all of your TB tablets together once a day. You can take them any '
        'time during the day, but preferably before lunch. The important thing '
        'is to take them every single day. Set your reminder time on the '
        'Reminder tab so you don\'t forget.',
    keywords: [
      'when',
      'time',
      'morning',
      'before lunch',
      'daily',
      'schedule',
    ],
  ),
  FaqEntry(
    category: 'Your Medicines',
    question: 'What if I take my dose late?',
    answer:
        'If you remember within a few hours, take it as soon as you can and '
        'still record it. If it is already close to the next day, skip the '
        'missed one — never take two days’ worth at once. The app marks a '
        'very late dose as "late" so your clinic can see your real pattern.',
    keywords: ['late', 'forgot', 'delayed', 'double dose'],
  ),

  // ---- Missed Doses ----
  FaqEntry(
    category: 'Missed Doses',
    question: 'What happens if I miss a dose?',
    answer:
        'Missing doses can make TB harder to treat, so try very hard not to. '
        'If you do miss one, log it honestly and take the next dose on time. '
        'If you miss several days in a row, contact your clinic — they may need '
        'to adjust your plan.',
    keywords: ['miss', 'missed', 'skip', 'skipped', 'forgot a day'],
  ),
  FaqEntry(
    category: 'Missed Doses',
    question: 'Can I log a dose I took earlier?',
    answer:
        'Yes. Open the Calendar tab, tap the day you took your medicine, and '
        'choose to log it. Days you have not recorded appear so you can keep '
        'your history accurate.',
    keywords: ['backfill', 'calendar', 'previous day', 'log later', 'history'],
  ),

  // ---- Side Effects ----
  FaqEntry(
    category: 'Side Effects',
    question: 'The medicine makes my urine orange — is that normal?',
    answer:
        'Yes. One of the TB medicines (rifampicin) can turn urine, tears and '
        'sweat orange or red. This is harmless and expected. It is not blood.',
    keywords: ['orange', 'red', 'urine', 'rifampicin', 'colour', 'color'],
  ),
  FaqEntry(
    category: 'Side Effects',
    question: 'What side effects should I report to my clinic?',
    answer:
        'Contact your clinic promptly if you notice yellow eyes or skin, severe '
        'stomach pain or vomiting, a skin rash, tingling or numbness in your '
        'hands or feet, or changes in your vision. Mild nausea is common, but '
        'anything that worries you is worth asking about.',
    keywords: [
      'side effect',
      'nausea',
      'rash',
      'yellow',
      'vomiting',
      'report',
      'liver',
    ],
  ),

  // ---- Recording Proof ----
  FaqEntry(
    category: 'Recording Your Dose',
    question: 'How do I record my dose video?',
    answer:
        'When your alarm rings, tap "Record & take my dose". The camera opens — '
        'record yourself swallowing your tablets, then the app saves and uploads '
        'the short clip automatically. The alarm clears once your clip is saved.',
    keywords: ['record', 'video', 'camera', 'proof', 'how to record'],
  ),
  FaqEntry(
    category: 'Recording Your Dose',
    question: 'What if I have no internet when I record?',
    answer:
        'No problem — your video is saved safely on your phone and uploads by '
        'itself the next time you have a connection. You do not need to record '
        'it again.',
    keywords: ['offline', 'no internet', 'upload later', 'connection', 'data'],
  ),

  // ---- Reminders & Alarm ----
  FaqEntry(
    category: 'Reminders & Alarm',
    question: 'Can I change my reminder time?',
    answer:
        'Yes. Open the Reminder tab and tap the time to pick a new one, then '
        'save. The reminder stays once a day, every day, because your TB '
        'medicine must be taken daily — but you choose the morning time that '
        'suits you.',
    keywords: ['change time', 'reminder', 'alarm time', 'edit', 'set time'],
  ),
  FaqEntry(
    category: 'Reminders & Alarm',
    question: 'My alarm did not ring over the lock screen.',
    answer:
        'On the Reminder tab, make sure "Lock-screen alarm access" is allowed. '
        'Some phones also need you to allow exact alarms and turn off battery '
        'optimization for DOTS Daily so the alarm is never delayed.',
    keywords: [
      'alarm not ringing',
      'lock screen',
      'permission',
      'battery',
      'exact alarm',
    ],
  ),

  // ---- Follow-up ----
  FaqEntry(
    category: 'Follow-up Visits',
    question: 'When is my next clinic visit?',
    answer:
        'Your next follow-up date is shown on the Home tab. Keep your '
        'appointments so your clinic can check your progress and refill your '
        'medicine on time.',
    keywords: ['follow up', 'appointment', 'next visit', 'checkup', 'clinic'],
  ),
];

/// All categories, in first-seen order, for the browse view.
List<String> faqCategories() {
  final seen = <String>[];
  for (final e in kFaqEntries) {
    if (!seen.contains(e.category)) seen.add(e.category);
  }
  return seen;
}
