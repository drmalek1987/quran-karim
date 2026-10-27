package com.quran.karim;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Reminders and prayer-time notifications. The web app works out the next 30 days of events
 * ({at: epoch ms, title, text, hash, kind: "adhan"|"rem"}) and hands them over; this keeps one
 * alarm set for the next event, shows it when it fires and moves on to the one after.
 */
final class Alarms {
    static final String PREFS = "alarms", CH_REM = "reminders", CH_ADHAN = "adhan";
    private Alarms() { }

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    static void store(Context c, String json) {
        prefs(c).edit().putString("events", json).apply();
        schedule(c);
    }

    private static JSONArray events(Context c) {
        try { return new JSONArray(prefs(c).getString("events", "[]")); } catch (Exception e) { return new JSONArray(); }
    }

    /** Sets the alarm for the first event still ahead (exact when Android allows it). */
    static void schedule(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = PendingIntent.getBroadcast(c, 1, new Intent(c, AlarmReceiver.class).setAction("com.quran.karim.ALARM"),
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        am.cancel(pi);
        long now = System.currentTimeMillis(), next = Long.MAX_VALUE, last = prefs(c).getLong("last", 0);
        JSONArray ev = events(c);
        for (int i = 0; i < ev.length(); i++) {
            long at = ev.optJSONObject(i).optLong("at");
            if (at > now && at > last && at < next) next = at;
        }
        if (next == Long.MAX_VALUE) return;
        boolean exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
        if (Build.VERSION.SDK_INT >= 23) {
            if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi);
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi);
        } else if (Build.VERSION.SDK_INT >= 19) am.setExact(AlarmManager.RTC_WAKEUP, next, pi);
        else am.set(AlarmManager.RTC_WAKEUP, next, pi);
    }

    /** Shows what is due now (only the latest, if the phone slept through several), then sets the next alarm. */
    static void fire(Context c) {
        long now = System.currentTimeMillis(), last = prefs(c).getLong("last", 0);
        JSONArray ev = events(c);
        JSONObject due = null;
        for (int i = 0; i < ev.length(); i++) {
            JSONObject e = ev.optJSONObject(i);
            long at = e.optLong("at");
            // Within the last two hours: an event missed for longer is old news.
            if (at <= now + 30000 && at > last && at > now - 7200000L && (due == null || at > due.optLong("at"))) due = e;
        }
        if (due != null) {
            prefs(c).edit().putLong("last", due.optLong("at")).apply();
            notify(c, due);
        } else prefs(c).edit().putLong("last", now).apply();
        schedule(c);
    }

    @SuppressWarnings("deprecation")
    private static void notify(Context c, JSONObject e) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        boolean adhan = "adhan".equals(e.optString("kind"));
        // Each muezzin gets its own channel, since Android fixes a channel's sound once it exists.
        String voice = e.optString("v", "alarm");
        int raw = adhan ? c.getResources().getIdentifier("adhan_" + voice, "raw", c.getPackageName()) : 0;
        Uri sound = raw != 0 ? Uri.parse("android.resource://" + c.getPackageName() + "/" + raw) : RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        String ch = adhan ? (raw != 0 ? CH_ADHAN + "_" + voice : "silent".equals(voice) ? CH_ADHAN + "_silent" : CH_ADHAN) : CH_REM;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel nc = new NotificationChannel(ch, adhan ? "الأذان" + (raw != 0 ? " (" + voice + ")" : "") : "التذكيرات",
                adhan ? NotificationManager.IMPORTANCE_HIGH : NotificationManager.IMPORTANCE_DEFAULT);
            if (adhan && "silent".equals(voice)) nc.setSound(null, null);
            else if (adhan) nc.setSound(sound, new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build());
            nm.createNotificationChannel(nc);
        }
        Intent open = new Intent(c, MainActivity.class).putExtra("hash", e.optString("hash", ""))
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, (int) (e.optLong("at") / 1000), open,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, ch) : new Notification.Builder(c);
        b.setSmallIcon(R.drawable.ic_notif).setContentTitle(e.optString("title")).setContentText(e.optString("text"))
            .setStyle(new Notification.BigTextStyle().bigText(e.optString("text")))
            .setContentIntent(pi).setAutoCancel(true).setColor(0xff0f6b4f);
        if (Build.VERSION.SDK_INT < 26 && adhan) b.setSound("silent".equals(voice) ? null : sound).setPriority(Notification.PRIORITY_HIGH);
        else if (Build.VERSION.SDK_INT < 26) b.setDefaults(Notification.DEFAULT_ALL);
        try { nm.notify(adhan ? 2 : 3, b.build()); } catch (SecurityException ignored) { }
    }
}
