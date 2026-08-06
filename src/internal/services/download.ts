/**
 * Handing a file to the user.
 *
 * Five places built this by hand and four of them built it the fragile way:
 * create an object URL, click a detached anchor, then revoke the URL on the
 * very next statement. Revoking synchronously after click() can outrun the
 * browser actually starting the download, and a detached anchor has
 * historically not fired at all in Firefox. The fifth - the Drive backup
 * export - did it properly, with the anchor in the document and the revoke
 * deferred; that one is presumably what someone wrote after hitting the
 * problem. This is that version, for everyone.
 */
function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename || 'download';
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadBlob(blob: Blob, filename: string): void {
  saveBlob(blob, filename);
}

export function downloadTextFile(
  filename: string,
  text: string,
  mime = 'application/json'
): void {
  saveBlob(new Blob([text], { type: mime }), filename || 'download.json');
}

/** For content fetched over IPC, which arrives as a plain number array. */
export function downloadBytes(
  bytes: Uint8Array | ArrayLike<number>,
  filename: string,
  mime?: string
): void {
  // .buffer rather than the view itself: a Uint8Array is typed over
  // ArrayBufferLike, which includes SharedArrayBuffer and so is not a BlobPart.
  const view = Uint8Array.from(bytes);
  const buffer = view.buffer as ArrayBuffer;
  saveBlob(new Blob([buffer], mime ? { type: mime } : undefined), filename);
}

/**
 * Strips what a filesystem will not accept from a value destined for a
 * filename - reserved characters, control characters, and the trailing dots
 * and spaces Windows silently drops.
 */
export function sanitizeFilenameSegment(input: string): string {
  const raw = String(input || '').trim();
  if (!raw) return '';
  let out = raw
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');
  if (out.length > 64) out = out.slice(0, 64).trim();
  return out;
}
