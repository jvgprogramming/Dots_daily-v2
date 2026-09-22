import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart' show Color;
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:timezone/timezone.dart' as tz;
import 'package:timezone/data/latest.dart' as tz_data;

/// Signature for handling notification taps (used to open the alarm screen).
typedef OnAlarmTap = void Function(String? payload);

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  /// Channel id for medication reminders. Versioned because Android freezes a
  /// channel's sound once it has been created, so bumping the id is the only
  /// reliable way to make the alarm sound apply on already-installed devices.
  static const String alarmChannelId = 'medication_alarms_v2';

  final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();
  bool _initialized = false;

  /// Set by main.dart so notification taps can route into the app
  /// (e.g. open the full-screen alarm-ringing experience).
  static OnAlarmTap? onAlarmTap;

  /// Monotonic ID generator that stays within the 32-bit signed range.
  static int _nextId = 0;
  static int nextId() {
    _nextId = (_nextId + 1) & 0x7FFFFFFF;
    return _nextId;
  }

  /// Initialize the notification plugin and create default channels.
  Future<void> initialize() async {
    if (_initialized) return;

    // Initialize timezone database (needed for zoned scheduling).
    tz_data.initializeTimeZones();

    // Without this, tz.local silently stays UTC: a "07:00" reminder rings at
    // 07:00 UTC — 15:00 in Manila — hours after the patient's breakfast.
    try {
      final name = await FlutterTimezone.getLocalTimezone();
      tz.setLocalLocation(tz.getLocation(name));
    } catch (e) {
      debugPrint('Could not detect the device timezone ($e) — alarms may '
          'ring at UTC wall-clock times.');
    }

    const androidSettings = AndroidInitializationSettings(
      '@mipmap/ic_launcher',
    );

    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _plugin.initialize(
      settings: initSettings,
      onDidReceiveNotificationResponse: _onNotificationTap,
    );

    if (defaultTargetPlatform == TargetPlatform.android) {
      final androidPlugin = _plugin
          .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >();

      // High-priority alarm channel: sound + vibration + lights.
      const alarmChannel = AndroidNotificationChannel(
        alarmChannelId,
        'Medication Reminders',
        description: 'Daily reminder to take TB medication before breakfast',
        importance: Importance.max,
        playSound: true,
        enableVibration: true,
        enableLights: true,
        // Plays res/raw/alarm_sound.wav on the alarm stream (audible even when
        // the phone is on silent/DND).
        sound: RawResourceAndroidNotificationSound('alarm_sound'),
        audioAttributesUsage: AudioAttributesUsage.alarm,
      );
      await androidPlugin?.createNotificationChannel(alarmChannel);

      // Request notification permission (Android 13+).
      await androidPlugin?.requestNotificationsPermission();
      // Request the ability to schedule exact alarms (Android 12+).
      await androidPlugin?.requestExactAlarmsPermission();
    }

    _initialized = true;
  }

  /// Android notification details tuned for a real alarm experience.
  AndroidNotificationDetails _alarmAndroidDetails() {
    return const AndroidNotificationDetails(
      alarmChannelId,
      'Medication Reminders',
      channelDescription:
          'Daily reminder to take TB medication before breakfast',
      importance: Importance.max,
      priority: Priority.max,
      category: AndroidNotificationCategory.alarm,
      fullScreenIntent: true,
      playSound: true,
      enableVibration: true,
      enableLights: true,
      ledColor: Color(0xFF16A34A),
      ledOnMs: 500,
      ledOffMs: 500,
      sound: RawResourceAndroidNotificationSound('alarm_sound'),
      audioAttributesUsage: AudioAttributesUsage.alarm,
      ongoing: false,
      autoCancel: true,
      icon: '@mipmap/ic_launcher',
    );
  }

  DarwinNotificationDetails get _alarmIosDetails =>
      const DarwinNotificationDetails(
        presentAlert: true,
        presentBadge: true,
        presentSound: true,
        interruptionLevel: InterruptionLevel.critical,
      );

  NotificationDetails get _alarmDetails => NotificationDetails(
    android: _alarmAndroidDetails(),
    iOS: _alarmIosDetails,
  );

  /// Show an instant notification (used for demos / tests).
  Future<void> showNotification({
    required int id,
    required String title,
    required String body,
    String? payload,
  }) async {
    await _ensureInitialized();
    await _plugin.show(
      id: id,
      title: title,
      body: body,
      notificationDetails: _alarmDetails,
      payload: payload,
    );
  }

  /// Schedule a one-shot notification for a specific future time.
  Future<void> scheduleNotification({
    required int id,
    required String title,
    required String body,
    required DateTime scheduledDate,
    String? payload,
  }) async {
    await _ensureInitialized();
    await _scheduleZoned(
      id: id,
      title: title,
      body: body,
      scheduledDate: tz.TZDateTime.from(scheduledDate, tz.local),
      payload: payload,
    );
  }

  /// Schedule a repeating daily alarm at the given hour/minute.
  Future<void> scheduleDailyAlarm({
    required int id,
    required String title,
    required String body,
    required int hour,
    required int minute,
    String? payload,
  }) async {
    await _ensureInitialized();
    final now = tz.TZDateTime.now(tz.local);
    var when = tz.TZDateTime(
      tz.local,
      now.year,
      now.month,
      now.day,
      hour,
      minute,
    );
    if (!when.isAfter(now)) {
      when = when.add(const Duration(days: 1));
    }

    await _scheduleZoned(
      id: id,
      title: title,
      body: body,
      scheduledDate: when,
      payload: payload,
      matchDateTimeComponents: DateTimeComponents.time,
    );
  }

  /// Schedule a weekly alarm on specific weekdays.
  ///
  /// [dayNames] uses the app's short day codes: Mon, Tue, Wed, Thu, Fri, Sat, Sun.
  /// Every enabled day gets its own weekly schedule (Android matches on
  /// day-of-week + time). When empty, schedules a daily repeat instead.
  Future<void> scheduleWeeklyAlarm({
    required int id,
    required String title,
    required String body,
    required int hour,
    required int minute,
    List<String> dayNames = const [],
    String? payload,
  }) async {
    await _ensureInitialized();

    if (dayNames.isEmpty || dayNames.length >= 7) {
      await scheduleDailyAlarm(
        id: id,
        title: title,
        body: body,
        hour: hour,
        minute: minute,
        payload: payload,
      );
      return;
    }

    const dayMap = {
      'Mon': DateTime.monday,
      'Tue': DateTime.tuesday,
      'Wed': DateTime.wednesday,
      'Thu': DateTime.thursday,
      'Fri': DateTime.friday,
      'Sat': DateTime.saturday,
      'Sun': DateTime.sunday,
    };

    final base = tz.TZDateTime.now(tz.local);
    for (final name in dayNames) {
      final weekday = dayMap[name];
      if (weekday == null) continue;

      var when = tz.TZDateTime(
        tz.local,
        base.year,
        base.month,
        base.day,
        hour,
        minute,
      );
      // Advance to the next occurrence of the target weekday.
      while (when.weekday != weekday || !when.isAfter(base)) {
        when = when.add(const Duration(days: 1));
      }

      await _scheduleZoned(
        id: id,
        title: title,
        body: body,
        scheduledDate: when,
        payload: payload,
        matchDateTimeComponents: DateTimeComponents.dayOfWeekAndTime,
      );
    }
  }

  Future<void> _scheduleZoned({
    required int id,
    required String title,
    required String body,
    required tz.TZDateTime scheduledDate,
    required String? payload,
    DateTimeComponents? matchDateTimeComponents,
  }) async {
    // Try exact scheduling first; fall back to inexact if the platform rejects it.
    try {
      await _plugin.zonedSchedule(
        id: id,
        title: title,
        body: body,
        scheduledDate: scheduledDate,
        notificationDetails: _alarmDetails,
        androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
        payload: payload,
        matchDateTimeComponents: matchDateTimeComponents,
      );
    } catch (e) {
      if ('$e'.contains('exact_alarms_not_permitted')) {
        debugPrint(
          'Exact alarms not permitted — falling back to inexact scheduling',
        );
        await _plugin.zonedSchedule(
          id: id,
          title: title,
          body: body,
          scheduledDate: scheduledDate,
          notificationDetails: _alarmDetails,
          androidScheduleMode: AndroidScheduleMode.inexact,
          payload: payload,
          matchDateTimeComponents: matchDateTimeComponents,
        );
      } else {
        rethrow;
      }
    }
  }

  /// Cancel all pending scheduled notifications.
  Future<void> cancelAll() async {
    await _plugin.cancelAll();
  }

  /// Cancel a specific notification by ID.
  Future<void> cancel(int id) async {
    await _plugin.cancel(id: id);
  }

  Future<void> _ensureInitialized() async {
    if (!_initialized) await initialize();
    if (!_initialized) {
      debugPrint('Notification service failed to initialize');
    }
  }

  /// Handle notification tap: route through the global hook so the app
  /// can surface the alarm-ringing screen.
  void _onNotificationTap(NotificationResponse response) {
    debugPrint('Notification tapped: ${response.payload}');
    onAlarmTap?.call(response.payload);
  }

  /// Payload of the notification that launched the app, if any.
  ///
  /// Covers the overnight case: the alarm fired while the app was dead, the
  /// full-screen intent started MainActivity, and [_onNotificationTap] never
  /// ran because there was no tap — the system opened us. Call once at
  /// startup and route the payload to the ringing screen.
  Future<String?> launchPayload() async {
    await _ensureInitialized();
    final details = await _plugin.getNotificationAppLaunchDetails();
    if (details == null || !details.didNotificationLaunchApp) return null;
    return details.notificationResponse?.payload;
  }

  /// Whether the alarm may cover the lock screen (full-screen intent),
  /// asking the user via the system page when not yet granted.
  ///
  /// Android 14+ stopped granting this at install time for most apps — the
  /// alarm then arrives as a plain heads-up banner instead. Calling this when
  /// already granted changes nothing system-side.
  Future<bool> requestFullScreenIntentPermission() async {
    if (defaultTargetPlatform != TargetPlatform.android) return true;
    final android = _plugin
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >();
    return await android?.requestFullScreenIntentPermission() ?? true;
  }

  /// Get plugin instance (for advanced use).
  FlutterLocalNotificationsPlugin get plugin => _plugin;
}
