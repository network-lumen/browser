import { describe, expect, it } from 'vitest';
import {
  driveEntryKindFromName,
  imageMimeFromName,
  isEpubEntry,
  isEpubName,
  isHlsEntry,
  isImageFile,
  isVideoFile,
} from '../../src/internal/services/driveEntries';

describe('classifying an entry by name', () => {
  it('recognises each kind it knows', () => {
    expect(driveEntryKindFromName('a.png')).toBe('image');
    expect(driveEntryKindFromName('a.mkv')).toBe('video');
    expect(driveEntryKindFromName('a.flac')).toBe('audio');
    expect(driveEntryKindFromName('a.7z')).toBe('archive');
    expect(driveEntryKindFromName('a.epub')).toBe('book');
    expect(driveEntryKindFromName('a.md')).toBe('document');
    expect(driveEntryKindFromName('a.xyz')).toBe('file');
    expect(driveEntryKindFromName('noextension')).toBe('file');
  });

  it('ignores case and reads only the last extension', () => {
    expect(driveEntryKindFromName('A.PNG')).toBe('image');
    expect(driveEntryKindFromName('archive.zip.mp4')).toBe('video');
  });

  it('consults the book flag where the old code did, not before it', () => {
    // A .png that reports itself as an EPUB stays an image: the extension wins
    // for kinds checked earlier in the list.
    expect(driveEntryKindFromName('cover.png', { book: true })).toBe('image');
    expect(driveEntryKindFromName('mystery.bin', { book: true })).toBe('book');
    expect(driveEntryKindFromName('notes.pdf', { book: true })).toBe('book');
  });
});

describe('every image the Drive classifies, it can also type', () => {
  it('never calls a file an image without knowing its MIME type', () => {
    // These were two separate lists of the same seven extensions. Deriving one
    // from the other is what keeps them from drifting - so this is the test
    // that would fail if someone added an eighth to only one of them.
    for (const ext of ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif', 'heic', 'tiff']) {
      const name = `photo.${ext}`;
      if (isImageFile(name)) {
        expect(imageMimeFromName(name)).toMatch(/^image\//);
      } else {
        expect(imageMimeFromName(name)).toBe('application/octet-stream');
      }
    }
  });

  it('maps the aliases onto one type', () => {
    expect(imageMimeFromName('a.jpg')).toBe('image/jpeg');
    expect(imageMimeFromName('a.jpeg')).toBe('image/jpeg');
    expect(imageMimeFromName('a.svg')).toBe('image/svg+xml');
  });

  it('refuses to guess for anything else', () => {
    expect(imageMimeFromName('a.mp4')).toBe('application/octet-stream');
    expect(imageMimeFromName('')).toBe('application/octet-stream');
  });
});

describe('the simple predicates', () => {
  it('agrees with the classifier', () => {
    expect(isImageFile('a.webp')).toBe(true);
    expect(isImageFile('a.mp4')).toBe(false);
    expect(isVideoFile('a.mov')).toBe(true);
    expect(isVideoFile('a.png')).toBe(false);
  });
});

describe('spotting an EPUB', () => {
  it('takes the extension when there is one', () => {
    expect(isEpubName('book.epub')).toBe(true);
    expect(isEpubName('book.EPUB')).toBe(true);
    expect(isEpubName('book.pdf')).toBe(false);
  });

  it('falls back to the content type, which only the page knows', () => {
    expect(isEpubEntry('book', 'application/epub+zip')).toBe(true);
    expect(isEpubEntry('book', 'application/pdf')).toBe(false);
    expect(isEpubEntry('book', undefined)).toBe(false);
  });
});

describe('spotting an HLS stream', () => {
  it('takes a playlist by path or by name', () => {
    expect(isHlsEntry({ cid: 'c', name: 'x', relPath: 'a/master.m3u8' } as any)).toBe(true);
    expect(isHlsEntry({ cid: 'c', name: 'master.M3U8' } as any)).toBe(true);
  });

  it('takes the directory the converter names', () => {
    expect(isHlsEntry({ cid: 'c', name: 'My clip - HLS' } as any)).toBe(true);
    expect(isHlsEntry({ cid: 'c', name: 'My clip -hls' } as any)).toBe(true);
    expect(isHlsEntry({ cid: 'c', name: 'HLS notes' } as any)).toBe(false);
  });

  it('says no to nothing at all', () => {
    expect(isHlsEntry(null)).toBe(false);
    expect(isHlsEntry(undefined)).toBe(false);
  });
});
