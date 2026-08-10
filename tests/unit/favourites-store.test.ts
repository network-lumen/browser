import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '../../src/internal/services/storage';

/**
 * Browser shortcuts, kept per profile in localStorage.
 *
 * The decisions worth pinning are the ones a caller cannot see: a lumen:// URL
 * is canonicalised before anything compares it, so two spellings of one address
 * are one shortcut; pinned entries live above unpinned ones and stay there when
 * a shortcut is pinned later; and the stored shape has to survive a version of
 * itself that only held strings.
 *
 * The module reads localStorage as it loads, so every test imports it fresh
 * after seeding - which is also the only way to cover the reading half.
 */

async function loadStore(seed?: unknown) {
  localStorage.clear();
  if (seed !== undefined) {
    localStorage.setItem(STORAGE_KEYS.favourites, JSON.stringify(seed));
  }
  vi.resetModules();
  return import('../../src/stores/favouritesStore');
}

const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEYS.favourites) || '{}');

beforeEach(() => {
  localStorage.clear();
});

describe('canonicalising the address', () => {
  it('normalises a lumen:// url so two spellings are one shortcut', async () => {
    // The trailing slash is what canonicalizeLumenUrl adds, and it is why the
    // expectations throughout this file carry one. Everything that compares or
    // de-duplicates shortcuts compares the canonical form.
    const store = await loadStore({ p1: ['lumen://home', 'lumen://home/'] });
    const urls = store.getFavouriteEntriesForProfile('p1').map((e) => e.url);
    expect(urls).toEqual(['lumen://home/']);
  });

  it('leaves an ordinary url exactly as it was given', async () => {
    const store = await loadStore({ p1: ['https://example.test/a?b=1'] });
    expect(store.getFavouriteEntriesForProfile('p1')[0].url).toBe('https://example.test/a?b=1');
  });
});

describe('reading what was stored', () => {
  it('starts empty when there is nothing', async () => {
    const store = await loadStore();
    expect(store.getFavouriteEntriesForProfile('p1')).toEqual([]);
  });

  it('accepts a bare list of urls, which is what the old format held', async () => {
    const store = await loadStore({ p1: ['lumen://home', 'https://example.test/'] });
    expect(store.getFavouriteEntriesForProfile('p1').map((e) => e.url)).toEqual([
      'lumen://home/',
      'https://example.test/'
    ]);
  });

  it('drops a duplicate url rather than keeping two shortcuts to one place', async () => {
    const store = await loadStore({ p1: ['lumen://home', 'lumen://home'] });
    expect(store.getFavouriteEntriesForProfile('p1')).toHaveLength(1);
  });

  it('ignores junk in the file instead of failing to load', async () => {
    const store = await loadStore({ p1: [null, 42, { nothing: true }, 'lumen://home'] });
    expect(store.getFavouriteEntriesForProfile('p1').map((e) => e.url)).toEqual(['lumen://home/']);
  });

  it('files a shortcut with no profile under a default bucket', async () => {
    const store = await loadStore({ '': ['lumen://home'] });
    expect(store.getFavouriteEntriesForProfile('').map((e) => e.url)).toEqual(['lumen://home/']);
  });
});

describe('keeping profiles apart', () => {
  it('does not show one profile the other profile shortcuts', async () => {
    const store = await loadStore({ p1: ['lumen://home'], p2: ['lumen://drive'] });
    expect(store.getFavouriteEntriesForProfile('p1').map((e) => e.url)).toEqual(['lumen://home/']);
    expect(store.getFavouriteEntriesForProfile('p2').map((e) => e.url)).toEqual(['lumen://drive/']);
  });

  it('writes through to storage so the next launch sees it', async () => {
    const store = await loadStore();
    store.setFavouritesForProfile('p1', ['lumen://home']);
    expect(stored().p1).toHaveLength(1);
    expect(stored().p1[0].url).toBe('lumen://home/');
  });
});

describe('order, and where a pinned shortcut goes', () => {
  it('puts a pinned entry above the unpinned ones', async () => {
    const store = await loadStore();
    store.setFavouriteEntriesForProfile('p1', [
      { id: 'a', url: 'lumen://one', pinned: false, createdAt: 1, updatedAt: 1 },
      { id: 'b', url: 'lumen://two', pinned: false, createdAt: 2, updatedAt: 2 }
    ]);
    // A shortcut created as pinned belongs at the top, not at the end.
    store.setFavouriteEntriesForProfile('p1', [
      { id: 'c', url: 'lumen://pinned', pinned: true, createdAt: 3, updatedAt: 3 },
      ...store.getFavouriteEntriesForProfile('p1')
    ]);
    expect(store.getFavouriteEntriesForProfile('p1')[0].url).toBe('lumen://pinned/');
  });

  it('keeps what it was handed, entry for entry', async () => {
    const store = await loadStore();
    const entries = [
      { id: 'a', url: 'lumen://one/', title: 'One', pinned: true, createdAt: 1, updatedAt: 1 }
    ];
    store.setFavouriteEntriesForProfile('p1', entries);
    const read = store.getFavouriteEntriesForProfile('p1');
    expect(read[0]).toMatchObject({ url: 'lumen://one/', title: 'One', pinned: true });
  });
});

describe('a corrupt file', () => {
  it('is treated as no shortcuts rather than taking the store down', async () => {
    localStorage.setItem(STORAGE_KEYS.favourites, '{not json');
    vi.resetModules();
    const store = await import('../../src/stores/favouritesStore');
    expect(store.getFavouriteEntriesForProfile('p1')).toEqual([]);
  });
});
