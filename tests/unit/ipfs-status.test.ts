import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkIpfsStatus } from '../../src/internal/common/ipfs';

/**
 * The gate in front of every Drive upload.
 *
 * It had both halves wrong at once, in opposite directions, which is why it
 * gets its own file. `ipfs:status` answers `{ok: true}` or `{ok: false}` and
 * the raw reply was handed back as a boolean - both are truthy objects, so the
 * caller's `if (!await checkIpfsStatus())` never once fired. And the bridge was
 * captured into a module-level constant at import, so loading this module
 * before the preload attached refused every upload for the rest of the session.
 */

afterEach(() => {
  delete (window as any).lumen;
  vi.restoreAllMocks();
});

describe('checkIpfsStatus', () => {
  it('is true when the daemon answers ok', async () => {
    (window as any).lumen = { ipfsStatus: async () => ({ ok: true }) };
    await expect(checkIpfsStatus()).resolves.toBe(true);
  });

  it('is false when the daemon answers not ok', async () => {
    // The whole point. A truthy `{ok: false}` used to read as connected.
    (window as any).lumen = { ipfsStatus: async () => ({ ok: false, error: 'http_500' }) };
    await expect(checkIpfsStatus()).resolves.toBe(false);
  });

  it('is false for a reply that is merely truthy', async () => {
    for (const reply of [{}, { running: true }, 'yes', 1, []]) {
      (window as any).lumen = { ipfsStatus: async () => reply };
      await expect(checkIpfsStatus()).resolves.toBe(false);
    }
  });

  it('reads the bridge on every call, not once at import', async () => {
    // A module-level capture made this permanently false when the module
    // loaded before the preload attached.
    delete (window as any).lumen;
    await expect(checkIpfsStatus()).resolves.toBe(false);

    (window as any).lumen = { ipfsStatus: async () => ({ ok: true }) };
    await expect(checkIpfsStatus()).resolves.toBe(true);
  });

  it('is false with no bridge and with no method on it', async () => {
    delete (window as any).lumen;
    await expect(checkIpfsStatus()).resolves.toBe(false);
    (window as any).lumen = {};
    await expect(checkIpfsStatus()).resolves.toBe(false);
  });

  it('never rejects when the call itself fails', async () => {
    (window as any).lumen = { ipfsStatus: async () => { throw new Error('ipc gone'); } };
    await expect(checkIpfsStatus()).resolves.toBe(false);
  });

  it('waits for the answer rather than judging the promise', async () => {
    // Returning the un-awaited promise is how the object reached the caller.
    let resolved = false;
    (window as any).lumen = {
      ipfsStatus: () => new Promise((resolve) => {
        setTimeout(() => { resolved = true; resolve({ ok: true }); }, 0);
      }),
    };
    await expect(checkIpfsStatus()).resolves.toBe(true);
    expect(resolved).toBe(true);
  });
});
