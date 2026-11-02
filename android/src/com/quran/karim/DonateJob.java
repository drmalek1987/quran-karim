package com.quran.karim;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.os.Build;

/**
 * Sends the waiting donated clips (Donations.upload) when the system allows: on Wi-Fi or another unmetered network,
 * or any network when the reader allowed mobile data, and not on a low battery. Retried with backoff until the queue
 * is empty. JobScheduler, since the app has no Gradle for WorkManager.
 */
public class DonateJob extends JobService {
    private static final int ID = 7301;

    static void schedule(Context c, boolean mobile) {
        Donations.prefs(c).edit().putBoolean("mobile", mobile).apply();
        JobInfo.Builder b = new JobInfo.Builder(ID, new ComponentName(c, DonateJob.class))
            .setRequiredNetworkType(mobile ? JobInfo.NETWORK_TYPE_ANY : JobInfo.NETWORK_TYPE_UNMETERED)
            .setBackoffCriteria(5 * 60 * 1000, JobInfo.BACKOFF_POLICY_EXPONENTIAL)
            .setPersisted(false);
        if (Build.VERSION.SDK_INT >= 26) b.setRequiresBatteryNotLow(true);
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js != null) js.schedule(b.build());
    }

    @Override
    public boolean onStartJob(final JobParameters p) {
        new Thread(new Runnable() { public void run() {
            boolean done = false;
            try { done = Donations.upload(getApplicationContext()); } catch (Throwable e) { }
            jobFinished(p, !done);
        } }).start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters p) { return true; }
}
