export type DriveEntryKind =
  | 'folder'
  | 'image'
  | 'video'
  | 'audio'
  | 'archive'
  | 'book'
  | 'document'
  | 'file';

export type DriveThumbnailVariant = 'row' | 'preview';

/**
 * Everything needed to picture one entry, resolved by whoever owns the caches
 * and the gateway. Grouped so a row takes one prop instead of four.
 */
export interface DriveThumbnailSources {
  imageSrc?: string;
  videoSrc?: string;
  poster?: string;
  icon?: unknown;
}

export type DriveEntryAction =
  | 'details'
  | 'download'
  | 'convert'
  | 'share'
  | 'remove';
