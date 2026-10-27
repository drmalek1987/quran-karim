package com.quran.karim;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.hardware.GeomagneticField;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Looper;
import android.view.Surface;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

/**
 * Location and compass heading for the qibla screen, exposed to the web app as window.QiblaBridge.
 * Results go back by calling window.qiblaLocation(lat, lon), window.qiblaLocationError(why)
 * and window.qiblaHeading(degreesFromTrueNorth, lowAccuracy).
 */
class QiblaBridge implements SensorEventListener {
    static final int PERMISSION_REQUEST = 7;

    private final Activity activity;
    private final WebView web;
    private final SensorManager sensors;
    private final LocationManager locations;
    private boolean compassOn, listening, lowAccuracy;
    private float declination, smooth = Float.NaN;
    private long lastSent;
    private final float[] rot = new float[9], rot2 = new float[9], orient = new float[3], grav = new float[3], geo = new float[3];
    private boolean haveGrav, haveGeo;

    QiblaBridge(Activity activity, WebView web) {
        this.activity = activity;
        this.web = web;
        sensors = (SensorManager) activity.getSystemService(Context.SENSOR_SERVICE);
        locations = (LocationManager) activity.getSystemService(Context.LOCATION_SERVICE);
    }

    // ---------- location ----------

    @JavascriptInterface
    public void locate() {
        activity.runOnUiThread(new Runnable() { public void run() { locateNow(); } });
    }

    private boolean hasPermission() {
        if (Build.VERSION.SDK_INT < 23) return true;
        return activity.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            || activity.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private void locateNow() {
        if (!hasPermission()) {
            activity.requestPermissions(new String[] {
                Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }, PERMISSION_REQUEST);
            return;
        }
        if (locations == null) { js("qiblaLocationError('')"); return; }
        Location best = null;
        try {
            for (String p : locations.getProviders(true)) {
                Location l = locations.getLastKnownLocation(p);
                if (l != null && (best == null || l.getTime() > best.getTime())) best = l;
            }
        } catch (SecurityException e) { js("qiblaLocationError('denied')"); return; }
        if (best != null) send(best);
        // Ask for a fresh fix too; the qibla barely changes within a city, so a cached one is shown meanwhile.
        boolean asked = false;
        for (String p : new String[] { LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER }) {
            try {
                if (locations.isProviderEnabled(p)) {
                    locations.requestSingleUpdate(p, new LocationListener() {
                        public void onLocationChanged(Location l) { send(l); }
                        public void onStatusChanged(String s, int i, Bundle b) { }
                        public void onProviderEnabled(String s) { }
                        public void onProviderDisabled(String s) { }
                    }, Looper.getMainLooper());
                    asked = true;
                }
            } catch (Exception ignored) { }
        }
        if (!asked && best == null) js("qiblaLocationError('')");
    }

    void onPermissionResult(int[] results) {
        boolean ok = false;
        for (int r : results) ok |= r == PackageManager.PERMISSION_GRANTED;
        if (ok) locateNow(); else js("qiblaLocationError('denied')");
    }

    private void send(Location l) {
        declination = new GeomagneticField((float) l.getLatitude(), (float) l.getLongitude(),
            (float) l.getAltitude(), System.currentTimeMillis()).getDeclination();
        js("qiblaLocation(" + l.getLatitude() + "," + l.getLongitude() + ")");
    }

    /**
     * A city picked from the list, or a place saved earlier: the compass still needs that place's magnetic declination
     * (magnetic north is about 4-5 degrees off true north in Egypt and the Gulf), not only a fresh GPS fix.
     */
    @JavascriptInterface
    public void setPlace(double lat, double lon) {
        declination = new GeomagneticField((float) lat, (float) lon, 0f, System.currentTimeMillis()).getDeclination();
    }

    // ---------- compass ----------

    @JavascriptInterface
    public void startCompass() {
        activity.runOnUiThread(new Runnable() { public void run() { compassOn = true; resume(); } });
    }

    @JavascriptInterface
    public void stopCompass() {
        activity.runOnUiThread(new Runnable() { public void run() { compassOn = false; pause(); } });
    }

    void resume() {
        if (!compassOn || listening || sensors == null) return;
        Sensor rv = sensors.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
        Sensor mag = sensors.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD);
        if (rv != null) sensors.registerListener(this, rv, SensorManager.SENSOR_DELAY_UI);
        else {
            Sensor acc = sensors.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
            if (acc == null || mag == null) return;
            sensors.registerListener(this, acc, SensorManager.SENSOR_DELAY_UI);
        }
        // The magnetometer is also how we learn whether the compass needs calibrating.
        if (mag != null) sensors.registerListener(this, mag, SensorManager.SENSOR_DELAY_UI);
        listening = true;
    }

    void pause() {
        if (listening && sensors != null) sensors.unregisterListener(this);
        listening = false;
        haveGrav = haveGeo = false;
    }

    @Override
    public void onSensorChanged(SensorEvent e) {
        int type = e.sensor.getType();
        boolean ok = false;
        if (type == Sensor.TYPE_ROTATION_VECTOR) {
            SensorManager.getRotationMatrixFromVector(rot, e.values);
            ok = true;
        } else if (type == Sensor.TYPE_ACCELEROMETER) {
            System.arraycopy(e.values, 0, grav, 0, 3); haveGrav = true;
        } else if (type == Sensor.TYPE_MAGNETIC_FIELD) {
            System.arraycopy(e.values, 0, geo, 0, 3); haveGeo = true;
            lowAccuracy = e.accuracy < SensorManager.SENSOR_STATUS_ACCURACY_MEDIUM;
            if (sensors.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR) == null && haveGrav)
                ok = SensorManager.getRotationMatrix(rot, null, grav, geo);
        }
        if (!ok) return;
        // Turn the readings into the frame of the screen as it is shown (the app also runs sideways), and when the phone
        // is held upright rather than flat use the direction the back camera faces, so the heading does not swing.
        int r = activity.getWindowManager().getDefaultDisplay().getRotation();
        int ax = SensorManager.AXIS_X, ay = SensorManager.AXIS_Y;
        if (r == Surface.ROTATION_90) { ax = SensorManager.AXIS_Y; ay = SensorManager.AXIS_MINUS_X; }
        else if (r == Surface.ROTATION_180) { ax = SensorManager.AXIS_MINUS_X; ay = SensorManager.AXIS_MINUS_Y; }
        else if (r == Surface.ROTATION_270) { ax = SensorManager.AXIS_MINUS_Y; ay = SensorManager.AXIS_X; }
        SensorManager.remapCoordinateSystem(rot, ax, ay, rot2);
        // rot2[8]: how flat the screen faces up (1 = flat on a table, 0 = upright).
        if (Math.abs(rot2[8]) < 0.5f) {
            float[] up = new float[9];
            SensorManager.remapCoordinateSystem(rot2, SensorManager.AXIS_X, SensorManager.AXIS_Z, up);
            System.arraycopy(up, 0, rot2, 0, 9);
        }
        SensorManager.getOrientation(rot2, orient);
        float deg = (float) Math.toDegrees(orient[0]) + declination;
        deg = (deg % 360 + 360) % 360;
        // Low-pass filter on the circle, so the dial does not jitter.
        if (Float.isNaN(smooth)) smooth = deg;
        else {
            float d = ((deg - smooth) % 360 + 540) % 360 - 180;
            smooth = ((smooth + 0.25f * d) % 360 + 360) % 360;
        }
        long now = System.currentTimeMillis();
        if (now - lastSent < 60) return;
        lastSent = now;
        js("qiblaHeading(" + smooth + "," + lowAccuracy + ")");
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        if (sensor.getType() == Sensor.TYPE_MAGNETIC_FIELD) lowAccuracy = accuracy < SensorManager.SENSOR_STATUS_ACCURACY_MEDIUM;
    }

    /** Calls fn(args) in the page, if the qibla screen is still open to receive it. */
    private void js(String call) {
        String fn = "window." + call.substring(0, call.indexOf('('));
        final String code = fn + " && " + fn + call.substring(call.indexOf('('));
        activity.runOnUiThread(new Runnable() { public void run() { web.evaluateJavascript(code, null); } });
    }
}
