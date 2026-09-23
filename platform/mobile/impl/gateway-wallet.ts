/**
 * The wallet-scoped gateway calls: pinning, usage, and the chain transactions
 * behind a plan.
 *
 * Two transports, and which one a member uses is not a style choice.
 *
 * Pinning and usage talk to the gateway agent over the PQ envelope in
 * gateway-pq.ts, because `authWallet` refuses anything else. Subscribing to a
 * plan or registering a gateway are chain transactions and go through the same
 * SDK signing path as every other write.
 *
 * `pinCid` differs from the desktop in one way worth stating: the desktop
 * exports a CAR from its own node and streams it to `/ingest/car`, because it
 * has the bytes locally. Here the CID is handed over and the gateway fetches
 * it from the network itself, which is the same outcome by a slower route and
 * needs the content to be reachable - it will be, since the embedded node is
 * seeding it.
 */

import { decryptKeystore } from './crypto';
import { gatewayAuthPq } from './gateway-pq';
import { getSessionPassword } from './security';
import { PROFILES_KEY, keystoreKey, readDoc } from './storage';
import { submitMessages } from './wallet';
import type { GatewayTarget, Keystore, ProfileRecord } from '../../../src/types/platformBridge';

const trimSlash = (s: string) => s.replace(/\/+$/, '');

function normalizeBase(hint: unknown): string {
  const raw = String(hint ?? '').trim();
  if (!raw) return '';
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return trimSlash(new URL(withScheme).origin);
  } catch {
    return '';
  }
}

/** The active profile, its address and its mnemonic - everything a PQ call needs. */
async function signer(): Promise<
  { ok: true; wallet: string; mnemonic: string } | { ok: false; error: string }
> {
  const doc = await readDoc<{ profiles: ProfileRecord[]; activeId: string }>(PROFILES_KEY);
  const profile = doc?.profiles?.find((p) => p.id === doc.activeId) ?? doc?.profiles?.[0];
  if (!profile) return { ok: false, error: 'no_active_profile' };

  const wallet = String(profile.walletAddress || profile.address || '').trim();
  if (!wallet) return { ok: false, error: 'wallet_address_missing' };

  const ks = await readDoc<Keystore>(keystoreKey(profile.id));
  if (!ks) return { ok: false, error: 'keystore_missing' };

  const mnemonic = await decryptKeystore(ks, getSessionPassword());
  // The gateway signature needs the key, so a locked wallet cannot make one -
  // and saying that is more use than a 401 from the agent.
  if (!mnemonic) return { ok: false, error: 'wallet_locked' };

  return { ok: true, wallet, mnemonic };
}

/** Wraps an authenticated call so callers always get `{ ok }`. */
async function authCall(
  baseHint: unknown,
  method: 'POST' | 'GET',
  path: string,
  payload: unknown,
  timeoutMs?: number
) {
  const base = normalizeBase(baseHint);
  if (!base) return { ok: false, error: 'missing_gateway_base' };

  const who = await signer();
  if (!who.ok) return { ok: false, error: who.error };

  return gatewayAuthPq({
    base,
    method,
    path,
    wallet: who.wallet,
    mnemonic: who.mnemonic,
    payload,
    timeoutMs
  });
}

const ingestListeners = new Set<(payload: unknown) => void>();

export const GATEWAY_WALLET_MEMBERS = {
  'gateway.pinCid': (input: GatewayTarget & { cid?: string; name?: string }) =>
    authCall(
      input?.baseUrl ?? input?.endpoint,
      'POST',
      '/pin',
      { cid: String(input?.cid ?? '').trim(), name: String(input?.name ?? '') },
      120_000
    ),

  'gateway.unpinCid': (input: GatewayTarget & { cid?: string }) =>
    authCall(input?.baseUrl ?? input?.endpoint, 'POST', '/unpin', {
      cid: String(input?.cid ?? '').trim()
    }),

  'gateway.renameCid': (input: GatewayTarget & { cid?: string; name?: string }) =>
    authCall(input?.baseUrl ?? input?.endpoint, 'POST', '/wallet/cid/rename', {
      cid: String(input?.cid ?? '').trim(),
      name: String(input?.name ?? '')
    }),

  /**
   * There is no CAR upload in flight to abort - the gateway fetches the
   * content itself here - so this reports plainly instead of pretending to
   * have stopped something.
   */
  'gateway.cancelPinCid': async () => ({
    ok: true,
    canceled: false,
    reason: 'pin_is_not_a_local_upload_here'
  }),

  /**
   * Ingest progress belongs to the CAR stream the desktop sends. Nothing
   * streams here, so the callback never fires - and the unsubscribe is real so
   * a caller's teardown works.
   */
  'gateway.onIngestProgress': (callback: (payload: unknown) => void) => {
    ingestListeners.add(callback);
    return () => ingestListeners.delete(callback);
  },

  // --- chain transactions ---------------------------------------------
  //
  // Built by the SDK, for the same reason the domain messages are: the field
  // names are not guessable. A gateway is registered with a `payout` address,
  // not an `endpoint`, and a contract's numbers are numbers rather than the
  // strings a hand-written message would have sent.

  'gateway.subscribePlan': (input: {
    gatewayId?: string | number;
    priceUlmn?: string | number;
    storageGbPerMonth?: number;
    networkGbPerMonth?: number;
    monthsTotal?: number;
    metadata?: string;
  }) =>
    submitMessages(
      (_sdk, from, client) => [
        client.gateways().msgCreateContract(from, {
          gatewayId: Number(input?.gatewayId ?? 0),
          priceUlmn: Number(input?.priceUlmn ?? 0),
          storageGbPerMonth: Number(input?.storageGbPerMonth ?? 0),
          networkGbPerMonth: Number(input?.networkGbPerMonth ?? 0),
          monthsTotal: Number(input?.monthsTotal ?? 1),
          metadata: String(input?.metadata ?? '')
        })
      ],
      'gateway:plan:subscribe'
    ),

  'gateway.cancelContract': (input: { contractId?: string | number }) =>
    submitMessages(
      (_sdk, from, client) =>
        // The id is the second argument here, not a field.
        [client.gateways().msgCancelContract(from, Number(input?.contractId ?? 0))],
      'gateway:plan:cancel'
    ),

  'gateway.registerGateway': (input: { payout?: string; metadata?: string }) =>
    submitMessages(
      (_sdk, from, client) => [
        client.gateways().msgRegisterGateway(from, {
          payout: String(input?.payout ?? from),
          metadata: String(input?.metadata ?? '')
        })
      ],
      'gateway:register'
    ),

  'gateway.updateGateway': (input: {
    gatewayId?: string | number;
    payout?: string;
    metadata?: string;
    active?: boolean;
  }) =>
    submitMessages(
      (_sdk, from, client) => [
        client.gateways().msgUpdateGateway(from, {
          gatewayId: Number(input?.gatewayId ?? 0),
          payout: input?.payout,
          metadata: input?.metadata,
          active: input?.active
        })
      ],
      'gateway:update'
    )
};

/** The two read members that also need the envelope. */
export const GATEWAY_WALLET_READS = {
  'gateway.getWalletUsage': (input?: GatewayTarget) =>
    authCall(input?.baseUrl ?? input?.endpoint, 'POST', '/wallet/usage', {}),

  'gateway.getWalletPinnedCids': (input?: GatewayTarget) =>
    authCall(input?.baseUrl ?? input?.endpoint, 'POST', '/wallet/cids', {})
};
