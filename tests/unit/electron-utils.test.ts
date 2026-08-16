import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const { safeString } = require_('../../electron/utils/strings.cjs');
const { runWithRpcRetry } = require_('../../electron/utils/tx.cjs');
const crx = require_('../../electron/extensions/crx.cjs');

/**
 * The small main-process helpers that everything else leans on.
 *
 * `safeString` is the coercion at every boundary the main process does not
 * control, and its cap matters as much as its trim: an unbounded string from a
 * site or an extension ends up in a log line, a map key or a dialog. The RPC
 * retry is narrower than it looks - it must repeat a dropped socket and
 * nothing else, because repeating a rejected transaction is a second attempt
 * to spend. And the store id parser decides which extension gets downloaded.
 */

describe('safeString', () => {
  it('trims and gives an empty string for anything unusable', () => {
    expect(safeString('  spaced  ')).toBe('spaced');
    expect(safeString(null)).toBe('');
    expect(safeString(undefined)).toBe('');
    expect(safeString('   ')).toBe('');
  });

  it('caps at 2048 by default', () => {
    expect(safeString('x'.repeat(5000))).toHaveLength(2048);
  });

  it('honours a tighter cap', () => {
    expect(safeString('abcdef', 3)).toBe('abc');
  });

  it('stringifies non-strings rather than rejecting them', () => {
    expect(safeString(42)).toBe('42');
    expect(safeString(false)).toBe('false');
    expect(safeString(0)).toBe('0');
  });

  it('matches the renderer’s copy on the cases that cross between them', () => {
    // The two are separate implementations by necessity - a sandboxed preload
    // cannot require a local file - so the shared cases are worth stating.
    expect(safeString('  a  ')).toBe('a');
    expect(safeString('')).toBe('');
  });
});

describe('runWithRpcRetry', () => {
  it('returns the first success without retrying', async () => {
    const action = vi.fn(async () => 'done');
    await expect(runWithRpcRetry(action, 'test')).resolves.toBe('done');
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('retries a dropped socket', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    let calls = 0;
    const action = vi.fn(async () => {
      calls += 1;
      if (calls < 3) throw new Error('UND_ERR_SOCKET');
      return 'done';
    });
    await expect(runWithRpcRetry(action, 'test', 3, 0)).resolves.toBe('done');
    expect(action).toHaveBeenCalledTimes(3);
  });

  it('recognises the dropped socket under its cause as well as its message', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    let calls = 0;
    const action = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        const err: any = new Error('fetch failed');
        err.cause = { code: 'UND_ERR_SOCKET' };
        throw err;
      }
      return 'done';
    });
    await expect(runWithRpcRetry(action, 'test', 3, 0)).resolves.toBe('done');
  });

  it('does not retry anything else', async () => {
    // Repeating a rejected transaction is a second attempt to spend.
    const action = vi.fn(async () => { throw new Error('insufficient funds'); });
    await expect(runWithRpcRetry(action, 'test', 3, 0)).rejects.toThrow('insufficient funds');
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('gives up after its budget and rethrows the last failure', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const action = vi.fn(async () => { throw new Error('UND_ERR_SOCKET'); });
    await expect(runWithRpcRetry(action, 'test', 3, 0)).rejects.toThrow('UND_ERR_SOCKET');
    expect(action).toHaveBeenCalledTimes(3);
  });
});

describe('extractChromeWebStoreId', () => {
  const ID = 'abcdefghijklmnopabcdefghijklmnop';

  it('reads a bare id', () => {
    expect(crx.extractChromeWebStoreId(ID)).toBe(ID);
  });

  it('lowercases it, since the id is used as a folder name', () => {
    expect(crx.extractChromeWebStoreId(ID.toUpperCase())).toBe(ID);
  });

  it('reads it out of a store URL', () => {
    expect(crx.extractChromeWebStoreId(`https://chromewebstore.google.com/detail/some-name/${ID}`)).toBe(ID);
  });

  it('refuses anything that is not an extension id', () => {
    // The alphabet is a-p only; a 32-char hex string is not an extension id.
    for (const junk of ['', '   ', 'not-an-id', 'z'.repeat(32), '0123456789abcdef0123456789abcdef']) {
      expect(() => crx.extractChromeWebStoreId(junk)).toThrow();
    }
  });
});

describe('the CRX download URLs', () => {
  const ID = 'abcdefghijklmnopabcdefghijklmnop';

  it('all target the same extension', () => {
    for (const url of crx.buildCrxDownloadCandidates(ID)) {
      expect(url).toContain(encodeURIComponent(ID));
      expect(url).toContain('acceptformat=crx3');
    }
  });

  it('offers several spellings, because the endpoint is picky about them', () => {
    expect(new Set(crx.buildCrxDownloadCandidates(ID)).size).toBeGreaterThan(1);
  });

  it('refuses to build a URL for a bad id rather than requesting one', () => {
    expect(() => crx.buildCrxDownloadUrl('not-an-id')).toThrow();
  });
});

describe('stripCrxHeader', () => {
  it('refuses a buffer too short to be a CRX', () => {
    expect(() => crx.stripCrxHeader(Buffer.alloc(4))).toThrow();
  });

  it('refuses a version it does not know', () => {
    const buf = Buffer.alloc(32);
    buf.write('Cr24', 0, 'ascii');
    buf.writeUInt32LE(9, 4);
    expect(() => crx.stripCrxHeader(buf)).toThrow(/unsupported_crx_version/);
  });

  it('returns the zip that follows a v3 header', () => {
    const header = Buffer.from('HEADER');
    const zip = Buffer.from('PK\x03\x04rest');
    const buf = Buffer.concat([
      Buffer.from('Cr24', 'ascii'),
      (() => { const b = Buffer.alloc(4); b.writeUInt32LE(3, 0); return b; })(),
      (() => { const b = Buffer.alloc(4); b.writeUInt32LE(header.length, 0); return b; })(),
      header,
      zip,
    ]);
    expect(crx.stripCrxHeader(buf).equals(zip)).toBe(true);
  });

  it('refuses a header that claims to run past the end of the file', () => {
    const buf = Buffer.alloc(20);
    buf.write('Cr24', 0, 'ascii');
    buf.writeUInt32LE(3, 4);
    buf.writeUInt32LE(0xffffff, 8);
    expect(() => crx.stripCrxHeader(buf)).toThrow(/invalid_crx_v3_header/);
  });
});

describe('verifyCrxArchive', () => {
  it('refuses anything that is not a CRX before looking at a signature', () => {
    expect(() => crx.verifyCrxArchive(Buffer.alloc(4))).toThrow(/invalid_crx_archive/);
    expect(() => crx.verifyCrxArchive(Buffer.alloc(64))).toThrow(/invalid_crx_magic/);
  });

  it('refuses CRX2, which has no signature format worth trusting', () => {
    const buf = Buffer.alloc(64);
    buf.write('Cr24', 0, 'ascii');
    buf.writeUInt32LE(2, 4);
    expect(() => crx.verifyCrxArchive(buf)).toThrow(/unsupported_crx_version/);
  });

  it('refuses a v3 header with nothing in it', () => {
    const buf = Buffer.alloc(64);
    buf.write('Cr24', 0, 'ascii');
    buf.writeUInt32LE(3, 4);
    buf.writeUInt32LE(0, 8);
    expect(() => crx.verifyCrxArchive(buf)).toThrow(/invalid_crx_v3_header/);
  });
});
