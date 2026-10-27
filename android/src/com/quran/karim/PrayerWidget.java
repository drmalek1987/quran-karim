package com.quran.karim;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.SystemClock;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Home-screen widget: the next prayer and a live countdown to it. The web app keeps three days of
 * prayer times in the same "widget" data QuranWidget uses; it is refreshed on every alarm and every 30 minutes.
 */
public class PrayerWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) m.updateAppWidget(id, views(c));
    }

    static void refresh(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, PrayerWidget.class));
        if (ids.length > 0) m.updateAppWidget(ids, views(c));
    }

    private static RemoteViews views(Context c) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_prayer);
        JSONObject w;
        try { w = new JSONObject(Alarms.prefs(c).getString("widget", "{}")); } catch (Exception e) { w = new JSONObject(); }
        JSONArray pr = w.optJSONArray("prayers");
        long now = System.currentTimeMillis();
        JSONObject next = null;
        if (pr != null) for (int i = 0; i < pr.length(); i++) {
            JSONObject p = pr.optJSONObject(i);
            if (p != null && p.optLong("at") > now) { next = p; break; }
        }
        if (next != null) {
            v.setTextViewText(R.id.wp_name, next.optString("n"));
            v.setTextViewText(R.id.wp_time, next.optString("t"));
            long left = next.optLong("at") - now;
            v.setChronometer(R.id.wp_left, SystemClock.elapsedRealtime() + left, null, true);
            if (Build.VERSION.SDK_INT >= 24) v.setChronometerCountDown(R.id.wp_left, true);
            v.setTextViewText(R.id.wp_place, w.optString("place", ""));
        } else {
            v.setTextViewText(R.id.wp_name, "مواقيت الصلاة");
            v.setTextViewText(R.id.wp_time, "افتح التطبيق وحدد مدينتك");
            v.setChronometer(R.id.wp_left, SystemClock.elapsedRealtime(), null, false);
            v.setTextViewText(R.id.wp_place, "");
        }
        Intent i = new Intent(c, MainActivity.class).putExtra("hash", "#/prayer").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        v.setOnClickPendingIntent(R.id.wp_root, PendingIntent.getActivity(c, 13, i, PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0)));
        return v;
    }
}
