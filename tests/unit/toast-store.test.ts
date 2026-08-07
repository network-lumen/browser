import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addToast, removeToast, toastList } from '../../src/stores/toastStore';

/**
 * The global toast queue.
 *
 * Small, but it is a singleton every page writes into, so the things worth
 * pinning are the ones that would leak between them: ids must not collide, an
 * auto-dismiss must remove its own toast and not whatever has taken its place,
 * and an error must stay up longer than a confirmation because it is the one
 * the user actually needs to read.
 */

beforeEach(() => {
  vi.useFakeTimers();
  for (const toast of [...toastList.value]) removeToast(toast.id);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('adding', () => {
  it('queues a toast and returns its id', () => {
    const id = addToast('success', 'Copied');
    expect(toastList.value).toHaveLength(1);
    expect(toastList.value[0]).toMatchObject({ id, type: 'success', message: 'Copied' });
  });

  it('gives every toast a distinct id, even in the same millisecond', () => {
    const ids = [addToast('info', 'a'), addToast('info', 'b'), addToast('info', 'c')];
    expect(new Set(ids).size).toBe(3);
  });

  it('keeps errors up longer, because they are the ones worth reading', () => {
    addToast('error', 'Failed');
    addToast('success', 'Done');
    expect(toastList.value[0].duration).toBe(10000);
    expect(toastList.value[1].duration).toBe(4000);
  });

  it('makes errors copyable by default and everything else not', () => {
    addToast('error', 'Failed');
    addToast('info', 'Note');
    expect(toastList.value[0].copyable).toBe(true);
    expect(toastList.value[1].copyable).toBe(false);
  });

  it('honours the options it is given', () => {
    addToast('info', 'msg', { title: 'Heads up', duration: 1234, dismissible: false, copyable: true });
    expect(toastList.value[0]).toMatchObject({
      title: 'Heads up', duration: 1234, dismissible: false, copyable: true,
    });
  });

  it('keeps them in the order they arrived', () => {
    addToast('info', 'first');
    addToast('info', 'second');
    expect(toastList.value.map((t) => t.message)).toEqual(['first', 'second']);
  });
});

describe('dismissing', () => {
  it('removes a toast by id', () => {
    const id = addToast('info', 'a');
    removeToast(id);
    expect(toastList.value).toHaveLength(0);
  });

  it('ignores an id that is not there', () => {
    addToast('info', 'a');
    expect(() => removeToast('toast-does-not-exist')).not.toThrow();
    expect(toastList.value).toHaveLength(1);
  });

  it('auto-dismisses after its own duration', () => {
    addToast('success', 'Done');
    vi.advanceTimersByTime(3999);
    expect(toastList.value).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(toastList.value).toHaveLength(0);
  });

  it('removes only its own toast when several are queued', () => {
    // The timer closes over an id rather than an index, so a toast dismissed
    // by hand in the meantime must not shift the wrong one out.
    addToast('success', 'short');
    addToast('error', 'long');
    vi.advanceTimersByTime(4000);
    expect(toastList.value.map((t) => t.message)).toEqual(['long']);
    vi.advanceTimersByTime(6000);
    expect(toastList.value).toHaveLength(0);
  });

  it('leaves a toast up forever when its duration is zero', () => {
    addToast('info', 'sticky', { duration: 0 });
    vi.advanceTimersByTime(60_000);
    expect(toastList.value).toHaveLength(1);
  });

  it('does not throw when its toast was already dismissed by hand', () => {
    const id = addToast('info', 'a');
    removeToast(id);
    expect(() => vi.advanceTimersByTime(5000)).not.toThrow();
  });
});
