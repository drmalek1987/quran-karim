package com.quran.karim;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** The alarm going off, or the phone restarting / the app updating / exact alarms being allowed (the alarm is set again). */
public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        // Each step on its own: an exception here would kill the process, and a widget must not stop the alarms.
        try {
            if ("com.quran.karim.ALARM".equals(i.getAction())) Alarms.fire(c);
            else Alarms.schedule(c);
        } catch (RuntimeException ignored) { }
        try { QuranWidget.refresh(c); } catch (RuntimeException ignored) { }
        try { PrayerWidget.refresh(c); } catch (RuntimeException ignored) { }
    }
}
