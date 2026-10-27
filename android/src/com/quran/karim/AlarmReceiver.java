package com.quran.karim;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** The alarm going off, or the phone restarting / the app updating (alarms are lost then and set again). */
public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        if ("com.quran.karim.ALARM".equals(i.getAction())) Alarms.fire(c);
        else Alarms.schedule(c);
        QuranWidget.refresh(c);
        PrayerWidget.refresh(c);
    }
}
