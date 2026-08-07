import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORAGE_KEYS,
  profileScopedKey,
  readJson,
  readString,
  removeKey,
  writeJson,
  writeString,
} from '../../src/internal/services/storage';

/**
 * Every `localStorage` key the renderer owns, and the accessors around them.
 *
 * Two things are being pinned. First that the accessors never throw: a browser
 * can deny storage outright, and a read that throws inside a component's setup
 * takes the page down. Second that the key *names* do not move - they address
 * data already sitting in users' browsers, so a rename silently orphans it.
 */

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('the key registry', () => {
  it('holds no duplicate values, which is the collision it exists to make visible', () => {
    const values = Object.values(STORAGE_KEYS);
    expect(new Set(values).size).toBe(values.length);
  });

  it('keeps the historical spellings that address live data', () => {
    // Frozen on purpose. These are not style choices; renaming one orphans
    // whatever it holds in an installed browser. New keys use
    // lumen:<area>:<name>:v1, which is why the newer ones look different.
    expect(STORAGE_KEYS.theme).toBe('lumen-theme');
    expect(STORAGE_KEYS.homeMySpaceCards).toBe('my_space_cards_order');
    expect(STORAGE_KEYS.recurringPayments).toBe('lumen_recurring_payments');
    expect(STORAGE_KEYS.favourites).toBe('lumen:favourites:v2');
    expect(STORAGE_KEYS.favouritesLegacy).toBe('lumen:favourites:v1');
  });
});

describe('profileScopedKey', () => {
  it('suffixes the profile id', () => {
    expect(profileScopedKey('lumen:drive:files:v1', 'p1')).toBe('lumen:drive:files:v1:p1');
  });

  it('gives a profile-less session its own bucket rather than an empty suffix', () => {
    // Without this, no-profile data would land on `prefix:` and collide with
    // itself across sessions.
    expect(profileScopedKey('k', '')).toBe('k:guest');
    expect(profileScopedKey('k', '   ')).toBe('k:guest');
    expect(profileScopedKey('k', null as never)).toBe('k:guest');
  });

  it('keeps two profiles apart', () => {
    expect(profileScopedKey('k', 'a')).not.toBe(profileScopedKey('k', 'b'));
  });
});

describe('readJson and writeJson', () => {
  it('round-trips a value', () => {
    expect(writeJson('k', { a: 1, b: [2, 3] })).toBe(true);
    expect(readJson('k', null)).toEqual({ a: 1, b: [2, 3] });
  });

  it('returns the fallback for a key that was never written', () => {
    expect(readJson('missing', 'fallback')).toBe('fallback');
  });

  it('returns the fallback for stored garbage instead of throwing', () => {
    localStorage.setItem('k', '{not json');
    expect(readJson('k', 'fallback')).toBe('fallback');
  });

  it('treats a stored null as absent', () => {
    // JSON.parse('null') is null, which a caller would otherwise have to test
    // for separately at every read.
    localStorage.setItem('k', 'null');
    expect(readJson('k', 'fallback')).toBe('fallback');
  });

  it('keeps falsy values that are real: 0, empty string, false', () => {
    // These round-trip because they serialise to '0', '""' and 'false' - all
    // non-empty text. A caller storing 0 gets 0 back, not its fallback.
    writeJson('zero', 0);
    writeJson('empty', '');
    writeJson('no', false);
    expect(readJson('zero', 'fallback')).toBe(0);
    expect(readJson('empty', 'fallback')).toBe('');
    expect(readJson('no', 'fallback')).toBe(false);
  });

  it('treats a literally empty stored value as absent', () => {
    // Not something writeJson can produce - this is a key another writer left
    // empty. Reading it as '' would hand the caller a value it never stored.
    localStorage.setItem('k', '');
    expect(readJson('k', 'fallback')).toBe('fallback');
  });

  it('reports failure rather than throwing when storage rejects the write', () => {
    // A full quota, or storage blocked entirely.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    expect(writeJson('k', { big: true })).toBe(false);
  });

  it('returns the fallback rather than throwing when storage denies the read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    expect(readJson('k', 'fallback')).toBe('fallback');
  });

  it('reports failure for a value that cannot be serialised', () => {
    const cyclic: any = {};
    cyclic.self = cyclic;
    expect(writeJson('k', cyclic)).toBe(false);
  });
});

describe('readString, writeString and removeKey', () => {
  it('round-trips a raw string', () => {
    expect(writeString('k', 'value')).toBe(true);
    expect(readString('k')).toBe('value');
  });

  it('gives null for a key that is not there', () => {
    expect(readString('missing')).toBeNull();
  });

  it('removes a key, and stays quiet about one that was never set', () => {
    writeString('k', 'v');
    removeKey('k');
    expect(readString('k')).toBeNull();
    expect(() => removeKey('never-set')).not.toThrow();
  });

  it('never throws when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('nope'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('nope'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('nope'); });
    expect(readString('k')).toBeNull();
    expect(writeString('k', 'v')).toBe(false);
    expect(() => removeKey('k')).not.toThrow();
  });
});
