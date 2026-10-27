package com.quran.karim;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Home-screen widget: the ayah of the day (a 30-day list the web app keeps filled) and
 * "continue from page N". Tapping the ayah opens its tafsir screen, the button opens the page.
 */
public class QuranWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) m.updateAppWidget(id, views(c));
    }

    static void store(Context c, String json) {
        Alarms.prefs(c).edit().putString("widget", json).apply();
        refresh(c);
        PrayerWidget.refresh(c);
    }

    static void refresh(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, QuranWidget.class));
        if (ids.length > 0) m.updateAppWidget(ids, views(c));
    }

    private static PendingIntent open(Context c, int code, String hash) {
        Intent i = new Intent(c, MainActivity.class).putExtra("hash", hash).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(c, code, i, PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
    }

    private static RemoteViews views(Context c) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget);
        JSONObject w;
        try { w = new JSONObject(Alarms.prefs(c).getString("widget", "{}")); } catch (Exception e) { w = new JSONObject(); }
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        JSONArray ay = w.optJSONArray("ayat");
        JSONObject pick = null;
        if (ay != null) for (int i = 0; i < ay.length(); i++) {
            JSONObject a = ay.optJSONObject(i);
            if (a.optString("d").compareTo(today) <= 0) pick = a;
        }
        if (pick == null && ay != null && ay.length() > 0) pick = ay.optJSONObject(0);
        if (pick != null) {
            v.setTextViewText(R.id.w_ayah, pick.optString("t"));
            v.setTextViewText(R.id.w_ref, pick.optString("r"));
            v.setOnClickPendingIntent(R.id.w_ayah, open(c, 11, pick.optString("h")));
        } else {
            v.setTextViewText(R.id.w_ayah, "افتح التطبيق مرة لتظهر آية اليوم هنا");
            v.setTextViewText(R.id.w_ref, "");
            v.setOnClickPendingIntent(R.id.w_ayah, open(c, 11, ""));
        }
        v.setTextViewText(R.id.w_cont, w.optString("cont", "ابدأ القراءة"));
        v.setOnClickPendingIntent(R.id.w_cont, open(c, 12, w.optString("contHash", "")));
        return v;
    }
}
