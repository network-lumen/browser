/**
 * Landscape while a video is fullscreen, the way every video app behaves.
 *
 * Wired here rather than in a page for two reasons. The renderer is shared
 * with the desktop, where none of this applies; and a video inside an IPFS
 * site runs in an iframe this app has no code in, yet its fullscreen still
 * raises `fullscreenchange` on the top document, so listening once at the
 * platform layer covers both.
 *
 * TWO EARLIER ATTEMPTS FAILED ON THE DEVICE, and both are worth naming:
 *
 *  - `screen.orientation.lock('landscape')` is refused outright by an Android
 *    WebView - "NotSupportedError: not available on this device". Orientation
 *    belongs to the Activity, so it takes a plugin.
 *  - `WebChromeClient.onShowCustomView` / `onHideCustomView` looks like the
 *    natural hook and is not: Capacitor's own `onShowCustomView` calls
 *    `onHideCustomView` while setting up, so the release landed 33ms after
 *    the lock and the video played upright anyway.
 *
 * `fullscreenchange` fires once per transition, in both directions, which is
 * what made it the one that works.
 */

import { registerPlugin } from '@capacitor/core';
import type { FullscreenPlugin } from '../../../src/types/fullscreen';

// Registered at module scope: resolving a promise with a Capacitor proxy makes
// the bridge try to call `.then` on it, which it does not implement.
const Fullscreen = registerPlugin<FullscreenPlugin>('Fullscreen');

/** Only a video earns a rotation; a fullscreen document stays as it is. */
function wantsLandscape(element: Element | null): boolean {
  if (!element) return false;
  const tag = String(element.tagName || '').toLowerCase();
  // An iframe here is a site that asked for fullscreen, which on this app is
  // how a site plays its own video.
  return tag === 'video' || tag === 'iframe';
}

export function installFullscreenOrientation(): void {
  const onChange = () => {
    const element = document.fullscreenElement;
    const call = wantsLandscape(element) ? Fullscreen.enter() : Fullscreen.exit();
    void call.catch((e) => {
      // A device that refuses keeps playing in whatever orientation it is in,
      // which is worse than rotating but is not broken.
      console.warn('[platform/mobile] fullscreen request refused:', e);
    });
  };

  document.addEventListener('fullscreenchange', onChange);
  // Older WebViews still fire only the prefixed one.
  document.addEventListener('webkitfullscreenchange', onChange);
}
