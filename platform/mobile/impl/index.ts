/**
 * The real mobile implementations, keyed by the same flat name the contract
 * uses: `'settingsGetAll'`, `'wallet.sendTokens'`, `'net.rpcGet'`.
 *
 * Anything absent here falls through to the generated stub in
 * `../bridge/stub.ts`, so the app boots whatever is missing and each addition
 * lights up one more screen. Call `__lumenBridgeReport()` in the console for
 * what is currently real.
 *
 * Nothing in this tree may import from `electron/` - that is the whole point of
 * the split. Native access goes through Capacitor plugins, and the chain logic
 * is plain TypeScript that is called directly instead of hopping through IPC.
 *
 * What is covered so far: settings, the security gate, profiles and their
 * keystores, plain HTTP, the chain reads and writes behind `net.*`, `wallet.*`
 * and `pqc.*`, and the read half of `dns.*`.
 *
 * IPFS is here too, pointed at whatever Kubo RPC API the user configured
 * rather than at a daemon this target cannot run - see ipfs.ts.
 *
 * What is not: `gateway.*`, which the desktop answers from a gateway agent on
 * localhost. A phone has no such agent, so search and pinning need a remote
 * gateway resolved from the user's on-chain plans - that is the next piece of
 * work, and the reason the search page is still short of working.
 */

import type { BridgeMember } from '../../../src/types/platformBridge';
import { IPFS_MEMBERS } from './ipfs';
import { HTTP_MEMBERS, NETWORK_MEMBERS } from './network';
import { PROFILE_MEMBERS } from './profiles';
import { SECURITY_MEMBERS } from './security';
import { SETTINGS_MEMBERS } from './settings';
import { SITE_MEMBERS } from './sites';
import { DNS_MEMBERS, WALLET_MEMBERS } from './wallet';

export const MOBILE_IMPL: Readonly<Record<string, BridgeMember>> = Object.freeze({
  ...SETTINGS_MEMBERS,
  ...SECURITY_MEMBERS,
  ...PROFILE_MEMBERS,
  ...NETWORK_MEMBERS,
  ...HTTP_MEMBERS,
  ...WALLET_MEMBERS,
  ...DNS_MEMBERS,
  ...SITE_MEMBERS,
  ...IPFS_MEMBERS,

  /**
   * The escape hatch for a site that refuses to be framed.
   *
   * Its namespace, , is otherwise unsupported here - an APK updates
   * through the Play Store, so there is nothing to download or publish. This
   * one member means something on every platform though, and an implementation
   * wins over the classification, so it is simply provided.
   *
   * A Custom Tab rather than a jump to another app: it keeps the user inside
   * Lumen's task, with a close button that comes back where they were.
   */
  'release.openExternal': async (url: string) => {
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url: String(url ?? '') });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e instanceof Error ? e.message : e) };
    }
  },

  // Small enough to answer inline rather than earn a module.
  appIsRoot: async () => true,
  appReportRendererError: async (payload: unknown) => {
    // The desktop writes these to a log file. There is nowhere equivalent here,
    // so the console is it - and it is reachable over chrome://inspect.
    console.error('[renderer]', payload);
    return { ok: true };
  },
  tabsReportState: async () => ({ ok: true }),
  tabsOnOpenInNewTab: () => () => {}
});

/**
 * Values, as opposed to callables - the `REQUIRED_VALUES` side of the contract.
 */
export const MOBILE_VALUES: Readonly<Record<string, unknown>> = Object.freeze({
  appPlatform: 'android',
  // The desktop flag exists because some Linux setups have no working portal;
  // on Android there are no Electron dialogs to be broken in the first place.
  appDialogLikelyBroken: false,
  appSystemLanguages: typeof navigator !== 'undefined' ? [...(navigator.languages ?? [])] : []
});
