import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { stubElectron } from './support/electronStub';

/**
 * What happens when the PQC link is broadcast but cannot be read back.
 *
 * Peers on this network are allowed to run with transaction indexing off, and
 * the one asked to confirm a broadcast is deliberately not the one that
 * accepted it. When the confirming peer cannot read any transaction, the link
 * still went through - and the account record proves it, because it is state
 * rather than a transaction.
 *
 * Before this, that case threw, so the message the link was made for was never
 * sent: on the live chain, a new wallet's first transfer failed while the link
 * it had just paid for sat on-chain. The regression is expensive and silent,
 * hence the test.
 */

type PqcLink = {
  ensureOnChainPqcLink: (
    bridgeMod: unknown,
    client: unknown,
    address: string,
    record: unknown,
    label?: string
  ) => Promise<boolean>;
};

const ADDRESS = 'lmn1ndq47dk3yha8255s48ukxwa8ythfphqp4j4mxp';
const RECORD = { name: 'profile:p1', scheme: 'dilithium3', publicKey: new Uint8Array([1, 2, 3]) };

const realFetch = globalThis.fetch;
let linkedOnChain = false;

/** Answers like the chain: the account record exists, or it does not. */
function serveChain() {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/lumen/pqc/v1/accounts/')) {
      return linkedOnChain
        ? new Response(JSON.stringify({ account: { addr: ADDRESS, pub_key_hash: 'aGFzaA==' } }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        : new Response(JSON.stringify({ code: 2, message: 'not found: no pqc record' }), {
            status: 500,
            headers: { 'content-type': 'application/json' }
          });
    }
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
}

/**
 * A signing client that reaches the chain and then loses sight of it.
 *
 * No `sign` method on purpose: that is what routes the broadcast through
 * `signAndBroadcast` here instead of the peer pool, so the test decides the
 * outcome instead of the network.
 */
function clientThatFailsWith(message: string) {
  return {
    pqc: () => ({
      account: async () => {
        if (!linkedOnChain) throw new Error('no pqc record');
        return { account: { pubKeyHash: 'hash' } };
      },
      params: async () => ({ params: { pow_difficulty_bits: 0 } }),
      msgLinkAccountPqc: (addr: string) => ({ typeUrl: '/lumen.pqc.v1.MsgLinkAccountPqc', addr })
    }),
    signAndBroadcast: async () => {
      throw new Error(message);
    }
  };
}

let pqcLink: PqcLink;

beforeEach(() => {
  linkedOnChain = false;
  serveChain();
  pqcLink = stubElectron({ BrowserWindow: { getAllWindows: () => [] } }).load<PqcLink>(
    'utils/pqc_link.cjs'
  );
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('linking a PQC key when the broadcast cannot be confirmed', () => {
  it('accepts the link once the account record shows it landed', async () => {
    // Accepted by the chain, unreadable afterwards - the record is the proof.
    linkedOnChain = true;
    const client = clientThatFailsWith('transaction indexing is disabled');
    // The status check above uses the same flag, so make it report unlinked at
    // first: the record only appears once the link has been broadcast.
    client.pqc = (() => ({
      account: async () => {
        throw new Error('no pqc record');
      },
      params: async () => ({ params: { pow_difficulty_bits: 0 } }),
      msgLinkAccountPqc: (addr: string) => ({ typeUrl: '/lumen.pqc.v1.MsgLinkAccountPqc', addr })
    })) as never;

    await expect(pqcLink.ensureOnChainPqcLink(null, client, ADDRESS, RECORD, 'test')).resolves.toBe(
      true
    );
  });

  // Slow on purpose: it waits out the same 15s window a user would, which is
  // the only way to prove the recovery gives up instead of always answering
  // "linked". Shortening it would mean a seam in production code that exists
  // for the test.
  it(
    'still fails when the record never appears',
    async () => {
      // Unreadable *and* absent: nothing says the chain took it, so the caller
      // must not go on to sign the message the link was needed for.
      linkedOnChain = false;
      const client = clientThatFailsWith('transaction indexing is disabled');
      await expect(
        pqcLink.ensureOnChainPqcLink(null, client, ADDRESS, RECORD, 'test')
      ).rejects.toThrow(/indexing is disabled/);
    },
    30_000
  );

  it('lets any other broadcast failure through untouched', async () => {
    // Only the unreadable case is recoverable. A rejection is a rejection, and
    // checking the record for it would be an invitation to ignore real ones.
    linkedOnChain = false;
    const client = clientThatFailsWith('insufficient funds');
    await expect(
      pqcLink.ensureOnChainPqcLink(null, client, ADDRESS, RECORD, 'test')
    ).rejects.toThrow(/insufficient funds/);
  });
});
