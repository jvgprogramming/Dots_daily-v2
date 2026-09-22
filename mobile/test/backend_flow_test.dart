import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mobile/providers/auth_provider.dart';
import 'package:mobile/providers/medications_provider.dart';
import 'package:mobile/services/api_service.dart';

/// End-to-end checks of the mobile ↔ backend dose-logging loop.
///
/// These drive the app's real providers against a running API, because the
/// failure they guard against is invisible to the widget tests: `AuthProvider`
/// and `MedicationsProvider` must share ONE `ApiService`. When they did not, the
/// token was set on a private client, `refresh()` returned early without
/// hydrating, and every logged dose silently stayed on the phone.
///
/// Requires the backend up with the demo patient seeded:
///
///     cd backend && php artisan serve --port=8000
///     php artisan db:seed --class=DemoPatientSeeder
///
/// Skips itself when the API is unreachable so `flutter test` stays green
/// offline. Note that "a logged dose reaches the backend" writes one real dose
/// row, backfilling the oldest day in the regimen that has nothing logged yet.
void main() {
  const email = 'patient@dotsdaily.com';
  const password = 'password';

  test('login puts the token on the shared client the providers write with', () async {
    if (!await _backendUp()) return markTestSkipped(_skipReason);

    final auth = AuthProvider();
    final loggedIn = await auth.login(email, password);

    expect(loggedIn, isTrue, reason: 'the demo patient should be able to sign in');
    expect(auth.token, isNotNull);
    // The regression: AuthProvider built its own ApiService, so this stayed null
    // while the provider that sends dose writes had no way to authenticate.
    expect(
      ApiService.shared.token,
      isNotNull,
      reason: 'the token must land on the shared client, not a private one',
    );
    expect(ApiService.shared.token, auth.token);
  });

  test('the calendar hydrates from the server rather than the mock history', () async {
    if (!await _backendUp()) return markTestSkipped(_skipReason);

    await AuthProvider().login(email, password);

    final meds = MedicationsProvider();
    await meds.refresh();

    expect(meds.syncError, isNull, reason: 'refresh should not have failed');

    // Ask the API directly, then compare: if the shared token were missing,
    // refresh() would bail out and leave the in-memory mock in place.
    final response = await ApiService.shared.get('/mobile/dose-logs');
    final serverCount =
        (response['data'] as Map<String, dynamic>)['count'] as int;

    expect(serverCount, greaterThan(0), reason: 'seed the demo data first');
    expect(
      meds.doseLogs.length,
      serverCount,
      reason: 'the provider must mirror the server, not the seeded mock history',
    );

    // The mock regimen starts 2024-01-01; the real plan start comes from the DB.
    expect(
      MedicationsProvider.dayKey(meds.regimenStart),
      isNot('2024-01-01'),
      reason: 'regimenStart should come from the treatment plan',
    );
    expect(meds.canLogDoses, isTrue);

    // The app presents the regimen as one "Drug Intake", never a drug name.
    for (final log in meds.doseLogs) {
      expect(log.medicationName, MedicationsProvider.medicineFullName);
    }
  });

  test('a logged dose reaches the backend', () async {
    if (!await _backendUp()) return markTestSkipped(_skipReason);

    await AuthProvider().login(email, password);

    final meds = MedicationsProvider();
    await meds.refresh();

    // The oldest day inside the regimen with nothing logged yet, so this stays
    // runnable against a database that already has history. Once every day is
    // filled there is nothing left to log, which is a skip rather than a failure.
    final day = _firstEmptyDay(meds);
    if (day == null) {
      return markTestSkipped('every day in the regimen already has a dose logged');
    }

    expect(meds.logDoseOn(day), isNotNull);
    expect(meds.isDayTaken(day), isTrue);

    await _waitForPush(meds);
    expect(
      meds.unsyncedCount,
      0,
      reason: 'dose was never accepted by the backend (${meds.syncError})',
    );

    // Confirm it by reading the server back, not from local state.
    final response = await ApiService.shared.get('/mobile/dose-logs');
    final logs = (response['data'] as Map<String, dynamic>)['logs'] as List<dynamic>;
    final dates =
        logs.map((e) => (e as Map<String, dynamic>)['scheduled_date']).toSet();

    expect(
      dates,
      contains(MedicationsProvider.dayKey(day)),
      reason: 'the dose must exist in the database, not only on the phone',
    );
  });

  test('missed and unverified days are classified as the web reports them', () async {
    if (!await _backendUp()) return markTestSkipped(_skipReason);

    await AuthProvider().login(email, password);

    final meds = MedicationsProvider();
    await meds.refresh();

    final rows = await _doseRows();

    final missed = rows.where((r) => r['status'] == 'missed').toList();
    expect(missed, isNotEmpty, reason: 'the demo history should contain missed days');

    for (final row in missed) {
      final date = row['scheduled_date'] as String;
      final day = DateTime.parse(date);

      // The regression: a `missed` row used to read as a logged dose, which
      // turned every missed day into a pending one and drove adherence to 100%.
      expect(meds.isDayTaken(day), isFalse, reason: '$date is recorded as missed');
      expect(meds.isDayUnverified(day), isFalse,
          reason: '$date must not read as an unverified dose');
      expect(meds.dosesOnDay(day), isEmpty, reason: '$date has no dose to show');
    }

    final pending =
        rows.where((r) => r['status'] != 'missed' && r['verified'] == false).toList();
    expect(pending, isNotEmpty,
        reason: 'the demo history should contain unverified doses');

    for (final row in pending) {
      final date = row['scheduled_date'] as String;
      final day = DateTime.parse(date);

      expect(meds.isDayTaken(day), isTrue);
      expect(meds.isDayUnverified(day), isTrue,
          reason: '$date is awaiting verification');
    }
  });

  test('the month totals agree with the underlying dose rows', () async {
    if (!await _backendUp()) return markTestSkipped(_skipReason);

    await AuthProvider().login(email, password);

    final meds = MedicationsProvider();
    await meds.refresh();

    final rows = await _doseRows();
    final monthPrefix = MedicationsProvider.dayKey(DateTime.now()).substring(0, 7);

    final takenDays = <String>{};
    for (final row in rows) {
      final date = row['scheduled_date'] as String;
      if (row['status'] != 'missed') takenDays.add(date);
    }

    final takenThisMonth =
        takenDays.where((date) => date.startsWith(monthPrefix)).length;

    // "Days taken" must count only days a dose was actually taken, so the app's
    // adherence can never disagree with the admin view.
    expect(
      meds.takenCountInMonth(DateTime.now()),
      takenThisMonth,
      reason: 'only doses actually taken should count towards the month',
    );
  });

  test('adherence matches the figure the admin web app is shown', () async {
    if (!await _backendUp()) return markTestSkipped(_skipReason);

    await AuthProvider().login(email, password);
    final meds = MedicationsProvider();
    await meds.refresh();

    final regimen = await ApiService.shared.get('/mobile/regimen');
    final patientId = ((regimen['data'] as Map<String, dynamic>)['patient']
        as Map<String, dynamic>)['id'] as int;

    final adminRate = await _adminAdherenceRate(patientId);
    expect(adminRate, isNotNull, reason: 'the admin view should report a rate');

    // The regression: this figure used to be the share of *verified* doses, so
    // the app could show a flattering number while the admin saw missed days.
    expect(
      meds.adherenceRate,
      closeTo(adminRate!, 0.05),
      reason: 'the app and the web admin view must not disagree about adherence',
    );
  });
}

const _adminEmail = 'admin@dotsdaily.com';
const _adminPassword = 'password';

/// The adherence rate the admin monitoring calendar shows for [patientId].
///
/// Calls exactly what the web page calls — an admin login, then the monitoring
/// endpoint — on its own HTTP client, so it can hold the admin token without
/// clobbering the patient session on [ApiService.shared].
Future<double?> _adminAdherenceRate(int patientId) async {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
  final base = ApiService.resolvedBaseUrl;

  final login = await http.post(
    Uri.parse('$base/login'),
    headers: headers,
    body: jsonEncode({'email': _adminEmail, 'password': _adminPassword}),
  );
  final adminToken =
      (jsonDecode(login.body)['data'] as Map<String, dynamic>)['token'] as String;

  final today = DateTime.now();
  final from = today.subtract(const Duration(days: 400));
  final response = await http.get(
    Uri.parse('$base/patients/monitoring?patient_id=$patientId'
        '&from=${_isoDate(from)}&to=${_isoDate(today)}'),
    headers: {...headers, 'Authorization': 'Bearer $adminToken'},
  );

  final summary = ((jsonDecode(response.body) as Map<String, dynamic>)['data']
      as Map<String, dynamic>)['summary'] as Map<String, dynamic>;
  final rate = summary['adherence_rate'];

  return rate == null ? null : (rate as num).toDouble();
}

String _isoDate(DateTime day) => '${day.year.toString().padLeft(4, '0')}-'
    '${day.month.toString().padLeft(2, '0')}-'
    '${day.day.toString().padLeft(2, '0')}';

/// The raw dose rows the app hydrates from, newest first.
Future<List<Map<String, dynamic>>> _doseRows() async {
  final response = await ApiService.shared.get('/mobile/dose-logs');
  final logs = (response['data'] as Map<String, dynamic>)['logs'] as List<dynamic>;

  return logs.cast<Map<String, dynamic>>();
}

const _skipReason = 'backend not reachable on 127.0.0.1:8000 — start it to run these';

bool? _apiUp;

/// Restores real networking and reports whether the API is up, probing once.
///
/// The override has to be cleared from inside the test body: the test binding
/// reinstates its 400-returning HttpClient mock around `setUpAll`, which makes a
/// reachable backend look unreachable.
Future<bool> _backendUp() async {
  HttpOverrides.global = null;

  return _apiUp ??= await _apiReachable();
}

/// True when the API answers at all — a 401 still proves it is up.
///
/// Goes through the app's own client so the request carries the same
/// `Accept: application/json` header the real app sends. Without it Laravel
/// treats the call as a browser navigation and, because there is no `login`
/// route, answers 500 instead of 401.
Future<bool> _apiReachable() async {
  try {
    await ApiService.shared.get('/mobile/regimen');

    return true;
  } on ApiException catch (e) {
    return e.statusCode == 401;
  } catch (_) {
    return false;
  }
}

/// The oldest day from the regimen start up to today with no dose logged.
DateTime? _firstEmptyDay(MedicationsProvider meds) {
  final today = DateTime.now();
  var day = DateTime(
    meds.regimenStart.year,
    meds.regimenStart.month,
    meds.regimenStart.day,
  );

  while (!day.isAfter(today)) {
    if (!meds.isDayTaken(day)) return day;
    day = day.add(const Duration(days: 1));
  }

  return null;
}

/// Waits for the queued dose to be accepted, since the write is fire-and-forget
/// so the calendar can update without blocking the tap.
Future<void> _waitForPush(
  MedicationsProvider meds, {
  Duration timeout = const Duration(seconds: 20),
}) async {
  final deadline = DateTime.now().add(timeout);

  while (DateTime.now().isBefore(deadline)) {
    if (meds.unsyncedCount == 0) return;
    await Future<void>.delayed(const Duration(milliseconds: 200));
  }

  fail('dose still unsynced after $timeout — syncError: ${meds.syncError}');
}
