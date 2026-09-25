import { describe, expect, it } from 'vitest';
import {
  directoryCrumbs,
  encodeEntryPath,
  filterDirectoryEntries,
  findIndexEntry,
  mapDirectoryEntries,
  shouldRenderListing
} from '../../src/internal/services/ipfsDirectory';

/**
 * Reading an IPFS directory.
 *
 * The payloads here are what kubo actually answered for
 * `bafybeifsjp2ukyhteh7svhnfezyrwcbws4xznynrdqhphm3a4q6embktlq`, in both the
 * shapes the two bridges hand over.
 */
const KUBO_LINKS = [
  { Name: 'index.html', Hash: 'bafkreiindex', Size: 4096, Type: 2 },
  { Name: '404', Hash: 'bafybei404', Size: 0, Type: 1 },
  { Name: 'assets', Hash: 'bafybeiassets', Size: 0, Type: 1 }
];

const DESKTOP_ENTRIES = [
  { name: 'index.html', cid: 'bafkreiindex', size: 4096, type: 'file' },
  { name: '404', cid: 'bafybei404', size: 0, type: 'dir' },
  { name: 'assets', cid: 'bafybeiassets', size: 0, type: 'dir' }
];

describe('reading whatever the bridge hands over', () => {
  /**
   * The bug this tolerance exists for: the mobile bridge passed kubo's own
   * `Links` through untouched, the page read `entry.name`, and every row was
   * dropped. `lumen://ipfs/<cid>` listed an empty folder on Android for
   * content that was sitting right there.
   */
  it('reads kubo capitals and bridge lowercase the same way', () => {
    const fromKubo = mapDirectoryEntries(KUBO_LINKS);
    const fromDesktop = mapDirectoryEntries(DESKTOP_ENTRIES);
    expect(fromKubo).toEqual(fromDesktop);
    expect(fromKubo).toHaveLength(3);
  });

  it('turns kubo type 1 into a directory and type 2 into a file', () => {
    const entries = mapDirectoryEntries(KUBO_LINKS);
    expect(entries.find((e) => e.name === 'assets')?.type).toBe('dir');
    expect(entries.find((e) => e.name === 'index.html')?.type).toBe('file');
  });

  it('puts folders first, then sorts by name', () => {
    expect(mapDirectoryEntries(KUBO_LINKS).map((e) => e.name)).toEqual([
      '404',
      'assets',
      'index.html'
    ]);
  });

  it('drops an entry with no name or no CID rather than drawing a blank row', () => {
    const entries = mapDirectoryEntries([
      { Name: '', Hash: 'bafyx', Type: 2 },
      { Name: 'ghost.txt', Hash: '', Type: 2 },
      { Name: 'real.txt', Hash: 'bafyreal', Type: 2 }
    ]);
    expect(entries.map((e) => e.name)).toEqual(['real.txt']);
  });

  it('builds the path from the directory it was listed at', () => {
    const entries = mapDirectoryEntries(KUBO_LINKS, 'season-1/');
    expect(entries.find((e) => e.name === 'assets')?.relPath).toBe('season-1/assets');
  });

  it('survives anything that is not a list', () => {
    expect(mapDirectoryEntries(null)).toEqual([]);
    expect(mapDirectoryEntries({ Objects: [] })).toEqual([]);
    expect(mapDirectoryEntries([null, undefined])).toEqual([]);
  });
});

describe('deciding who draws the directory', () => {
  /**
   * An index is the difference between a website and a folder of files. With
   * one, the gateway serves the site as its author meant it; without one, it
   * answers with its own "Index of /ipfs/…" page, which is what this replaces.
   */
  it('leaves a directory carrying an index to the gateway', () => {
    expect(shouldRenderListing(mapDirectoryEntries(KUBO_LINKS))).toBe(false);
  });

  it('draws a directory that has no index', () => {
    const entries = mapDirectoryEntries([
      { Name: 'S01 E01.mp4', Hash: 'bafy1', Size: 975_000_000, Type: 2 },
      { Name: 'S01 E02.mp4', Hash: 'bafy2', Size: 962_000_000, Type: 2 }
    ]);
    expect(shouldRenderListing(entries)).toBe(true);
  });

  it('leaves a file alone - kubo lists one as empty, and so it stays the gateway\'s', () => {
    // Measured: `ls` on a file CID answers `{ ok: true, entries: [] }`.
    expect(shouldRenderListing(mapDirectoryEntries([]))).toBe(false);
  });

  it('accepts index.htm as well, and ignores the case', () => {
    expect(findIndexEntry(mapDirectoryEntries([{ Name: 'INDEX.HTM', Hash: 'b', Type: 2 }]))).toBeTruthy();
    expect(findIndexEntry(mapDirectoryEntries([{ Name: 'Index.HTML', Hash: 'b', Type: 2 }]))).toBeTruthy();
  });

  it('does not take a folder named index.html for a page', () => {
    // A directory cannot be served in place of its parent, and treating it as
    // one would hand the gateway a path it answers with another listing.
    const entries = mapDirectoryEntries([{ Name: 'index.html', Hash: 'bafy', Type: 1 }]);
    expect(findIndexEntry(entries)).toBeNull();
    expect(shouldRenderListing(entries)).toBe(true);
  });
});

describe('the trail above the current directory', () => {
  it('names every step and the path that reaches it', () => {
    expect(directoryCrumbs('season-1/extras/')).toEqual([
      { label: 'season-1', path: 'season-1' },
      { label: 'extras', path: 'season-1/extras' }
    ]);
  });

  it('is empty at the root', () => {
    expect(directoryCrumbs('')).toEqual([]);
    expect(directoryCrumbs('/')).toEqual([]);
  });
});

describe('putting a path back into a URL', () => {
  it('encodes each segment and keeps the separators', () => {
    // Encoding the whole path would turn the slashes into %2F and address one
    // file whose name happens to contain them.
    expect(encodeEntryPath('My Name Is Earl/S01 E01.mp4')).toBe(
      'My%20Name%20Is%20Earl/S01%20E01.mp4'
    );
  });

  it('leaves nothing dangling at either end', () => {
    expect(encodeEntryPath('/a/b/')).toBe('a/b');
    expect(encodeEntryPath('')).toBe('');
  });
});

/**
 * Finding one file among many.
 *
 * A folder can hold five hundred episodes, and a list with no way to search it
 * is a list you scroll past. What matters is that the match is forgiving:
 * nobody types an accent to find a file, and nobody should have to match case.
 */
describe('searching a directory', () => {
  const entries = mapDirectoryEntries([
    { Name: 'My Name Is Earl S01 E07.mp4', Hash: 'bafy1', Type: 2 },
    { Name: 'My Name Is Earl S01 E08.mp4', Hash: 'bafy2', Type: 2 },
    { Name: 'Résumé de la saison.pdf', Hash: 'bafy3', Type: 2 },
    { Name: 'Extras', Hash: 'bafy4', Type: 1 }
  ]);

  it('matches anywhere in the name, not just at the start', () => {
    expect(filterDirectoryEntries(entries, 'E07').map((e) => e.name)).toEqual([
      'My Name Is Earl S01 E07.mp4'
    ]);
  });

  it('ignores case', () => {
    expect(filterDirectoryEntries(entries, 'extras')).toHaveLength(1);
  });

  it('finds an accented name typed without accents', () => {
    expect(filterDirectoryEntries(entries, 'resume').map((e) => e.name)).toEqual([
      'Résumé de la saison.pdf'
    ]);
  });

  it('returns everything for an empty or blank query', () => {
    expect(filterDirectoryEntries(entries, '')).toHaveLength(4);
    expect(filterDirectoryEntries(entries, '   ')).toHaveLength(4);
  });

  it('returns nothing rather than everything when nothing matches', () => {
    expect(filterDirectoryEntries(entries, 'zzz')).toEqual([]);
  });

  it('searches folders as readily as files', () => {
    expect(filterDirectoryEntries(entries, 'extr')[0].type).toBe('dir');
  });

  it('survives being handed nothing', () => {
    expect(filterDirectoryEntries(null as any, 'a')).toEqual([]);
  });
});
