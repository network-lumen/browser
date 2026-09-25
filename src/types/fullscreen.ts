/**
 * The native fullscreen plugin, as
 * `platform/mobile/shims/fullscreen-orientation.ts` uses it.
 *
 * An Android WebView refuses `screen.orientation.lock()`, and a page has no
 * say over the status bar or the navigation buttons at all - both belong to
 * the Activity. See `android/.../FullscreenPlugin.java`.
 */
export interface FullscreenPlugin {
  /** Landscape, and the system bars out of the way. */
  enter(): Promise<void>;
  /** Back to the user's own rotation setting, bars restored. */
  exit(): Promise<void>;
}
