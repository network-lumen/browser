import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyToClipboard, copyToClipboardWithToast } from '../../src/composables/useClipboard';
import { removeToast, toastList } from '../../src/stores/toastStore';

/**
 * Copying, and saying so.
 *
 * `navigator.clipboard.writeText` rejects in Electron depending on window
 * focus and origin, which is why the main-process bridge exists behind it -
 * without the fallback, copying silently fails on exactly the screens where
 * people copy an address. The wording is deliberately not an argument: nine
 * call sites each had their own pair, which is nine ways of saying one of two
 * things.
 */

function setClipboard(writeText: unknown) {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
}

beforeEach(() => {
  for (const toast of [...toastList.value]) removeToast(toast.id);
});

afterEach(() => {
  delete (window as any).lumen;
  vi.restoreAllMocks();
});

describe('copyToClipboard', () => {
  it('uses the browser API when it works', async () => {
    const writeText = vi.fn(async () => {});
    setClipboard(writeText);
    await expect(copyToClipboard('hello')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('falls back to the main process when the browser API rejects', async () => {
    // The reason this fallback exists at all.
    setClipboard(async () => { throw new Error('NotAllowedError'); });
    const clipboardWriteText = vi.fn(async () => true);
    (window as any).lumen = { clipboardWriteText };
    await expect(copyToClipboard('hello')).resolves.toBe(true);
    expect(clipboardWriteText).toHaveBeenCalledWith('hello');
  });

  it('accepts either shape the bridge answers with', async () => {
    setClipboard(async () => { throw new Error('denied'); });
    (window as any).lumen = { clipboardWriteText: async () => ({ ok: true }) };
    await expect(copyToClipboard('hello')).resolves.toBe(true);
  });

  it('reports failure when both routes fail', async () => {
    setClipboard(async () => { throw new Error('denied'); });
    (window as any).lumen = { clipboardWriteText: async () => ({ ok: false }) };
    await expect(copyToClipboard('hello')).resolves.toBe(false);
  });

  it('reports failure when there is no bridge to fall back to', async () => {
    setClipboard(async () => { throw new Error('denied'); });
    delete (window as any).lumen;
    await expect(copyToClipboard('hello')).resolves.toBe(false);
  });

  it('never rejects, even when the bridge itself throws', async () => {
    setClipboard(async () => { throw new Error('denied'); });
    (window as any).lumen = { clipboardWriteText: async () => { throw new Error('ipc gone'); } };
    await expect(copyToClipboard('hello')).resolves.toBe(false);
  });
});

describe('copyToClipboardWithToast', () => {
  it('says Copied, and nothing else', async () => {
    // The message takes no parameter on purpose - the user knows what they
    // clicked, and naming it back at them only guarantees the wordings drift.
    setClipboard(async () => {});
    await expect(copyToClipboardWithToast('lmn1abc')).resolves.toBe(true);
    expect(toastList.value[0]).toMatchObject({ message: 'Copied', type: 'success' });
  });

  it('says Failed to copy when it did not work', async () => {
    setClipboard(async () => { throw new Error('denied'); });
    delete (window as any).lumen;
    await expect(copyToClipboardWithToast('lmn1abc')).resolves.toBe(false);
    expect(toastList.value[0]).toMatchObject({ message: 'Failed to copy', type: 'error' });
  });

  it('takes no wording argument at all', () => {
    expect(copyToClipboardWithToast.length).toBe(1);
  });
});
