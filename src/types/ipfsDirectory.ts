/**
 * One entry in an IPFS directory, as every listing in the app draws it.
 *
 * `relPath` is the path from the root the listing started at, which is what a
 * click has to navigate to - the entry's own CID would work too, but it would
 * drop the name from the URL and with it the breadcrumbs.
 */
export interface IpfsDirEntry {
  /** Stable across a re-list: the same CID under the same name is the same row. */
  key: string;
  name: string;
  cid: string;
  type: 'dir' | 'file';
  size: number | null;
  relPath: string;
}

/** One step of the path above the current directory. */
export interface IpfsCrumb {
  label: string;
  path: string;
}
