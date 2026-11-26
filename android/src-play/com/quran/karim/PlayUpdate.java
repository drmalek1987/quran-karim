package com.quran.karim;

import android.app.Activity;
import android.webkit.WebView;

import com.google.android.gms.tasks.OnFailureListener;
import com.google.android.gms.tasks.OnSuccessListener;
import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.UpdateAvailability;

/**
 * Google Play In-App Updates (Play build only: android/src-play is compiled when PLAY=1, with the Play Core jars).
 * Play itself says whether a newer version is live for this user, so nothing has to be updated by hand after a
 * release (5.43; version.json only serves 5.42 and older). AppBridge reaches this class by reflection, so the GitHub
 * build compiles without it.
 */
final class PlayUpdate {
    static final int REQ = 7043;
    private PlayUpdate() { }

    /** Asks Play, then calls window.onPlayUpdate({st:"newer"|"current"|"unknown", code}) in the page. */
    static void check(final Activity a, final WebView web) {
        final AppUpdateManager m;
        try { m = AppUpdateManagerFactory.create(a); } catch (Throwable t) { reply(a, web, "unknown", 0); return; }
        m.getAppUpdateInfo().addOnSuccessListener(new OnSuccessListener<AppUpdateInfo>() {
            public void onSuccess(AppUpdateInfo info) {
                boolean newer = info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
                    && info.isUpdateTypeAllowed(AppUpdateOptions.defaultOptions(AppUpdateType.IMMEDIATE));
                reply(a, web, newer ? "newer" : "current", info.availableVersionCode());
            }
        }).addOnFailureListener(new OnFailureListener() {
            // Not installed from Play (a sideloaded test copy), no Play Store, offline: never "newer".
            public void onFailure(Exception e) { reply(a, web, "unknown", 0); }
        });
    }

    /** Google's own full-screen update (it downloads, installs and restarts the app); runs fallback if Play can't start it. */
    static void start(final Activity a, final Runnable fallback) {
        final AppUpdateManager m;
        try { m = AppUpdateManagerFactory.create(a); } catch (Throwable t) { a.runOnUiThread(fallback); return; }
        m.getAppUpdateInfo().addOnSuccessListener(new OnSuccessListener<AppUpdateInfo>() {
            public void onSuccess(AppUpdateInfo info) {
                try {
                    if (info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
                        && m.startUpdateFlowForResult(info, a, AppUpdateOptions.defaultOptions(AppUpdateType.IMMEDIATE), REQ)) return;
                } catch (Exception e) { }
                fallback.run();
            }
        }).addOnFailureListener(new OnFailureListener() { public void onFailure(Exception e) { fallback.run(); } });
    }

    private static void reply(Activity a, final WebView web, String st, int code) {
        final String js = "window.onPlayUpdate && onPlayUpdate({st:'" + st + "',code:" + code + "})";
        a.runOnUiThread(new Runnable() { public void run() { try { web.evaluateJavascript(js, null); } catch (Exception e) { } } });
    }
}
