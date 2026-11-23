package com.quran.karim;

import android.content.Context;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.media.AudioRecord;
import android.os.Build;

/**
 * 5.34 #39: which microphone NvAsr records from (the phone's own, a USB or wired headset, a Bluetooth headset).
 * Lives apart from NvAsr because AudioDeviceInfo needs API 23 (minSdk is 21): NvAsr only touches this class on 23+.
 * One instance per recording session: open() before startRecording(), close() when the session ends or fails.
 */
class MicRoute {
    /** open() answers: the phone decides / the chosen mic is used / the chosen mic is gone (the phone decides). */
    static final int AUTO = 0, CHOSEN = 1, MISSING = 2;

    private final AudioManager am;
    private boolean btOpen;   // a Bluetooth route that close() must give back
    /** How the Bluetooth route went, for the page's "[mic]" console line (read over CDP on a phone). */
    String note = "";

    MicRoute(Context c) { am = (AudioManager) c.getSystemService(Context.AUDIO_SERVICE); }

    /** Our short name for an input type, or null when the mic page does not offer that kind. */
    private static String kind(int type) {
        switch (type) {
            case AudioDeviceInfo.TYPE_BUILTIN_MIC: return "builtin";
            case AudioDeviceInfo.TYPE_WIRED_HEADSET: return "wired";
            case AudioDeviceInfo.TYPE_USB_DEVICE:
            case AudioDeviceInfo.TYPE_USB_HEADSET: return "usb";
            case AudioDeviceInfo.TYPE_BLUETOOTH_SCO: return "bt";
            default: return null;
        }
    }

    /** JSON [{id, type: builtin|wired|usb|bt, name}] of the inputs the reader can pick. The page words the labels. */
    static String list(Context c) {
        org.json.JSONArray out = new org.json.JSONArray();
        AudioManager am = (AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
        if (am == null) return out.toString();
        try {
            for (AudioDeviceInfo d : am.getDevices(AudioManager.GET_DEVICES_INPUTS)) {
                String k = kind(d.getType());
                if (k == null) continue;
                org.json.JSONObject o = new org.json.JSONObject();
                o.put("id", d.getId()); o.put("type", k);
                o.put("name", d.getProductName() == null ? "" : d.getProductName().toString());
                out.put(o);
            }
        } catch (Exception e) { /* an empty list = automatic only */ }
        return out.toString();
    }

    private AudioDeviceInfo find(int id) {
        for (AudioDeviceInfo d : am.getDevices(AudioManager.GET_DEVICES_INPUTS)) if (d.getId() == id && kind(d.getType()) != null) return d;
        return null;
    }

    /** Points the recorder at the chosen mic (id 0 = leave it to the phone). */
    int open(AudioRecord ar, int id) {
        if (id == 0 || am == null) return AUTO;
        AudioDeviceInfo d = find(id);
        if (d == null) return MISSING;
        if (d.getType() == AudioDeviceInfo.TYPE_BLUETOOTH_SCO) routeBluetooth(d);
        return ar.setPreferredDevice(d) ? CHOSEN : MISSING;
    }

    /** A Bluetooth headset's mic only works while the SCO link to it is up: 31+ asks for it as the communication device,
     *  older Androids start the SCO link (it takes a moment to come up; the recorder gets silence until then). */
    private void routeBluetooth(AudioDeviceInfo input) {
        if (Build.VERSION.SDK_INT >= 31) {
            // setCommunicationDevice wants an entry of getAvailableCommunicationDevices(): the output side of the same headset.
            // Same address first; some stacks report no address, then the only SCO device there is.
            AudioDeviceInfo pick = null;
            for (AudioDeviceInfo d : am.getAvailableCommunicationDevices()) {
                if (d.getType() != AudioDeviceInfo.TYPE_BLUETOOTH_SCO) continue;
                if (pick == null) pick = d;
                if (d.getAddress() != null && d.getAddress().equals(input.getAddress())) { pick = d; break; }
            }
            if (pick == null) { note = "no SCO communication device"; return; }
            btOpen = am.setCommunicationDevice(pick);
            note = "setCommunicationDevice(" + pick.getProductName() + ")=" + btOpen;
        } else {
            am.startBluetoothSco(); am.setBluetoothScoOn(true); btOpen = true; note = "startBluetoothSco";
        }
    }

    /** "type:name" of the input the recorder really got (after startRecording), "" when unknown: for the page's debug line. */
    static String routed(AudioRecord ar) {
        AudioDeviceInfo d = ar.getRoutedDevice();
        if (d == null) return "";
        String k = kind(d.getType());
        return (k == null ? "type" + d.getType() : k) + ":" + (d.getProductName() == null ? "" : d.getProductName());
    }

    /** Gives back any Bluetooth route we opened. Safe to call twice. */
    void close() {
        if (!btOpen || am == null) return;
        btOpen = false;
        try {
            if (Build.VERSION.SDK_INT >= 31) am.clearCommunicationDevice();
            else { am.setBluetoothScoOn(false); am.stopBluetoothSco(); }
        } catch (Exception e) { /* nothing left to give back */ }
    }
}
