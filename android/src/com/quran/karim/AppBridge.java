package com.quran.karim;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import java.io.File;
import java.io.FileOutputStream;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.HapticFeedbackConstants;
import android.view.View;
import android.webkit.JavascriptInterface;

/** Small helpers for the web app, exposed as window.AppBridge. */
class AppBridge {
    private final Activity activity;
    private final android.webkit.WebView web;

    AppBridge(Activity activity, android.webkit.WebView web) { this.activity = activity; this.web = web; }

    /** Copies an ayah to the clipboard (the WebView has no reliable clipboard API for file:// pages). */
    @JavascriptInterface
    public void copy(final String text) {
        activity.runOnUiThread(new Runnable() {
            public void run() {
                ClipboardManager cm = (ClipboardManager) activity.getSystemService(Context.CLIPBOARD_SERVICE);
                if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("آية", text));
            }
        });
    }

    /** 5.34 #14: full screen keeps the phone's status bar (clock, battery) when the reader chose so (Settings). Set before
     *  immersive() and insets(), which both follow it; the page sends it at launch and again before every full screen. */
    @JavascriptInterface
    public void fsStatus(boolean keep) { MainActivity.fsKeepStatus = keep; }

    /** Full screen while reading the mushaf: hides the navigation bar and, unless fsStatus(true), the status bar too
     *  (a swipe from the edge shows them for a moment). */
    @JavascriptInterface
    public void immersive(final boolean on) {
        if (Build.VERSION.SDK_INT < 30) return;
        activity.runOnUiThread(new Runnable() {
            public void run() {
                android.view.WindowInsetsController c = activity.getWindow().getInsetsController();
                if (c == null) return;
                // the bars to hide, by what was chosen; showing brings back all of them (a kept status bar is already there)
                int bars = MainActivity.fsKeepStatus ? android.view.WindowInsets.Type.navigationBars() : android.view.WindowInsets.Type.systemBars();
                if (on) {
                    c.setSystemBarsBehavior(android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                    c.hide(bars);
                } else c.show(android.view.WindowInsets.Type.systemBars());
            }
        });
    }

    /** 5.34 #15: keeps the screen lit while the app is open (Settings: إبقاء الشاشة مضيئة). The window flag a video player uses. */
    @JavascriptInterface
    public void keepOn(final boolean on) {
        activity.runOnUiThread(new Runnable() {
            public void run() {
                android.view.Window w = activity.getWindow();
                if (on) w.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else w.clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            }
        });
    }

    /** #18: this window's own brightness (Settings: التحكم في الإضاءة بالسحب). v in [0.02, 1], or -1 = follow the system again.
     *  Only the window attribute: no system setting is changed, so no permission is needed. */
    @JavascriptInterface
    public void setBrightness(final float v) {
        final float val = v < 0 ? android.view.WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE : Math.max(0.02f, Math.min(1f, v));
        activity.runOnUiThread(new Runnable() {
            public void run() {
                android.view.Window w = activity.getWindow();
                android.view.WindowManager.LayoutParams lp = w.getAttributes();
                lp.screenBrightness = val;
                w.setAttributes(lp);
            }
        });
    }

    /** 5.43: the theme the page applied (true = dark), kept for the splash that draws before the page; auto = follow the system night mode. */
    @JavascriptInterface
    public void setThemeDark(boolean dark) { activity.getSharedPreferences("theme", android.content.Context.MODE_PRIVATE).edit().putBoolean("dark", dark).apply(); }

    @JavascriptInterface
    public void setThemeAuto(boolean auto) { activity.getSharedPreferences("theme", android.content.Context.MODE_PRIVATE).edit().putBoolean("auto", auto).apply(); }

    /** #18: the brightness strip's rect in css px (0 width = hidden). From Android 10 it is kept out of the system back gesture. */
    @JavascriptInterface
    public void brightStrip(float x, float y, float w, float h) {
        if (Build.VERSION.SDK_INT < 29) return;
        final float d = activity.getResources().getDisplayMetrics().density;
        final int l = Math.round(x * d), t = Math.round(y * d), r = Math.round((x + w) * d), b = Math.round((y + h) * d);
        final boolean hide = w <= 0 || h <= 0;
        activity.runOnUiThread(new Runnable() {
            public void run() {
                if (hide) web.setSystemGestureExclusionRects(java.util.Collections.<android.graphics.Rect>emptyList());
                else web.setSystemGestureExclusionRects(java.util.Collections.singletonList(new android.graphics.Rect(l, t, r, b)));
            }
        });
    }

    /** "top,bottom,fsTop,fsBottom" in css px: the WebView's inset from the screen edges now, and with the system bars
     *  hidden (the cutout only, or the status bar too when it is kept). Full screen uses it to glide the page once, straight to where it ends (5.11 G2). */
    @JavascriptInterface
    public String insets() {
        if (Build.VERSION.SDK_INT < 30) return "";
        float d = activity.getResources().getDisplayMetrics().density;
        // a kept status bar keeps the WebView's top where it is: the page must not glide to the cutout line (#14)
        int fsTop = MainActivity.fsKeepStatus ? MainActivity.insT : MainActivity.cutT;
        return (MainActivity.insT / d) + "," + (MainActivity.insB / d) + "," + (fsTop / d) + "," + (MainActivity.cutB / d);
    }

    /** A tap buzz at the strength chosen in Settings: 1 light, 2 medium, 3 strong. */
    @JavascriptInterface
    public void buzz(int level) {
        final int lv = Math.max(1, Math.min(3, level));
        final long[] ms = { 0, 12, 22, 35 };
        final int[] amp = { 0, 70, 150, 255 };
        activity.runOnUiThread(new Runnable() {
            public void run() {
                Vibrator vib = (Vibrator) activity.getSystemService(Context.VIBRATOR_SERVICE);
                if (vib == null || !vib.hasVibrator()) { tick(); return; }
                if (Build.VERSION.SDK_INT >= 26) vib.vibrate(VibrationEffect.createOneShot(ms[lv], amp[lv]));
                else vib.vibrate(ms[lv]);
            }
        });
    }

    /** A buzz pattern (ms on/off pairs), used by the sebha when the target is reached. */
    @JavascriptInterface
    public void buzzPattern(String csv) {
        String[] p = csv.split(",");
        final long[] ms = new long[p.length + 1];
        for (int i = 0; i < p.length; i++) ms[i + 1] = Math.max(0, Math.min(2000, Long.parseLong(p[i].trim())));
        activity.runOnUiThread(new Runnable() {
            public void run() {
                Vibrator vib = (Vibrator) activity.getSystemService(Context.VIBRATOR_SERVICE);
                if (vib == null || !vib.hasVibrator()) return;
                if (Build.VERSION.SDK_INT >= 26) vib.vibrate(VibrationEffect.createWaveform(ms, -1));
                else vib.vibrate(ms, -1);
            }
        });
    }

    private android.media.MediaPlayer adhanPlayer;

    /** Plays a muezzin's adhan from res/raw to try it in the prayer settings; "" stops it. */
    @JavascriptInterface
    public void previewAdhan(final String voice) {
        activity.runOnUiThread(new Runnable() {
            public void run() {
                stopAdhan();
                if (voice == null || !voice.matches("[a-z0-9_]+")) return;
                int raw = activity.getResources().getIdentifier("adhan_" + voice, "raw", activity.getPackageName());
                if (raw == 0) return;
                adhanPlayer = android.media.MediaPlayer.create(activity, raw);
                if (adhanPlayer != null) adhanPlayer.start();
            }
        });
    }

    /** UI thread: ends the adhan being tried (also when the app is left). */
    void stopAdhan() {
        if (adhanPlayer != null) { try { adhanPlayer.release(); } catch (Exception e) { } adhanPlayer = null; }
    }

    /** A light tap felt on a page turn or an ayah tap; needs no permission. */
    @JavascriptInterface
    public void tick() {
        activity.runOnUiThread(new Runnable() {
            public void run() {
                View v = activity.getWindow().getDecorView();
                v.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP, HapticFeedbackConstants.FLAG_IGNORE_GLOBAL_SETTING);
            }
        });
    }

    /** Opens the Android share sheet with an ayah as text. */
    @JavascriptInterface
    public void shareText(final String text) {
        activity.runOnUiThread(new Runnable() {
            public void run() {
                Intent i = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text);
                activity.startActivity(Intent.createChooser(i, Alarms.tr(activity, "مشاركة الآية", "Share the ayah")));
            }
        });
    }

    /** Saves the ayah picture (PNG, base64) in the cache and shares it through ShareProvider. */
    @JavascriptInterface
    public void shareImage(final String base64, String name) {
        final String safe = name.replaceAll("[^A-Za-z0-9._-]", "");
        activity.runOnUiThread(new Runnable() {
            public void run() {
                try {
                    File dir = new File(activity.getCacheDir(), "share");
                    dir.mkdirs();
                    File f = new File(dir, safe.length() > 0 ? safe : "ayah.png");
                    FileOutputStream out = new FileOutputStream(f);
                    try { out.write(Base64.decode(base64, Base64.DEFAULT)); } finally { out.close(); }
                    Uri uri = Uri.parse("content://" + ShareProvider.authority(activity) + "/" + f.getName());
                    Intent i = new Intent(Intent.ACTION_SEND).setType("image/png").putExtra(Intent.EXTRA_STREAM, uri)
                        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    activity.startActivity(Intent.createChooser(i, Alarms.tr(activity, "مشاركة الآية", "Share the ayah")).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION));
                } catch (Exception e) { }
            }
        });
    }

    /** Shares the backup (JSON text) as a file so it can be saved to Drive, sent, or kept. */
    @JavascriptInterface
    public void shareFile(final String text, String name) {
        final String safe = name.replaceAll("[^A-Za-z0-9._-]", "");
        activity.runOnUiThread(new Runnable() {
            public void run() {
                try {
                    File dir = new File(activity.getCacheDir(), "share");
                    dir.mkdirs();
                    File f = new File(dir, safe.length() > 0 ? safe : "backup.json");
                    FileOutputStream out = new FileOutputStream(f);
                    try { out.write(text.getBytes("UTF-8")); } finally { out.close(); }
                    Uri uri = Uri.parse("content://" + ShareProvider.authority(activity) + "/" + f.getName());
                    Intent i = new Intent(Intent.ACTION_SEND).setType("application/json").putExtra(Intent.EXTRA_STREAM, uri)
                        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    activity.startActivity(Intent.createChooser(i, Alarms.tr(activity, "حفظ النسخة الاحتياطية", "Save the backup")).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION));
                } catch (Exception e) { }
            }
        });
    }

    /** The next 30 days of reminders and prayer notifications, worked out by the web app. */
    @JavascriptInterface
    public void setAlarms(String json) { Alarms.store(activity, json); }

    /** What the home-screen widget shows (ayah of the day list, continue-reading page). */
    @JavascriptInterface
    public void setWidget(String json) { QuranWidget.store(activity, json); }

    /** Android 13+ asks the user before an app may show notifications. */
    @JavascriptInterface
    public void askNotifications() {
        if (Build.VERSION.SDK_INT >= 33 && activity.checkSelfPermission("android.permission.POST_NOTIFICATIONS") != android.content.pm.PackageManager.PERMISSION_GRANTED)
            activity.requestPermissions(new String[] { "android.permission.POST_NOTIFICATIONS" }, 42);
    }

    /** Whether prayer alarms can ring on the minute (Android 12+ lets the user turn this off). */
    @JavascriptInterface
    public boolean exactAlarms() {
        if (Build.VERSION.SDK_INT < 31) return true;
        android.app.AlarmManager am = (android.app.AlarmManager) activity.getSystemService(Context.ALARM_SERVICE);
        return am != null && am.canScheduleExactAlarms();
    }

    @JavascriptInterface
    public void askExactAlarms() {
        if (Build.VERSION.SDK_INT >= 31) try {
            activity.startActivity(new Intent(android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + activity.getPackageName())));
        } catch (Exception e) { }
    }

    /** Whether the app may show notifications at all (the user can turn them off in the phone's settings). */
    @JavascriptInterface
    public boolean notificationsOn() {
        android.app.NotificationManager nm = (android.app.NotificationManager) activity.getSystemService(Context.NOTIFICATION_SERVICE);
        return nm == null || Build.VERSION.SDK_INT < 24 || nm.areNotificationsEnabled();
    }

    /** The app's page in the phone's settings (notifications, battery, autostart on some phones). */
    @JavascriptInterface
    public void openAppSettings() {
        try {
            activity.startActivity(new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + activity.getPackageName())));
        } catch (Exception e) { }
    }

    /** "4.9 (40)": the installed versionName and versionCode, for donated clip labels. */
    @JavascriptInterface
    public String version() {
        try {
            android.content.pm.PackageInfo p = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
            return p.versionName + " (" + p.versionCode + ")";
        } catch (Exception e) { return ""; }
    }

    /** Sprint 6 #22: the application id, so the web code can tell the Play build (com.lawh.quran) from the GitHub one. */
    @JavascriptInterface
    public String appId() { return activity.getPackageName(); }

    /** Sprint 6 #22: open this app's page in the Play Store app; the https page is the fallback when no store app is installed. */
    @JavascriptInterface
    public void openStore() {
        String id = activity.getPackageName();
        try {
            activity.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + id)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        } catch (Exception e) {
            try {
                activity.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=" + id)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } catch (Exception e2) { }
        }
    }

    // 5.43: Google Play In-App Updates. PlayUpdate is only in the Play build (android/src-play), hence the reflection:
    // the GitHub build has no such class, says false here and keeps no update prompt at all.
    private static Class<?> playUpdate() {
        try { return Class.forName("com.quran.karim.PlayUpdate"); } catch (Throwable t) { return null; }
    }

    @JavascriptInterface
    public boolean playUpdates() { return playUpdate() != null; }

    /** Asks Play for a newer version; the answer comes back through window.onPlayUpdate({st, code}). */
    @JavascriptInterface
    public void playUpdateCheck() {
        final Class<?> c = playUpdate(); if (c == null) return;
        activity.runOnUiThread(new Runnable() { public void run() {
            try { c.getDeclaredMethod("check", Activity.class, android.webkit.WebView.class).invoke(null, activity, web); } catch (Exception e) { }
        } });
    }

    /** Starts Google's update screen; the store page opens instead when Play can't start it. */
    @JavascriptInterface
    public void playUpdateStart() {
        final Class<?> c = playUpdate();
        final Runnable store = new Runnable() { public void run() { openStore(); } };
        if (c == null) { store.run(); return; }
        activity.runOnUiThread(new Runnable() { public void run() {
            try { c.getDeclaredMethod("start", Activity.class, Runnable.class).invoke(null, activity, store); } catch (Exception e) { store.run(); }
        } });
    }

    // #34 Phase 2: official Quran radio (RadioService). The state comes back through window.onRadio({st, id, reason}).
    @JavascriptInterface
    public void radioPlay(final String id, final String url, final String title, final String owner) {
        activity.runOnUiThread(new Runnable() { public void run() {
            try { RadioService.web = web; RadioService.play(activity, id, url, title, owner); } catch (Exception e) { }
        } });
    }

    @JavascriptInterface
    public void radioPause() {
        activity.runOnUiThread(new Runnable() { public void run() { try { RadioService.userPause(activity); } catch (Exception e) { } } });
    }

    @JavascriptInterface
    public void radioResume() {
        activity.runOnUiThread(new Runnable() { public void run() { try { RadioService.web = web; RadioService.resume(activity); } catch (Exception e) { } } });
    }

    @JavascriptInterface
    public void radioStop() {
        activity.runOnUiThread(new Runnable() { public void run() { try { RadioService.stop(activity); } catch (Exception e) { } } });
    }

    /** {"st","id","reason"} of the radio right now (the page asks when it opens). */
    @JavascriptInterface
    public String radioState() { RadioService.web = web; return RadioService.stateJson(); }
}
