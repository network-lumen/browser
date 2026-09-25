package chain.lumen.browser;

import android.os.Bundle;
import android.view.KeyEvent;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /**
     * Back leaves fullscreen first.
     *
     * <p>While a video fills the screen, the custom view Chromium puts up
     * swallows the key: Capacitor never notifies its {@code backButton}
     * listeners, so the page's own handler - the one that closes a panel or
     * steps back through the tab's history - is never reached. Measured:
     * pressing back in fullscreen did nothing at all, and the phone stayed
     * sideways with the system bars hidden.
     *
     * <p>Through the dispatcher rather than {@code onBackPressed()}, which was
     * the second thing tried and is never called here: this app targets SDK 36,
     * and predictive back has replaced that callback since API 35.
     *
     * <p>Enabled only while a video is actually fullscreen, so every other
     * back press travels its usual route. The plugin toggles it.
     */
    private static OnBackPressedCallback fullscreenBack;

    /** Called from {@link FullscreenPlugin}, on the UI thread. */
    static void setFullscreenBackEnabled(boolean enabled) {
        if (fullscreenBack != null) fullscreenBack.setEnabled(enabled);
    }
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Registered before super.onCreate, which is when the bridge is built
        // and the plugin list is read.
        registerPlugin(KuboPlugin.class);
        registerPlugin(FullscreenPlugin.class);
        registerPlugin(SiteNavPlugin.class);
        registerPlugin(UpdaterPlugin.class);
        super.onCreate(savedInstanceState);

        // After super.onCreate, because the bridge does not exist until then.
        // This is what makes <cid>.ipfs.localhost resolvable without a resolver
        // - see IpfsWebViewClient for why that matters for a site's CSS.
        getBridge().setWebViewClient(new IpfsWebViewClient(getBridge()));

        // Asking the page to leave fullscreen, rather than tearing the custom
        // view down here, is what keeps the rest in step: the
        // `fullscreenchange` that follows restores the orientation and the
        // system bars through the same path every other exit uses.
        fullscreenBack = new OnBackPressedCallback(false) {
            @Override
            public void handleOnBackPressed() {
                if (getBridge() == null || getBridge().getWebView() == null) return;
                getBridge()
                    .getWebView()
                    .evaluateJavascript("document.exitFullscreen && document.exitFullscreen()", null);
            }
        };
        getOnBackPressedDispatcher().addCallback(this, fullscreenBack);
    }

    /**
     * The same exit, one level higher up.
     *
     * <p>The dispatcher above covers the back GESTURE. It does not cover the
     * back KEY: the fullscreen view Chromium puts up takes focus and swallows
     * it before any dispatcher is consulted - measured, twice, with
     * {@code onBackPressed()} and then with the AndroidX callback, and the
     * phone stayed sideways both times. {@code dispatchKeyEvent} sees the
     * event before the view hierarchy does, which is the level this has to be
     * handled at.
     *
     * <p>On ACTION_UP so that holding the key does not fire it repeatedly.
     */
    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (
            FullscreenPlugin.isActive() &&
            event.getKeyCode() == KeyEvent.KEYCODE_BACK &&
            event.getAction() == KeyEvent.ACTION_UP &&
            getBridge() != null &&
            getBridge().getWebView() != null
        ) {
            getBridge()
                .getWebView()
                .evaluateJavascript("document.exitFullscreen && document.exitFullscreen()", null);
            return true;
        }
        return super.dispatchKeyEvent(event);
    }
}
