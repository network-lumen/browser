import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { stubElectron } from './support/electronStub';

/**
 * What a transaction that cannot be read back is reported as.
 *
 * Peers on this network may run with transaction indexing off, and the peer
 * asked to confirm a broadcast is deliberately not the one that accepted it.
 * When none of them can read the transaction, the app used to say it "may have
 * been sent" - and someone told that about a transfer sends it again. The
 * account sequence settles it: it is state, so it stays readable, and it moves
 * only if the transaction reached a block.
 *
 * The cost of getting this wrong is a second real transfer, so both directions
 * are pinned here.
 */

type Chain = {
  broadcastTx: (bytes: Uint8Array, options?: Record<string, unknown>) => Promise<any>;
};

const SENDER = 'lmn1ndq47dk3yha8255s48ukxwa8ythfphqp4j4mxp';
const realFetch = globalThis.fetch;

/** Sequence handed out on the next read; the test moves it to mean "included". */
let sequence = 7;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

/**
 * A network where every node is healthy and none of them can read a
 * transaction back - the exact shape of the live failure.
 */
function serveIndexingDisabledNetwork() {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (init?.method === 'POST') {
      // broadcast_tx_sync: accepted into the mempool.
      return json({ jsonrpc: '2.0', result: { code: 0, hash: 'DEADBEEF' } });
    }
    if (url.includes('/status')) {
      return json({
        result: { node_info: { network: 'lumen' }, sync_info: { latest_block_height: '4080000' } }
      });
    }
    if (url.includes('/tx?hash=')) {
      return json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal error', data: 'transaction indexing is disabled' }
      });
    }
    if (url.includes('/cosmos/auth/v1beta1/accounts/')) {
      return json({ account: { address: SENDER, sequence: String(sequence) } });
    }
    return json({});
  }) as typeof fetch;
}

let chain: Chain;

beforeEach(() => {
  sequence = 7;
  serveIndexingDisabledNetwork();
  chain = stubElectron().load<Chain>('chain/client.cjs');
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Short windows: the point is the verdict, not the waiting. */
const FAST = { confirmTimeoutMs: 1_000, pollIntervalMs: 250, settleTimeoutMs: 1_000 };

describe('a broadcast no peer can confirm', () => {
  it('reports it as included when the sequence advances', async () => {
    const bump = setTimeout(() => {
      sequence = 8;
    }, 300);
    try {
      const res = await chain.broadcastTx(Buffer.from('a1b2c3', 'hex'), {
        ...FAST,
        sender: SENDER
      });
      expect(res).toMatchObject({ ok: false, included: true, retrySafe: false });
    } finally {
      clearTimeout(bump);
    }
  });

  it('reports it as safe to retry when the sequence never moves', async () => {
    const res = await chain.broadcastTx(Buffer.from('a1b2c3', 'hex'), { ...FAST, sender: SENDER });
    expect(res).toMatchObject({ ok: false, included: false, retrySafe: true });
  });

  it('stays undecided when no sender was given, rather than guessing', async () => {
    // The old answer. A caller that cannot say who signed gets no verdict,
    // and the wording upstream stays the cautious one.
    const res = await chain.broadcastTx(Buffer.from('a1b2c3', 'hex'), FAST);
    expect(res.ok).toBe(false);
    expect(res.included).toBeUndefined();
    expect(res.retrySafe).toBeUndefined();
  });

  it('stays undecided when the account cannot be read at all', async () => {
    const inner = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('/cosmos/auth/')) return json({ code: 2, message: 'not found' }, 500);
      return inner(input as never, init as never);
    }) as typeof fetch;

    const res = await chain.broadcastTx(Buffer.from('a1b2c3', 'hex'), { ...FAST, sender: SENDER });
    expect(res.retrySafe).toBeUndefined();
  });
});

/**
 * The same verdict, on the path the app actually takes.
 *
 * broadcastTx only sees a transaction when the signing client exposes `sign()`
 * and the bytes go through the peer pool. The SDK's client does not, so every
 * wallet transfer falls back to its own signAndBroadcast - which reports the
 * unreadable failure with no verdict attached. Establishing it only in
 * broadcastTx would have fixed the branch nobody uses.
 */
describe('a wallet transaction no peer can confirm', () => {
  type PqcLink = {
    signAndBroadcastWithPqcAutoLink: (args: Record<string, unknown>) => Promise<unknown>;
  };

  /** Already linked, and unable to broadcast readably. No `sign` on purpose. */
  function client() {
    return {
      pqc: () => ({
        account: async () => ({ account: { pubKeyHash: 'hash' } }),
        params: async () => ({ params: {} })
      }),
      signAndBroadcast: async () => {
        throw new Error('transaction indexing is disabled');
      }
    };
  }

  async function attempt() {
    const pqcLink = stubElectron({ BrowserWindow: { getAllWindows: () => [] } }).load<PqcLink>(
      'utils/pqc_link.cjs'
    );
    return pqcLink
      .signAndBroadcastWithPqcAutoLink({
        bridgeMod: null,
        client: client(),
        profileId: 'p1',
        address: SENDER,
        msgs: [{ typeUrl: '/cosmos.bank.v1beta1.MsgSend', value: {} }],
        fee: { amount: [], gas: '250000' },
        memo: '',
        label: 'test'
      })
      .then(
        () => null,
        (e) => e as Error & { retrySafe?: boolean; included?: boolean }
      );
  }

  // Only the included case, and deliberately: the opposite one would sit
  // through the whole 20s window this path allows a block, and it is the same
  // `retrySafe = !included` either way - pinned above, where the window is an
  // option and the test is instant.
  it('marks it included once the sequence moves, so nobody sends it twice', async () => {
    const bump = setTimeout(() => {
      sequence = 8;
    }, 300);
    try {
      expect(await attempt()).toMatchObject({ included: true, retrySafe: false });
    } finally {
      clearTimeout(bump);
    }
  });
});
