import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  installRendererErrorReporting,
  resetRendererErrorReporting,
} from '../../src/internal/services/errorReporting';

/**
 * The renderer's last-resort net.
 *
 * The main process has had one as long as it has had a log file; this side had
 * nothing, so an error thrown outside a `try` went to a devtools console
 * nobody opens and left no trace on disk.
 *
 * The throttle is the part that needs pinning. A render loop throwing on every
 * frame would otherwise turn one bug into an unbounded write to the user's
 * disk - which is the same reason the IPC channel behind this is guarded and
 * is not exposed to pages at all.
 */

let sent: any[];

function bridge(fn?: (payload: unknown) => void) {
  sent = [];
  (window as any).lumen = {
    appReportRendererError: fn || ((payload: unknown) => { sent.push(payload); }),
  };
}

function throwInWindow(error: unknown, extra: Partial<ErrorEvent> = {}) {
  window.dispatchEvent(Object.assign(new Event('error'), {
    error, message: String((error as any)?.message || error), filename: '', lineno: 0, colno: 0,
    ...extra,
  }));
}

function rejectInWindow(reason: unknown) {
  window.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason }));
}

beforeEach(() => {
  resetRendererErrorReporting();
  bridge();
  installRendererErrorReporting();
});

afterEach(() => {
  delete (window as any).lumen;
  resetRendererErrorReporting();
  vi.restoreAllMocks();
});

describe('what it captures', () => {
  it('reports an uncaught error with its stack and position', () => {
    throwInWindow(new Error('boom'), { filename: 'app.js', lineno: 12, colno: 7 });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      kind: 'error', message: 'boom', source: 'app.js', line: 12, column: 7,
    });
    expect(sent[0].stack).toContain('boom');
  });

  it('reports an unhandled rejection', () => {
    rejectInWindow(new Error('async boom'));
    expect(sent[0]).toMatchObject({ kind: 'unhandledrejection', message: 'async boom' });
  });

  it('describes a rejected plain object instead of [object Object]', () => {
    // What a rejected IPC reply looks like.
    rejectInWindow({ ok: false, error: 'node_unreachable' });
    expect(sent[0].message).toContain('node_unreachable');
  });

  it('describes a thrown string and a thrown null', () => {
    rejectInWindow('just a string');
    expect(sent[0].message).toBe('just a string');
    resetRendererErrorReporting();
    bridge();
    installRendererErrorReporting();
    rejectInWindow(null);
    expect(sent[0].message).toBe('null');
  });

  it('records where it happened', () => {
    throwInWindow(new Error('boom'));
    expect(typeof sent[0].url).toBe('string');
  });
});

describe('the throttle', () => {
  it('reports one identical error once, not once per frame', () => {
    for (let i = 0; i < 50; i += 1) throwInWindow(new Error('same'), { lineno: 1, colno: 1 });
    expect(sent).toHaveLength(1);
  });

  it('still reports a different error', () => {
    throwInWindow(new Error('first'), { lineno: 1 });
    throwInWindow(new Error('second'), { lineno: 2 });
    expect(sent).toHaveLength(2);
  });

  it('stops after its budget, so a storm cannot fill the disk', () => {
    for (let i = 0; i < 100; i += 1) throwInWindow(new Error(`distinct ${i}`), { lineno: i });
    expect(sent.length).toBeLessThanOrEqual(20);
  });

  it('opens a fresh window once the old one has passed', () => {
    vi.useFakeTimers();
    throwInWindow(new Error('same'), { lineno: 1, colno: 1 });
    expect(sent).toHaveLength(1);
    vi.setSystemTime(Date.now() + 11_000);
    throwInWindow(new Error('same'), { lineno: 1, colno: 1 });
    expect(sent).toHaveLength(2);
    vi.useRealTimers();
  });
});

describe('when it cannot report', () => {
  it('does not throw with no bridge at all', () => {
    resetRendererErrorReporting();
    delete (window as any).lumen;
    installRendererErrorReporting();
    expect(() => throwInWindow(new Error('boom'))).not.toThrow();
  });

  it('does not turn one error into two when the reporter itself throws', () => {
    resetRendererErrorReporting();
    bridge(() => { throw new Error('bridge gone'); });
    installRendererErrorReporting();
    expect(() => throwInWindow(new Error('boom'))).not.toThrow();
  });

  it('installs once, however many times it is called', () => {
    resetRendererErrorReporting();
    bridge();
    installRendererErrorReporting();
    installRendererErrorReporting();
    installRendererErrorReporting();
    throwInWindow(new Error('once'), { lineno: 3 });
    expect(sent).toHaveLength(1);
  });
});
