import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'services/notification_service.dart';
import 'theme/app_theme.dart';
import 'widgets/motion.dart';
import 'providers/auth_provider.dart';
import 'providers/medications_provider.dart';
import 'pages/dashboard_page.dart';
import 'pages/reminder_page.dart';
import 'pages/calendar_page.dart';
import 'pages/alarm_ringing_page.dart';
import 'pages/chatbot_page.dart';
import 'pages/symptoms_page.dart';
import 'providers/symptoms_provider.dart';
import 'pages/test_alarm_page.dart';
import 'pages/profile_page.dart';
import 'models/medication.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize notification service
  final notificationService = NotificationService();
  await notificationService.initialize();

  // The alarm may have started the app itself (full-screen intent while the
  // phone was locked and the process was dead). Capture its payload now, so
  // once the first frame is up the ringing screen can be opened over it.
  final alarmLaunchPayload = await notificationService.launchPayload();

  runApp(MyApp(alarmLaunchPayload: alarmLaunchPayload));
}

/// Light only until every page reads colors from `context.palette`; pages
/// still on the light-only `AppColors` constants would look broken in dark
/// mode. Set to [ThemeMode.system] to preview dark mode on the updated
/// screens (login, home).
const ThemeMode appThemeMode = ThemeMode.light;

/// Global navigator key so notification taps can open the ringing screen
/// even when the app is restored from the background.
final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

class MyApp extends StatelessWidget {
  const MyApp({super.key, this.alarmLaunchPayload});

  /// Non-null when an alarm notification started the app itself.
  final String? alarmLaunchPayload;

  @override
  Widget build(BuildContext context) {
    // Notification taps route into the app: open the alarm ringing screen.
    NotificationService.onAlarmTap = (payload) {
      // A nurse update: opening the app is all it needs (the sync that runs on
      // resume pulls in the new review state).
      if (payload == 'vot') return;
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
        ChangeNotifierProvider(
          create: (_) {
            final meds = MedicationsProvider();
            // Startup restore: re-arm the saved daily reminder (covers reboot
            // and app updates, which clear scheduled alarms) and resurface any
            // offline-queued proof uploads so they retry.
            meds.restoreAndArmReminder();
            meds.restoreQueue();
            return meds;
          },
        ),
        ChangeNotifierProvider(create: (_) => SymptomsProvider()),
      ],
      child: MaterialApp(
        title: 'DOTS Daily',
        debugShowCheckedModeBanner: false,
        navigatorKey: navigatorKey,
        theme: AppTheme.lightTheme,
        darkTheme: AppTheme.darkTheme,
        themeMode: appThemeMode,
        home: AlarmLaunchGate(alarmLaunchPayload: alarmLaunchPayload),
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

/// Opens the ringing screen once, if the app was started by an alarm.
///
/// Waits a frame so the navigator and providers exist before pushing over
/// them, then stays out of the way (renders nothing) for the app's lifetime.
class AlarmLaunchGate extends StatefulWidget {
  final String? alarmLaunchPayload;

  const AlarmLaunchGate({super.key, this.alarmLaunchPayload});

  @override
  State<AlarmLaunchGate> createState() => _AlarmLaunchGateState();
}

class _AlarmLaunchGateState extends State<AlarmLaunchGate> {
  bool _handled = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _openAlarmIfNeeded());
  }

  void _openAlarmIfNeeded() {
    if (_handled || !mounted) return;
    _handled = true;

    final payload = widget.alarmLaunchPayload;
    if (payload == null || !payload.startsWith('alarm:')) return;

    final id = payload.substring('alarm:'.length);
    final meds = Provider.of<MedicationsProvider>(context, listen: false);
    try {
      final alarm = meds.alarms.firstWhere((a) => a.id == id);
      AlarmRingingPage.open(context, alarm);
    } catch (_) {
      // Unknown id — nothing to ring for; the app opens normally.
    }
  }

  @override
  Widget build(BuildContext context) => const MainShell();
}

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> with WidgetsBindingObserver {
  int _currentIndex = 0;

  /// Last foreground re-sync, so flipping between apps doesn't spam the API.
  DateTime? _lastResumeSync;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  /// There is no push service, so coming back to the app is when a nurse's
  /// decision (verified / rejected / record again) is picked up: the sync
  /// uploads queued proofs, reloads the calendar and turns new clinic messages
  /// into phone notifications.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) return;
    if (!context.read<AuthProvider>().isLoggedIn) return;
    final now = DateTime.now();
    if (_lastResumeSync != null &&
        now.difference(_lastResumeSync!) < const Duration(seconds: 30)) {
      return;
    }
    _lastResumeSync = now;
    context.read<MedicationsProvider>().refresh();
  }

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
      // Land the next session on Home rather than whichever tab was open.
      _currentIndex = 0;
      return const LoginPage();
    }

    if (!_pulledFromBackend) {
      _pulledFromBackend = true;
      // Deferred a frame so the fetch starts with the providers settled.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.read<MedicationsProvider>().refresh();
      });
    }

    final palette = context.palette;

    return Scaffold(
      backgroundColor: palette.background,
      // Reserve space for the footer navigation bar so it never covers the
      // last items of a page.
      extendBody: false,
      // AnimatedSwitcher cross-fades whenever its child's key changes, so
      // keying each tab by its index animates tab changes.
      body: AnimatedSwitcher(
        duration: Motion.reduced(context) ? Duration.zero : Motion.medium,
        switchInCurve: Motion.emphasized,
        switchOutCurve: Curves.easeIn,
        transitionBuilder: (child, animation) => FadeTransition(
          opacity: animation,
          child: SlideTransition(
            position: Tween<Offset>(
              begin: const Offset(0, 0.015),
              end: Offset.zero,
            ).animate(animation),
            child: child,
          ),
        ),
        child: KeyedSubtree(
          key: ValueKey(_currentIndex),
          child: _buildTab(_tabs[_currentIndex].$1),
        ),
      ),
      bottomNavigationBar: DecoratedBox(
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: palette.borderLight)),
        ),
        child: NavigationBar(
          selectedIndex: _currentIndex,
          onDestinationSelected: _onTabTapped,
          animationDuration: Motion.medium,
          destinations: [
            for (final tab in _tabs)
              NavigationDestination(
                icon: Icon(tab.$3),
                selectedIcon: Icon(tab.$4),
                label: tab.$2,
              ),
          ],
        ),
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

  /// Bumped on every failed sign-in so the form shakes.
  int _failures = 0;

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
      setState(() => _failures++);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(auth.error!),
          backgroundColor: context.palette.danger,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.palette;

    return Scaffold(
      backgroundColor: p.background,
      body: Stack(
        children: [
          // Deep green band across the top, like the portal's hero areas.
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: MediaQuery.of(context).size.height * 0.42,
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: p.heroGradient,
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: const BorderRadius.vertical(
                  bottom: Radius.circular(36),
                ),
              ),
            ),
          ),
          const Positioned(top: -60, right: -40, child: _GlowCircle(size: 180)),
          const Positioned(top: 120, left: -50, child: _GlowCircle(size: 120)),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      FadeSlideIn(child: _buildLogo()),
                      const SizedBox(height: 20),
                      const FadeSlideIn(
                        index: 1,
                        child: Text(
                          'DOTS Daily',
                          style: TextStyle(
                            fontSize: 30,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                            letterSpacing: -0.6,
                          ),
                        ),
                      ),
                      const SizedBox(height: 6),
                      FadeSlideIn(
                        index: 2,
                        child: Text(
                          'Your TB treatment companion',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.white.withValues(alpha: 0.8),
                          ),
                        ),
                      ),
                      const SizedBox(height: 32),
                      FadeSlideIn(
                        index: 3,
                        offset: 28,
                        child: ShakeOnChange(
                          trigger: _failures,
                          child: _buildFormCard(p),
                        ),
                      ),
                      const SizedBox(height: 20),
                      FadeSlideIn(
                        index: 5,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.lock_outline_rounded,
                              size: 14,
                              color: p.textTertiary,
                            ),
                            const SizedBox(width: 6),
                            Flexible(
                              child: Text(
                                'Use the account your health center gave you',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: p.textTertiary,
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
        ],
      ),
    );
  }

  Widget _buildLogo() {
    return Container(
      width: 96,
      height: 96,
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: Colors.white,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.15),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: ClipOval(
        child: Image.asset(
          'assets/images/logo.png',
          fit: BoxFit.cover,
        ),
      ),
    );
  }

  Widget _buildFormCard(AppPalette p) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: p.card,
        borderRadius: BorderRadius.circular(AppRadius.xxl),
        border: Border.all(color: p.borderLight),
        boxShadow: p.elevatedShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Sign in',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: p.textPrimary,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Welcome back. Enter your details to continue.',
            style: TextStyle(fontSize: 13, color: p.textSecondary),
          ),
          const SizedBox(height: 20),
          TextField(
            controller: _emailController,
            decoration: const InputDecoration(
              labelText: 'Email',
              hintText: 'you@example.com',
              prefixIcon: Icon(Icons.email_outlined),
            ),
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _passwordController,
            decoration: InputDecoration(
              labelText: 'Password',
              hintText: 'Enter your password',
              prefixIcon: const Icon(Icons.lock_outlined),
              suffixIcon: IconButton(
                icon: AnimatedSwitcher(
                  duration: Motion.fast,
                  transitionBuilder: (child, a) =>
                      ScaleTransition(scale: a, child: child),
                  child: Icon(
                    _obscure
                        ? Icons.visibility_outlined
                        : Icons.visibility_off_outlined,
                    key: ValueKey(_obscure),
                    color: p.textTertiary,
                  ),
                ),
                onPressed: () => setState(() => _obscure = !_obscure),
              ),
            ),
            obscureText: _obscure,
            onSubmitted: (_) => _handleLogin(),
          ),
          const SizedBox(height: 24),
          PressableScale(
            enabled: !_loading,
            child: SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: _loading ? null : _handleLogin,
                child: AnimatedSwitcher(
                  duration: Motion.fast,
                  child: _loading
                      ? const SizedBox(
                          key: ValueKey('loading'),
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Row(
                          key: ValueKey('label'),
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text('Sign In'),
                            SizedBox(width: 8),
                            Icon(Icons.arrow_forward_rounded, size: 18),
                          ],
                        ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Soft translucent circle used as decoration on green hero areas.
class _GlowCircle extends StatelessWidget {
  final double size;

  const _GlowCircle({required this.size});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.white.withValues(alpha: 0.07),
      ),
    );
  }
}
