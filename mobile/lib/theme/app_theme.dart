import 'package:material_ui/material_ui.dart';

// Colors, radii and shadows mirror the web portal's tokens in
// web/app/globals.css so the app and the portal read as one product.

/// Theme-aware colors. Read them with `context.palette` so a widget picks up
/// the light or dark values automatically.
///
/// A [ThemeExtension] lets us hang our own tokens on [ThemeData]: Flutter
/// stores one instance per theme and hands back the active one through
/// `Theme.of(context)`, and animates between them when the theme changes.
@immutable
class AppPalette extends ThemeExtension<AppPalette> {
  // Brand
  final Color primary; // primary-500
  final Color primaryStrong; // primary-700 (light) / 600 (dark)
  final Color primarySoft; // primary-100: tinted chips, icon tiles
  final Color primaryTint; // primary-200: hairline accents
  final Color onPrimary; // text/icons drawn on [primary]
  final Color brandAction; // solid buttons
  final Color brandActionHover;

  // Surfaces
  final Color background; // bg-main
  final Color card; // bg-card
  final Color subtle; // bg-subtle

  // Borders
  final Color borderLight;
  final Color border;
  final Color borderStrong;

  // Text
  final Color textPrimary;
  final Color textBody;
  final Color textSecondary;
  final Color textTertiary;
  final Color textMuted;

  // Status
  final Color success;
  final Color successBg;
  final Color warning;
  final Color warningBg;
  final Color danger;
  final Color dangerBg;
  final Color info;
  final Color infoBg;

  /// Deep green gradient behind the home hero and other banners.
  final List<Color> heroGradient;

  final List<BoxShadow> cardShadow;
  final List<BoxShadow> elevatedShadow;

  const AppPalette({
    required this.primary,
    required this.primaryStrong,
    required this.primarySoft,
    required this.primaryTint,
    required this.onPrimary,
    required this.brandAction,
    required this.brandActionHover,
    required this.background,
    required this.card,
    required this.subtle,
    required this.borderLight,
    required this.border,
    required this.borderStrong,
    required this.textPrimary,
    required this.textBody,
    required this.textSecondary,
    required this.textTertiary,
    required this.textMuted,
    required this.success,
    required this.successBg,
    required this.warning,
    required this.warningBg,
    required this.danger,
    required this.dangerBg,
    required this.info,
    required this.infoBg,
    required this.heroGradient,
    required this.cardShadow,
    required this.elevatedShadow,
  });

  static const light = AppPalette(
    primary: Color(0xFF18865B),
    primaryStrong: Color(0xFF0E5D41),
    primarySoft: Color(0xFFE3F0E8),
    primaryTint: Color(0xFFC9E2D3),
    onPrimary: Colors.white,
    brandAction: Color(0xFF0B5A3C),
    brandActionHover: Color(0xFF084A31),
    background: Color(0xFFF1F4F2),
    card: Colors.white,
    subtle: Color(0xFFF5F7F6),
    borderLight: Color(0xFFE4E9E6),
    border: Color(0xFFD5DDD8),
    borderStrong: Color(0xFFBCC7C1),
    textPrimary: Color(0xFF13201A),
    textBody: Color(0xFF3F4C45),
    textSecondary: Color(0xFF66736C),
    textTertiary: Color(0xFF84908A),
    textMuted: Color(0xFFA6B0AB),
    success: Color(0xFF18865B),
    successBg: Color(0xFFE6F2EA),
    warning: Color(0xFFB07A16),
    warningBg: Color(0xFFFBF3E2),
    danger: Color(0xFFC0412F),
    dangerBg: Color(0xFFFCEFEC),
    info: Color(0xFF0B4934),
    infoBg: Color(0xFFEAF3EE),
    heroGradient: [Color(0xFF064E32), Color(0xFF0B5A3C), Color(0xFF18865B)],
    cardShadow: [
      BoxShadow(color: Color(0x0A13201A), blurRadius: 2, offset: Offset(0, 1)),
      BoxShadow(
        color: Color(0x1F13201A),
        blurRadius: 18,
        spreadRadius: -12,
        offset: Offset(0, 6),
      ),
    ],
    elevatedShadow: [
      BoxShadow(
        color: Color(0x4D13201A),
        blurRadius: 44,
        spreadRadius: -28,
        offset: Offset(0, 20),
      ),
    ],
  );

  static const dark = AppPalette(
    primary: Color(0xFF58B889),
    primaryStrong: Color(0xFF70C99A),
    primarySoft: Color(0xFF15291E),
    primaryTint: Color(0xFF20402E),
    onPrimary: Color(0xFF0C0F0E),
    brandAction: Color(0xFF1C7A53),
    brandActionHover: Color(0xFF23905F),
    background: Color(0xFF0C0F0E),
    card: Color(0xFF141A18),
    subtle: Color(0xFF111614),
    borderLight: Color(0xFF232C28),
    border: Color(0xFF2E3934),
    borderStrong: Color(0xFF3F4C46),
    textPrimary: Color(0xFFEEF2F0),
    textBody: Color(0xFFC3CCC7),
    textSecondary: Color(0xFF9FACA5),
    textTertiary: Color(0xFF87948D),
    textMuted: Color(0xFF6F7B75),
    success: Color(0xFF71BB91),
    successBg: Color(0xFF183126),
    warning: Color(0xFFD3A85B),
    warningBg: Color(0xFF342A19),
    danger: Color(0xFFD4776C),
    dangerBg: Color(0xFF38211F),
    info: Color(0xFF8AB8A0),
    infoBg: Color(0xFF1A2C24),
    heroGradient: [Color(0xFF0A2419), Color(0xFF103A29), Color(0xFF1C7A53)],
    cardShadow: [
      BoxShadow(color: Color(0x33000000), blurRadius: 2, offset: Offset(0, 1)),
      BoxShadow(
        color: Color(0x4D000000),
        blurRadius: 24,
        spreadRadius: -20,
        offset: Offset(0, 8),
      ),
    ],
    elevatedShadow: [
      BoxShadow(
        color: Color(0x8C000000),
        blurRadius: 44,
        spreadRadius: -24,
        offset: Offset(0, 20),
      ),
    ],
  );

  @override
  AppPalette copyWith() => this;

  @override
  AppPalette lerp(ThemeExtension<AppPalette>? other, double t) {
    if (other is! AppPalette) return this;
    Color c(Color a, Color b) => Color.lerp(a, b, t)!;
    return AppPalette(
      primary: c(primary, other.primary),
      primaryStrong: c(primaryStrong, other.primaryStrong),
      primarySoft: c(primarySoft, other.primarySoft),
      primaryTint: c(primaryTint, other.primaryTint),
      onPrimary: c(onPrimary, other.onPrimary),
      brandAction: c(brandAction, other.brandAction),
      brandActionHover: c(brandActionHover, other.brandActionHover),
      background: c(background, other.background),
      card: c(card, other.card),
      subtle: c(subtle, other.subtle),
      borderLight: c(borderLight, other.borderLight),
      border: c(border, other.border),
      borderStrong: c(borderStrong, other.borderStrong),
      textPrimary: c(textPrimary, other.textPrimary),
      textBody: c(textBody, other.textBody),
      textSecondary: c(textSecondary, other.textSecondary),
      textTertiary: c(textTertiary, other.textTertiary),
      textMuted: c(textMuted, other.textMuted),
      success: c(success, other.success),
      successBg: c(successBg, other.successBg),
      warning: c(warning, other.warning),
      warningBg: c(warningBg, other.warningBg),
      danger: c(danger, other.danger),
      dangerBg: c(dangerBg, other.dangerBg),
      info: c(info, other.info),
      infoBg: c(infoBg, other.infoBg),
      heroGradient: [
        for (var i = 0; i < heroGradient.length; i++)
          c(heroGradient[i], other.heroGradient[i]),
      ],
      cardShadow: BoxShadow.lerpList(cardShadow, other.cardShadow, t)!,
      elevatedShadow:
          BoxShadow.lerpList(elevatedShadow, other.elevatedShadow, t)!,
    );
  }
}

extension AppPaletteContext on BuildContext {
  /// The active [AppPalette] (light or dark).
  AppPalette get palette => Theme.of(this).extension<AppPalette>()!;
}

/// Corner radii from the web portal (--radius-*).
class AppRadius {
  static const double sm = 6;
  static const double md = 10;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 24;
}

/// Light-mode constants, kept for pages that have not moved to
/// `context.palette` yet. New code should use `context.palette` so it also
/// works in dark mode.
class AppColors {
  static const Color primary = Color(0xFF18865B); // primary-500
  static const Color primaryDark = Color(0xFF0E5D41); // primary-700
  static const Color greenLight = Color(0xFF6FB592); // primary-400

  static const Color background = Color(0xFFF1F4F2);
  static const Color surface = Colors.white;
  static const Color card = Colors.white;

  static const Color foreground = Color(0xFF13201A);
  static const Color mutedForeground = Color(0xFF66736C);

  static const Color muted = Color(0xFFE3F0E8); // primary-100
  static const Color secondary = Color(0xFFC9E2D3); // primary-200
  static const Color accent = Color(0xFFA2CFB6); // primary-300
  static const Color border = Color(0xFFD5DDD8);
  static const Color destructive = Color(0xFFC0412F);
  static const Color orange = Color(0xFFC2622D);
  static const Color amber = Color(0xFFB07A16);
  static const Color emerald = Color(0xFF18865B);

  static const List<Color> primaryGradient = [
    Color(0xFF064E32),
    Color(0xFF0B5A3C),
    Color(0xFF18865B),
  ];
}

class AppTheme {
  static ThemeData get lightTheme => _build(AppPalette.light, Brightness.light);
  static ThemeData get darkTheme => _build(AppPalette.dark, Brightness.dark);

  static ThemeData _build(AppPalette p, Brightness brightness) {
    final scheme = ColorScheme.fromSeed(
      seedColor: p.primary,
      brightness: brightness,
    ).copyWith(
      primary: p.primary,
      onPrimary: p.onPrimary,
      secondary: p.primaryStrong,
      surface: p.card,
      onSurface: p.textPrimary,
      onSurfaceVariant: p.textSecondary,
      error: p.danger,
      outline: p.border,
      outlineVariant: p.borderLight,
    );

    final inputBorder = OutlineInputBorder(
      borderRadius: BorderRadius.circular(AppRadius.md + 2),
      borderSide: BorderSide(color: p.border),
    );

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      extensions: [p],
      scaffoldBackgroundColor: p.background,
      dividerColor: p.borderLight,
      splashFactory: InkSparkle.splashFactory,
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: FadeSlidePageTransitionsBuilder(),
          TargetPlatform.iOS: FadeSlidePageTransitionsBuilder(),
        },
      ),
      cardTheme: CardThemeData(
        color: p.card,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          side: BorderSide(color: p.borderLight),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: p.card,
        surfaceTintColor: Colors.transparent,
        indicatorColor: p.primarySoft,
        indicatorShape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.md + 4),
        ),
        height: 68,
        elevation: 0,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return TextStyle(
            fontSize: 11.5,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            color: selected ? p.primaryStrong : p.textTertiary,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(
            color: selected ? p.primaryStrong : p.textTertiary,
            size: 24,
          );
        }),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected) ? Colors.white : null,
        ),
        trackColor: WidgetStateProperty.resolveWith(
          (states) =>
              states.contains(WidgetState.selected) ? p.brandAction : null,
        ),
      ),
      timePickerTheme: TimePickerThemeData(
        backgroundColor: p.card,
        dialHandColor: p.primary,
        hourMinuteTextColor: p.textPrimary,
        dayPeriodColor: WidgetStateColor.resolveWith(
          (states) =>
              states.contains(WidgetState.selected) ? p.primary : p.primarySoft,
        ),
        dayPeriodTextColor: WidgetStateColor.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? p.onPrimary
              : p.textSecondary,
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: p.card,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.xl),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: p.textPrimary,
        contentTextStyle: TextStyle(color: p.card, fontSize: 14),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.md + 2),
        ),
      ),
      appBarTheme: AppBarTheme(
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        backgroundColor: Colors.transparent,
        foregroundColor: p.textPrimary,
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(color: p.primary),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: p.subtle,
        labelStyle: TextStyle(color: p.textSecondary),
        hintStyle: TextStyle(color: p.textMuted),
        prefixIconColor: WidgetStateColor.resolveWith(
          (states) => states.contains(WidgetState.focused)
              ? p.primary
              : p.textTertiary,
        ),
        suffixIconColor: p.textTertiary,
        border: inputBorder,
        enabledBorder: inputBorder,
        focusedBorder: inputBorder.copyWith(
          borderSide: BorderSide(color: p.primary, width: 1.6),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 14,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: p.brandAction,
          foregroundColor: Colors.white,
          disabledBackgroundColor: p.brandAction.withValues(alpha: 0.55),
          disabledForegroundColor: Colors.white70,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.md + 2),
          ),
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: p.brandAction,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.md + 2),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: p.textPrimary,
          side: BorderSide(color: p.border),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.md + 2),
          ),
          textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: p.primaryStrong,
          textStyle: const TextStyle(fontWeight: FontWeight.w600),
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(foregroundColor: p.primaryStrong),
      ),
      textTheme: TextTheme(
        headlineLarge: TextStyle(
          fontSize: 28,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.5,
          color: p.textPrimary,
        ),
        headlineMedium: TextStyle(
          fontSize: 22,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.3,
          color: p.textPrimary,
        ),
        headlineSmall: TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: p.textPrimary,
        ),
        titleLarge: TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: p.textPrimary,
        ),
        titleMedium: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w600,
          color: p.textPrimary,
        ),
        titleSmall: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: p.textPrimary,
        ),
        bodyLarge: TextStyle(fontSize: 16, color: p.textBody),
        bodyMedium: TextStyle(fontSize: 14, color: p.textPrimary),
        bodySmall: TextStyle(fontSize: 12, color: p.textSecondary),
        labelLarge: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: p.textPrimary,
        ),
      ),
    );
  }
}

/// Android page transition: the new page fades in while rising slightly,
/// and the page underneath fades back a little. Softer than the default
/// zoom, and close to the web portal's route fade.
class FadeSlidePageTransitionsBuilder extends PageTransitionsBuilder {
  const FadeSlidePageTransitionsBuilder();

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    final enter = CurvedAnimation(
      parent: animation,
      curve: Curves.easeOutCubic,
      reverseCurve: Curves.easeInCubic,
    );
    final exit = CurvedAnimation(
      parent: secondaryAnimation,
      curve: Curves.easeOutCubic,
    );
    return FadeTransition(
      opacity: Tween<double>(begin: 1, end: 0.6).animate(exit),
      child: FadeTransition(
        opacity: enter,
        child: SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(0, 0.04),
            end: Offset.zero,
          ).animate(enter),
          child: child,
        ),
      ),
    );
  }
}
