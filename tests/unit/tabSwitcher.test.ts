import { describe, expect, it } from 'vitest';
import {
  buildTabRows,
  nextActiveTabId,
  tabCountLabel,
  tabOrigin,
  tabSubtitle
} from '../../src/internal/services/tabSwitcher';
import type { Tab } from '../../src/types/tab';

/**
 * The tab switcher's row model.
 *
 * `origin` is the part worth pinning: it decides the chip that tells a user
 * whether they are on a name the chain resolved, on raw IPFS content or on the
 * ordinary web. On a phone the address bar is cut to a few characters, so this
 * chip is the provenance signal - getting it wrong would label a plain https
 * page as chain-resolved, which is a security claim, not a cosmetic one.
 */
const tab = (id: string, url: string, extra: Partial<Tab> = {}): Tab => ({
  id,
  history: [{ url, title: extra.title }],
  history_position: 0,
  ...extra
});

describe('where a tab came from', () => {
  it('separates an app page from a registered name by the dot', () => {
    // This is the whole rule routes.ts would have provided, and the reason
    // this module does not import it.
    expect(tabOrigin('lumen://settings')).toBe('internal');
    expect(tabOrigin('lumen://network/validators')).toBe('internal');
    expect(tabOrigin('lumen://lumen.lmn')).toBe('chain');
    expect(tabOrigin('lumen://mobile.lulu/page')).toBe('chain');
  });

  it('calls content content, whichever way it was addressed', () => {
    expect(tabOrigin('lumen://ipfs/bafybeicyr7m4bjhlvqes5rqdya6o2j3mf3nbhmrmyzqimxbuelqgfb3tji')).toBe('ipfs');
    expect(tabOrigin('lumen://ipns/k51example')).toBe('ipfs');
    expect(tabOrigin('ipfs://bafytest')).toBe('ipfs');
    expect(tabOrigin('ipns://k51example')).toBe('ipfs');
  });

  it('does not let a plain web page pass for a chain-resolved one', () => {
    expect(tabOrigin('https://lumen.lmn')).toBe('web');
    expect(tabOrigin('http://example.com')).toBe('web');
    expect(tabOrigin('https://ipfs.io/ipfs/bafytest')).toBe('web');
  });

  it('treats a tab that has been nowhere as blank', () => {
    expect(tabOrigin('lumen://newtab')).toBe('blank');
    expect(tabOrigin('')).toBe('blank');
    expect(tabOrigin('   ')).toBe('blank');
  });
});

describe('the line under the title', () => {
  it('drops www and the scheme, which the chip already says', () => {
    expect(tabSubtitle('https://www.example.com/a/b?c=1')).toBe('example.com');
  });

  it('keeps the path on a chain name, since that is what distinguishes two tabs', () => {
    expect(tabSubtitle('lumen://lumen.lmn')).toBe('lumen.lmn');
    expect(tabSubtitle('lumen://lumen.lmn/blog/')).toBe('lumen.lmn/blog');
  });

  it('elides the middle of a CID rather than the end', () => {
    // The end of a CID is what tells two of them apart; cutting it off would
    // make every row from the same gateway look identical.
    const subtitle = tabSubtitle(
      'lumen://ipfs/bafybeicyr7m4bjhlvqes5rqdya6o2j3mf3nbhmrmyzqimxbuelqgfb3tji/index.html'
    );
    expect(subtitle.startsWith('bafybeic')).toBe(true);
    expect(subtitle.endsWith('b3tji')).toBe(true);
    expect(subtitle).toContain('…');
  });

  it('names the route for an app page', () => {
    expect(tabSubtitle('lumen://settings')).toBe('lumen://settings');
  });

  it('says nothing at all for a blank tab', () => {
    expect(tabSubtitle('lumen://newtab')).toBe('');
  });
});

describe('building the rows', () => {
  const tabs = [
    tab('a', 'lumen://lumen.lmn', { title: 'Lumen' }),
    tab('b', 'https://example.com', { loading: true, favicon: 'data:image/png;base64,x' }),
    tab('c', 'lumen://newtab')
  ];

  it('marks exactly one row active', () => {
    const rows = buildTabRows(tabs, 'b', 'New tab');
    expect(rows.map((r) => r.active)).toEqual([false, true, false]);
  });

  it('falls back to the given title rather than showing an empty row', () => {
    const rows = buildTabRows(tabs, 'a', 'New tab');
    expect(rows[2].title).toBe('New tab');
    expect(rows[0].title).toBe('Lumen');
  });

  it('carries what the row draws on its left: spinner, favicon or chip', () => {
    const rows = buildTabRows(tabs, 'a', 'New tab');
    expect(rows[1]).toMatchObject({ loading: true, favicon: 'data:image/png;base64,x', origin: 'web' });
    expect(rows[0]).toMatchObject({ loading: false, favicon: null, origin: 'chain' });
  });

  it('survives being handed nothing', () => {
    expect(buildTabRows([], '', 'New tab')).toEqual([]);
    expect(buildTabRows(null as any, '', 'New tab')).toEqual([]);
  });
});

describe('the counter', () => {
  it('caps at three characters, which is what the button fits', () => {
    expect(tabCountLabel(1)).toBe('1');
    expect(tabCountLabel(99)).toBe('99');
    expect(tabCountLabel(100)).toBe('99+');
    expect(tabCountLabel(4000)).toBe('99+');
  });

  it('reads a bad count as none rather than as NaN', () => {
    expect(tabCountLabel(NaN)).toBe('0');
    expect(tabCountLabel(-3)).toBe('0');
  });
});

describe('where closing a tab leaves you', () => {
  const tabs = [tab('a', 'lumen://home'), tab('b', 'lumen://drive'), tab('c', 'lumen://settings')];

  it('moves forward through the list, not back to the start', () => {
    expect(nextActiveTabId(tabs, 'b', 'b')).toBe('c');
  });

  it('falls back to the previous one at the end of the list', () => {
    expect(nextActiveTabId(tabs, 'c', 'c')).toBe('b');
  });

  it('does not move the user when a background tab closes', () => {
    // Closing something you are not reading must not change what you see.
    expect(nextActiveTabId(tabs, 'a', 'c')).toBe('a');
  });

  it('reports a tab that is not open rather than guessing', () => {
    expect(nextActiveTabId(tabs, 'a', 'zzz')).toBeNull();
  });

  it('has nothing to offer when the last tab goes', () => {
    expect(nextActiveTabId([tabs[0]], 'a', 'a')).toBeNull();
  });
});
