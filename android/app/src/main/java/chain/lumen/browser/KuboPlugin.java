package chain.lumen.browser;

import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import com.getcapacitor.JSArray;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Runs a real kubo node inside the app.
 *
 * The daemon is the same Go binary the desktop uses, cross-compiled for arm64
 * and shipped as {@code libkubo.so}. The {@code .so} name is not decoration:
 * since API 29 an app may only exec a file from its nativeLibraryDir, and the
 * packager only puts a file there when it looks like a native library. That,
 * plus {@code useLegacyPackaging}, is what makes the binary runnable at all.
 *
 * <p>Everything above this plugin is unchanged. {@code platform/mobile/impl/
 * ipfs.ts} already speaks the Kubo RPC API to whatever {@code ipfsApiBase}
 * says, so a node answering on 127.0.0.1:5001 is simply a node it can reach -
 * which is why the loopback address had to stop being refused before this
 * could work.
 *
 * <p><b>Lifetime.</b> The daemon is a child of the app process and dies with
 * it. Android reclaims background apps freely, so a node is running while
 * Lumen is in use rather than around the clock. Making it survive means a
 * foreground service with a permanent notification, which is a product
 * decision - a browser that seeds all night is not obviously what someone
 * wants from a phone - and not a technical gap here.
 */
@CapacitorPlugin(name = "Kubo")
public class KuboPlugin extends Plugin {

    private static final String TAG = "LumenKubo";
    private static final String API_ADDRESS = "/ip4/127.0.0.1/tcp/5001";
    // 8088, not 8080: `localGatewayBase` defaults to http://127.0.0.1:8088 and
    // that is where the desktop puts its gateway too. A node listening
    // anywhere else is a node every lumen:// address fails to reach.
    private static final String GATEWAY_ADDRESS = "/ip4/127.0.0.1/tcp/8088";

    /** The origin the WebView serves Lumen from, which the API must accept. */
    private static final String[] ALLOWED_ORIGINS = {
        "https://localhost",
        "http://localhost",
        "capacitor://localhost"
    };

    private Process daemon;
    private Thread logPump;

    /**
     * The daemon's own output, kept so the app can show it.
     *
     * Everything here used to go to logcat and nowhere else, which meant the
     * one account of why the node would not start was reachable only with a
     * cable. "Failed to connect to 127.0.0.1:5001" is the symptom; these lines
     * are the cause, and they belong where the person hitting it can read them.
     */
    private static final int LOG_LIMIT = 200;
    private final ArrayDeque<String> recentOutput = new ArrayDeque<>();

    private void remember(String line) {
        synchronized (recentOutput) {
            recentOutput.addLast(line);
            while (recentOutput.size() > LOG_LIMIT) recentOutput.removeFirst();
        }
    }

    private JSArray recentOutputArray() {
        JSArray out = new JSArray();
        synchronized (recentOutput) {
            for (String line : recentOutput) out.put(line);
        }
        return out;
    }

    private File binary() {
        return new File(getContext().getApplicationInfo().nativeLibraryDir, "libkubo.so");
    }

    private File repoDir() {
        return new File(getContext().getFilesDir(), "ipfs");
    }

    /**
     * Runs one kubo command to completion.
     *
     * @return the exit code, or -1 when the process could not be started.
     */
    private int run(List<String> args, StringBuilder output) {
        List<String> command = new ArrayList<>();
        command.add(binary().getAbsolutePath());
        command.addAll(args);

        try {
            ProcessBuilder builder = new ProcessBuilder(command);
            builder.redirectErrorStream(true);
            Map<String, String> env = builder.environment();
            env.put("IPFS_PATH", repoDir().getAbsolutePath());
            // Without a writable HOME some of kubo's dependencies fall back to
            // paths that do not exist in an app sandbox.
            env.put("HOME", getContext().getFilesDir().getAbsolutePath());
            env.put("IPFS_TELEMETRY", "off");

            Process process = builder.start();
            try (BufferedReader reader =
                     new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (output != null) output.append(line).append('\n');
                }
            }
            // Bounded: a subcommand that decided to ask a question would
            // otherwise block this thread for the life of the app, and the
            // promise the renderer is waiting on with it.
            if (!process.waitFor(90, TimeUnit.SECONDS)) {
                process.destroyForcibly();
                remember("command timed out: " + args);
                return -1;
            }
            return process.exitValue();
        } catch (IOException | InterruptedException e) {
            Log.e(TAG, "command failed: " + command, e);
            if (output != null) output.append(e).append('\n');
            return -1;
        }
    }

    private void configure() {
        // The API refuses a cross-origin request unless the origin is named
        // here, and the WebView's page IS cross-origin to 127.0.0.1. This is
        // the single most likely reason for an otherwise healthy node to look
        // dead from the page, so it is set on every start rather than only at
        // init - a repo restored from a backup will not have it.
        StringBuilder origins = new StringBuilder("[");
        for (int i = 0; i < ALLOWED_ORIGINS.length; i++) {
            if (i > 0) origins.append(',');
            origins.append('"').append(ALLOWED_ORIGINS[i]).append('"');
        }
        origins.append(']');

        run(List.of("config", "--json", "API.HTTPHeaders.Access-Control-Allow-Origin",
            origins.toString()), null);
        run(List.of("config", "--json", "API.HTTPHeaders.Access-Control-Allow-Methods",
            "[\"POST\",\"GET\",\"OPTIONS\"]"), null);
        run(List.of("config", "Addresses.API", API_ADDRESS), null);
        run(List.of("config", "Addresses.Gateway", GATEWAY_ADDRESS), null);

        // The gateway needs its own CORS headers: a lumen:// site is fetched
        // from it by the page, which is a different origin. Same values the
        // desktop sets in electron/ipfs.cjs.
        run(List.of("config", "--json", "Gateway.HTTPHeaders.Access-Control-Allow-Origin",
            "[\"*\"]"), null);
        run(List.of("config", "--json", "Gateway.HTTPHeaders.Access-Control-Allow-Methods",
            "[\"GET\",\"HEAD\",\"OPTIONS\"]"), null);
        run(List.of("config", "--json", "Gateway.HTTPHeaders.Access-Control-Allow-Headers",
            "[\"Range\",\"Origin\",\"Accept\",\"Content-Type\",\"User-Agent\"]"), null);

        // A phone is usually behind a carrier NAT, so these are what let it
        // reach peers at all.
        run(List.of("config", "--json", "Swarm.RelayClient.Enabled", "true"), null);
        run(List.of("config", "--json", "Swarm.EnableHolePunching", "true"), null);

        // A phone is not a server: no relay duty, no DHT server mode, and a
        // connection budget that will not chew through a battery or a data cap.
        run(List.of("config", "--json", "Swarm.RelayService.Enabled", "false"), null);
        run(List.of("config", "--json", "Swarm.ConnMgr.HighWater", "40"), null);
        run(List.of("config", "--json", "Swarm.ConnMgr.LowWater", "20"), null);
        run(List.of("config", "Routing.Type", "auto"), null);
    }

    private boolean repoExists() {
        return new File(repoDir(), "config").exists();
    }

    /** True when the API answers, which is the only definition that matters. */
    private boolean apiAnswers() {
        try {
            URL url = new URL("http://127.0.0.1:5001/api/v0/id");
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(1500);
            connection.setReadTimeout(1500);
            int code = connection.getResponseCode();
            connection.disconnect();
            return code == 200;
        } catch (IOException e) {
            return false;
        }
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (apiAnswers()) {
            JSObject result = new JSObject();
            result.put("ok", true);
            result.put("alreadyRunning", true);
            call.resolve(result);
            return;
        }

        File bin = binary();
        if (!bin.exists()) {
            JSObject failure = new JSObject();
            failure.put("ok", false);
            failure.put("error", "kubo_binary_missing_for_this_abi");
            failure.put("path", bin.getAbsolutePath());
            call.resolve(failure);
            return;
        }
        if (!bin.canExecute()) {
            // Extracted but not runnable - which is what a wrong packaging mode
            // looks like, and worth naming rather than discovering as a failed
            // exec three steps later.
            JSObject failure = new JSObject();
            failure.put("ok", false);
            failure.put("error", "kubo_binary_not_executable");
            failure.put("path", bin.getAbsolutePath());
            call.resolve(failure);
            return;
        }

        new Thread(() -> {
            try {
                if (!repoExists()) {
                    StringBuilder out = new StringBuilder();
                    // lowpower trims the background work a handset should not
                    // be doing: no DHT server, less reprovide traffic.
                    int code = run(List.of("init", "--profile=lowpower"), out);
                    if (code != 0 && !repoExists()) {
                        JSObject failure = new JSObject();
                        failure.put("ok", false);
                        failure.put("error", "ipfs_init_failed");
                        failure.put("output", recentOutputArray());
                        call.resolve(failure);
                        return;
                    }
                }

                configure();

                List<String> command = new ArrayList<>();
                command.add(bin.getAbsolutePath());
                command.add("daemon");
                command.add("--migrate=true");
                command.add("--enable-gc");

                ProcessBuilder builder = new ProcessBuilder(command);
                builder.redirectErrorStream(true);
                builder.environment().put("IPFS_PATH", repoDir().getAbsolutePath());
                builder.environment().put("HOME", getContext().getFilesDir().getAbsolutePath());
                builder.environment().put("IPFS_TELEMETRY", "off");
                daemon = builder.start();

                // Drained rather than ignored: a filled pipe buffer blocks the
                // daemon, so a node nobody is reading the logs of would stall.
                logPump = new Thread(() -> {
                    try (BufferedReader reader = new BufferedReader(
                             new InputStreamReader(daemon.getInputStream()))) {
                        String line;
                        while ((line = reader.readLine()) != null) {
                            Log.i(TAG, line);
                            remember(line);
                        }
                    } catch (IOException ignored) {
                        // The pipe closes when the daemon exits; nothing to do.
                    }
                });
                logPump.setDaemon(true);
                logPump.start();

                // The API listener comes up a moment after the process does.
                for (int attempt = 0; attempt < 120; attempt++) {
                    // A dead process will never answer, so stop waiting for it
                    // rather than burning the full minute on a corpse.
                    if (!daemon.isAlive()) {
                        remember("daemon exited with code " + daemon.exitValue());
                        break;
                    }
                    if (apiAnswers()) {
                        JSObject result = new JSObject();
                        result.put("ok", true);
                        result.put("apiBase", "http://127.0.0.1:5001");
                        call.resolve(result);
                        return;
                    }
                    Thread.sleep(500);
                }
                JSObject failure = new JSObject();
                failure.put("ok", false);
                failure.put("error", "daemon_started_but_api_never_answered");
                failure.put("output", recentOutputArray());
                call.resolve(failure);
            } catch (IOException | InterruptedException e) {
                Log.e(TAG, "daemon failed", e);
                call.reject("daemon_failed: " + e);
            }
        }).start();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (daemon != null) {
            daemon.destroy();
            daemon = null;
        }
        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject result = new JSObject();
        result.put("ok", true);
        result.put("running", apiAnswers());
        result.put("repoInitialised", repoExists());
        result.put("binaryPresent", binary().exists());
        result.put("apiBase", "http://127.0.0.1:5001");
        result.put("output", recentOutputArray());
        call.resolve(result);
    }

    @Override
    protected void handleOnDestroy() {
        if (daemon != null) daemon.destroy();
        super.handleOnDestroy();
    }
}
