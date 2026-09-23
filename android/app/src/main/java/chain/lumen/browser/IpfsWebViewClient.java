package chain.lumen.browser;

import android.util.Log;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Serves {@code <cid>.ipfs.localhost} without anyone having to resolve it.
 *
 * <p>A site fetched from a path gateway loses every absolute asset: the page at
 * {@code 127.0.0.1:8088/ipfs/<cid>/index.html} asks for {@code /assets/app.css},
 * which resolves against the gateway root and 404s. The site renders as bare
 * HTML. The fix the IPFS project settled on is the subdomain gateway - give the
 * site its own origin, {@code <cid>.ipfs.localhost}, and absolute paths land
 * inside the CID where they belong.
 *
 * <p>The catch has always been DNS: nothing guarantees a device resolves
 * wildcard subdomains of localhost, and measurement said it does not.
 *
 * <p>But {@code shouldInterceptRequest} runs BEFORE any lookup. Answer here and
 * the name never has to exist - the WebView asked us, we handed back bytes, and
 * no resolver was ever consulted. So the origin is real to the page, the
 * absolute paths work, and the DNS question simply does not arise.
 *
 * <p>Everything else is delegated to Capacitor untouched, including the app's
 * own assets.
 */
public class IpfsWebViewClient extends BridgeWebViewClient {

    private static final String TAG = "LumenIpfsWeb";

    /** Where the embedded node actually listens. */
    private static final String GATEWAY = "http://127.0.0.1:8088";

    private static final String IPFS_SUFFIX = ".ipfs.localhost";
    private static final String IPNS_SUFFIX = ".ipns.localhost";

    public IpfsWebViewClient(Bridge bridge) {
        super(bridge);
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        String host = request.getUrl().getHost();
        if (host == null) return super.shouldInterceptRequest(view, request);

        String lower = host.toLowerCase();
        String namespace;
        String key;
        if (lower.endsWith(IPFS_SUFFIX)) {
            namespace = "ipfs";
            key = lower.substring(0, lower.length() - IPFS_SUFFIX.length());
        } else if (lower.endsWith(IPNS_SUFFIX)) {
            namespace = "ipns";
            key = lower.substring(0, lower.length() - IPNS_SUFFIX.length());
        } else {
            return super.shouldInterceptRequest(view, request);
        }

        if (key.isEmpty()) return super.shouldInterceptRequest(view, request);

        try {
            return proxy(request, namespace, key);
        } catch (IOException e) {
            Log.w(TAG, "gateway proxy failed for " + host, e);
            // Null lets the WebView try the request itself. It will fail on the
            // name, but failing the way it would have anyway beats inventing an
            // error page the site cannot distinguish from its own.
            return null;
        }
    }

    /**
     * Fetches the same resource from the path gateway and hands it back as if
     * it had come from the subdomain host.
     *
     * <p>The path form is used deliberately rather than sending a {@code Host}
     * header: it needs no cooperation from the gateway's subdomain routing, and
     * it is the form measured to answer 200.
     */
    private WebResourceResponse proxy(WebResourceRequest request, String namespace, String key)
        throws IOException {
        String path = request.getUrl().getEncodedPath();
        if (path == null || path.isEmpty()) path = "/";
        String query = request.getUrl().getEncodedQuery();

        String target = GATEWAY + "/" + namespace + "/" + key + path + (query != null ? "?" + query : "");

        HttpURLConnection connection = (HttpURLConnection) new URL(target).openConnection();
        connection.setRequestMethod(request.getMethod());
        connection.setConnectTimeout(15_000);
        connection.setReadTimeout(60_000);
        // Redirects are followed here rather than handed back: a 301 to the
        // subdomain form would send the WebView straight back to a name it
        // cannot resolve.
        connection.setInstanceFollowRedirects(true);

        // Range above all - it is what makes seeking in an audio or video file
        // work, and a gateway that never sees it streams from the start every
        // time.
        for (Map.Entry<String, String> header : request.getRequestHeaders().entrySet()) {
            String name = header.getKey();
            if ("Host".equalsIgnoreCase(name) || "Accept-Encoding".equalsIgnoreCase(name)) continue;
            connection.setRequestProperty(name, header.getValue());
        }

        int status = connection.getResponseCode();
        String contentType = connection.getContentType();
        String mimeType = "application/octet-stream";
        String encoding = null;

        if (contentType != null) {
            String[] parts = contentType.split(";");
            mimeType = parts[0].trim();
            for (String part : parts) {
                String trimmed = part.trim();
                if (trimmed.toLowerCase().startsWith("charset=")) {
                    encoding = trimmed.substring("charset=".length()).trim();
                }
            }
        }

        Map<String, String> responseHeaders = new HashMap<>();
        for (Map.Entry<String, List<String>> entry : connection.getHeaderFields().entrySet()) {
            if (entry.getKey() == null || entry.getValue().isEmpty()) continue;
            responseHeaders.put(entry.getKey(), entry.getValue().get(0));
        }
        // The page and its assets share the subdomain origin, so this is not
        // about the site's own files - it is for anything the site fetches
        // cross-origin from itself.
        responseHeaders.put("Access-Control-Allow-Origin", "*");

        InputStream body = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
        String reason = connection.getResponseMessage();
        if (reason == null || reason.isEmpty()) reason = "OK";

        return new WebResourceResponse(mimeType, encoding, status, reason, responseHeaders, body);
    }
}
