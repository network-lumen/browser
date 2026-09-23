/**
 * The mobile port of the wallet half of `electron/ipc/wallet.cjs` and
 * `electron/ipc/chain.cjs`.
 *
 * Two very different jobs live here.
 *
 * READS are plain REST against the chain, so they are ported directly - same
 * paths, same return shapes, through `readState` in network.ts so they get the
 * two-endpoint comparison.
 *
 * WRITES are not ported at all. The desktop hand-builds every transaction,
 * signs it with secp256k1, computes the Dilithium3 signature, splices the two
 * together and broadcasts - about fifteen hundred lines that must agree exactly
 * with `app/ante_pqc_dualsign.go` or the chain rejects the result. Re-deriving
 * that from scratch for a second platform is how the two drift apart, and the
 * failure mode is a wallet that signs transactions nobody accepts.
 *
 * So writes go through the SDK's own `LumenSigningClient.signAndBroadcast`,
 * which already does the whole dual-signature pipeline and is the same code the
 * chain team ships. All this file supplies is the signer and a PQC key store
 * backed by the documents profiles.ts already keeps.
 */

import type { Keystore, ProfileRecord } from '../../../src/types/platformBridge';
import { decryptKeystore } from './crypto';
import { activeNetwork, readState } from './network';
import { getSessionPassword } from './security';
import { PROFILES_KEY, keystoreKey, readDoc } from './storage';

const addressOf = (p: ProfileRecord | null | undefined) =>
  String(p?.walletAddress || p?.address || '').trim();

async function activeProfile(): Promise<ProfileRecord | null> {
  const doc = await readDoc<{ profiles: ProfileRecord[]; activeId: string }>(PROFILES_KEY);
  const profiles = doc?.profiles ?? [];
  return profiles.find((p) => p.id === doc?.activeId) ?? profiles[0] ?? null;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** One REST read, with the desktop's "ok plus a named list" return shape. */
async function restList(path: string, key: string, errorLabel: string) {
  const res = await readState(path, { kind: 'rest', timeout: 10_000 });
  if (!res.ok) return { ok: false, status: res.status, error: errorLabel };
  return { ok: true, [key]: asArray((res.json as any)?.[key]) };
}

async function getBalance(input: { address?: string; denom?: string } | string) {
  const address = String(typeof input === 'string' ? input : (input?.address ?? '')).trim();
  if (!address) return { ok: false, error: 'missing address' };
  const denom = String((typeof input === 'object' && input?.denom) || 'ulmn');

  const byDenom = await readState(
    `/cosmos/bank/v1beta1/balances/${encodeURIComponent(address)}/by_denom?denom=${encodeURIComponent(denom)}`,
    { kind: 'rest', timeout: 8_000 }
  );
  if (byDenom.ok && (byDenom.json as any)?.balance) {
    return { ok: true, balance: (byDenom.json as any).balance };
  }

  // Not every node exposes by_denom; the full list is the fallback, exactly as
  // on the desktop.
  const all = await readState(`/cosmos/bank/v1beta1/balances/${encodeURIComponent(address)}`, {
    kind: 'rest',
    timeout: 8_000
  });
  if (!all.ok) return { ok: false, status: all.status, error: 'balance query failed' };

  const coins = asArray((all.json as any)?.balances) as { denom?: string }[];
  return { ok: true, balance: coins.find((c) => c.denom === denom) ?? { denom, amount: '0' } };
}

async function listSendTxs(input: { address?: string; limit?: number } | string) {
  const address = String(typeof input === 'string' ? input : (input?.address ?? '')).trim();
  if (!address) return { ok: false, error: 'missing address' };
  const limit = Math.min(100, Math.max(1, Number((input as any)?.limit ?? 50) | 0));

  const filters = [
    `message.sender='${address}'`,
    `transfer.recipient='${address}'`
  ];
  const byHash = new Map<string, unknown>();

  for (const filter of filters) {
    const query = new URLSearchParams({
      events: filter,
      order_by: 'ORDER_BY_DESC',
      page: '1',
      limit: String(limit)
    });
    let res = await readState(`/cosmos/tx/v1beta1/txs?${query}`, { kind: 'rest', timeout: 15_000 });

    if (!res.ok) {
      // Older LCDs take `query` instead of `events`.
      const legacy = new URLSearchParams({
        query: filter,
        order_by: 'ORDER_BY_DESC',
        page: '1',
        limit: String(limit)
      });
      res = await readState(`/cosmos/tx/v1beta1/txs?${legacy}`, { kind: 'rest', timeout: 15_000 });
    }

    // A 404 means "no transactions" and a 500 usually means the node has
    // indexing off - neither is worth surfacing as a failure.
    if (!res.ok) continue;

    for (const tx of asArray((res.json as any)?.tx_responses) as { txhash?: string }[]) {
      if (tx?.txhash) byHash.set(tx.txhash, tx);
    }
  }

  return { ok: true, txs: [...byHash.values()] };
}

async function getTokenomicsParams() {
  const res = await readState('/lumen/tokenomics/v1/params', { kind: 'rest', timeout: 10_000 });
  if (!res.ok) return { ok: false, status: res.status, error: 'tokenomics params query failed' };
  return { ok: true, params: (res.json as any)?.params ?? (res.json as any) ?? {} };
}

// ---------------------------------------------------------------------------
// Writes, through the SDK
// ---------------------------------------------------------------------------

/**
 * The PQC key store the SDK expects: `getLink(address)` naming a key, and
 * `getKey(name)` returning it. Both read the same two documents profiles.ts
 * writes, so a key imported through a backup is the key that signs.
 */
async function buildPqcStore() {
  const links = (await readDoc<Record<string, string>>('pqc_keys/links.json')) ?? {};
  const rawKeys = await readDoc<Record<string, any>>('pqc_keys/keys.json');

  let keys: Record<string, any> = rawKeys ?? {};
  if ((rawKeys as any)?.crypto) {
    // The key file is sealed once a password is set; without an open session
    // there is nothing to sign with, and saying so beats a confusing failure
    // deep inside the SDK.
    const password = getSessionPassword();
    if (!password) throw new Error('wallet_locked');
    const { decryptWithPassword } = await import('./crypto');
    keys = JSON.parse(await decryptWithPassword(rawKeys as unknown as Keystore, password));
  }

  const normalize = (rec: any) =>
    rec && {
      name: rec.name,
      scheme: rec.scheme ?? 'dilithium3',
      publicKey: rec.publicKey ?? rec.public_key,
      privateKey: rec.privateKey ?? rec.private_key
    };

  return {
    getLink: (address: string) => links[address] ?? null,
    getKey: (name: string) => normalize(keys[name]) ?? null
  };
}

/** The mnemonic of the profile that is signing. Throws rather than guessing. */
async function signingMnemonic(profileId: string): Promise<string> {
  const ks = await readDoc<Keystore>(keystoreKey(profileId));
  if (!ks) throw new Error('keystore_missing');
  const mnemonic = await decryptKeystore(ks, getSessionPassword());
  if (!mnemonic) throw new Error('wallet_locked');
  return mnemonic;
}

/**
 * A signing client for the active profile.
 *
 * Built per call rather than cached: it holds the mnemonic-derived signer, and
 * keeping that alive between transactions would outlive the session lock that
 * is supposed to end it.
 */
async function connectSigning(profileId: string) {
  const network = await activeNetwork();
  const mod: any = await import('@lumen-chain/sdk');
  const sdk = mod?.default ?? mod;

  const mnemonic = await signingMnemonic(profileId);
  const signer = await sdk.utils.walletFromMnemonic(mnemonic, network.prefix);
  const [account] = await signer.getAccounts();

  const { NETWORK_MEMBERS } = await import('./network');
  const described: any = await NETWORK_MEMBERS['net.getNetwork']();
  const endpoints = { rpc: described?.network?.rpc?.[0], rest: described?.network?.rest?.[0] };

  const client = await sdk.LumenSigningClient.connectWithSigner(signer, endpoints, network.chainId, {
    pqc: { enabled: true, store: await buildPqcStore() }
  });

  return { client, address: account.address as string };
}

/**
 * The fee every ordinary Lumen transaction carries: none.
 *
 * `app/ante_zero_fee.go` REFUSES a fee on an ordinary transaction, so there is
 * nothing to estimate and `'auto'` is not a shortcut - it asks the SDK to price
 * the transaction, which needs a gasPrice nobody set. That is the whole of
 * "gasPrice must be set when using auto fee estimation", and it broke every
 * write on this target, not just the one that reported it.
 *
 * Gas is declared because the ante still meters it; the amount stays empty
 * because the chain rejects a transaction that pays. An IBC transfer is the
 * one exception and passes its own fee.
 */
const ZERO_FEE = { amount: [] as { denom: string; amount: string }[], gas: '300000' };

/**
 * Wraps a write so the renderer always gets `{ ok }` rather than an exception.
 *
 * Exported because the domain and governance writes in site-chain.ts are the
 * same transaction, differing only in the messages they build - and a second
 * copy of the signing dance is a second thing to keep in step with the chain.
 */
export async function submitMessages(
  build: (sdk: any, address: string) => unknown[],
  memo = '',
  fee: unknown = ZERO_FEE
): Promise<Record<string, unknown>> {
  try {
    const profile = await activeProfile();
    if (!profile) return { ok: false, error: 'no_active_profile' };

    const mod: any = await import('@lumen-chain/sdk');
    const sdk = mod?.default ?? mod;
    const { client, address } = await connectSigning(profile.id);

    const messages = build(sdk, address);
    if (!messages.length) return { ok: false, error: 'nothing_to_send' };

    const result = await client.signAndBroadcast(address, messages, fee, memo);
    const code = Number(result?.code ?? 0);
    if (code !== 0) return { ok: false, code, error: result?.rawLog || 'tx_rejected' };
    return { ok: true, hash: result?.transactionHash, height: result?.height };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // 'wallet_locked' is a state the UI knows how to act on; anything else is
    // reported as-is rather than flattened into a generic failure.
    return { ok: false, error: message };
  }
}

const coin = (amount: unknown, denom: string) => ({ denom, amount: String(amount ?? '0') });

export const WALLET_MEMBERS = {
  'wallet.getBalance': getBalance,
  'wallet.listSendTxs': listSendTxs,
  'wallet.getTokenomicsParams': getTokenomicsParams,

  'wallet.getDelegations': (input: { address?: string } | string) => {
    const address = String(typeof input === 'string' ? input : (input?.address ?? '')).trim();
    if (!address) return Promise.resolve({ ok: false, error: 'missing address' });
    return restList(
      `/cosmos/staking/v1beta1/delegations/${encodeURIComponent(address)}`,
      'delegation_responses',
      'delegations query failed'
    ).then((r: any) => (r.ok ? { ok: true, delegations: r.delegation_responses } : r));
  },

  'wallet.getUnbondingDelegations': (input: { address?: string } | string) => {
    const address = String(typeof input === 'string' ? input : (input?.address ?? '')).trim();
    if (!address) return Promise.resolve({ ok: false, error: 'missing address' });
    return restList(
      `/cosmos/staking/v1beta1/delegators/${encodeURIComponent(address)}/unbonding_delegations`,
      'unbonding_responses',
      'unbonding query failed'
    ).then((r: any) => (r.ok ? { ok: true, unbonding: r.unbonding_responses } : r));
  },

  'wallet.getRedelegations': (input: { address?: string } | string) => {
    const address = String(typeof input === 'string' ? input : (input?.address ?? '')).trim();
    if (!address) return Promise.resolve({ ok: false, error: 'missing address' });
    return restList(
      `/cosmos/staking/v1beta1/delegators/${encodeURIComponent(address)}/redelegations`,
      'redelegation_responses',
      'redelegations query failed'
    ).then((r: any) => (r.ok ? { ok: true, redelegations: r.redelegation_responses } : r));
  },

  'wallet.getStakingRewards': async (input: { address?: string } | string) => {
    const address = String(typeof input === 'string' ? input : (input?.address ?? '')).trim();
    if (!address) return { ok: false, error: 'missing address' };
    const res = await readState(
      `/cosmos/distribution/v1beta1/delegators/${encodeURIComponent(address)}/rewards`,
      { kind: 'rest', timeout: 10_000 }
    );
    if (!res.ok) return { ok: false, status: res.status, error: 'rewards query failed' };
    return {
      ok: true,
      rewards: asArray((res.json as any)?.rewards),
      total: asArray((res.json as any)?.total)
    };
  },

  'wallet.sendTokens': async (input: {
    toAddress?: string;
    to?: string;
    amount?: string;
    denom?: string;
    memo?: string;
  }) => {
    const to = String(input?.toAddress ?? input?.to ?? '').trim();
    if (!to) return { ok: false, error: 'missing_recipient' };
    const denom = String(input?.denom ?? (await activeNetwork()).denom);
    return submitMessages(
      (sdk, from) => [sdk.utils.msg.bankSend(from, to, [coin(input?.amount, denom)])],
      String(input?.memo ?? '')
    );
  },

  'wallet.delegate': async (input: { validatorAddress?: string; amount?: string; denom?: string }) => {
    const validator = String(input?.validatorAddress ?? '').trim();
    if (!validator) return { ok: false, error: 'missing_validator' };
    const denom = String(input?.denom ?? (await activeNetwork()).denom);
    return submitMessages((_sdk, from) => [
      {
        typeUrl: '/cosmos.staking.v1beta1.MsgDelegate',
        value: { delegatorAddress: from, validatorAddress: validator, amount: coin(input?.amount, denom) }
      }
    ]);
  },

  'wallet.undelegate': async (input: { validatorAddress?: string; amount?: string; denom?: string }) => {
    const validator = String(input?.validatorAddress ?? '').trim();
    if (!validator) return { ok: false, error: 'missing_validator' };
    const denom = String(input?.denom ?? (await activeNetwork()).denom);
    return submitMessages((_sdk, from) => [
      {
        typeUrl: '/cosmos.staking.v1beta1.MsgUndelegate',
        value: { delegatorAddress: from, validatorAddress: validator, amount: coin(input?.amount, denom) }
      }
    ]);
  },

  'wallet.redelegate': async (input: {
    fromValidator?: string;
    toValidator?: string;
    amount?: string;
    denom?: string;
  }) => {
    const src = String(input?.fromValidator ?? '').trim();
    const dst = String(input?.toValidator ?? '').trim();
    if (!src || !dst) return { ok: false, error: 'missing_validator' };
    const denom = String(input?.denom ?? (await activeNetwork()).denom);
    return submitMessages((_sdk, from) => [
      {
        typeUrl: '/cosmos.staking.v1beta1.MsgBeginRedelegate',
        value: {
          delegatorAddress: from,
          validatorSrcAddress: src,
          validatorDstAddress: dst,
          amount: coin(input?.amount, denom)
        }
      }
    ]);
  },

  'wallet.withdrawRewards': async (input: { validatorAddress?: string }) => {
    const validator = String(input?.validatorAddress ?? '').trim();
    if (!validator) return { ok: false, error: 'missing_validator' };
    return submitMessages((_sdk, from) => [
      {
        typeUrl: '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
        value: { delegatorAddress: from, validatorAddress: validator }
      }
    ]);
  },

  'wallet.withdrawAllRewards': async (input: { address?: string }) => {
    const profile = await activeProfile();
    const address = String(input?.address ?? addressOf(profile)).trim();
    if (!address) return { ok: false, error: 'missing address' };

    const res = await readState(
      `/cosmos/distribution/v1beta1/delegators/${encodeURIComponent(address)}/rewards`,
      { kind: 'rest', timeout: 10_000 }
    );
    if (!res.ok) return { ok: false, error: 'rewards query failed' };

    const validators = asArray((res.json as any)?.rewards)
      .map((r: any) => String(r?.validator_address ?? '').trim())
      .filter(Boolean);

    // The chain caps a transaction at 64 messages (app/ante_max_messages.go),
    // so a delegator spread wider than that has to claim in batches. Only the
    // first batch is sent here and the caller is told how many are left.
    const batch = validators.slice(0, 64);
    const result = await submitMessages((_sdk, from) =>
      batch.map((validator) => ({
        typeUrl: '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
        value: { delegatorAddress: from, validatorAddress: validator }
      }))
    );
    return { ...result, claimed: batch.length, remaining: validators.length - batch.length };
  },

  'wallet.ibcTransfer': async (input: {
    toAddress?: string;
    amount?: string;
    denom?: string;
    sourceChannel?: string;
    memo?: string;
    fee?: unknown;
  }) => {
    const to = String(input?.toAddress ?? '').trim();
    const channel = String(input?.sourceChannel ?? '').trim();
    if (!to || !channel) return { ok: false, error: 'missing_ibc_route' };
    const denom = String(input?.denom ?? (await activeNetwork()).denom);

    // The one transaction that must pay. `app/ante_zero_fee.go` requires a
    // positive fee on an IBC transfer and refuses one everywhere else, so this
    // is the exception rather than the rule - and passing ZERO_FEE here would
    // be rejected just as surely as paying on an ordinary send.
    const ibcFee = input?.fee ?? {
      amount: [coin(1000, denom)],
      gas: '300000'
    };

    return submitMessages((_sdk, from) => [
      {
        typeUrl: '/ibc.applications.transfer.v1.MsgTransfer',
        value: {
          sourcePort: 'transfer',
          sourceChannel: channel,
          token: coin(input?.amount, denom),
          sender: from,
          receiver: to,
          // Ten minutes, in nanoseconds, which is what the field wants.
          timeoutTimestamp: BigInt(Date.now() + 10 * 60 * 1000) * 1_000_000n,
          memo: String(input?.memo ?? '')
        }
      }
    ], String(input?.memo ?? ''), ibcFee);
  },

  'pqc.getParams': async () => {
    const res = await readState('/lumen/pqc/v1/params', { kind: 'rest', timeout: 10_000 });
    if (!res.ok) return { ok: false, status: res.status, error: 'pqc params query failed' };
    return { ok: true, params: (res.json as any)?.params ?? {} };
  },

  'pqc.getAccount': async (input: { address?: string } | string) => {
    const address = String(typeof input === 'string' ? input : (input?.address ?? '')).trim();
    if (!address) return { ok: false, error: 'missing address' };
    const res = await readState(`/lumen/pqc/v1/account/${encodeURIComponent(address)}`, {
      kind: 'rest',
      timeout: 10_000
    });
    // A 404 is an account with no key linked, which is a normal state and not
    // a failure the UI should shout about.
    if (!res.ok) return { ok: true, account: null, status: res.status };
    return { ok: true, account: (res.json as any)?.account ?? (res.json as any) ?? null };
  }
};

/** Chain-name-service reads. The write side still goes through the stub. */
export const DNS_MEMBERS = {
  'dns.getParams': async () => {
    const res = await readState('/lumen/dns/v1/params', { kind: 'rest', timeout: 10_000 });
    return res.ok
      ? { ok: true, params: (res.json as any)?.params ?? {} }
      : { ok: false, status: res.status, error: 'dns params query failed' };
  },

  'dns.getDomainInfo': async (input: { name?: string; ext?: string } | string) => {
    const name = String(typeof input === 'string' ? input : (input?.name ?? '')).trim();
    if (!name) return { ok: false, error: 'missing_domain' };
    const ext = String((typeof input === 'object' && input?.ext) || '').trim();
    const fqdn = ext ? `${name}.${ext}` : name;

    const res = await readState(`/lumen/dns/v1/domain/${encodeURIComponent(fqdn)}`, {
      kind: 'rest',
      timeout: 10_000
    });
    // An unregistered domain is a 404, and "available" is the useful answer
    // rather than an error.
    if (!res.ok) return { ok: true, domain: null, available: res.status === 404 };
    return { ok: true, domain: (res.json as any)?.domain ?? (res.json as any) ?? null, available: false };
  },

  'dns.listByOwnerDetailed': async (input: { address?: string } | string) => {
    const address = String(typeof input === 'string' ? input : (input?.address ?? '')).trim();
    if (!address) return { ok: false, error: 'missing address' };
    const res = await readState(`/lumen/dns/v1/domains_by_owner/${encodeURIComponent(address)}`, {
      kind: 'rest',
      timeout: 10_000
    });
    return res.ok
      ? { ok: true, domains: asArray((res.json as any)?.domains) }
      : { ok: true, domains: [] };
  },

  'dns.listAuctions': async () => {
    const res = await readState('/lumen/dns/v1/auctions', { kind: 'rest', timeout: 10_000 });
    return res.ok ? { ok: true, auctions: asArray((res.json as any)?.auctions) } : { ok: true, auctions: [] };
  },

  /**
   * Priced from the chain's parameters, not from an endpoint - there is none.
   * See dns-price.ts for the arithmetic and why it lives apart.
   */
  'dns.estimateRegisterPrice': async (
    input: { name?: string; ext?: string; duration_days?: number } | string
  ) => {
    const res = await readState('/lumen/dns/v1/params', { kind: 'rest', timeout: 10_000 });
    if (!res.ok) return { ok: false, status: res.status, error: 'dns_params_unavailable' };

    const body = res.json as any;
    const params = body?.params ?? body ?? {};
    const { estimateRegisterPrice } = await import('./dns-price');
    return estimateRegisterPrice(params, input);
  }
};
