package com.example.mobile

import android.app.KeyguardManager
import android.content.Context
import android.os.Build
import androidx.core.content.ContextCompat
import android.view.WindowManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/**
 * Alarm-capable host activity.
 *
 * `setShowWhenLocked` + `setTurnScreenOn` let the alarm experience render
 * directly over the lock screen and light the display up, like a real alarm
 * clock app. Because the flags apply to the whole activity, the rest of the
 * app is also visible over the keyguard — so Dart asks this channel whether
 * the device is still locked and shows a PIN/biometric gate before anything
 * else can be used.
 */
class MainActivity : FlutterActivity() {
    private val lockChannel = "dotsdaily.dev/lock"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, lockChannel)
            .setMethodCallHandler { call, result ->
                val km = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
                when (call.method) {
                    "isDeviceLocked" -> result.success(km.isKeyguardLocked)
                    "isDeviceSecure" -> result.success(km.isKeyguardSecure)
                    else -> result.notImplemented()
                }
            }
    }

    override fun onResume() {
        super.onResume()
        // True → visible (and audible) over the keyguard without unlocking.
        setShowWhenLocked(true)
        // True → the screen lights up when the alarm brings us to front.
        setTurnScreenOn(true)
    }
}
