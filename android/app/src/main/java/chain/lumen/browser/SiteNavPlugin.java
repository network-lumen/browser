package chain.lumen.browser;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Telling the app when a site navigates inside its own frame.
 *
 * <p>A lumen:// site is drawn in an iframe on this target, and an iframe on a
 * different origin reports nothing: no navigation event, no readable
 * {@code location}. So clicking a link inside a site left the address bar on
 * the page it started from, and the back button - having no entry for the page
 * the user was actually looking at - took them out of the site entirely.
 *
 * <p>The one place that does see it is {@link IpfsWebViewClient}, which is
 * asked for every request the WebView makes, iframes included. This carries
 * what it sees back to the page.
 */
@CapacitorPlugin(name = "SiteNav")
public class SiteNavPlugin extends Plugin {

    /**
     * The live instance, so the WebViewClient can reach it.
     *
     * <p>It is not a Plugin and has no handle on one; Capacitor builds this
     * object itself and never hands it out. One WebView, one instance.
     */
    private static SiteNavPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) instance = null;
    }

    /** Called from the WebViewClient, off the UI thread. */
    static void report(String url) {
        SiteNavPlugin plugin = instance;
        if (plugin == null || url == null || url.isEmpty()) return;

        JSObject payload = new JSObject();
        payload.put("url", url);
        plugin.notifyListeners("navigated", payload);
    }
}
