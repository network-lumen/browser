import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { stubElectron } from './support/electronStub';

/**
 * The PQC dual-signer flow every signing path in the main process goes
 * through.
 *
 * It used to exist twice - once in `ipc/wallet.cjs`, once in
 * `ipc/gateway.cjs` - and the copies had drifted on the parts that decide
 * whether a transaction is broadcast at all. What is worth pinning here is the
 * shape of that decision: an address already linked on-chain must not pay for
 * a second link, an error the chain phrases as "insufficient funds" must reach
 * the user as the activation notice rather than raw chain text, and a key hash
 * must compare equal whether the chain returned it as hex or as base64.
 */

const HEX = 'a'.repeat(64);

function loadModule() {
  return stubElectron().load<any>('utils/pqc_link.cjs');
}

describe('normalizeHashString', () => {
  const { normalizeHashString } = loadModule();

  it('lowercases a hash the chain returned as hex', () => {
    expect(normalizeHashString(HEX.toUpperCase())).toBe(HEX);
  });

  it('decodes the same hash returned as base64', () => {
    const bytes = Buffer.from(HEX, 'hex');
    expect(normalizeHashString(bytes.toString('base64'))).toBe(HEX);
  });

  it('gives an empty string for nothing', () => {
    expect(normalizeHashString('')).toBe('');
    expect(normalizeHashString(null)).toBe('');
    expect(normalizeHashString(undefined)).toBe('');
  });
});

describe('sanitizePqcErrorMessage', () => {
  const { sanitizePqcErrorMessage, WALLET_ACTIVATION_TOOLTIP } = loadModule();

  it('turns every phrasing of "you have no funds" into the activation notice', () => {
    for (const raw of [
      'failed to execute message: insufficient funds',
      'account has less than min_balance_for_link',
      'requires at least 1000ulmn',
      'spendable balance 0ulmn is smaller than 1000ulmn',
    ]) {
      expect(sanitizePqcErrorMessage(raw)).toBe(WALLET_ACTIVATION_TOOLTIP);
    }
  });

  it('passes anything else through, trimmed', () => {
    expect(sanitizePqcErrorMessage('  tx timed out  ')).toBe('tx timed out');
    expect(sanitizePqcErrorMessage(null)).toBe('');
  });
});

describe('isPqcRelatedErrorText', () => {
  const { isPqcRelatedErrorText } = loadModule();

  it('recognises the chain rejecting an unlinked account', () => {
    expect(isPqcRelatedErrorText('codespace: pqc, code: 5')).toBe(true);
    expect(isPqcRelatedErrorText('pqc_policy_required')).toBe(true);
    expect(isPqcRelatedErrorText('no PQC key linked for account')).toBe(true);
    expect(isPqcRelatedErrorText('pqc key not found in local store')).toBe(true);
  });

  it('leaves unrelated failures alone, so they are not retried as link errors', () => {
    expect(isPqcRelatedErrorText('out of gas')).toBe(false);
    expect(isPqcRelatedErrorText('account sequence mismatch')).toBe(false);
    expect(isPqcRelatedErrorText('')).toBe(false);
  });
});

describe('resolvePqcHome', () => {
  const previous = process.env.LUMEN_PQC_HOME;

  afterEach(() => {
    if (previous === undefined) delete process.env.LUMEN_PQC_HOME;
    else process.env.LUMEN_PQC_HOME = previous;
  });

  it('prefers the override, so a test or a relocated profile never writes to the real one', () => {
    process.env.LUMEN_PQC_HOME = '/tmp/elsewhere';
    expect(loadModule().resolvePqcHome()).toBe('/tmp/elsewhere');
  });

  it('falls back to the app userData folder', () => {
    delete process.env.LUMEN_PQC_HOME;
    const stub = stubElectron();
    expect(stub.load<any>('utils/pqc_link.cjs').resolvePqcHome()).toBe(stub.userData);
  });
});

describe('ensureOnChainPqcLink', () => {
  let mod: any;

  beforeEach(() => {
    mod = loadModule();
  });

  const linkedClient = () => ({
    pqc: () => ({
      account: async () => ({ account: { pubKeyHash: HEX } }),
      msgLinkAccountPqc: () => ({ typeUrl: '/lumen.pqc.v1.MsgLinkAccountPqc' }),
    }),
  });

  it('does nothing without an address, a client or a key', async () => {
    await expect(mod.ensureOnChainPqcLink({}, null, '', null)).resolves.toBe(false);
    await expect(mod.ensureOnChainPqcLink({}, linkedClient(), 'lmn1abc', null)).resolves.toBe(false);
  });

  it('does not pay for a second link when the address is already linked', async () => {
    let broadcasts = 0;
    const client = {
      ...linkedClient(),
      signAndBroadcast: async () => {
        broadcasts += 1;
        return { code: 0 };
      },
    };
    const linked = await mod.ensureOnChainPqcLink({}, client, 'lmn1abc', {
      scheme: 'dilithium3',
      publicKey: new Uint8Array([1, 2, 3]),
    });
    expect(linked).toBe(false);
    expect(broadcasts).toBe(0);
  });
});

describe('signAndBroadcastWithPqcAutoLink', () => {
  const { signAndBroadcastWithPqcAutoLink } = loadModule();

  // A client with no `sign()` signs and broadcasts on its own rather than
  // going through the peer pool - the branch that keeps this testable without
  // a chain, and the one an older SDK build still takes.
  const client = (result: any) => ({
    pqc: () => ({ account: async () => ({ account: { pubKeyHash: HEX } }) }),
    signAndBroadcast: async () => result,
  });

  const call = (c: any) =>
    signAndBroadcastWithPqcAutoLink({
      bridgeMod: {},
      client: c,
      profileId: 'p1',
      address: 'lmn1abc',
      msgs: [{ typeUrl: '/cosmos.bank.v1beta1.MsgSend' }],
      fee: { amount: [], gas: '200000' },
      memo: '',
      label: 'test_send',
    });

  it('broadcasts straight through when the account is already linked', async () => {
    await expect(call(client({ code: 0, transactionHash: 'ABC' }))).resolves.toMatchObject({
      transactionHash: 'ABC',
    });
  });

  it('reports a rejected transaction with the chain log and its hash', async () => {
    await expect(
      call(client({ code: 11, rawLog: 'out of gas', transactionHash: 'DEF' }))
    ).rejects.toThrow('out of gas');
  });

  it('rewrites a link the chain refused for an empty wallet', async () => {
    const { WALLET_ACTIVATION_TOOLTIP } = loadModule();
    const record = {
      name: 'profile:p1',
      scheme: 'dilithium3',
      publicKey: new Uint8Array([1, 2, 3]),
      privateKey: new Uint8Array([4, 5, 6]),
    };
    const store = {
      getLink: () => 'profile:p1',
      getKey: () => record,
      listKeys: () => [record],
      linkAddress: async () => {},
    };
    const unlinked = {
      pqc: () => ({
        account: async () => ({ account: {} }),
        msgLinkAccountPqc: () => ({ typeUrl: '/lumen.pqc.v1.MsgLinkAccountPqc' }),
      }),
      signAndBroadcast: async () => ({ code: 5, rawLog: 'spendable balance 0ulmn is smaller' }),
    };

    // The real message is never built: the preflight links first, and the
    // link is what the chain refuses.
    await expect(
      signAndBroadcastWithPqcAutoLink({
        bridgeMod: { pqc: { PqcKeyStore: { open: async () => store } } },
        client: unlinked,
        profileId: 'p1',
        address: 'lmn1abc',
        msgs: [{ typeUrl: '/cosmos.bank.v1beta1.MsgSend' }],
        fee: { amount: [], gas: '200000' },
        memo: '',
        label: 'test_send',
      })
    ).rejects.toThrow(WALLET_ACTIVATION_TOOLTIP);
  });
});
