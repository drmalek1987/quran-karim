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

    AppBridge(Activity activity) { this.activity = activity; }

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

    /** Full screen while reading the mushaf: hides the status and navigation bars (a swipe from the edge shows them for a moment). */
    @JavascriptInterface
    public void immersive(final boolean on) {
        if (Build.VERSION.SDK_INT < 30) return;
        activity.runOnUiThread(new Runnable() {
            public void run() {
                android.view.WindowInsetsController c = activity.getWindow().getInsetsController();
                if (c == null) return;
                if (on) {
                    c.setSystemBarsBehavior(android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                    c.hide(android.view.WindowInsets.Type.systemBars());
                } else c.show(android.view.WindowInsets.Type.systemBars());
            }
        });
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
                if (adhanPlayer != null) { try { adhanPlayer.release(); } catch (Exception e) { } adhanPlayer = null; }
                int raw = voice.length() == 0 ? 0 : activity.getResources().getIdentifier("adhan_" + voice, "raw", activity.getPackageName());
                if (raw == 0) return;
                adhanPlayer = android.media.MediaPlayer.create(activity, raw);
                if (adhanPlayer != null) adhanPlayer.start();
            }
        });
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
                activity.startActivity(Intent.createChooser(i, "مشاركة الآية"));
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
                    out.write(Base64.decode(base64, Base64.DEFAULT));
                    out.close();
                    Uri uri = Uri.parse("content://" + ShareProvider.AUTHORITY + "/" + f.getName());
                    Intent i = new Intent(Intent.ACTION_SEND).setType("image/png").putExtra(Intent.EXTRA_STREAM, uri)
                        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    activity.startActivity(Intent.createChooser(i, "مشاركة الآية").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION));
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
                    out.write(text.getBytes("UTF-8"));
                    out.close();
                    Uri uri = Uri.parse("content://" + ShareProvider.AUTHORITY + "/" + f.getName());
                    Intent i = new Intent(Intent.ACTION_SEND).setType("application/json").putExtra(Intent.EXTRA_STREAM, uri)
                        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    activity.startActivity(Intent.createChooser(i, "حفظ النسخة الاحتياطية").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION));
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
}
