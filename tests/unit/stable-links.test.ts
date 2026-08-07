import { describe, expect, it } from 'vitest';
import {
  sanitizeStableLinkLabel,
  stableLinkDisplayName,
  stableLinkKeyNameFromLabel,
} from '../../src/internal/services/stableLinks';

/**
 * Naming rules for the IPNS keys a site publishes under.
 *
 * The `stable:` prefix is what keeps browser-managed keys apart from the raw
 * keys a user creates by hand in Domains, and it is stored in Kubo - so it is
 * asserted literally below. Changing it orphans every key already published.
 * DomainPage and LumenSiteModalHost each carried a copy of these rules, which
 * is how the two could have drifted apart without anyone noticing.
 */

describe('sanitizeStableLinkLabel', () => {
  it('keeps what a Kubo key name may contain', () => {
    expect(sanitizeStableLinkLabel('my-site_v1.0')).toBe('my-site_v1.0');
  });

  it('turns spaces and everything else into dashes', () => {
    expect(sanitizeStableLinkLabel('my site')).toBe('my-site');
    expect(sanitizeStableLinkLabel('héllo wörld')).toBe('h-llo-w-rld');
    expect(sanitizeStableLinkLabel('a/b\\c')).toBe('a-b-c');
  });

  it('collapses a run of spaces into a single dash', () => {
    expect(sanitizeStableLinkLabel('a    b')).toBe('a-b');
  });

  it('drops dashes at either end, including ones it just created', () => {
    expect(sanitizeStableLinkLabel('  spaced  ')).toBe('spaced');
    expect(sanitizeStableLinkLabel('---edge---')).toBe('edge');
    expect(sanitizeStableLinkLabel('!!!hello!!!')).toBe('hello');
  });

  it('caps the length, so a pasted essay cannot become a key name', () => {
    expect(sanitizeStableLinkLabel('a'.repeat(500))).toHaveLength(96);
  });

  it('returns nothing when nothing usable is left', () => {
    for (const junk of ['', '   ', '!!!', '///', null, undefined]) {
      expect(sanitizeStableLinkLabel(junk as never)).toBe('');
    }
  });
});

describe('stableLinkKeyNameFromLabel', () => {
  it('prefixes the sanitised label', () => {
    expect(stableLinkKeyNameFromLabel('My Site')).toBe('stable:My-Site');
  });

  it('produces nothing for a label that sanitises to nothing', () => {
    // An empty label must not yield the bare prefix: `stable:` would be a key
    // name that collides with every other empty label.
    expect(stableLinkKeyNameFromLabel('!!!')).toBe('');
    expect(stableLinkKeyNameFromLabel('')).toBe('');
  });
});

describe('stableLinkDisplayName', () => {
  it('drops the prefix from a managed key', () => {
    expect(stableLinkDisplayName('stable:my-site')).toBe('my-site');
  });

  it('round-trips with the name builder', () => {
    expect(stableLinkDisplayName(stableLinkKeyNameFromLabel('My Site'))).toBe('My-Site');
  });

  it('leaves a key the user made themselves alone', () => {
    // This list also holds hand-made keys from Domains; renaming those would
    // be worse than showing a prefix.
    expect(stableLinkDisplayName('my-own-key')).toBe('my-own-key');
    expect(stableLinkDisplayName('self')).toBe('self');
  });

  it('takes the last segment of a multi-part managed name', () => {
    expect(stableLinkDisplayName('stable:site:v2')).toBe('v2');
  });

  it('gives an empty string for nothing', () => {
    expect(stableLinkDisplayName('')).toBe('');
    expect(stableLinkDisplayName('   ')).toBe('');
    expect(stableLinkDisplayName(null as never)).toBe('');
  });
});
