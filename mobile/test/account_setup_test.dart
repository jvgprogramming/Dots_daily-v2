import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:mobile/main.dart';
import 'package:mobile/pages/account_setup_page.dart';
import 'package:mobile/providers/auth_provider.dart';
import 'package:mobile/theme/app_theme.dart';

Widget _wrap(Widget child) => ChangeNotifierProvider(
      create: (_) => AuthProvider(),
      child: MaterialApp(theme: AppTheme.lightTheme, home: child),
    );

void main() {
  testWidgets('sign-in offers activation and password reset', (tester) async {
    await tester.binding.setSurfaceSize(const Size(400, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(_wrap(const LoginPage()));
    await tester.pumpAndSettle();

    expect(find.text('Forgot password?'), findsOneWidget);
    expect(find.text('Activate your account'), findsOneWidget);

    await tester.tap(find.text('Activate your account'));
    await tester.pumpAndSettle();

    expect(find.byType(AccountSetupPage), findsOneWidget);
    expect(find.text('Confirm your email'), findsOneWidget);
    expect(find.text('Step 1 of 3'), findsOneWidget);
  });

  testWidgets('the email and code steps fit a narrow phone without overflow', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(320, 640));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    // Email step.
    await tester.pumpWidget(_wrap(const AccountSetupPage()));
    await tester.pumpAndSettle();
    expect(find.text('Confirm your email'), findsOneWidget);

    // Code step, with a long email and an error showing.
    await tester.pumpWidget(
      _wrap(
        const AccountSetupPage(
          key: ValueKey('code'),
          initialEmail: 'juan.dela.cruz.patient@example.com',
          sendCodeOnOpen: true,
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Check your email'), findsOneWidget);
    expect(find.text('Change email'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('an invalid email is caught before anything is sent', (tester) async {
    await tester.binding.setSurfaceSize(const Size(400, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      _wrap(const AccountSetupPage(mode: AccountSetupMode.reset)),
    );
    await tester.pumpAndSettle();

    expect(find.text('Reset your password'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'not-an-email');
    await tester.tap(find.text('Send code'));
    await tester.pumpAndSettle();

    expect(
      find.text('Enter the email address your health center registered.'),
      findsOneWidget,
    );
    expect(find.text('Step 1 of 3'), findsOneWidget);
  });
}
