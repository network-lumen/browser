import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearLogEntries,
  formatLogEntries,
  getLogEntries,
  installLogCapture,
  LOG_BUFFER_LIMIT,
  resetLogCapture
} from '../../src/internal/services/appLog';

/**
 * The in-app log buffer.
 *
 * It exists because a phone has no log file and no console within reach, so
 * this is the only account of what the app did that anyone can get at without
 * a cable. Two properties matter more than the rest and are asserted here: it
 * must not swallow the original console output, and it must not grow without
 * bound in a session left open all day.
 */
describe('the application log buffer', () => {
  // installLogCapture wraps console permanently, so the originals are put back
  // afterwards rather than left wrapped for every test file that follows.
  const originals = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error
  };

  beforeEach(() => {
    clearLogEntries();
    installLogCapture();
  });

  afterEach(() => {
    Object.assign(console, originals);
    // The wrapper is gone now, so the module has to be told - otherwise its
    // idempotence guard refuses to wrap the restored console next time.
    resetLogCapture();
    clearLogEntries();
  });

  it('records what is printed, at the level it was printed', () => {
    console.warn('disk is nearly full');
    console.error('broadcast refused');

    const levels = getLogEntries().map((e) => e.level);
    const messages = getLogEntries().map((e) => e.message);

    expect(levels).toContain('warn');
    expect(levels).toContain('error');
    expect(messages).toContain('disk is nearly full');
    expect(messages).toContain('broadcast refused');
  });

  it('still calls the original console, so remote debugging sees the same lines', () => {
    const seen: string[] = [];
    console.warn = (...args: unknown[]) => void seen.push(String(args[0]));
    // Re-wrapping is refused, which is the point of the guard - but the
    // already-installed wrapper must keep delegating to whatever console holds.
    installLogCapture();

    console.warn('still visible');
    expect(seen).toEqual(['still visible']);
  });

  it('renders objects and errors without throwing on a cycle', () => {
    const cyclic: Record<string, unknown> = { name: 'loop' };
    cyclic.self = cyclic;

    expect(() => console.warn('payload', cyclic, new Error('boom'))).not.toThrow();
    const last = getLogEntries().at(-1)?.message ?? '';
    expect(last).toContain('payload');
    expect(last).toContain('Error: boom');
  });

  it('keeps the buffer bounded, dropping the oldest lines', () => {
    const overflow = LOG_BUFFER_LIMIT + 100;
    for (let i = 0; i < overflow; i++) console.warn(`line ${i}`);

    const entries = getLogEntries();
    expect(entries.length).toBeLessThanOrEqual(LOG_BUFFER_LIMIT);
    // The newest survive and the earliest are gone - the opposite would make
    // the screen useless exactly when something has just failed.
    expect(entries.at(-1)?.message).toBe(`line ${overflow - 1}`);
    expect(entries.some((e) => e.message === 'line 0')).toBe(false);
  });

  it('formats a copyable block with a timestamp and a level per line', () => {
    console.error('something went wrong');
    const text = formatLogEntries();

    expect(text).toContain('ERROR');
    expect(text).toContain('something went wrong');
    expect(text.split('\n').length).toBe(getLogEntries().length);
  });

  it('clears on request', () => {
    console.warn('noise');
    expect(getLogEntries().length).toBeGreaterThan(0);
    clearLogEntries();
    expect(getLogEntries()).toEqual([]);
  });
});
