package chain.lumen.browser;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Registered before super.onCreate, which is when the bridge is built
        // and the plugin list is read.
        registerPlugin(KuboPlugin.class);
        super.onCreate(savedInstanceState);

        // After super.onCreate, because the bridge does not exist until then.
        // This is what makes <cid>.ipfs.localhost resolvable without a resolver
        // - see IpfsWebViewClient for why that matters for a site's CSS.
        getBridge().setWebViewClient(new IpfsWebViewClient(getBridge()));
    }
}
