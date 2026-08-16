import { beforeEach, describe, expect, it } from 'vitest';
import { useToast } from '../../src/composables/useToast';
import { removeToast, toastList } from '../../src/stores/toastStore';

/**
 * The four toast helpers, and the one that picks between them by argument.
 *
 * `show` is here because five pages had each grown their own copy of that
 * dispatch, differing only in which of the four types they bothered to handle
 * - so passing 'warning' to the wrong one silently produced a success toast,
 * which is the one outcome a warning must never be mistaken for.
 */

const toast = useToast();
const last = () => toastList.value[toastList.value.length - 1];

beforeEach(() => {
  for (const t of [...toastList.value]) removeToast(t.id);
});

describe('the four named helpers', () => {
  it('each raise their own type', () => {
    toast.success('a');
    expect(last()).toMatchObject({ type: 'success', message: 'a' });
    toast.error('b');
    expect(last()).toMatchObject({ type: 'error', message: 'b' });
    toast.warning('c');
    expect(last()).toMatchObject({ type: 'warning', message: 'c' });
    toast.info('d');
    expect(last()).toMatchObject({ type: 'info', message: 'd' });
  });

  it('pass their options along', () => {
    toast.info('x', { title: 'Heads up', duration: 50 });
    expect(last()).toMatchObject({ title: 'Heads up', duration: 50 });
  });
});

describe('show', () => {
  it('handles all four types, which the hand-written copies did not', () => {
    for (const type of ['success', 'error', 'warning', 'info'] as const) {
      toast.show('m', type);
      expect(last().type).toBe(type);
    }
  });

  it('defaults to success when no type is given', () => {
    toast.show('m');
    expect(last().type).toBe('success');
  });
});

describe('fromResult', () => {
  it('reports a success and says so', () => {
    expect(toast.fromResult({ ok: true }, 'Saved')).toBe(true);
    expect(last()).toMatchObject({ type: 'success', message: 'Saved' });
  });

  it('reports a failure with the error it was given', () => {
    expect(toast.fromResult({ ok: false, error: 'disk_full' })).toBe(false);
    expect(last()).toMatchObject({ type: 'error', message: 'disk_full' });
  });

  it('has something to say when the failure carries no error', () => {
    toast.fromResult({ ok: false });
    expect(last()).toMatchObject({ type: 'error' });
    expect(last().message).toBeTruthy();
  });

  it('has something to say when the success carries no message', () => {
    toast.fromResult({ ok: true });
    expect(last()).toMatchObject({ type: 'success' });
    expect(last().message).toBeTruthy();
  });

  it('treats a missing ok as a failure rather than a success', () => {
    // A reply that never set `ok` is not a result to celebrate.
    expect(toast.fromResult({})).toBeFalsy();
    expect(last().type).toBe('error');
  });
});
