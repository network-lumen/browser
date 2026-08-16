import { describe, expect, it } from 'vitest';
import { avatarToneStyle, describeFavouriteUrl } from '../../src/internal/services/favouriteMeta';

/**
 * How a saved page reads in a list.
 *
 * One URL, four ways it can be drawn: an internal page, a search, a website, a
 * local file. Every shortcut row, every history row and every address-bar
 * suggestion goes through this, so a URL that describes itself as the wrong
 * kind is a row with the wrong title and the wrong colour everywhere at once.
 */

describe('an internal page', () => {
  it('is named by the page, not by the URL', () => {
    const meta = describeFavouriteUrl('lumen://drive');
    expect(meta.kind).toBe('internal');
    expect(meta.title).toBe('Drive');
    expect(meta.subtitle).toBe('lumen://drive');
  });

  it('humanises a page it has no name for, rather than showing the slug', () => {
    expect(describeFavouriteUrl('lumen://my-gateways').title).toBe('My Gateways');
  });

  it('keeps the path in the subtitle, decoded', () => {
    expect(describeFavouriteUrl('lumen://network/block/12').subtitle).toBe('lumen://network/block/12');
  });
});

describe('a search', () => {
  it('is titled by what was searched for', () => {
    const meta = describeFavouriteUrl('lumen://search?q=hello%20world');
    expect(meta.kind).toBe('search');
    expect(meta.title).toBe('hello world');
  });
});

describe('a website', () => {
  it('is titled by its last path segment, and subtitled by its host', () => {
    const meta = describeFavouriteUrl('https://www.example.test/some-page');
    expect(meta.kind).toBe('web');
    expect(meta.title).toBe('Some page');
    expect(meta.subtitle).toBe('example.test');
  });

  it('falls back to the host when there is no path to name it by', () => {
    expect(describeFavouriteUrl('https://example.test/').title).toBe('example.test');
  });
});

describe('a local file', () => {
  it('is titled by its filename', () => {
    const meta = describeFavouriteUrl('file:///C:/tmp/report.pdf');
    expect(meta.kind).toBe('file');
    expect(meta.title).toBe('report.pdf');
  });
});

describe('the title the user gave it', () => {
  it('wins over the one derived from the URL', () => {
    expect(describeFavouriteUrl('https://example.test/a', 'My bookmark').title).toBe('My bookmark');
    expect(describeFavouriteUrl('lumen://drive', 'Files').title).toBe('Files');
  });

  it('is ignored when it is only whitespace', () => {
    expect(describeFavouriteUrl('lumen://drive', '   ').title).toBe('Drive');
  });
});

describe('the monogram', () => {
  it('takes the initials of two words, and two letters of one', () => {
    expect(describeFavouriteUrl('lumen://my-gateways').monogram).toBe('MG');
    expect(describeFavouriteUrl('lumen://drive').monogram).toBe('DR');
  });

  it('never comes back empty, whatever it was given', () => {
    expect(describeFavouriteUrl('').monogram).toBeTruthy();
    expect(describeFavouriteUrl('!!!').monogram).toBeTruthy();
  });
});

describe('the tone behind it', () => {
  it('gives each kind its own colour', () => {
    const web = avatarToneStyle('web');
    const search = avatarToneStyle('search');
    expect(web.color).toBeTruthy();
    expect(web.color).not.toBe(search.color);
  });

  it('has nothing to say about a kind with no colour of its own', () => {
    expect(avatarToneStyle('other')).toEqual({});
  });
});
