import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'services/notification_service.dart';
import 'theme/app_theme.dart';
import 'providers/auth_provider.dart';
import 'providers/medications_provider.dart';
import 'pages/dashboard_page.dart';
import 'pages/reminder_page.dart';
import 'pages/calendar_page.dart';
import 'pages/alarm_ringing_page.dart';
import 'pages/chatbot_page.dart';
import 'pages/symptoms_page.dart';
import 'pages/test_alarm_page.dart';
import 'pages/profile_page.dart';
import 'models/medication.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize notification service
  final notificationService = NotificationService();
  await notificationService.initialize();

  runApp(const MyApp());
}

/// Global navigator key so notification taps can open the ringing screen
/// even when the app is restored from the background.
final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    // Notification taps route into the app: open the alarm ringing screen.
    NotificationService.onAlarmTap = (payload) {
      if (payload != null && payload.startsWith('alarm:')) {
        final id = payload.substring('alarm:'.length);
        final alarm = _findAlarmById(id);
        if (alarm != null) {
          AlarmRingingPage.open(navigatorKey.currentContext!, alarm);
          return;
        }
      }
      // Fallback: open the reminder settings.
      final ctx = navigatorKey.currentContext;
      if (ctx != null && ctx.mounted) {
        ScaffoldMessenger.of(ctx).showSnackBar(
          const SnackBar(
            content: Text(
              'Medication reminder — open the Reminder tab for details',
            ),
          ),
        );
      }
    };

    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => MedicationsProvider()),
      ],
      child: MaterialApp(
        title: 'DOTS Daily',
        debugShowCheckedModeBanner: false,
        navigatorKey: navigatorKey,
        theme: AppTheme.lightTheme,
        home: const MainShell(),
      ),
    );
  }

  Alarm? _findAlarmById(String id) {
    // The provider is not accessible above MaterialApp, so look it up via
    // the navigator context instead.
    final ctx = navigatorKey.currentContext;
    if (ctx == null) return null;
    final meds = Provider.of<MedicationsProvider>(ctx, listen: false);
    try {
      return meds.alarms.firstWhere((a) => a.id == id);
    } catch (_) {
      return null;
    }
  }
}

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _currentIndex = 0;

  /// Guards the once-per-session pull of the signed-in patient's regimen and
  /// dose history from the backend.
  bool _pulledFromBackend = false;

  static const _tabs = [
    ('dashboard', 'Home', Icons.home_outlined, Icons.home_rounded),
    ('reminder', 'Reminder', Icons.alarm_outlined, Icons.alarm_rounded),
    (
      'calendar',
      'Calendar',
      Icons.calendar_month_outlined,
      Icons.calendar_month_rounded,
    ),
    ('chatbot', 'Chat', Icons.chat_outlined, Icons.chat_rounded),
    (
      'symptoms',
      'Symptoms',
      Icons.monitor_heart_outlined,
      Icons.monitor_heart_rounded,
    ),
  ];

  void _onTabTapped(int index) {
    setState(() => _currentIndex = index);
  }

  /// Push a full-screen page above the tab shell (with its own back button).
  Future<void> _pushPage(String route) async {
    await Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (_) => _buildPushedPage(route)));
  }

  Widget _buildPushedPage(String route) {
    switch (route) {
      case 'profile':
        return const ProfilePage();
      case 'test-alarm':
        return const TestAlarmPage();
      default:
        return const ProfilePage();
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    if (!auth.isLoggedIn) {
      // The next sign-in belongs to whoever logs in next, so pull again then.
      _pulledFromBackend = false;
      return const LoginPage();
    }

    if (!_pulledFromBackend) {
      _pulledFromBackend = true;
      // Deferred a frame so the fetch starts with the providers settled.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.read<MedicationsProvider>().refresh();
      });
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      // Reserve space for the footer navigation bar so it never covers the
      // last items of a page.
      extendBody: false,
      body: _buildTab(_tabs[_currentIndex].$1),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: _onTabTapped,
        destinations: [
          for (final tab in _tabs)
            NavigationDestination(
              icon: Icon(tab.$3),
              selectedIcon: Icon(tab.$4),
              label: tab.$2,
            ),
        ],
      ),
    );
  }

  Widget _buildTab(String view) {
    switch (view) {
      case 'dashboard':
        return DashboardPage(
          onViewChange: (v) {
            final index = _tabs.indexWhere((t) => t.$1 == v);
            if (index != -1) {
              _onTabTapped(index);
            } else {
              _pushPage(v);
            }
          },
          onTriggerAlarm: (_) => _pushPage('test-alarm'),
        );
      case 'reminder':
        return ReminderPage(
          onViewChange: (v) {
            final index = _tabs.indexWhere((t) => t.$1 == v);
            if (index != -1) _onTabTapped(index);
          },
        );
      case 'calendar':
        return CalendarPage(
          onViewChange: (v) {
            final index = _tabs.indexWhere((t) => t.$1 == v);
            if (index != -1) _onTabTapped(index);
          },
        );
      case 'chatbot':
        return ChatbotPage(
          onViewChange: (v) {
            final index = _tabs.indexWhere((t) => t.$1 == v);
            if (index != -1) _onTabTapped(index);
          },
        );
      case 'symptoms':
        return SymptomsPage(
          onViewChange: (v) {
            final index = _tabs.indexWhere((t) => t.$1 == v);
            if (index != -1) _onTabTapped(index);
          },
        );
      default:
        return DashboardPage(
          onViewChange: (v) {
            final index = _tabs.indexWhere((t) => t.$1 == v);
            if (index != -1) {
              _onTabTapped(index);
            } else {
              _pushPage(v);
            }
          },
          onTriggerAlarm: (_) => _pushPage('test-alarm'),
        );
    }
  }
}

// =====================================================================
// Login Page
// =====================================================================

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _loading = false;
  bool _obscure = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    setState(() => _loading = true);
    final auth = context.read<AuthProvider>();
    await auth.login(_emailController.text, _passwordController.text);
    if (!mounted) return;
    setState(() => _loading = false);

    if (!auth.isLoggedIn && auth.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(auth.error!),
          backgroundColor: AppColors.destructive,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFFDCFCE7), AppColors.background],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Logo
                    Container(
                      width: 76,
                      height: 76,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: AppColors.primaryGradient,
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.primary.withValues(alpha: 0.35),
                            blurRadius: 24,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: const Icon(
                        Icons.medication_rounded,
                        color: Colors.white,
                        size: 38,
                      ),
                    ),
                    const SizedBox(height: 24),
                    const Text(
                      'DOTS Daily',
                      style: TextStyle(
                        fontSize: 32,
                        fontWeight: FontWeight.w800,
                        color: AppColors.foreground,
                        letterSpacing: -0.5,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Your TB treatment companion.\nSign in to continue.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 14,
                        height: 1.5,
                        color: AppColors.mutedForeground,
                      ),
                    ),
                    const SizedBox(height: 32),

                    // Card-wrapped form
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.05),
                            blurRadius: 20,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: Column(
                        children: [
                          TextField(
                            controller: _emailController,
                            decoration: const InputDecoration(
                              labelText: 'Email',
                              hintText: 'you@example.com',
                              prefixIcon: Icon(Icons.email_outlined),
                            ),
                            keyboardType: TextInputType.emailAddress,
                          ),
                          const SizedBox(height: 16),
                          TextField(
                            controller: _passwordController,
                            decoration: InputDecoration(
                              labelText: 'Password',
                              hintText: 'Enter your password',
                              prefixIcon: const Icon(Icons.lock_outlined),
                              suffixIcon: IconButton(
                                icon: Icon(
                                  _obscure
                                      ? Icons.visibility_outlined
                                      : Icons.visibility_off_outlined,
                                ),
                                onPressed: () =>
                                    setState(() => _obscure = !_obscure),
                              ),
                            ),
                            obscureText: _obscure,
                            onSubmitted: (_) => _handleLogin(),
                          ),
                          const SizedBox(height: 24),
                          SizedBox(
                            width: double.infinity,
                            height: 50,
                            child: ElevatedButton(
                              onPressed: _loading ? null : _handleLogin,
                              style: ElevatedButton.styleFrom(
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(14),
                                ),
                              ),
                              child: _loading
                                  ? const SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: Colors.white,
                                      ),
                                    )
                                  : const Text(
                                      'Sign In',
                                      style: TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
