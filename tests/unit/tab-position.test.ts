import { describe, expect, it } from 'vitest';
import {
  tabCurrentEntry,
  tabCurrentTitle,
  tabCurrentUrl,
} from '../../src/internal/services/tabPosition';
import type { Tab } from '../../src/types/tab';

const tab = (over: Partial<Tab> = {}) => ({ id: 't', ...over }) as Tab;
const entries = (...urls: string[]) => urls.map((url) => ({ url, title: `T:${url}` }));

describe('where a tab currently is', () => {
  it('reads the entry the position points at', () => {
    const t = tab({ history: entries('a', 'b', 'c'), history_position: 1 });
    expect(tabCurrentUrl(t)).toBe('b');
    expect(tabCurrentTitle(t)).toBe('T:b');
  });

  it('assumes the newest entry when no position is recorded', () => {
    // This is the divergence that made this service worth extracting: MainScreen
    // defaulted to the first entry, so a tab with no position reported the
    // oldest page in it - and MainScreen is what writes the browsing history.
    const t = tab({ history: entries('a', 'b', 'c') });
    expect(tabCurrentUrl(t)).toBe('c');
    expect(tabCurrentTitle(t)).toBe('T:c');
  });

  it('clamps a position that has run past either end', () => {
    expect(tabCurrentUrl(tab({ history: entries('a', 'b'), history_position: 9 }))).toBe('b');
    expect(tabCurrentUrl(tab({ history: entries('a', 'b'), history_position: -3 }))).toBe('a');
  });

  it('falls back to the tab url when the history is empty or missing', () => {
    expect(tabCurrentUrl(tab({ url: 'x', history: [] }))).toBe('x');
    expect(tabCurrentUrl(tab({ url: 'x' }))).toBe('x');
    expect(tabCurrentUrl(tab({ url: 'x', history: 'nope' as unknown as [] }))).toBe('x');
  });

  it('prefers a history entry over the tab url', () => {
    expect(tabCurrentUrl(tab({ url: 'stale', history: entries('fresh') }))).toBe('fresh');
  });

  it('ignores an entry whose url is blank', () => {
    const t = tab({ url: 'x', history: [{ url: '   ', title: '' }] });
    expect(tabCurrentUrl(t)).toBe('x');
  });

  it('trims what it returns', () => {
    expect(tabCurrentUrl(tab({ history: [{ url: '  a  ', title: '' }] }))).toBe('a');
  });
});

describe('the fallback is empty unless asked otherwise', () => {
  it('returns nothing for a tab with nothing in it', () => {
    // MainScreen relies on this: an empty url means "not worth recording", so a
    // default of lumen://newtab there would put every new tab in the history.
    expect(tabCurrentUrl(null)).toBe('');
    expect(tabCurrentUrl(undefined)).toBe('');
    expect(tabCurrentUrl(tab())).toBe('');
  });

  it('uses the caller fallback when one is given', () => {
    expect(tabCurrentUrl(null, { fallback: 'lumen://newtab' })).toBe('lumen://newtab');
    expect(tabCurrentTitle(tab(), { fallback: 'New tab' })).toBe('New tab');
  });
});

describe('the entry itself', () => {
  it('is null when there is no history to point into', () => {
    expect(tabCurrentEntry(tab({ url: 'x' }))).toBeNull();
    expect(tabCurrentEntry(null)).toBeNull();
  });

  it('comes back whole, so url and title cannot disagree', () => {
    const t = tab({ history: entries('a', 'b'), history_position: 0 });
    expect(tabCurrentEntry(t)).toEqual({ url: 'a', title: 'T:a' });
  });
});
