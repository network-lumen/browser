/**
 * Uploading a file to IPFS from a phone, without changing the code that does
 * the uploading.
 *
 * `src/internal/common/upload.ts` is written around filesystem paths: a dialog
 * hands back a list of them, and each is passed to `ipfsAddPathWithProgress`
 * for the main process to read off disk. Neither half of that exists here -
 * the WebView's file chooser returns `File` objects, never paths, and there is
 * no process able to open one by name afterwards.
 *
 * Rather than branch that flow on the platform, the two ends are adapted so
 * the middle never notices. The chooser stashes the files it got and returns
 * synthetic paths naming them; the add-by-path call looks a path back up and
 * uploads the bytes it was holding. What travels between the two is a string
 * either way, which is all upload.ts ever assumed.
 *
 * The stash is per-run and in memory. A path is valid until the app is closed,
 * which is longer than the seconds that pass between choosing a file and
 * sending it.
 */

import { IPFS_MEMBERS } from './ipfs';

/** The scheme marks a handle as ours, so a real path is never mistaken for one. */
const HANDLE_PREFIX = 'lumen-picked://';

const picked = new Map<string, File>();
let counter = 0;

function stash(file: File): string {
  const handle = `${HANDLE_PREFIX}${++counter}/${encodeURIComponent(file.name)}`;
  picked.set(handle, file);
  return handle;
}

/** The file a handle names, or null when the string is not one of ours. */
export function resolvePickedFile(path: unknown): File | null {
  const key = String(path ?? '');
  return key.startsWith(HANDLE_PREFIX) ? (picked.get(key) ?? null) : null;
}

function openChooser(multiple: boolean, accept?: string): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = multiple;
    if (accept) input.accept = accept;

    input.onchange = () => resolve([...(input.files ?? [])]);
    // A cancelled chooser fires no change event, so without this the promise
    // would never settle and the upload button would spin forever.
    input.oncancel = () => resolve([]);
    input.click();
  });
}

export const UPLOAD_MEMBERS = {
  /**
   * The system file chooser, answering in the shape the dialog did.
   *
   * `paths` carries handles rather than filesystem paths - see the note at the
   * top of this file. upload.ts trims and filters them as strings and passes
   * them straight back to us.
   */
  dialogOpenFiles: async (options?: { multi?: boolean; accept?: string }) => {
    // Logged at every step: the upload path crosses a native file chooser, a
    // node and a gateway, and when it "does nothing" the only useful question
    // is which of the three it got to. These land in Settings > Troubleshooting.
    console.warn('[upload] opening the file chooser');
    const files = await openChooser(options?.multi !== false, options?.accept);
    console.warn(`[upload] chooser returned ${files.length} file(s)`);
    if (!files.length) return { ok: true, canceled: true, paths: [] };
    return { ok: true, canceled: false, paths: files.map(stash) };
  },

  /**
   * Android's chooser has no directory mode that returns something readable
   * here, so this stays refused rather than pretending. The UI offering it
   * should be hidden on this target.
   */
  dialogOpenFolder: async () => ({
    ok: false,
    canceled: true,
    paths: [],
    error: 'folder_picker_unsupported_on_mobile'
  }),

  /** Uploads the bytes behind a handle. The progress callback is not used. */
  ipfsAddPathWithProgress: async (input: { filePath?: string; filename?: string }) => {
    const file = resolvePickedFile(input?.filePath);
    if (!file) {
      console.warn('[upload] no file behind handle', input?.filePath);
      return { ok: false, error: 'file_handle_expired_or_unknown' };
    }
    console.warn(`[upload] adding "${file.name}" (${file.size} bytes) to IPFS`);
    const result: any = await IPFS_MEMBERS.ipfsAdd(file, input?.filename ?? file.name);
    console.warn('[upload] add result', result?.ok ? `cid ${result.cid}` : `failed: ${result?.error}`);
    return result;
  },

  ipfsAddPath: async (input: { filePath?: string; filename?: string } | string) => {
    const path = typeof input === 'string' ? input : input?.filePath;
    const file = resolvePickedFile(path);
    if (!file) return { ok: false, error: 'file_handle_expired_or_unknown' };
    return IPFS_MEMBERS.ipfsAdd(file, (typeof input === 'object' && input?.filename) || file.name);
  },

  /**
   * Nothing is chunked, so there is no upload in flight to call off - but the
   * caller is told plainly rather than left with a rejected promise it did not
   * expect.
   */
  ipfsCancelAdd: async () => ({ ok: true, canceled: false, reason: 'upload_is_not_resumable_here' })
};
