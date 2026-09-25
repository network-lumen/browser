/**
 * Reading an IPFS directory, the same way everywhere it is drawn.
 *
 * `lumen://ipfs/<cid>` has always listed a directory with the app's own table.
 * `lumen://<domain>` did not: it handed the gateway URL to a webview, and a
 * directory with no `index.html` is answered by the gateway's own "Index of
 * /ipfs/…" page - a different font, a different language, and a CID where the
 * domain should be. Same content, two displays. This is what lets both use one.
 *
 * WHAT COUNTS AS A DIRECTORY is decided by the listing itself: kubo answers
 * `ls` on a file with an empty list, and on a directory with its links. An
 * empty directory is therefore indistinguishable from a file, and is read as a
 * file - the caller then leaves the gateway to serve it, which is what it
 * already did.
 */

import type { IpfsCrumb, IpfsDirEntry } from '../../types/ipfsDirectory';

/** The names a directory is served under when one of them is present. */
const INDEX_NAMES = ['index.html', 'index.htm'];

/**
 * Both spellings are accepted on purpose.
 *
 * The desktop bridge normalises kubo's `Links` to `{cid, name, size, type}`;
 * the mobile one used to pass `{Name, Hash, Size, Type}` straight through, and
 * every entry was silently dropped by the page reading the lowercase names -
 * `lumen://ipfs/<cid>` listed an empty folder on Android for content that was
 * there. Reading both costs three lines and removes the whole class of failure.
 */
function readRaw(entry: Record<string, unknown>): {
  name: string;
  cid: string;
  size: number | null;
  type: 'dir' | 'file';
} {
  const name = String(entry.name ?? entry.Name ?? '');
  const cid = String(entry.cid ?? entry.Hash ?? '');
  const rawSize = entry.size ?? entry.Size;
  const size = typeof rawSize === 'number' ? rawSize : null;

  // kubo says 1 for a directory and 2 for a file; the desktop bridge has
  // already turned that into a word by the time it arrives.
  const rawType = entry.type ?? entry.Type;
  const type = rawType === 'dir' || rawType === 1 ? 'dir' : 'file';

  return { name, cid, size, type };
}

/**
 * The entries of a directory, named, typed and sorted.
 *
 * @param raw     whatever `ipfsLs` put in `entries`.
 * @param relPath the path this listing sits at, '' at the root.
 */
export function mapDirectoryEntries(raw: unknown, relPath = ''): IpfsDirEntry[] {
  const list = Array.isArray(raw) ? raw : [];
  const base = String(relPath ?? '').replace(/^\/+|\/+$/g, '');

  const mapped = list
    .map((entry) => readRaw((entry ?? {}) as Record<string, unknown>))
    .filter((entry) => entry.name && entry.cid)
    .map((entry) => ({
      key: `${entry.cid}:${entry.name}`,
      name: entry.name,
      cid: entry.cid,
      type: entry.type,
      size: entry.size,
      relPath: base ? `${base}/${entry.name}` : entry.name
    }));

  // Folders first, then alphabetical - the order a file manager uses, and the
  // order the gateway's own page does not.
  mapped.sort((a, b) =>
    a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1
  );

  return mapped;
}

/**
 * The entry a browser would serve instead of listing the directory, or null.
 *
 * Its presence is the whole difference between "this is a website" and "this
 * is a folder of files".
 */
export function findIndexEntry(entries: IpfsDirEntry[]): IpfsDirEntry | null {
  const files = (Array.isArray(entries) ? entries : []).filter((e) => e.type === 'file');
  for (const name of INDEX_NAMES) {
    const found = files.find((entry) => entry.name.toLowerCase() === name);
    if (found) return found;
  }
  return null;
}

/**
 * Whether the app should draw this listing itself.
 *
 * True for a directory with nothing to serve in its place. A file, an empty
 * listing, or a directory carrying an index all stay with the gateway, which
 * renders the site as its author meant it.
 */
export function shouldRenderListing(entries: IpfsDirEntry[]): boolean {
  return entries.length > 0 && !findIndexEntry(entries);
}

/**
 * The entries whose name matches what was typed.
 *
 * Folded to lowercase and stripped of accents on both sides, so "resume"
 * finds "Résumé" - a directory listing is not a place to make someone spell
 * a filename exactly. Matching is a plain substring: a folder of 500 episodes
 * is searched by typing "e07", not by writing a pattern.
 */
export function filterDirectoryEntries(entries: IpfsDirEntry[], query: string): IpfsDirEntry[] {
  const list = Array.isArray(entries) ? entries : [];
  const needle = fold(query);
  if (!needle) return list;
  return list.filter((entry) => fold(entry.name).includes(needle));
}

/** Lowercase, unaccented, trimmed - the form both sides of a match share. */
function fold(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    // Combining marks, which is what an accent decomposes into.
    .replace(/[̀-ͯ]/g, '');
}

/** The path split into the steps above it, for the breadcrumb trail. */
export function directoryCrumbs(relPath: string): IpfsCrumb[] {
  const clean = String(relPath ?? '').replace(/^\/+|\/+$/g, '');
  if (!clean) return [];

  const parts = clean.split('/').filter(Boolean);
  return parts.map((label, index) => ({
    label,
    path: parts.slice(0, index + 1).join('/')
  }));
}

/**
 * The path of an entry, encoded segment by segment.
 *
 * `encodeURIComponent` on the whole path would turn its separators into %2F
 * and address a single file with slashes in its name.
 */
export function encodeEntryPath(relPath: string): string {
  return String(relPath ?? '')
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}
