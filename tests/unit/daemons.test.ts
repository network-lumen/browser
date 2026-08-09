import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubElectron } from './support/electronStub';

const { defineDaemon } = stubElectron().load<any>('daemons/daemon.cjs');

/**
 * The lifecycle every background loop in the app shares.
 *
 * Eight of them used to schedule themselves, four different ways, and three
 * could not be stopped. The rules below are the ones those eight disagreed
 * about, so they are worth holding: a tick never overlaps itself, a throwing
 * tick does not kill the loop, and stop() actually stops it.
 */

afterEach(() => {
  vi.useRealTimers();
});

function tickingDaemon(tick: () => unknown, over: Record<string, unknown> = {}) {
  // firstRunMs above the runtime's 50ms floor, so the timings below are the
  // ones the daemon actually uses.
  return defineDaemon({ name: 'test', everyMs: 1_000, firstRunMs: 100, tick, ...over });
}

describe('defineDaemon', () => {
  it('refuses a definition it could not run', () => {
    expect(() => defineDaemon({ name: 'x', everyMs: 1_000 })).toThrow();
    expect(() => defineDaemon({ name: 'x', everyMs: 0, tick: () => {} })).toThrow();
  });

  it('runs on its own schedule and stops when told', async () => {
    vi.useFakeTimers();
    let runs = 0;
    const d = tickingDaemon(() => {
      runs += 1;
    });

    expect(d.start()).toBe(true);
    await vi.advanceTimersByTimeAsync(150);
    expect(runs).toBe(1);

    await vi.advanceTimersByTimeAsync(2_100);
    expect(runs).toBe(3);

    d.stop();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(runs).toBe(3);
  });

  it('starts once, however many times it is asked', async () => {
    vi.useFakeTimers();
    let runs = 0;
    const d = tickingDaemon(() => {
      runs += 1;
    });
    expect(d.start()).toBe(true);
    expect(d.start()).toBe(false);
    await vi.advanceTimersByTimeAsync(150);
    // Two schedules would double every tick from here on.
    expect(runs).toBe(1);
    d.stop();
  });

  it('does not stack a tick on top of one still running', async () => {
    vi.useFakeTimers();
    let started = 0;
    let release: (() => void) | null = null;
    const d = tickingDaemon(
      () =>
        new Promise<void>((resolve) => {
          started += 1;
          release = resolve;
        })
    );

    d.start();
    await vi.advanceTimersByTimeAsync(150);
    expect(started).toBe(1);

    // The period elapses several times while the first tick is still pending.
    await vi.advanceTimersByTimeAsync(5_000);
    expect(started).toBe(1);

    release?.();
    d.stop();
  });

  it('survives a throwing tick and keeps its schedule', async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let runs = 0;
    const d = tickingDaemon(() => {
      runs += 1;
      throw new Error('boom');
    });

    d.start();
    await vi.advanceTimersByTimeAsync(150);
    await vi.advanceTimersByTimeAsync(1_100);
    expect(runs).toBe(2);
    expect(d.status().lastError).toBe('boom');

    d.stop();
    warn.mockRestore();
  });

  it('never starts when its enabled() says no', async () => {
    vi.useFakeTimers();
    let runs = 0;
    const d = tickingDaemon(() => {
      runs += 1;
    }, { enabled: () => false });

    expect(d.start()).toBe(false);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(runs).toBe(0);
  });

  it('reports what it is doing', () => {
    const d = tickingDaemon(() => {});
    expect(d.status()).toMatchObject({ name: 'test', running: false, everyMs: 1_000 });
    d.start();
    expect(d.status().running).toBe(true);
    d.stop();
    expect(d.status().running).toBe(false);
  });
});

describe('the registry', () => {
  // The app boots by calling startDaemons(). Nothing else here loads
  // daemons/index.cjs, so a mistyped export in a declaration would only show up
  // when someone launches the app - this is the check that replaces that.
  const { daemons, daemonStatuses } = stubElectron().load<any>('daemons/index.cjs');

  it('declares every background loop with a real tick and a sane period', () => {
    expect(daemons.length).toBeGreaterThan(0);
    for (const d of daemons) {
      const status = d.status();
      expect(typeof d.name).toBe('string');
      expect(d.name).not.toBe('');
      expect(status.everyMs).toBeGreaterThan(0);
      expect(status.running).toBe(false);
    }
  });

  it('gives every loop a distinct name, since that is how they are read in a log', () => {
    const names = daemons.map((d: any) => d.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('lists one status per declared daemon', () => {
    expect(daemonStatuses()).toHaveLength(daemons.length);
  });
});
