import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Browsing history, and the one thing it has to get right: what counts as the
 * same page.
 *
 * A CID has two spellings - the v0 `Qm…` form and the v1 base32 form - and the
 * same content reached through either would otherwise appear twice in history
 * and never match a favourite. `normalizeHistoryUrlForComparison` folds them
 * together, through the main process, in the three shapes a CID can arrive in:
 * a lumen://ipfs address, a /ipfs/ path on a gateway, and a subdomain gateway
 * host.
 *
 * The conversion is the app's, not this test's: it is asked of
 * `window.lumen.ipfsCidToBase32`, so the tests below stub that and assert the
 * URL that comes back out.
 */

const V0 = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';
const V1 = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';

function stubBridge(convert?: (cid: string) => string | null) {
  (globalThis as any).window = (globalThis as any).window || {};
  (globalThis as any).window.lumen = {
    ipfsCidToBase32: vi.fn(async (cid: string) => {
      const next = convert ? convert(cid) : null;
      return next ? { cid: next } : null;
    })
  };
}

async function loadStore() {
  vi.resetModules();
  return import('../../src/stores/historyStore');
}

beforeEach(() => {
  localStorage.clear();
  delete (globalThis as any).window?.lumen;
});

describe('folding the two spellings of a CID together', () => {
  it('rewrites a v0 CID in a lumen://ipfs address', async () => {
    stubBridge((cid) => (cid === V0 ? V1 : null));
    const { normalizeHistoryUrlForComparison } = await loadStore();
    expect(await normalizeHistoryUrlForComparison(`lumen://ipfs/${V0}/index.html`)).toBe(
      `lumen://ipfs/${V1}/index.html`
    );
  });

  it('rewrites a v0 CID in a gateway path', async () => {
    stubBridge((cid) => (cid === V0 ? V1 : null));
    const { normalizeHistoryUrlForComparison } = await loadStore();
    expect(await normalizeHistoryUrlForComparison(`http://127.0.0.1:8080/ipfs/${V0}/a.txt`)).toBe(
      `http://127.0.0.1:8080/ipfs/${V1}/a.txt`
    );
  });

  it('leaves a subdomain gateway host alone, because a v0 CID cannot be one', async () => {
    // Recorded rather than folded: hostnames are case-insensitive and the URL
    // parser lowercases them, while a v0 CID is case-sensitive base58. `Qm…`
    // never reaches `url.hostname` intact, which is why Kubo's subdomain
    // gateway serves v1 only. A branch that tried to convert here was dead.
    stubBridge((cid) => (cid === V0 ? V1 : null));
    const { normalizeHistoryUrlForComparison } = await loadStore();
    const url = `http://${V1}.ipfs.localhost:8080/`;
    expect(await normalizeHistoryUrlForComparison(url)).toBe(url);
  });

  it('leaves a CID that is already v1 alone', async () => {
    const convert = vi.fn(() => null);
    stubBridge(convert);
    const { normalizeHistoryUrlForComparison } = await loadStore();
    const url = `lumen://ipfs/${V1}/`;
    expect(await normalizeHistoryUrlForComparison(url)).toBe(url);
  });

  it('keeps the original url when the main process cannot convert', async () => {
    // Node down, bridge missing: history still has to record something, and a
    // wrong rewrite would be worse than an unfolded duplicate.
    stubBridge(() => null);
    const { normalizeHistoryUrlForComparison } = await loadStore();
    expect(await normalizeHistoryUrlForComparison(`lumen://ipfs/${V0}/`)).toBe(
      `lumen://ipfs/${V0}/`
    );
  });

  it('survives no bridge at all', async () => {
    const { normalizeHistoryUrlForComparison } = await loadStore();
    await expect(normalizeHistoryUrlForComparison(`lumen://ipfs/${V0}/`)).resolves.toContain(V0);
  });
});

describe('urls that are not IPFS', () => {
  it('passes an ordinary page through untouched', async () => {
    stubBridge(() => V1);
    const { normalizeHistoryUrlForComparison } = await loadStore();
    expect(await normalizeHistoryUrlForComparison('https://example.test/a?b=1')).toBe(
      'https://example.test/a?b=1'
    );
  });

  it('gives an empty string for nothing', async () => {
    const { normalizeHistoryUrlForComparison } = await loadStore();
    expect(await normalizeHistoryUrlForComparison('')).toBe('');
    expect(await normalizeHistoryUrlForComparison('   ')).toBe('');
  });

  it('does not ask the main process about a page with no CID in it', async () => {
    stubBridge(() => V1);
    const { normalizeHistoryUrlForComparison } = await loadStore();
    await normalizeHistoryUrlForComparison('https://example.test/');
    expect((globalThis as any).window.lumen.ipfsCidToBase32).not.toHaveBeenCalled();
  });
});
