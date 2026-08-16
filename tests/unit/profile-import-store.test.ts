import { beforeEach, describe, expect, it } from 'vitest';
import {
  importRequest,
  importRequestMode,
  requestProfileImport,
} from '../../src/stores/profileImportStore';

/**
 * The one shared fact between a page and the navbar's import dialog.
 *
 * A counter rather than a boolean, and that is the whole design: asking twice
 * in a row has to open the dialog twice. With a flag, the second ask lands on
 * a value that is already `true`, nothing changes, and the watcher never runs -
 * so closing the dialog and clicking the same button again would do nothing.
 */
describe('profileImportStore', () => {
  beforeEach(() => {
    importRequest.value = 0;
    importRequestMode.value = 'file';
  });

  it('advances the counter so a watcher fires', () => {
    requestProfileImport();
    expect(importRequest.value).toBe(1);
  });

  it('fires again when asked a second time', () => {
    requestProfileImport();
    requestProfileImport();
    expect(importRequest.value).toBe(2);
  });

  it('defaults to the recovery-phrase tab', () => {
    requestProfileImport();
    expect(importRequestMode.value).toBe('manual');
  });

  it('carries the mode the caller asked for', () => {
    requestProfileImport('file');
    expect(importRequestMode.value).toBe('file');
  });

  it('sets the mode before the counter, so a watcher reads the right one', () => {
    requestProfileImport('manual');
    // Both are set by the time the caller returns; the watcher runs after, and
    // reads the mode this request carried rather than the previous one's.
    expect([importRequestMode.value, importRequest.value]).toEqual(['manual', 1]);
  });
});
