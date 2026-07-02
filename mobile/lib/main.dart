import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'services/notification_service.dart';
import 'theme/app_theme.dart';
import 'providers/auth_provider.dart';
import 'providers/medications_provider.dart';
import 'widgets/navigation_header.dart';
import 'pages/dashboard_page.dart';
import 'pages/medications_page.dart';
import 'pages/chatbot_page.dart';
import 'pages/symptoms_page.dart';
import 'pages/test_alarm_page.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize notification service
  final notificationService = NotificationService();
  await notificationService.initialize();

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => MedicationsProvider()),
      ],
      child: MaterialApp(
        title: 'DOTS Daily',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        home: const MainShell(),
      ),
    );
  }
}

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  String _currentView = 'dashboard';

  void _onViewChange(String view) {
    setState(() {
      _currentView = view;
    });
  }

  void _onTriggerAlarm(Map<String, String> alarmInfo) {
    // Navigate to test alarm page when alarm is triggered from dashboard
    setState(() {
      _currentView = 'test-alarm';
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    // If not logged in, show login page
    if (!auth.isLoggedIn) {
      return const LoginPage();
    }

    return Scaffold(
      backgroundColor: AppTheme.lightTheme.scaffoldBackgroundColor,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // Sticky navigation header
            NavigationHeader(
              currentView: _currentView,
              onViewChange: _onViewChange,
            ),

            // Page content
            Expanded(
              child: _buildPage(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPage() {
    switch (_currentView) {
      case 'dashboard':
        return DashboardPage(
          onViewChange: _onViewChange,
          onTriggerAlarm: _onTriggerAlarm,
        );
      case 'medications':
        return MedicationsPage(
          onViewChange: _onViewChange,
        );
      case 'chatbot':
        return ChatbotPage(
          onViewChange: _onViewChange,
        );
      case 'symptoms':
        return SymptomsPage(
          onViewChange: _onViewChange,
        );
      case 'test-alarm':
        return TestAlarmPage(
          onViewChange: _onViewChange,
        );
      default:
        return DashboardPage(
          onViewChange: _onViewChange,
          onTriggerAlarm: _onTriggerAlarm,
        );
    }
  }
}

// Login Page (simple version)
class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _emailController = TextEditingController(text: 'john@example.com');
  final _passwordController = TextEditingController(text: 'password');
  bool _loading = false;

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
    if (mounted) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.lightTheme.scaffoldBackgroundColor,
      body: SafeArea(
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
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Icon(
                      Icons.medication,
                      color: AppColors.primary,
                      size: 34,
                    ),
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'DOTS Daily',
                    style: TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                      color: AppColors.foreground,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Sign in to continue your treatment support workflow.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 14,
                      color: AppColors.mutedForeground,
                    ),
                  ),
                  const SizedBox(height: 32),

                  // Login form
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
                    decoration: const InputDecoration(
                      labelText: 'Password',
                      hintText: 'Enter your password',
                      prefixIcon: Icon(Icons.lock_outlined),
                    ),
                    obscureText: true,
                    onSubmitted: (_) => _handleLogin(),
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _loading ? null : _handleLogin,
                      child: _loading
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Sign In'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
