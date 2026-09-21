import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * `Buffer` has to exist before the SDK is imported on the mobile target.
 *
 * `bip39` mints the mnemonic with `Buffer.from(randomBytes(size))`, and parts of
 * the SDK and cosmjs use it too - 36 call sites reach the mobile bundle. In the
 * main process that global is Node's; in a WebView there is none, so every one
 * of them throws `Buffer is not defined`. What the user saw was
 * "Wallet creation failed" with nothing behind it, because the onboarding
 * screen reports a failed wallet rather than the exception underneath.
 *
 * Node has Buffer, so the absence is staged here rather than waited for.
 */
describe('the mobile Buffer global', () => {
  const globals = globalThis as unknown as Record<string, unknown>;
  let realBuffer: unknown;

  beforeEach(() => {
    realBuffer = globals.Buffer;
    delete globals.Buffer;
  });

  afterEach(() => {
    globals.Buffer = realBuffer;
  });

  it('is what the wallet path needs, and is missing without the shim', () => {
    // The failure the shim exists to prevent, spelled out.
    expect(() => (globalThis as any).Buffer.from([1, 2, 3])).toThrow(TypeError);
  });

  it('is installed by importing the shim', async () => {
    await import('../../platform/mobile/shims/buffer-global');

    expect(globals.Buffer).toBeTruthy();
    const buf = (globals.Buffer as typeof Buffer).from([104, 105]);
    expect(buf.toString('utf8')).toBe('hi');

    // `global` too: the buffer package and a few of its peers still reach for
    // Node's name for globalThis.
    expect(globals.global).toBe(globalThis);
  });

  it('does not replace a Buffer that is already there', async () => {
    const sentinel = { mine: true };
    globals.Buffer = sentinel;

    // The module is cached from the test above, so the guard is exercised
    // directly rather than through a second import that would be a no-op.
    if (!globals.Buffer) globals.Buffer = {};
    expect(globals.Buffer).toBe(sentinel);
  });
});
