/**
 * Types for the per-target `window.lumen` installers under `platform/`.
 *
 * They live here rather than next to that code for the reason every other type
 * in this project does (see CONTRIBUTING.md and the `no-restricted-syntax`
 * block in eslint.config.mjs): one home, so a concept cannot quietly grow a
 * second definition. `lumenBridge.ts` next door types the bridge the renderer
 * *consumes*; this types the machinery that builds one.
 */

/**
 * A bridge member. Arguments and return stay `any` for the same reason they do
 * in `lumenBridge.ts`: the contract in `lumenBridgeSurface.ts` records names,
 * not signatures, and inventing signatures would trade an honest `any` for a
 * confident lie.
 */
export type BridgeMember = (...args: any[]) => any;

/**
 * Whether a contract member is expected to work on mobile eventually.
 *
 * `unsupported` is an answer, not a backlog entry: a local IPFS daemon or a
 * Chromium extension host has no Android equivalent, and the UI that reaches
 * for one should be hidden on that target rather than waiting for it.
 */
export type MobileSupport = 'planned' | 'unsupported';

/** How one contract member was satisfied when the bridge was built. */
export type MemberState = 'implemented' | 'stubbed' | 'unsupported';

/** Inventory of a built bridge, for `__lumenBridgeReport()` and for tests. */
export interface BridgeReport {
  implemented: string[];
  stubbed: string[];
  unsupported: string[];
  total: number;
}

/** scrypt work factor, recorded beside every secret it protected. */
export interface ScryptParams {
  N: number;
  r: number;
  p: number;
  dklen: number;
}

/** The `crypto` block shared by every keystore and encrypted backup. */
export interface KeystoreCrypto {
  cipher: 'aes-256-gcm';
  ciphertext: string;
  iv: string;
  tag: string;
  kdf: 'scrypt';
  kdfparams: ScryptParams & { salt: string };
}

/**
 * An encrypted secret, in the exact shape `electron/utils/crypto.cjs` writes.
 *
 * `version: 1` is protected by the machine secret, `version: 2` with
 * `passwordProtected: true` by the user's password - the same discrimination
 * `isPasswordProtected()` makes on the desktop.
 */
export interface Keystore {
  version: number;
  passwordProtected?: boolean;
  createdAt: number;
  crypto: KeystoreCrypto;
}

/** A stored password verifier - never a key, only something to compare against. */
export interface PasswordHash {
  hash: string;
  salt: string;
  algorithm: 'scrypt-sha256';
  params: ScryptParams;
}

/** What `security.getStatus()` answers. */
export interface SecurityStatus {
  passwordEnabled: boolean;
  hasPassword: boolean;
  sessionActive: boolean;
  sessionTimeoutMs: number;
}

/** The profiles document: every profile, plus which one is selected. */
export interface ProfilesFile {
  profiles: import('./profile').Profile[];
  activeId: string;
}

/** The SDK entry point that mints a wallet, resolved lazily at call time. */
export type CreateWalletFn = () => Promise<{ mnemonic?: string; address?: string } | null>;

/** The settings document - an open bag, normalised against defaults on read. */
export type Settings = Record<string, unknown>;

/** A file written to the device and offered to the share sheet. */
export interface SavedFile {
  ok: boolean;
  path?: string;
  uri?: string;
  shared?: boolean;
  error?: string;
}

/** Which Lumen the mobile build is talking to. */
export type NetworkId = 'mainnet' | 'testnet';

/** One answer from a chain endpoint, RPC or REST. */
export interface ChainResponse {
  ok: boolean;
  status: number;
  text?: string;
  json?: unknown;
  error?: string;
  timeout?: boolean;
  endpoint?: string;
}

/** The parts of a stored profile the chain-facing code reads. */
export interface ProfileRecord {
  id: string;
  name?: string;
  walletAddress?: string;
  address?: string;
  role?: string;
}

/** One site's remembered answers to Lumen's permission prompts. */
export interface SitePermission {
  siteKey: string;
  actions: Record<string, boolean>;
}

/**
 * What Lumen recorded about a site holding data, per profile.
 *
 * On Android this is Lumen's own record rather than an inventory of the
 * WebView's storage - see the note in platform/mobile/impl/sites.ts.
 */
export interface SiteDataRecord {
  siteKey: string;
  profileId: string;
  keyName?: string;
  updatedAt?: number;
}
