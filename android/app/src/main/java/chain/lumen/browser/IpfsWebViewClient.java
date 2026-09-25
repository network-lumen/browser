package chain.lumen.browser;

import android.util.Log;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
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

        reportIfNavigation(request);

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
     * Tells the page when the site in its iframe is navigating somewhere.
     *
     * <p>A cross-origin iframe reports nothing - no event, no readable
     * location - so clicking a link inside a site left the address bar behind
     * and the back button took the user out of the site. This is the only
     * place that sees it happen.
     *
     * <p>A NAVIGATION IS TOLD APART BY WHAT IT ASKS FOR, and it took two
     * measurements to get right. {@code Sec-Fetch-Dest} would say it outright
     * and this WebView never sends it - every request arrives without one. An
     * {@code Accept} leading with {@code text/html} is the next best signal,
     * and it correctly rejects stylesheets, images and fetches, which lead
     * with something else.
     *
     * <p>It is not enough on its own. Next.js prefetches the next page's
     * chunk, and that request carries the same document {@code Accept} - so
     * the address bar jumped to a {@code .js} file and the back button walked
     * into it. The two are told apart by {@code Upgrade-Insecure-Requests},
     * which Chromium sends on a navigation and not on a prefetch:
     *
     * <pre>
     *   /index.html                 Accept: text/html…  UIR: 1   (navigation)
     *   /_next/…/downloads-….js     Accept: text/html…  Referer  (prefetch)
     * </pre>
     *
     * <p>Getting this wrong only costs a spurious address-bar update, and the
     * page drops one that matches where it already is.
     */
    private void reportIfNavigation(WebResourceRequest request) {
        if (!"GET".equalsIgnoreCase(request.getMethod())) return;

        Map<String, String> headers = request.getRequestHeaders();
        String dest = header(headers, "Sec-Fetch-Dest");
        String accept = header(headers, "Accept");

        boolean wantsDocument = "document".equalsIgnoreCase(dest) ||
            (dest.isEmpty() && accept.toLowerCase().startsWith("text/html"));
        if (!wantsDocument) return;
        if (header(headers, "Upgrade-Insecure-Requests").isEmpty()) return;

        Log.i(TAG, "site navigated to " + request.getUrl());
        SiteNavPlugin.report(request.getUrl().toString());
    }

    /** Header lookup that does not care about case, which the map does. */
    private String header(Map<String, String> headers, String name) {
        if (headers == null) return "";
        for (Map.Entry<String, String> entry : headers.entrySet()) {
            if (name.equalsIgnoreCase(entry.getKey())) {
                return entry.getValue() == null ? "" : entry.getValue();
            }
        }
        return "";
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

        // An HTML page gets the route reporter spliced into it - see
        // SITE_NAV_SCRIPT for why nothing outside the document can do this job.
        if (status < 400 && "text/html".equalsIgnoreCase(mimeType) && body != null) {
            byte[] page = readAll(body);
            byte[] patched = withSiteNavReporter(page, encoding);
            // The length changed, and a stale one truncates the page.
            responseHeaders.remove("Content-Length");
            responseHeaders.remove("content-length");

            /*
             * NOT CACHED, and this is the part that bit.
             *
             * The gateway answers an /ipfs/ path with
             * `Cache-Control: public, max-age=29030400, immutable` - correct for
             * content addressed by hash, and fatal here: Chromium then serves
             * the page from its own cache and never calls this interceptor
             * again, so a page first loaded by an older build kept being
             * replayed without the reporter. The site worked, the address bar
             * did not, and no amount of reinstalling changed it.
             *
             * Only the HTML is exempted. Every asset keeps the immutable
             * caching it deserves.
             */
            responseHeaders.remove("Cache-Control");
            responseHeaders.remove("cache-control");
            responseHeaders.put("Cache-Control", "no-store");

            body = new ByteArrayInputStream(patched);
        }

        return new WebResourceResponse(mimeType, encoding, status, reason, responseHeaders, body);
    }

    /**
     * The one thing a shell outside the document cannot see: a route change.
     *
     * <p>A site built with a client-side router - the lumen.lmn site is
     * Next.js - answers a click on {@code /community/} by calling
     * {@code history.pushState} and re-rendering. No request is made, so
     * {@link #reportIfNavigation} has nothing to look at, and the address bar
     * stayed on the page the site was opened at while the back button, having
     * no entry for what was on screen, left the site entirely.
     *
     * <p>Injecting this is a real intrusion into someone else's page and is
     * kept to the minimum that does the job: it wraps the two history methods,
     * listens for the two events that change a location without them, and
     * posts the result to the shell. It reads nothing, sends nothing else, and
     * the shell ignores any URL that does not belong to the CID it is showing.
     */
    private static final String SITE_NAV_SCRIPT =
        "<script>(function(){var l='';function s(){var u=location.href;if(u===l)return;l=u;" +
        "try{parent.postMessage({source:'lumen-site-nav',url:u},'*')}catch(e){}}" +
        "['pushState','replaceState'].forEach(function(m){var f=history[m];" +
        "history[m]=function(){var r=f.apply(this,arguments);s();return r}});" +
        "addEventListener('popstate',s);addEventListener('hashchange',s);s()})()</script>";

    /**
     * Spliced in right after the opening {@code <head>}, so it is wrapping
     * `history` before the site's own bundle has a chance to push anything. A
     * page with no head is left alone rather than guessed at.
     */
    private byte[] withSiteNavReporter(byte[] page, String encoding) {
        Charset charset = charsetOf(encoding);
        String html = new String(page, charset);

        int head = indexOfIgnoreCase(html, "<head>");
        if (head < 0) return page;

        int at = head + "<head>".length();
        return (html.substring(0, at) + SITE_NAV_SCRIPT + html.substring(at)).getBytes(charset);
    }

    private Charset charsetOf(String encoding) {
        try {
            if (encoding != null && !encoding.isEmpty()) return Charset.forName(encoding);
        } catch (Exception e) {
            // An encoding the JVM does not know is not worth failing a page for.
        }
        return StandardCharsets.UTF_8;
    }

    private int indexOfIgnoreCase(String haystack, String needle) {
        return haystack.toLowerCase().indexOf(needle.toLowerCase());
    }

    /** The whole body, because the page has to be rewritten before it is sent. */
    private byte[] readAll(InputStream stream) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream(32 * 1024);
        byte[] buffer = new byte[16 * 1024];
        int read;
        while ((read = stream.read(buffer)) != -1) out.write(buffer, 0, read);
        return out.toByteArray();
    }
}
