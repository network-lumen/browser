package chain.lumen.browser;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageInstaller;
import android.os.Build;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Updating the app itself, without a store.
 *
 * <p>The desktop replaces its own binary; Android will not let an app do that
 * silently in the general case - every install goes through the system
 * installer. What it does allow, since API 31, is an update with NO dialOG at
 * all under two conditions: the app is the installer of record for the version
 * in place, and the new APK is signed with the same key. So the first update
 * shows one system screen, and every one after it is silent.
 *
 * <p>THE SIGNING KEY IS THE PART THAT CANNOT BE FIXED LATER. An APK signed with
 * a different key is refused by the OS, and the debug key this project builds
 * with today is generated per machine. Until a release keystore exists and is
 * kept, an update will be refused and the user would have to uninstall first -
 * which loses their profiles. The plumbing below is correct either way; the key
 * is what makes it usable.
 *
 * <p>The download is verified against the sha256 the chain published for the
 * artifact before anything is installed. HTTPS and the OS signature check are
 * the real boundaries; this catches a truncated or swapped file early, with a
 * message that says so.
 */
@CapacitorPlugin(name = "Updater")
public class UpdaterPlugin extends Plugin {

    private static final String TAG = "LumenUpdater";
    private static final String INSTALL_ACTION = "chain.lumen.browser.INSTALL_RESULT";

    /** One at a time: two concurrent installs of the same package is nonsense. */
    private final ExecutorService worker = Executors.newSingleThreadExecutor();

    private BroadcastReceiver installReceiver;

    @Override
    public void load() {
        installReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                handleInstallStatus(intent);
            }
        };
        ContextCompat.registerReceiver(
            getContext(),
            installReceiver,
            new IntentFilter(INSTALL_ACTION),
            ContextCompat.RECEIVER_NOT_EXPORTED
        );
    }

    @Override
    protected void handleOnDestroy() {
        try {
            if (installReceiver != null) getContext().unregisterReceiver(installReceiver);
        } catch (IllegalArgumentException e) {
            // Never registered, or already gone.
        }
        worker.shutdownNow();
    }

    /** The device's own architecture, in the names the release list uses. */
    @PluginMethod
    public void abi(PluginCall call) {
        String[] abis = Build.SUPPORTED_ABIS;
        String primary = abis != null && abis.length > 0 ? abis[0] : "";

        String arch;
        switch (primary) {
            case "arm64-v8a":
                arch = "arm64";
                break;
            case "armeabi-v7a":
            case "armeabi":
                arch = "arm";
                break;
            case "x86_64":
                arch = "amd64";
                break;
            case "x86":
                arch = "386";
                break;
            default:
                arch = primary;
        }

        JSObject out = new JSObject();
        out.put("abi", primary);
        out.put("arch", arch);
        out.put("platform", "android-" + arch);
        call.resolve(out);
    }

    /**
     * Fetches the APK, checks it, and hands it to the installer.
     *
     * <p>Off the main thread, because it is tens of megabytes and a hash over
     * all of them. Progress is reported as it goes, so the UI can say something
     * truer than a spinner.
     */
    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url", "");
        String expectedSha = call.getString("sha256Hex", "");

        if (url == null || url.isEmpty()) {
            call.reject("missing_url");
            return;
        }

        call.setKeepAlive(true);
        worker.execute(() -> {
            File apk = new File(getContext().getCacheDir(), "lumen-update.apk");
            try {
                long written = download(url, apk, expectedSha);
                emit("verified", written, written, null);
                install(apk);
                JSObject out = new JSObject();
                out.put("ok", true);
                out.put("bytes", written);
                call.resolve(out);
            } catch (Exception e) {
                // The file is useless if anything went wrong, and it is large.
                if (apk.exists() && !apk.delete()) Log.w(TAG, "could not remove " + apk);
                Log.w(TAG, "update failed", e);
                emit("failed", 0, 0, String.valueOf(e.getMessage()));
                call.reject(String.valueOf(e.getMessage()));
            }
        });
    }

    /** Streams to disk while hashing, so the file is read once. */
    private long download(String url, File target, String expectedSha) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setConnectTimeout(20_000);
        connection.setReadTimeout(120_000);
        connection.setInstanceFollowRedirects(true);

        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) throw new IOException("http_" + status);

        long total = connection.getContentLengthLong();
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        long written = 0;
        long lastReported = 0;

        try (
            InputStream in = connection.getInputStream();
            OutputStream out = new FileOutputStream(target)
        ) {
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
                digest.update(buffer, 0, read);
                written += read;

                // Every half megabyte rather than every chunk: the bridge is
                // not free and nobody reads a bar that moves 900 times.
                if (written - lastReported >= 512 * 1024) {
                    lastReported = written;
                    emit("downloading", written, total, null);
                }
            }
        }

        if (total > 0 && written != total) throw new IOException("truncated_download");

        if (expectedSha != null && !expectedSha.isEmpty()) {
            String actual = hex(digest.digest());
            if (!actual.equalsIgnoreCase(expectedSha)) throw new IOException("sha256_mismatch");
        }

        return written;
    }

    private String hex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    /**
     * Opens a session, writes the APK into it and commits.
     *
     * <p>{@code USER_ACTION_NOT_REQUIRED} is what makes a later update silent;
     * the system ignores the request when this app did not install the version
     * being replaced, and answers with {@code STATUS_PENDING_USER_ACTION}
     * instead - which is the screen the receiver below opens.
     */
    private void install(File apk) throws IOException {
        PackageInstaller installer = getContext().getPackageManager().getPackageInstaller();

        PackageInstaller.SessionParams params =
            new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        params.setAppPackageName(getContext().getPackageName());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
        }

        int sessionId = installer.createSession(params);
        try (PackageInstaller.Session session = installer.openSession(sessionId)) {
            try (
                InputStream in = new FileInputStream(apk);
                OutputStream out = session.openWrite("lumen.apk", 0, apk.length())
            ) {
                byte[] buffer = new byte[64 * 1024];
                int read;
                while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
                session.fsync(out);
            }

            Intent intent = new Intent(INSTALL_ACTION).setPackage(getContext().getPackageName());
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_MUTABLE;

            PendingIntent pending =
                PendingIntent.getBroadcast(getContext(), sessionId, intent, flags);
            emit("installing", apk.length(), apk.length(), null);
            session.commit(pending.getIntentSender());
        }
    }

    /**
     * What the installer decided.
     *
     * <p>{@code STATUS_PENDING_USER_ACTION} is not a failure: it is the system
     * asking for the one tap it needs the first time, and the Intent it hands
     * over is the screen that asks.
     */
    private void handleInstallStatus(Intent intent) {
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, Integer.MIN_VALUE);
        String message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);

        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT);
            if (confirm != null) {
                confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                try {
                    getContext().startActivity(confirm);
                    emit("awaiting_confirmation", 0, 0, null);
                    return;
                } catch (Exception e) {
                    emit("failed", 0, 0, "could_not_open_installer");
                    return;
                }
            }
            emit("failed", 0, 0, "no_confirmation_intent");
            return;
        }

        if (status == PackageInstaller.STATUS_SUCCESS) {
            // Rarely seen: the process is usually replaced before this arrives.
            emit("installed", 0, 0, null);
            return;
        }

        emit("failed", 0, 0, message == null ? "install_failed_" + status : message);
    }

    private void emit(String phase, long received, long total, String error) {
        JSObject payload = new JSObject();
        payload.put("phase", phase);
        payload.put("received", received);
        payload.put("total", total);
        if (error != null) payload.put("error", error);
        notifyListeners("progress", payload);
    }
}
