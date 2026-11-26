package com.quran.karim;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.webkit.WebView;
import org.json.JSONObject;

/**
 * #34 Phase 2: the official Quran radio. A foreground media service around one MediaPlayer (it plays mp3 and HLS m3u8 alike).
 * State is static so the bridge and the page can read it; every change is pushed to the page as window.onRadio({st, id, reason}),
 * st = loading | playing | paused | stopped | error (reason: offline | down).
 */
public class RadioService extends Service {
    static final String A_PLAY = "com.quran.karim.RADIO_PLAY", A_PAUSE = "com.quran.karim.RADIO_PAUSE",
        A_RESUME = "com.quran.karim.RADIO_RESUME", A_STOP = "com.quran.karim.RADIO_STOP";
    private static final String CH = "radio";
    private static final int NID = 7;
    private static final long PREPARE_MS = 15000;

    // what the page sees
    static volatile String st = "stopped", id = "", reason = "";
    static WebView web;
    private static RadioService inst;
    private static final Handler H = new Handler(Looper.getMainLooper());

    private MediaPlayer mp;
    private MediaSession ms;
    private AudioManager am;
    private AudioFocusRequest focusReq;
    private PowerManager.WakeLock wake;
    private WifiManager.WifiLock wifi;
    private String url = "", title = "", owner = "";
    private boolean prepared, userPaused, focusPaused, autoPaused;
    private Runnable timeout, autoResume;

    // ---- static API (bridge, alarms, microphone) ----

    /** Starts or restarts a station. */
    static void play(Context c, String sid, String sUrl, String sTitle, String sOwner) {
        send(c, new Intent(A_PLAY).putExtra("id", sid).putExtra("url", sUrl).putExtra("title", sTitle).putExtra("owner", sOwner));
    }
    static void resume(Context c) { if (inst != null) send(c, new Intent(A_RESUME)); }
    static void userPause(Context c) { if (inst != null) send(c, new Intent(A_PAUSE)); }
    static void stop(Context c) { if (inst != null) send(c, new Intent(A_STOP)); else setState("stopped", "", ""); }

    private static void send(Context c, Intent i) {
        i.setClass(c, RadioService.class);
        if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
    }

    /** The microphone is about to listen: the radio steps aside (the reader presses play again afterwards). */
    static void pause(Context c) {
        try { H.post(new Runnable() { public void run() { if (inst != null && ("playing".equals(st) || "loading".equals(st))) inst.pauseAuto(0); } }); } catch (RuntimeException ignored) { }
    }

    /** The adhan is sounding: pause now, resume after ms unless the reader paused or stopped meanwhile. */
    static void pauseFor(Context c, final long ms) {
        try { H.post(new Runnable() { public void run() { if (inst != null && "playing".equals(st)) inst.pauseAuto(ms); } }); } catch (RuntimeException ignored) { }
    }

    static String stateJson() {
        try { return new JSONObject().put("st", st).put("id", id).put("reason", reason).toString(); } catch (Exception e) { return "{\"st\":\"stopped\"}"; }
    }

    private static void setState(String s, String i, String r) {
        st = s; id = i; reason = r;
        final WebView w = web;
        if (w == null) return;
        w.post(new Runnable() { public void run() {
            try { w.evaluateJavascript("window.onRadio && onRadio(" + stateJson() + ")", null); } catch (RuntimeException ignored) { }
        } });
    }

    // ---- service ----

    @Override public IBinder onBind(Intent i) { return null; }

    @Override public void onCreate() {
        super.onCreate();
        inst = this;
        am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        try {
            ms = new MediaSession(this, "radio");
            ms.setCallback(new MediaSession.Callback() {
                @Override public void onPlay() { doResume(); }
                @Override public void onPause() { doPause(); }
                @Override public void onStop() { doStop(); }
            });
            ms.setActive(true);
        } catch (RuntimeException e) { ms = null; }
    }

    @Override public int onStartCommand(Intent in, int flags, int startId) {
        String a = in == null ? "" : in.getAction();
        if (A_PLAY.equals(a)) {
            id = in.getStringExtra("id"); url = in.getStringExtra("url"); title = in.getStringExtra("title"); owner = in.getStringExtra("owner");
            if (id == null) id = "";
            if (url == null) url = "";
            if (title == null) title = "";
            if (owner == null) owner = "";
            startFg("loading");
            startPlay();
        } else if (A_RESUME.equals(a)) {
            startFg(st);
            doResume();
        } else if (A_PAUSE.equals(a)) { startFg(st); doPause(); }
        else if (A_STOP.equals(a)) { startFg(st); doStop(); }
        else { stopSelf(); }
        return START_NOT_STICKY;
    }

    @Override public void onDestroy() {
        cancelTimers(); release(); abandonFocus();
        if (ms != null) { try { ms.release(); } catch (RuntimeException ignored) { } ms = null; }
        if (inst == this) inst = null;
        super.onDestroy();
    }

    private void startFg(String s) {
        Notification n = buildNotif(s);
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(NID, n, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            else startForeground(NID, n);
        } catch (RuntimeException e) { /* not allowed to go foreground right now: play anyway */ }
    }

    @SuppressWarnings("deprecation")
    private boolean online() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            NetworkInfo ni = cm == null ? null : cm.getActiveNetworkInfo();
            return ni != null && ni.isConnected();
        } catch (RuntimeException e) { return true; }
    }

    private void startPlay() {
        cancelTimers(); release();
        userPaused = false; focusPaused = false; autoPaused = false; prepared = false;
        if (!online()) { fail("offline"); return; }
        if (!requestFocus()) { fail("down"); return; }
        setState("loading", id, "");
        try {
            mp = new MediaPlayer();
            mp.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());
            mp.setWakeMode(this, PowerManager.PARTIAL_WAKE_LOCK);
            mp.setOnPreparedListener(new MediaPlayer.OnPreparedListener() { public void onPrepared(MediaPlayer m) {
                if (m != mp) return;
                prepared = true; cancelTimers();
                if (userPaused || focusPaused || autoPaused) { setState("paused", id, ""); update("paused"); return; }
                m.start(); locks(true); setState("playing", id, ""); update("playing");
            } });
            mp.setOnErrorListener(new MediaPlayer.OnErrorListener() { public boolean onError(MediaPlayer m, int w, int x) {
                if (m == mp) fail(online() ? "down" : "offline");
                return true;
            } });
            mp.setOnCompletionListener(new MediaPlayer.OnCompletionListener() { public void onCompletion(MediaPlayer m) {
                if (m == mp) fail(online() ? "down" : "offline");   // a live stream never ends: it dropped
            } });
            mp.setDataSource(url);
            mp.prepareAsync();
            timeout = new Runnable() { public void run() { if (!prepared) fail(online() ? "down" : "offline"); } };
            H.postDelayed(timeout, PREPARE_MS);
            update("loading");
        } catch (Exception e) { fail("down"); }
    }

    private void doPause() {
        userPaused = true; autoPaused = false; cancelAuto();
        pauseNow();
    }

    /** Paused by the app itself (adhan, microphone); ms above 0: comes back by itself unless the reader acts in between. */
    private void pauseAuto(long ms) {
        autoPaused = true; cancelAuto();
        pauseNow();
        if (ms > 0) {
            autoResume = new Runnable() { public void run() {
                autoResume = null;
                if (autoPaused && !userPaused && "paused".equals(st)) { autoPaused = false; resumeNow(); }
            } };
            H.postDelayed(autoResume, ms);
        }
    }

    private void pauseNow() {
        if (mp == null) return;
        if (prepared) { try { if (mp.isPlaying()) mp.pause(); } catch (RuntimeException ignored) { } locks(false); }
        setState("paused", id, ""); update("paused");   // still connecting: onPrepared keeps it paused
    }

    private void doResume() {
        userPaused = false; autoPaused = false; focusPaused = false; cancelAuto();
        if (mp == null) { if (url.length() > 0) startPlay(); return; }
        resumeNow();
    }

    private void resumeNow() {
        if (mp == null) return;
        if (!prepared) { setState("loading", id, ""); update("loading"); return; }
        if (!requestFocus()) { fail("down"); return; }
        try { mp.setVolume(1f, 1f); mp.start(); locks(true); setState("playing", id, ""); update("playing"); }
        catch (RuntimeException e) { startPlay(); }
    }

    private void doStop() {
        cancelTimers(); release(); abandonFocus();
        setState("stopped", "", "");
        stopForeground(true);
        stopSelf();
    }

    private void fail(String why) {
        cancelTimers(); release(); abandonFocus();
        setState("error", id, why);
        stopForeground(true);
        stopSelf();
    }

    private void release() {
        locks(false);
        if (mp != null) { try { mp.reset(); mp.release(); } catch (RuntimeException ignored) { } mp = null; }
        prepared = false;
    }

    private void cancelAuto() { if (autoResume != null) { H.removeCallbacks(autoResume); autoResume = null; } }
    private void cancelTimers() { if (timeout != null) { H.removeCallbacks(timeout); timeout = null; } cancelAuto(); }

    // ---- locks and focus ----

    @SuppressWarnings("deprecation")
    private void locks(boolean on) {
        try {
            if (on) {
                if (wake == null) { PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE); wake = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "quran:radio"); wake.setReferenceCounted(false); }
                if (!wake.isHeld()) wake.acquire();
                if (wifi == null) {
                    WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                    if (wm != null) { wifi = wm.createWifiLock(Build.VERSION.SDK_INT >= 29 ? WifiManager.WIFI_MODE_FULL_HIGH_PERF : WifiManager.WIFI_MODE_FULL, "quran:radio"); wifi.setReferenceCounted(false); }
                }
                if (wifi != null && !wifi.isHeld()) wifi.acquire();
            } else {
                if (wake != null && wake.isHeld()) wake.release();
                if (wifi != null && wifi.isHeld()) wifi.release();
            }
        } catch (RuntimeException ignored) { }
    }

    private final AudioManager.OnAudioFocusChangeListener focus = new AudioManager.OnAudioFocusChangeListener() {
        public void onAudioFocusChange(int change) {
            if (change == AudioManager.AUDIOFOCUS_LOSS) { doStop(); }
            else if (change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
                if ("playing".equals(st) || "loading".equals(st)) { focusPaused = true; pauseNow(); }
            } else if (change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK) {
                try { if (mp != null) mp.setVolume(0.2f, 0.2f); } catch (RuntimeException ignored) { }
            } else if (change == AudioManager.AUDIOFOCUS_GAIN) {
                try { if (mp != null) mp.setVolume(1f, 1f); } catch (RuntimeException ignored) { }
                if (focusPaused && !userPaused && !autoPaused) { focusPaused = false; resumeNow(); }
            }
        }
    };

    @SuppressWarnings("deprecation")
    private boolean requestFocus() {
        if (am == null) return true;
        int r;
        if (Build.VERSION.SDK_INT >= 26) {
            if (focusReq == null) focusReq = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
                .setOnAudioFocusChangeListener(focus, H).build();
            r = am.requestAudioFocus(focusReq);
        } else r = am.requestAudioFocus(focus, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN);
        return r == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
    }

    @SuppressWarnings("deprecation")
    private void abandonFocus() {
        if (am == null) return;
        try {
            if (Build.VERSION.SDK_INT >= 26) { if (focusReq != null) am.abandonAudioFocusRequest(focusReq); }
            else am.abandonAudioFocus(focus);
        } catch (RuntimeException ignored) { }
    }

    // ---- notification ----

    private void update(String s) {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.notify(NID, buildNotif(s));
            if (ms != null) ms.setPlaybackState(new PlaybackState.Builder()
                .setActions(PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_STOP)
                .setState("playing".equals(s) ? PlaybackState.STATE_PLAYING : "loading".equals(s) ? PlaybackState.STATE_BUFFERING : PlaybackState.STATE_PAUSED, 0, 1f).build());
        } catch (RuntimeException ignored) { }
    }

    private PendingIntent act(String a, int code) {
        return PendingIntent.getService(this, code, new Intent(a).setClass(this, RadioService.class),
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
    }

    @SuppressWarnings("deprecation")
    private Notification buildNotif(String s) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm != null) {
            NotificationChannel nc = new NotificationChannel(CH, "الإذاعة", NotificationManager.IMPORTANCE_LOW);
            nc.setSound(null, null);
            nm.createNotificationChannel(nc);
        }
        boolean playing = "playing".equals(s);
        PendingIntent open = PendingIntent.getActivity(this, 7, new Intent(this, MainActivity.class).putExtra("hash", "#/radio")
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        Notification.MediaStyle style = new Notification.MediaStyle().setShowActionsInCompactView(0, 1);
        if (ms != null) style.setMediaSession(ms.getSessionToken());
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CH) : new Notification.Builder(this);
        b.setSmallIcon(R.drawable.ic_notif).setContentTitle(title.length() > 0 ? title : "إذاعة القرآن الكريم")
            .setContentText("loading".equals(s) ? "جارٍ الاتصال…" : owner).setContentIntent(open).setOngoing(playing || "loading".equals(s))
            .setColor(0xff1e3a5f).setStyle(style)
            .addAction(playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play, playing ? "إيقاف مؤقت" : "تشغيل", act(playing ? A_PAUSE : A_RESUME, 1))
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "إيقاف", act(A_STOP, 2));
        return b.build();
    }
}
