/**
 * What the `window.lumen` contract means on Android.
 *
 * The desktop bridge has 222 members, and a fair share of them exist only
 * because Electron is a desktop process: a local IPFS node (kubo), an express
 * gateway server, Chromium extension loading, ffmpeg, the logs folder. None of
 * those have an Android equivalent, and pretending they are "not done yet"
 * would leave a permanent to-do list that is really a design decision.
 *
 * So each member is classified once, here, and the classification drives two
 * things: what the generated stub does when called, and what
 * `__lumenBridgeReport()` prints. `PLANNED` is work; `UNSUPPORTED` is an
 * answer.
 *
 * Classification is by prefix/namespace rather than per member: the split
 * follows subsystems, and listing 222 names by hand would be a second contract
 * to keep in sync with the first.
 */

import type { MobileSupport } from '../../../src/types/platformBridge';

/**
 * Namespaces with no Android story. Calling into one is not a bug to fix
 * later - the UI that reaches for it should be hidden on mobile instead.
 */
const UNSUPPORTED_NAMESPACES = new Set<string>([
  // Chromium extension hosting: no CRX loader outside Electron.
  'extensions',
  // Chromium's own find-in-page and devtools, both <webview>-bound.
  'find',
  'devtools',
  // Desktop-only release channel: an APK updates through the Play Store.
  'release'
]);

/**
 * Top-level functions with no Android story, matched by prefix.
 *
 * `ipfs*` is the big one: those 35 members front a local kubo daemon. Mobile
 * reaches IPFS through a remote gateway instead, which is `gateway.*` - a
 * different namespace, and one that IS planned.
 */
const UNSUPPORTED_PREFIXES = [
  // The ipfs members that survive on this target speak to a REMOTE Kubo RPC
  // API (see impl/ipfs.ts) and are implemented, which wins over this entry.
  // What is left under the prefix is what needs a local filesystem or a
  // long-running job: adding by path, directory walks, the managed pin queue.
  'ipfs',
  'gatewayServer',   // hosting an express gateway from the device
  'drive',           // ffmpeg/ffprobe native binaries
  'dialogOpen',      // desktop file dialogs
  'bootstrapPath',   // custom userData path on disk
  'setWindowMode',   // no window manager
  'openMainWindow'
];

/** Namespace members that are desktop-only inside an otherwise planned group. */
const UNSUPPORTED_MEMBERS = new Set<string>([
  'troubleshooting.openLogsFolder',
  'profiles.pickManualProfileSource', // native file picker
  'profiles.pickManualPqcSource'
]);

/**
 * Whether a member is expected to work on mobile eventually.
 *
 * `name` is the flat key: `'settingsGetAll'` for a top-level function,
 * `'wallet.sendTokens'` for a namespaced one.
 */
export function mobileSupportOf(name: string): MobileSupport {
  if (UNSUPPORTED_MEMBERS.has(name)) return 'unsupported';

  const dot = name.indexOf('.');
  if (dot > -1) {
    return UNSUPPORTED_NAMESPACES.has(name.slice(0, dot)) ? 'unsupported' : 'planned';
  }

  return UNSUPPORTED_PREFIXES.some((p) => name.startsWith(p)) ? 'unsupported' : 'planned';
}

/**
 * Subscription-shaped members: `settingsOnChanged`, `net.onNetworkChanged`,
 * `ipfsOnPinProgress`, ...
 *
 * These matter more than they look. Callers invoke them synchronously and keep
 * the return value as an unsubscribe function, so a stub that returns a
 * rejected promise crashes the caller on teardown rather than degrading. The
 * stub returns a no-op unsubscribe for these instead, which is exactly what
 * "this event never fires" should look like.
 */
export function isSubscription(member: string): boolean {
  return /^on[A-Z]/.test(member) || /[a-z]On[A-Z]/.test(member);
}
