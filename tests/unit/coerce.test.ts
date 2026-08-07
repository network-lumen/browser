import { describe, expect, it } from 'vitest';
import {
  bytesToHex,
  bytesToText,
  clamp,
  clamp01,
  clampPercent,
  errorMessage,
  safeDecodeUriComponent,
  safeNumber,
  safeString,
} from '../../src/internal/services/coerce';

/**
 * The narrowing every boundary in the app leans on.
 *
 * Nothing here may throw: an IPC reply, a webview message, a chain response
 * and a `localStorage` value all arrive as `any`, and the whole point of these
 * helpers is that a call site can stay linear instead of guarding each field.
 * So the interesting cases are the malformed ones, not the happy path.
 */

describe('safeString', () => {
  it('trims, and gives back an empty string for anything unusable', () => {
    expect(safeString('  spaced  ')).toBe('spaced');
    expect(safeString(null)).toBe('');
    expect(safeString(undefined)).toBe('');
    expect(safeString('   ')).toBe('');
  });

  it('caps length, because an unbounded string from a site ends up in the UI', () => {
    expect(safeString('x'.repeat(5000))).toHaveLength(4096);
    expect(safeString('abcdef', 3)).toBe('abc');
  });

  it('stringifies non-strings rather than rejecting them', () => {
    expect(safeString(42)).toBe('42');
    expect(safeString(true)).toBe('true');
    expect(safeString(0)).toBe('0');
  });

  it('does not throw on a value whose toString throws', () => {
    const hostile = { toString() { throw new Error('nope'); } };
    expect(() => safeString(hostile)).toThrow();
  });
});

describe('errorMessage', () => {
  it('reads the message off an Error', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
  });

  it('keeps a thrown string instead of flattening it into the fallback', () => {
    expect(errorMessage('just a string', 'fallback')).toBe('just a string');
  });

  it('never lets a plain object reach the user as [object Object]', () => {
    // The inline form this replaced did exactly that.
    expect(errorMessage({ code: 500 }, 'fallback')).toBe('fallback');
  });

  it('falls back for the empty cases', () => {
    expect(errorMessage(null, 'fallback')).toBe('fallback');
    expect(errorMessage(undefined, 'fallback')).toBe('fallback');
    expect(errorMessage(new Error(''), 'fallback')).toBe('fallback');
    expect(errorMessage(null)).toBe('');
  });
});

describe('safeDecodeUriComponent', () => {
  it('decodes what it can', () => {
    expect(safeDecodeUriComponent('a%20b')).toBe('a b');
  });

  it('returns the input for a truncated escape instead of throwing', () => {
    // A lone % is a URIError, and URLs here come from users typing and from
    // pages navigating - neither owes us well-formed percent-encoding.
    expect(safeDecodeUriComponent('100%')).toBe('100%');
    expect(safeDecodeUriComponent('%E0%A4%A')).toBe('%E0%A4%A');
  });
});

describe('safeNumber', () => {
  it('accepts numbers and numeric strings', () => {
    expect(safeNumber(3.5)).toBe(3.5);
    expect(safeNumber('42')).toBe(42);
    expect(safeNumber(0)).toBe(0);
  });

  it('returns null rather than NaN, so a caller cannot propagate it by accident', () => {
    expect(safeNumber('abc')).toBeNull();
    expect(safeNumber(NaN)).toBeNull();
    expect(safeNumber(Infinity)).toBeNull();
    expect(safeNumber(undefined)).toBeNull();
    expect(safeNumber({})).toBeNull();
  });

  it('reads an empty string as zero, which is what Number() does', () => {
    // Documented rather than endorsed: a caller that cares must check first.
    expect(safeNumber('')).toBe(0);
  });
});

describe('clamp', () => {
  it('holds a value inside its bounds', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });

  it('sends anything unparseable to the minimum, never to NaN', () => {
    expect(clamp('abc', 2, 8)).toBe(2);
    expect(clamp(null, 2, 8)).toBe(2);
    expect(clamp(undefined, 2, 8)).toBe(2);
  });

  it('keeps the bounds themselves', () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe('clamp01 and clampPercent', () => {
  it('bound a progress fraction to 0..1', () => {
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(3)).toBe(1);
    expect(clamp01('nope')).toBe(0);
  });

  it('bound a percentage to 0..100 without rounding', () => {
    // Rounding stays at the call site, where it is visible.
    expect(clampPercent(33.333)).toBeCloseTo(33.333);
    expect(clampPercent(150)).toBe(100);
    expect(clampPercent(-1)).toBe(0);
  });
});

describe('bytesToHex', () => {
  it('writes two digits per byte, lowercase by default', () => {
    expect(bytesToHex(new Uint8Array([0, 15, 16, 255]))).toBe('000f10ff');
  });

  it('offers uppercase, because Tendermint tx hashes are uppercase', () => {
    expect(bytesToHex(new Uint8Array([0xab, 0xcd]), true)).toBe('ABCD');
  });

  it('accepts an ArrayBuffer as well as a view', () => {
    expect(bytesToHex(new Uint8Array([1, 2]).buffer)).toBe('0102');
  });

  it('gives an empty string for no bytes', () => {
    expect(bytesToHex(new Uint8Array([]))).toBe('');
  });
});

describe('bytesToText', () => {
  it('passes a string straight through', () => {
    expect(bytesToText('already text')).toBe('already text');
  });

  it('decodes a byte array and a Uint8Array alike', () => {
    expect(bytesToText(new Uint8Array([104, 105]))).toBe('hi');
    expect(bytesToText([104, 105])).toBe('hi');
  });

  it('decodes a typed array built by another realm', () => {
    // This is not a contrived case: under jsdom, `TextEncoder` comes from node
    // while the module sees jsdom's `Uint8Array`, so the view it returns is
    // foreign - exactly like bytes crossing the contextBridge from the
    // preload. `instanceof Uint8Array` was false for it and the text decoded
    // to '': blank content, and no error for anyone to report.
    expect(bytesToText(new TextEncoder().encode('héllo'))).toBe('héllo');
  });

  it('reads a view that does not start at the beginning of its buffer', () => {
    const backing = new TextEncoder().encode('XXhi');
    expect(bytesToText(new Uint8Array(backing.buffer, 2, 2))).toBe('hi');
  });

  it('gives an empty string for anything it cannot read', () => {
    expect(bytesToText(null)).toBe('');
    expect(bytesToText(42)).toBe('');
    expect(bytesToText({})).toBe('');
  });
});
