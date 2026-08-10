import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { stubElectron } from './support/electronStub';

/**
 * How `pqc:getAccount` reads the chain's answer for an address with no key.
 *
 * The chain reports it as `500 {"code":2,"message":"... not found: no pqc
 * record for lmn1..."}`, so the handler cannot go by status alone - it used to
 * check for 404 or 400 and consequently never recognised the case it was
 * written for. Under a PQC_POLICY_REQUIRED chain every new wallet is in that
 * state, so this is the common answer, not an edge.
 */

type Handler = (evt: unknown, arg: unknown) => Promise<any>;

const handlers = new Map<string, Handler>();
const realFetch = globalThis.fetch;

function answerWith(status: number, body: unknown) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' }
    })) as typeof fetch;
}

beforeEach(() => {
  handlers.clear();
  const stub = stubElectron({
    ipcMain: {
      handle: (channel: string, fn: Handler) => handlers.set(channel, fn),
      on: () => {},
      removeHandler: () => {}
    }
  });
  const chain = stub.load<{ registerChainIpc: () => void }>('ipc/chain.cjs');
  chain.registerChainIpc();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

async function getAccount(address = 'lmn1ndq47dk3yha8255s48ukxwa8ythfphqp4j4mxp') {
  const handler = handlers.get('pqc:getAccount');
  if (!handler) throw new Error('pqc:getAccount was never registered');
  return handler(null, address);
}

describe('pqc:getAccount', () => {
  it('reads the chain\'s 500 "no pqc record" as simply not linked', async () => {
    answerWith(500, {
      code: 2,
      message: 'codespace sdk code 38: not found: no pqc record for lmn1ndq47dk',
      details: []
    });
    expect(await getAccount()).toMatchObject({ ok: true, linked: false, account: null });
  });

  it('reads a plain 404 the same way', async () => {
    answerWith(404, { code: 5, message: 'not found' });
    expect(await getAccount()).toMatchObject({ ok: true, linked: false });
  });

  it('reports a linked account', async () => {
    answerWith(200, { account: { address: 'lmn1x', pub_key_hash: 'abc123', scheme: 'dilithium3' } });
    expect(await getAccount()).toMatchObject({ ok: true, linked: true });
  });

  it('keeps a broken node an error, rather than calling it unlinked', async () => {
    answerWith(500, { code: 13, message: 'internal error' });
    expect(await getAccount()).toMatchObject({ ok: false, status: 500 });
  });

  it('keeps a malformed address an error, so the mistake is visible', async () => {
    // It used to answer "not linked" to this, which is how a typo in an
    // address turns into a wallet that looks fine and cannot sign.
    answerWith(400, { code: 3, message: 'addr: decoding bech32 failed: invalid checksum' });
    expect(await getAccount('lmn1nonsense')).toMatchObject({ ok: false, status: 400 });
  });
});
