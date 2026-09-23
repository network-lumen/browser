import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Giving a mobile wallet its Dilithium key before it needs one.
 *
 * The chain refuses any transaction whose post-quantum half is missing, so an
 * address that has never been linked cannot buy a domain, send tokens, or do
 * anything else - it meets "No PQC key linked to lmn1…. Import and link a
 * Dilithium key first" on its first action. The desktop links in the
 * background and the user never sees that sentence; this is the same flow, and
 * these tests pin the decisions it gets wrong most easily.
 */
const store = new Map<string, string>();

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: store.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => void store.set(key, value),
    remove: async ({ key }: { key: string }) => void store.delete(key),
    keys: async () => ({ keys: [...store.keys()] })
  }
}));

const ADDRESS = 'lmn1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';

/** What the chain is asked, and what it answers. */
const chain = {
  linked: false,
  powBits: 0 as unknown,
  nodeBroken: false,
  reads: [] as string[]
};

/**
 * The chain's real answers, including the awkward one.
 *
 * An address with no key is not a 404: the node replies
 * `500 {"code":2,"message":"…not found: no pqc record for lmn1…"}`. And the
 * record carries `pub_key_hash` - the chain keeps a hash, never the key.
 * Serving anything tidier here would let the mistakes this file exists to
 * catch pass unnoticed.
 */
vi.mock('../../platform/mobile/impl/network', () => ({
  readState: async (path: string) => {
    chain.reads.push(path);
    if (path.includes('/params')) {
      return { ok: true, status: 200, json: { params: { pow_difficulty_bits: chain.powBits } } };
    }
    if (chain.nodeBroken) return { ok: false, status: 502, text: 'Bad Gateway' };
    if (chain.linked) {
      return {
        ok: true,
        status: 200,
        json: { account: { addr: ADDRESS, scheme: 'dilithium3', pub_key_hash: 'SGFzaA==' } }
      };
    }
    return {
      ok: false,
      status: 500,
      json: { code: 2, message: `codespace sdk code 38: not found: no pqc record for ${ADDRESS}` }
    };
  }
}));

const PUBLIC_KEY_BYTES = 1952;
const PRIVATE_KEY_BYTES = 4000;

const sdkCalls = { created: 0, pow: [] as unknown[][] };

vi.mock('@lumen-chain/sdk', () => ({
  default: {
    pqc: {
      // Raw bytes, at Dilithium3's exact sizes - that is what the real
      // `createKeyPair` returns, and those sizes are what the signer checks.
      createKeyPair: async () => {
        sdkCalls.created += 1;
        return {
          publicKey: new Uint8Array(PUBLIC_KEY_BYTES).fill(sdkCalls.created),
          privateKey: new Uint8Array(PRIVATE_KEY_BYTES).fill(100 + sdkCalls.created)
        };
      },
      computePowNonce: async (...args: unknown[]) => {
        sdkCalls.pow.push(args);
        return new Uint8Array([7]);
      }
    }
  }
}));

const { ensurePqcLinked, isPqcError } = await import('../../platform/mobile/impl/pqc-link');
const { PROFILE_MEMBERS } = await import('../../platform/mobile/impl/profiles');
const storage = await import('../../platform/mobile/impl/storage');
const security = await import('../../platform/mobile/impl/security');


/** A client that records what it was asked to broadcast. */
function fakeClient() {
  const sent: any[][] = [];
  return {
    sent,
    // The snapshot handed over at connect time, taken before any of this ran.
    pqcConfig: { enabled: true, store: { stale: true } as any },
    pqcStore: { stale: true } as any,
    pqc: () => ({
      msgLinkAccountPqc: (creator: string, body: any) => ({
        typeUrl: '/lumen.pqc.v1.MsgLinkAccountPqc',
        value: { creator, ...body }
      })
    }),
    signAndBroadcast: async (_addr: string, msgs: any[]) => {
      sent.push(msgs);
      return { code: 0, transactionHash: 'HASH', height: 1 };
    }
  };
}

describe('linking a Dilithium key on mobile', () => {
  beforeEach(() => {
    store.clear();
    // The session password outlives the preferences map, so one test that
    // unlocks the wallet would leave every later one unlocked.
    security.clearSession();
    chain.linked = false;
    chain.powBits = 0;
    chain.nodeBroken = false;
    chain.reads = [];
    sdkCalls.created = 0;
    sdkCalls.pow = [];
  });

  it('mints a key, warns about the backup, and links it', async () => {
    const seen: any[] = [];
    PROFILE_MEMBERS['profiles.onPqcLinked']((payload: unknown) => seen.push(payload));

    const client = fakeClient();
    await ensurePqcLinked(client, 'p1', ADDRESS);

    expect(sdkCalls.created).toBe(1);
    expect(seen).toEqual([{ profileId: 'p1', address: ADDRESS }]);
    expect(client.sent).toHaveLength(1);
    expect(client.sent[0][0].typeUrl).toBe('/lumen.pqc.v1.MsgLinkAccountPqc');

    // On disk, so the next launch finds it rather than minting a second one.
    const links = await storage.readDoc<Record<string, string>>('pqc_keys/links.json');
    expect(links?.[ADDRESS]).toBe('profile:p1');
  });

  /**
   * The format on each side of the file, which is what broke the purchase.
   *
   * `keys.json` holds base64, because that is what the desktop's SDK key store
   * writes and a backup has to cross between the two. The message wants bytes.
   * An earlier version wrote `String(uint8array)` - "1,1,1,…" - into the file
   * and passed the same string to the message, and the encoder answered
   * "invalid base64 string format".
   */
  it('stores the key as base64 and sends it as bytes', async () => {
    const client = fakeClient();
    await ensurePqcLinked(client, 'p1', ADDRESS);

    const keys = await storage.readDoc<Record<string, any>>('pqc_keys/keys.json');
    const stored = keys?.['profile:p1'];
    expect(typeof stored.publicKey).toBe('string');
    expect(stored.publicKey).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(atob(stored.publicKey)).toHaveLength(PUBLIC_KEY_BYTES);
    expect(atob(stored.privateKey)).toHaveLength(PRIVATE_KEY_BYTES);

    const sent = client.sent[0][0].value;
    expect(sent.pubKey).toBeInstanceOf(Uint8Array);
    expect(sent.pubKey).toHaveLength(PUBLIC_KEY_BYTES);
  });

  /**
   * A phone that already ran the broken build has "1,1,1,…" sitting in its key
   * file. Trusting it would fail the same way on every future attempt, so it is
   * replaced - the chain never accepted it, so nothing is lost with it.
   */
  it('replaces a key the broken build left behind', async () => {
    await storage.writeDoc('pqc_keys/links.json', { [ADDRESS]: 'profile:p1' });
    await storage.writeDoc('pqc_keys/keys.json', {
      'profile:p1': {
        name: 'profile:p1',
        scheme: 'dilithium3',
        publicKey: String(new Uint8Array(PUBLIC_KEY_BYTES).fill(9)),
        privateKey: String(new Uint8Array(PRIVATE_KEY_BYTES).fill(9))
      }
    });

    const client = fakeClient();
    await ensurePqcLinked(client, 'p1', ADDRESS);

    expect(sdkCalls.created).toBe(1);
    const keys = await storage.readDoc<Record<string, any>>('pqc_keys/keys.json');
    expect(atob(keys?.['profile:p1'].publicKey)).toHaveLength(PUBLIC_KEY_BYTES);
  });

  /**
   * Unless the chain already committed to a key for this address. Minting
   * another one would add a mismatch on top of an unreadable file, and only
   * the backup can put that right.
   */
  it('refuses to replace an unreadable key the chain is already committed to', async () => {
    chain.linked = true;
    await storage.writeDoc('pqc_keys/links.json', { [ADDRESS]: 'profile:p1' });
    await storage.writeDoc('pqc_keys/keys.json', {
      'profile:p1': { name: 'profile:p1', scheme: 'dilithium3', publicKey: 'x', privateKey: 'y' }
    });

    await expect(ensurePqcLinked(fakeClient(), 'p1', ADDRESS)).rejects.toThrow(
      /import_backup/
    );
    expect(sdkCalls.created).toBe(0);
  });

  /**
   * The bug this file exists for.
   *
   * Clearing `client.pqcStore` looks like enough - it is the cache the SDK
   * reads. It is not: the SDK rebuilds that cache from `pqcConfig.store`, the
   * snapshot passed at connect time, taken before this key existed. Refresh
   * only the cache and the signer looks straight past the key just written,
   * then fails with the very error this function exists to prevent.
   */
  it('shows the new key to the client that is about to sign with it', async () => {
    const client = fakeClient();
    await ensurePqcLinked(client, 'p1', ADDRESS);

    for (const pqcStore of [client.pqcStore, client.pqcConfig.store]) {
      expect(pqcStore.stale).toBeUndefined();
      expect(pqcStore.getLink(ADDRESS)).toBe('profile:p1');
      const key = pqcStore.getKey('profile:p1');
      expect(key.scheme).toBe('dilithium3');
      // Bytes, at the length the signer measures - a base64 string would be
      // 2604 characters and rejected as "incompatible with Dilithium3".
      expect(key.privateKey).toBeInstanceOf(Uint8Array);
      expect(key.privateKey).toHaveLength(PRIVATE_KEY_BYTES);
      expect(key.publicKey).toHaveLength(PUBLIC_KEY_BYTES);
    }
  });

  it('does not pay for a second link when the chain already knows the address', async () => {
    chain.linked = true;

    const client = fakeClient();
    await ensurePqcLinked(client, 'p1', ADDRESS);

    expect(sdkCalls.created).toBe(1);
    expect(client.sent).toHaveLength(0);
  });

  it('reuses the key it already has, and stays silent about a backup', async () => {
    await ensurePqcLinked(fakeClient(), 'p1', ADDRESS);

    const seen: any[] = [];
    PROFILE_MEMBERS['profiles.onPqcLinked']((payload: unknown) => seen.push(payload));
    chain.linked = true;

    await ensurePqcLinked(fakeClient(), 'p1', ADDRESS);
    expect(sdkCalls.created).toBe(1);
    expect(seen).toEqual([]);
  });

  it('mines no proof of work when the chain asks for none', async () => {
    // `pow_difficulty_bits` ships at 0 on purpose. A `||` read would turn that
    // deliberate zero into a fallback and mine a proof nobody asked for.
    await ensurePqcLinked(fakeClient(), 'p1', ADDRESS);
    expect(sdkCalls.pow).toEqual([]);
  });

  it('mines over the address, not just the key, when the chain asks for work', async () => {
    chain.powBits = 8;
    await ensurePqcLinked(fakeClient(), 'p1', ADDRESS);

    // The digest the chain checks is sha256(creator || "|" || pubKey || nonce):
    // mining without the address yields a nonce it refuses, and the refusal
    // names the proof rather than the address it is missing.
    expect(sdkCalls.pow).toHaveLength(1);
    expect(sdkCalls.pow[0][0]).toBe(ADDRESS);
    expect(sdkCalls.pow[0][2]).toBe(8);
  });

  it('leaves a sealed key file alone while the session is locked', async () => {
    // Without the password the file cannot be read, and a second key written
    // next to it would strand everything already inside.
    await storage.writeDoc('pqc_keys/keys.json', { crypto: { cipher: 'aes-256-gcm' } });

    const client = fakeClient();
    await ensurePqcLinked(client, 'p1', ADDRESS);

    expect(sdkCalls.created).toBe(0);
    expect(client.sent).toHaveLength(0);
  });

  /**
   * With the session open, a password is no reason to refuse the key - the
   * wallet would be permanently unable to sign, which is exactly what the
   * password is not supposed to cost. The file goes back sealed.
   */
  it('mints into a sealed file when the session is open, and re-seals it', async () => {
    const { SECURITY_MEMBERS } = await import('../../platform/mobile/impl/security');
    const { encryptWithPassword, decryptWithPassword } = await import(
      '../../platform/mobile/impl/crypto'
    );

    const password = 'correct horse battery';
    await SECURITY_MEMBERS['security.setPassword']({ password });
    await storage.writeDoc(
      'pqc_keys/keys.json',
      await encryptWithPassword(JSON.stringify({}), password)
    );

    await ensurePqcLinked(fakeClient(), 'p1', ADDRESS);
    expect(sdkCalls.created).toBe(1);

    const raw = await storage.readDoc<any>('pqc_keys/keys.json');
    expect(raw.crypto, 'the file is still sealed').toBeTruthy();

    const keys = JSON.parse(await decryptWithPassword(raw, password));
    expect(atob(keys['profile:p1'].publicKey)).toHaveLength(PUBLIC_KEY_BYTES);
  });
});

describe('recognising a PQC refusal', () => {
  it('matches how the chain phrases an unlinked account', () => {
    expect(isPqcError('No PQC key linked to lmn1abc. Import and link a Dilithium key first')).toBe(
      true
    );
    expect(isPqcError('post-quantum signature missing')).toBe(true);
  });

  it('leaves unrelated failures alone, so they are not retried as link errors', () => {
    expect(isPqcError('insufficient funds')).toBe(false);
    expect(isPqcError('account sequence mismatch')).toBe(false);
  });
});

/**
 * The account query, which answered "not linked" to everything.
 *
 * Two independent mistakes, each silent on its own. The path was
 * `/lumen/pqc/v1/account/…` - singular - which is a registered route that
 * returns `501 Not Implemented` for every address, so nothing ever threw and
 * every wallet looked unlinked. And the field read was `pub_key`, which the
 * chain never sends: it stores `pub_key_hash`. Either one alone would have
 * been enough to make the app re-link an account that was already linked.
 */
describe('reading what the chain holds for an address', () => {
  beforeEach(() => {
    chain.linked = false;
    chain.nodeBroken = false;
    chain.reads = [];
  });

  it('asks the plural path, the only one the node implements', async () => {
    const { readPqcAccount } = await import('../../platform/mobile/impl/pqc-link');
    await readPqcAccount(ADDRESS);

    expect(chain.reads[0]).toBe(`/lumen/pqc/v1/accounts/${ADDRESS}`);
  });

  it('reads the hash the chain actually sends', async () => {
    chain.linked = true;
    const { readPqcAccount } = await import('../../platform/mobile/impl/pqc-link');

    const res = await readPqcAccount(ADDRESS);
    expect(res).toMatchObject({ ok: true, linked: true });
    expect(res.account).toMatchObject({ scheme: 'dilithium3', pub_key_hash: 'SGFzaA==' });
  });

  it('reads a 500 that says "no pqc record" as an unlinked account', async () => {
    const { readPqcAccount } = await import('../../platform/mobile/impl/pqc-link');

    // Not a 404, which is what makes this worth pinning.
    expect(await readPqcAccount(ADDRESS)).toEqual({ ok: true, linked: false, account: null });
  });

  it('does not call a broken node an unlinked account', async () => {
    chain.nodeBroken = true;
    const { readPqcAccount } = await import('../../platform/mobile/impl/pqc-link');

    // "ok: false" and "linked: false" are different answers: one says the
    // account has no key, the other says nobody could tell.
    expect(await readPqcAccount(ADDRESS)).toMatchObject({ ok: false, status: 502 });
  });
});
