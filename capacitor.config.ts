import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor wraps the `mobile` target of the Vite build - the one where
 * `@platform` resolves to `platform/mobile/install.ts` and the renderer
 * installs its own `window.lumen` because there is no Electron preload here.
 * See platform/README.md.
 *
 * `webDir` is `dist-mobile`, never `dist`: `dist` is what electron-builder
 * packages for the desktop app, and pointing Capacitor at it would ship a
 * build whose bridge is missing entirely.
 *
 * Produce it with `npm run build:mobile`, then `npx cap sync android`.
 */
const config: CapacitorConfig = {
  appId: 'chain.lumen.browser',
  appName: 'Lumen Browser',
  webDir: 'dist-mobile',
  android: {
    // The renderer is served from https://localhost by default, which keeps it
    // a secure context - crypto.subtle is used for signing and simply does not
    // exist otherwise.
    allowMixedContent: false
  }
};

export default config;
