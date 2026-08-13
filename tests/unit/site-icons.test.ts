import { beforeEach, describe, expect, it } from 'vitest';
import {
  LUMEN_MARK,
  dropSiteIcon,
  pinSiteIcon,
  resolveSiteIcon,
  siteIconKind,
  siteIconUrl,
} from '../../src/internal/services/siteIcons';

/**
 * Which icon a listed URL gets, and what is remembered about it.
 *
 * The kind is decided from the URL alone, which is the whole point: a list of
 * shortcuts must draw immediately, without asking the network what each row is.
 * Internal pages have no dot in their host, domains always do.
 */

const STORAGE_KEY = 'lumen:siteIcons:v1';

beforeEach(() => {
  localStorage.clear();
  dropSiteIcon('https://example.com/a');
  dropSiteIcon('lumen://web.lmn/');
});

describe('classifying a URL', () => {
  it('gives internal Lumen pages the Lumen mark', () => {
    expect(siteIconKind('lumen://settings')).toBe('lumen');
    expect(siteIconKind('lumen://my-gateways/')).toBe('lumen');
    expect(LUMEN_MARK).toBeTruthy();
  });

  it('treats a dotted Lumen host as a site with a favicon of its own', () => {
    expect(siteIconKind('lumen://web.lmn/')).toBe('site');
    expect(siteIconKind('https://example.com/a')).toBe('site');
  });

  it('has nothing to show for files, searches and empty input', () => {
    expect(siteIconKind('file:///c:/tmp/a.txt')).toBe('none');
    expect(siteIconKind('')).toBe('none');
    expect(siteIconKind('   ')).toBe('none');
  });
});

describe('pinning what a page reported', () => {
  it('keys an icon by host, so any path on the site draws it', () => {
    pinSiteIcon('https://example.com/a', 'https://example.com/favicon.ico');
    expect(siteIconUrl('https://example.com/deep/page?q=1')).toBe('https://example.com/favicon.ico');
  });

  it('survives a restart, which is what saves the re-probe', () => {
    pinSiteIcon('https://example.com/a', 'https://example.com/favicon.ico');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')).toEqual({
      'web:example.com': 'https://example.com/favicon.ico',
    });
  });

  it('never confuses a Lumen domain with an http host of the same name', () => {
    pinSiteIcon('https://web.lmn/', 'https://web.lmn/favicon.ico');
    expect(siteIconUrl('lumen://web.lmn/')).toBeNull();
  });

  it('ignores an empty icon rather than pinning a blank', () => {
    pinSiteIcon('https://example.com/a', '');
    expect(siteIconUrl('https://example.com/a')).toBeNull();
  });

  it('forgets an icon that turned out not to render', () => {
    pinSiteIcon('https://example.com/a', 'https://example.com/favicon.ico');
    dropSiteIcon('https://example.com/a');
    expect(siteIconUrl('https://example.com/a')).toBeNull();
  });
});

describe('resolving an icon', () => {
  it('answers from the pin without probing', async () => {
    pinSiteIcon('https://example.com/a', 'https://example.com/favicon.ico');
    await expect(resolveSiteIcon('https://example.com/a')).resolves.toBe(
      'https://example.com/favicon.ico',
    );
  });

  it('has no icon to resolve for a URL that carries none', async () => {
    await expect(resolveSiteIcon('lumen://settings')).resolves.toBeNull();
    await expect(resolveSiteIcon('')).resolves.toBeNull();
  });
});
