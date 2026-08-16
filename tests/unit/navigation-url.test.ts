import { describe, expect, it } from 'vitest';
import {
  buildExtensionTabUrl,
  canonicalizeLumenUrl,
  getFileUrlTitle,
  isBrowserUrl,
  isExtensionUrl,
  isFileUrl,
  isHttpUrl,
  isLumenUrl,
  normalizeAddressInput,
  normalizeHttpBaseUrl,
  normalizeTabUrl,
  parseExtensionTabUrl,
} from '../../src/internal/services/navigationUrl';

/**
 * What the address bar does with what you typed.
 *
 * This is the fork every navigation goes through: a domain, a local file, a
 * Windows path pasted from Explorer, or a search. Getting it wrong is not a
 * rendering bug - typing a domain and being handed a search for it, or a path
 * that silently becomes a query, is the browser refusing to go where it was
 * told.
 *
 * It had no tests at all until it moved out of `src/internal/*.ts`, a folder
 * that `check:tests` never watched.
 */

describe('recognising a scheme', () => {
  it('tells the four apart, leading space and case included', () => {
    expect(isLumenUrl('  LUMEN://home')).toBe(true);
    expect(isHttpUrl(' https://example.test')).toBe(true);
    expect(isFileUrl('file:///c:/tmp/a.txt')).toBe(true);
    expect(isExtensionUrl('chrome-extension://abc/page.html')).toBe(true);
    expect(isLumenUrl('https://example.test')).toBe(false);
  });

  it('groups the ones a webview renders', () => {
    expect(isBrowserUrl('https://example.test')).toBe(true);
    expect(isBrowserUrl('file:///tmp/a.html')).toBe(true);
    expect(isBrowserUrl('chrome-extension://abc/p.html')).toBe(true);
    expect(isBrowserUrl('lumen://home')).toBe(false);
  });
});

describe('canonicalising a lumen URL', () => {
  it('gives the host a trailing slash, so one page has one address', () => {
    expect(canonicalizeLumenUrl('lumen://home')).toBe('lumen://home/');
    expect(canonicalizeLumenUrl('lumen://search?q=a')).toBe('lumen://search/?q=a');
    expect(canonicalizeLumenUrl('lumen://home#x')).toBe('lumen://home/#x');
  });

  it('leaves a path alone, and anything that is not lumen', () => {
    expect(canonicalizeLumenUrl('lumen://drive/files')).toBe('lumen://drive/files');
    expect(canonicalizeLumenUrl('https://example.test')).toBe('https://example.test');
  });
});

describe('normalising what a tab was asked to show', () => {
  it('falls back to the new tab page rather than nowhere', () => {
    expect(normalizeTabUrl('')).toBe('lumen://newtab');
    expect(normalizeTabUrl('   ')).toBe('lumen://newtab');
  });

  it('turns a Windows path into a file URL, both drive and UNC', () => {
    expect(normalizeTabUrl('C:\\Users\\me\\a b.txt')).toBe('file:///C:/Users/me/a%20b.txt');
    expect(normalizeTabUrl('\\\\server\\share\\file.txt')).toBe('file://server/share/file.txt');
  });

  it('assumes lumen for a bare host', () => {
    expect(normalizeTabUrl('web.lmn')).toBe('lumen://web.lmn/');
  });
});

describe('normalising what the user typed', () => {
  const builtins = ['home', 'settings', 'drive'];

  it('takes a builtin page by name', () => {
    expect(normalizeAddressInput('Settings', builtins)).toBe('lumen://settings');
  });

  it('treats something with a dot as an address, not a search', () => {
    expect(normalizeAddressInput('web.lmn', builtins)).toBe('lumen://web.lmn/');
  });

  it('searches for anything else, including a phrase that has a dot in it', () => {
    expect(normalizeAddressInput('how do i', builtins)).toBe('lumen://search?q=how%20do%20i');
    // The space is what settles it: "3.5 inch floppy" is a question, not a host.
    expect(normalizeAddressInput('3.5 inch floppy', builtins)).toBe(
      'lumen://search?q=3.5%20inch%20floppy',
    );
  });

  it('passes a real URL through untouched', () => {
    expect(normalizeAddressInput('https://example.test/a?b=1', builtins)).toBe(
      'https://example.test/a?b=1',
    );
  });
});

describe('reducing an http URL to a base', () => {
  it('drops the query and the fragment and the trailing slashes', () => {
    expect(normalizeHttpBaseUrl('https://gw.test/a/?x=1#y')).toBe('https://gw.test/a');
    expect(normalizeHttpBaseUrl('https://gw.test///')).toBe('https://gw.test');
  });

  it('refuses anything that is not http, which is the validation too', () => {
    expect(normalizeHttpBaseUrl('lumen://home')).toBeNull();
    expect(normalizeHttpBaseUrl('not a url')).toBeNull();
    expect(normalizeHttpBaseUrl('')).toBeNull();
  });
});

describe('naming a local file', () => {
  it('uses the last segment, decoded', () => {
    expect(getFileUrlTitle('file:///C:/tmp/my%20report.pdf')).toBe('my report.pdf');
    expect(getFileUrlTitle('file:///tmp/dir/')).toBe('dir');
  });

  it('says something for a URL it cannot read', () => {
    expect(getFileUrlTitle('')).toBe('Local file');
    expect(getFileUrlTitle('not a url')).toBe('not a url');
  });
});

describe('an extension tab', () => {
  it('round-trips everything it carries', () => {
    const url = buildExtensionTabUrl('abc123', {
      url: 'https://example.test/p',
      name: 'My Extension',
      sourceTabId: 'tab-1',
    });
    const parsed = parseExtensionTabUrl(url);
    expect(parsed).toMatchObject({
      extensionId: 'abc123',
      targetUrl: 'https://example.test/p',
      name: 'My Extension',
      sourceTabId: 'tab-1',
    });
  });

  it('falls back to the extensions page with no id to open', () => {
    expect(buildExtensionTabUrl('')).toBe('lumen://extensions');
  });

  it('parses nothing out of another lumen page', () => {
    expect(parseExtensionTabUrl('lumen://drive/')).toBeNull();
    expect(parseExtensionTabUrl('https://example.test')).toBeNull();
  });
});
