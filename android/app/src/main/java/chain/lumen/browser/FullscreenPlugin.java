package chain.lumen.browser;

import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.view.Window;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * What "fullscreen" has to mean on a phone: sideways, and nothing else on
 * screen.
 *
 * <p>TWO THINGS, because neither is enough on its own. A 16:9 video on an
 * upright phone gets about a fifth of the screen, so it rotates; and the
 * status bar and navigation buttons stay drawn over a fullscreen WebView
 * unless something hides them, which is why the first version still had a
 * clock and three buttons on top of the video.
 *
 * <p>BOTH BELONG TO THE ACTIVITY, which is the whole reason this plugin
 * exists. The web routes do not work here:
 * {@code screen.orientation.lock('landscape')} is answered by an Android
 * WebView with {@code NotSupportedError: not available on this device}, and a
 * page has no say over the system bars at all. Measured on the device, not
 * assumed.
 *
 * <p>{@code WebChromeClient.onShowCustomView} / {@code onHideCustomView} looks
 * like the natural hook and is not: Capacitor's own {@code onShowCustomView}
 * calls {@code onHideCustomView} while setting up, so the release fired 33ms
 * after the lock and the video played upright anyway. The page's own
 * {@code fullscreenchange} fires once per transition, in both directions, and
 * is what drives these two methods.
 *
 * <p>{@code SENSOR_LANDSCAPE} rather than {@code LANDSCAPE}: the sensor picks
 * which way round, so a phone turned the other way does not show the video
 * upside down.
 */
@CapacitorPlugin(name = "Fullscreen")
public class FullscreenPlugin extends Plugin {

    /**
     * Whether a video is filling the screen right now.
     *
     * Static because the one thing that needs to ask is the Activity, on its
     * way to deciding what the back button means, and it has no handle on the
     * plugin instance. One Activity, one WebView, one flag.
     */
    private static volatile boolean active = false;

    public static boolean isActive() {
        return active;
    }

    @PluginMethod
    public void enter(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("no_activity");
            return;
        }

        active = true;
        activity.runOnUiThread(() -> {
            setOrientation(activity, ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
            setSystemBarsHidden(activity, true);
            MainActivity.setFullscreenBackEnabled(true);
        });
        call.resolve();
    }

    @PluginMethod
    public void exit(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("no_activity");
            return;
        }

        active = false;
        activity.runOnUiThread(() -> {
            // Back to whatever the user's own rotation setting says, rather
            // than to portrait: someone holding the phone sideways to read
            // should not be snapped upright for having closed a video.
            setOrientation(activity, ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
            setSystemBarsHidden(activity, false);
            MainActivity.setFullscreenBackEnabled(false);
        });
        call.resolve();
    }

    private void setOrientation(Activity activity, int orientation) {
        try {
            activity.setRequestedOrientation(orientation);
        } catch (IllegalStateException e) {
            // A locked-task or otherwise restricted Activity refuses this. The
            // video still plays, just in whatever orientation it was in.
        }
    }

    /**
     * Hidden with {@code BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE}, so a swipe
     * from the edge brings them back for a moment without leaving the video -
     * the behaviour every full-screen player has, and the one that keeps the
     * back gesture reachable.
     */
    private void setSystemBarsHidden(Activity activity, boolean hidden) {
        Window window = activity.getWindow();
        if (window == null) return;

        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(window, window.getDecorView());

        if (hidden) {
            controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            );
            controller.hide(WindowInsetsCompat.Type.systemBars());
        } else {
            controller.show(WindowInsetsCompat.Type.systemBars());
        }
    }
}
