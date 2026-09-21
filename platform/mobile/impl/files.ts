/**
 * Getting a file out of, and into, the app on Android.
 *
 * The first version of the backup export built a Blob, made an `<a download>`
 * and clicked it. That is the right move in a browser and does nothing at all
 * in a WebView: an Android WebView has no download manager of its own, so
 * unless the host app installs a DownloadListener the click is simply
 * swallowed. No file, no error, no clue - which is exactly what was reported.
 *
 * So the file is written to a real directory with Capacitor's Filesystem and
 * then offered to the share sheet, which is the gesture an Android user
 * actually has for "put this somewhere I choose". The path is reported back so
 * the UI can say where it went even if the sheet is dismissed.
 */

import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { SavedFile } from '../../../src/types/platformBridge';

/**
 * Writes `contents` and offers it to the share sheet.
 *
 * `Directory.Documents` rather than `Cache`: a wallet backup that the system
 * may delete to reclaim space is not a backup. It is also a directory the user
 * can reach with any file manager, which matters when the whole point is to
 * copy the file somewhere safe.
 */
export async function saveAndShare(
  filename: string,
  contents: string,
  shareTitle: string
): Promise<SavedFile> {
  try {
    const written = await Filesystem.writeFile({
      path: filename,
      data: contents,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true
    });

    try {
      await Share.share({ title: shareTitle, text: shareTitle, url: written.uri });
      return { ok: true, path: filename, uri: written.uri, shared: true };
    } catch {
      // A dismissed share sheet is not a failed export - the file is on disk
      // either way, and saying otherwise would send the user looking for a
      // problem that does not exist.
      return { ok: true, path: filename, uri: written.uri, shared: false };
    }
  } catch (e) {
    return { ok: false, error: String(e instanceof Error ? e.message : e) };
  }
}

/**
 * Opens the system file chooser and reads what comes back.
 *
 * A file input is used rather than a native picker plugin: the WebView's own
 * chooser already reaches Drive, Downloads and every other provider the device
 * has, and it hands back the contents directly instead of a path this target
 * has no way to read.
 */
export function pickTextFile(accept = 'application/json,.json'): Promise<{
  name: string;
  text: string;
} | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        resolve({ name: file.name, text: await file.text() });
      } catch {
        resolve(null);
      }
    };

    // A cancelled chooser fires no change event, so the promise would hang
    // forever without this; 'cancel' is dispatched by current WebViews.
    input.oncancel = () => resolve(null);
    input.click();
  });
}
