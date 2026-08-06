import {
  BookOpen,
  File,
  FileArchive,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Folder,
} from 'lucide-vue-next';
import type { DriveEntryKind } from '../../types/drive';
import type { DriveFile } from '../../types/upload';

/**
 * What kind of thing a Drive entry is, from its name.
 *
 * The extension lists lived inside DrivePage, written out twice - once to pick
 * an icon and once to build a "type-image"-style class name. Two copies of one
 * table is one copy too many: adding .avif to the icon list and forgetting the
 * other would have left the two disagreeing about the same file.
 *
 * (The class-name copy turned out to be dead - nothing in the repo defines
 * .type-image or its siblings - so it was deleted rather than folded in here.)
 *
 * Folder and HLS are deliberately absent: neither can be decided from a name.
 * The page knows those from caches it fills as it browses, and passes the
 * answer down.
 */
const EXTENSIONS: Array<[DriveEntryKind, string[]]> = [
  ['image', ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp']],
  ['video', ['mp4', 'webm', 'mov', 'avi', 'mkv']],
  ['audio', ['mp3', 'wav', 'ogg', 'flac', 'm4a']],
  ['archive', ['zip', 'rar', '7z', 'tar', 'gz']],
  ['book', ['epub']],
  ['document', ['pdf', 'doc', 'docx', 'txt', 'md']],
];

export const DRIVE_ENTRY_ICONS: Record<DriveEntryKind, unknown> = {
  folder: Folder,
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  archive: FileArchive,
  book: BookOpen,
  document: FileText,
  file: File,
};

function extensionOf(name: string): string {
  return String(name || '').split('.').pop()?.toLowerCase() || '';
}

export function isImageFile(name: string): boolean {
  return EXTENSIONS[0][1].includes(extensionOf(name));
}

export function isVideoFile(name: string): boolean {
  return EXTENSIONS[1][1].includes(extensionOf(name));
}

/**
 * True for an HLS stream: a playlist by path or name, or a directory the
 * converter named "<something> - HLS".
 */
export function isHlsEntry(file: DriveFile | null | undefined): boolean {
  const rel = String(file?.relPath || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .toLowerCase();
  if (rel.endsWith('.m3u8')) return true;

  const name = String(file?.name || '').trim();
  if (name.toLowerCase().endsWith('.m3u8')) return true;
  return /\s-\s*hls$/i.test(name);
}

/**
 * `book` is a flag rather than being read from the name because an EPUB can
 * also be recognised from its content type, which only the page has. It is
 * consulted at the position the old code checked it - after archives, before
 * documents - so a .png that reports itself as an EPUB stays an image, as it
 * did before.
 */
export function driveEntryKindFromName(
  name: string,
  flags: { book?: boolean } = {}
): DriveEntryKind {
  const ext = extensionOf(name);
  for (const [kind, extensions] of EXTENSIONS) {
    if (extensions.includes(ext)) return kind;
    if (kind === 'book' && flags.book) return 'book';
  }
  return 'file';
}
