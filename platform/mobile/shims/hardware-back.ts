/**
 * The Android back gesture, wired to the browser's own Back.
 *
 * By default Capacitor lets the system handle it, which on the first screen
 * means leaving the app - so a user one page deep inside lumen:// found
 * themselves back on their launcher instead of on the previous page. In a
 * browser, Back means back.
 *
 * The wiring goes through a cancelable DOM event rather than a direct call
 * because nothing at this layer knows what a tab is. `NavBar.vue` owns the
 * history for the active tab, so it listens, and calling `preventDefault()` is
 * how it says "I handled it". When nobody does - no history left - the app
 * exits, which is what the gesture should do on the first page.
 */

export const HARDWARE_BACK_EVENT = 'lumen:hardware-back';

export async function installHardwareBack(): Promise<void> {
  try {
    const { App } = await import('@capacitor/app');

    await App.addListener('backButton', () => {
      const event = new CustomEvent(HARDWARE_BACK_EVENT, { cancelable: true });
      const handled = !window.dispatchEvent(event);
      if (!handled) void App.exitApp();
    });
  } catch (e) {
    // A failure here costs the back gesture, not the app. Worth a line in the
    // log rather than a broken startup.
    console.warn('[platform/mobile] hardware back button not wired:', e);
  }
}
