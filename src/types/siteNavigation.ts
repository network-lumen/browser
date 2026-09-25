/**
 * The native plugin that reports a navigation inside a site's iframe.
 *
 * A cross-origin iframe tells the page nothing about where it went, so the
 * WebView's request interceptor says it instead - see
 * `android/.../SiteNavPlugin.java`.
 */
export interface SiteNavPlugin {
  addListener(
    event: 'navigated',
    handler: (payload: { url: string }) => void
  ): Promise<{ remove: () => Promise<void> }>;
}
