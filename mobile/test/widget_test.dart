import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:mobile/main.dart';
import 'package:mobile/pages/calendar_page.dart';
import 'package:mobile/providers/auth_provider.dart';
import 'package:mobile/providers/medications_provider.dart';
import 'package:mobile/theme/app_theme.dart';

const List<String> _monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

void main() {
  group('app launch', () {
    testWidgets('shows the sign-in screen when nobody is logged in', (
      tester,
    ) async {
      await tester.pumpWidget(const MyApp());

      expect(find.text('DOTS Daily'), findsOneWidget);
      expect(find.text('Email'), findsOneWidget);
      expect(find.text('Password'), findsOneWidget);
      expect(find.text('Sign In'), findsOneWidget);
    });
  });

  group('daily reminder', () {
    test('starts with a single medicine and one enabled reminder', () {
      final meds = MedicationsProvider();

      expect(meds.medications, hasLength(1));
      expect(meds.medications.single.name, MedicationsProvider.medicineName);

      expect(meds.alarms, hasLength(1));
      expect(meds.reminder.id, MedicationsProvider.reminderId);
      expect(meds.reminder.enabled, isTrue);
      expect(meds.reminder.displayTime, '07:00 AM');
    });

    test('updateReminder edits the time and on/off state in place', () {
      final meds = MedicationsProvider();

      meds.updateReminder(time: '08:30', enabled: false);

      expect(meds.reminder.time, '08:30');
      expect(meds.reminder.enabled, isFalse);
      // Still a single reminder — editing must not append a second one.
      expect(meds.alarms, hasLength(1));
      expect(meds.activeAlarmCount, 0);
    });
  });

  group('calendar data', () {
    test('has roughly three months of dose history', () {
      final meds = MedicationsProvider();

      expect(meds.doseLogs.length, greaterThan(60));
    });

    test('today always has a dose logged', () {
      final meds = MedicationsProvider();

      expect(meds.isDayTaken(DateTime.now()), isTrue);
    });

    test('isDayTaken agrees with logsOnDay', () {
      final meds = MedicationsProvider();
      final now = DateTime.now();

      for (var day = 1; day <= now.day; day++) {
        final date = DateTime(now.year, now.month, day);
        expect(meds.isDayTaken(date), meds.logsOnDay(date).isNotEmpty);
      }
    });

    test('taken + missed accounts for every scheduled day so far', () {
      final meds = MedicationsProvider();
      final now = DateTime.now();
      final month = DateTime(now.year, now.month);

      // The regimen started long before this month, so the scheduled days run
      // from the 1st up to today — inclusive, i.e. now.day days.
      expect(
        meds.takenCountInMonth(month) + meds.missedCountInMonth(month),
        now.day,
      );
    });

    test('adherence for the month is a sane percentage', () {
      final meds = MedicationsProvider();
      final adherence = meds.adherenceInMonth(DateTime.now());

      expect(adherence, greaterThan(50));
      expect(adherence, lessThanOrEqualTo(100));
    });

    test('logs are grouped under the right day key', () {
      final meds = MedicationsProvider();
      final now = DateTime.now();

      final byDay = meds.doseLogsByDay(DateTime(now.year, now.month));
      final todayKey = MedicationsProvider.dayKey(now);

      expect(byDay.keys, isNotEmpty);
      expect(byDay[todayKey], isNotNull);
      expect(byDay[todayKey], hasLength(meds.logsOnDay(now).length));

      // Every key must fall inside the requested month.
      for (final key in byDay.keys) {
        expect(
          key,
          startsWith('${now.year}-${now.month.toString().padLeft(2, '0')}-'),
        );
      }
    });

    test('a future month has nothing logged and nothing missed', () {
      final meds = MedicationsProvider();
      final now = DateTime.now();
      final nextYear = DateTime(now.year + 1, now.month);

      expect(meds.takenCountInMonth(nextYear), 0);
      expect(meds.missedCountInMonth(nextYear), 0);
      expect(meds.adherenceInMonth(nextYear), 0);
    });

    test('logDoseOn backfills a day with no log, pending verification', () {
      final meds = MedicationsProvider();
      // Inside the regimen but outside the seeded three-month history.
      final day = DateTime.now().subtract(const Duration(days: 120));

      expect(meds.isDayTaken(day), isFalse);
      final log = meds.logDoseOn(day);

      expect(log, isNotNull);
      expect(meds.isDayTaken(day), isTrue);
      expect(meds.logsOnDay(day), hasLength(1));
      expect(meds.logsOnDay(day).single.verified, isFalse);
      expect(
        meds.logsOnDay(day).single.medicationName,
        MedicationsProvider.medicineFullName,
      );
    });

    test('logDoseOn refuses a second dose for the same day', () {
      final meds = MedicationsProvider();
      final day = DateTime.now().subtract(const Duration(days: 120));

      expect(meds.logDoseOn(day), isNotNull);
      expect(meds.logDoseOn(day), isNull);
      expect(meds.logsOnDay(day), hasLength(1));
    });

    test('backfilling a missed day moves it from missed to taken', () {
      final meds = MedicationsProvider();
      final now = DateTime.now();
      final month = DateTime(now.year, now.month);

      // Force a genuinely missed day inside the current month.
      final day = DateTime(now.year, now.month, 1);
      for (final log in meds.logsOnDay(day)) {
        meds.deleteDoseLog(log.id);
      }
      expect(meds.isDayTaken(day), isFalse);

      final takenBefore = meds.takenCountInMonth(month);
      final missedBefore = meds.missedCountInMonth(month);

      expect(meds.logDoseOn(day), isNotNull);

      expect(meds.takenCountInMonth(month), takenBefore + 1);
      expect(meds.missedCountInMonth(month), missedBefore - 1);
    });
  });

  group('calendar page', () {
    testWidgets('renders the current month with the legend', (tester) async {
      await tester.binding.setSurfaceSize(const Size(400, 900));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider(create: (_) => AuthProvider()),
            ChangeNotifierProvider(create: (_) => MedicationsProvider()),
          ],
          child: MaterialApp(
            theme: AppTheme.lightTheme,
            home: const CalendarPage(),
          ),
        ),
      );

      final now = DateTime.now();
      expect(
        find.text('${_monthNames[now.month - 1]} ${now.year}'),
        findsOneWidget,
      );
      expect(find.text('TREATMENT CALENDAR'), findsOneWidget);
      expect(find.text('Not verified'), findsOneWidget);
      expect(find.text('Missed'), findsWidgets);
    });

    testWidgets('a missed day can be logged retroactively from the sheet', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(const Size(400, 900));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      final meds = MedicationsProvider();
      final now = DateTime.now();

      // Force the 1st of this month to be missed, then log it back.
      final day = DateTime(now.year, now.month, 1);
      for (final log in meds.logsOnDay(day)) {
        meds.deleteDoseLog(log.id);
      }
      expect(meds.isDayTaken(day), isFalse);

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider(create: (_) => AuthProvider()),
            ChangeNotifierProvider.value(value: meds),
          ],
          child: MaterialApp(
            theme: AppTheme.lightTheme,
            home: const CalendarPage(),
          ),
        ),
      );

      await tester.tap(
        find.descendant(of: find.byType(GridView), matching: find.text('1')),
      );
      await tester.pumpAndSettle();

      expect(find.text('No dose logged for this day'), findsOneWidget);
      expect(find.text('Log this dose'), findsOneWidget);

      await tester.tap(find.text('Log this dose'));
      await tester.pumpAndSettle();

      expect(meds.isDayTaken(day), isTrue);
      expect(meds.logsOnDay(day).single.verified, isFalse);

      // Let the confirmation snack bar expire so no timer is left pending.
      await tester.pump(const Duration(seconds: 5));
      await tester.pumpAndSettle();
    });
  });
}
