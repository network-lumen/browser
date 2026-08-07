import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRecurringPaymentsService } from '../../src/internal/services/recurringPayments';
import { STORAGE_KEYS } from '../../src/internal/services/storage';
import type { RecurringPayment } from '../../src/types/recurringPayments';

/**
 * Recurring payments, which in Lumen are reminders and never executions.
 *
 * The product rule is definitive: a reminder plus a confirmation dialog, no
 * automatic spending, ever. So the tests below cover the bookkeeping - dates,
 * counters, when a schedule ends - and one of them asserts the absence of any
 * method that would fire payments on its own, because that method used to
 * exist here unused, beside a timer that nothing could stop.
 */

const service = getRecurringPaymentsService();

type NewPayment = Parameters<typeof service.createRecurringPayment>[0];

function draft(overrides: Partial<NewPayment> = {}): NewPayment {
  return {
    name: 'Rent',
    recipient: 'lmn1landlord',
    amount: '1000000',
    frequency: 'monthly',
    status: 'active',
    startDate: new Date('2026-01-01T00:00:00Z'),
    nextPaymentDate: new Date('2026-02-01T00:00:00Z'),
    reminderEnabled: false,
    reminderDaysBefore: 3,
    ...overrides,
  } as NewPayment;
}

beforeEach(() => {
  localStorage.clear();
});

describe('nothing here spends on a schedule', () => {
  it('exposes no method that fires due payments by itself', () => {
    // checkDuePayments() and a 60-second setInterval used to live here. The
    // interval's callback was empty and stopPaymentChecker() was never called,
    // so it was a wake-up a minute for nothing - and a strong suggestion to
    // the next reader that this runs on a timer. It does not.
    expect((service as any).checkDuePayments).toBeUndefined();
    expect((service as any).startPaymentChecker).toBeUndefined();
    expect((service as any).stopPaymentChecker).toBeUndefined();
  });
});

describe('creating and reading', () => {
  it('stores a payment and reads it back with real Date objects', () => {
    const created = service.createRecurringPayment(draft());
    const read = service.getRecurringPayment(created.id);
    expect(read?.name).toBe('Rent');
    // JSON has no dates; a caller comparing them would otherwise get strings.
    expect(read?.nextPaymentDate).toBeInstanceOf(Date);
    expect(read?.createdAt).toBeInstanceOf(Date);
  });

  it('starts every counter at zero', () => {
    const created = service.createRecurringPayment(draft());
    expect(created.totalPayments).toBe(0);
    expect(created.successfulPayments).toBe(0);
    expect(created.failedPayments).toBe(0);
  });

  it('gives each payment its own id', () => {
    const a = service.createRecurringPayment(draft());
    const b = service.createRecurringPayment(draft());
    expect(a.id).not.toBe(b.id);
  });

  it('returns null for an id it does not have', () => {
    expect(service.getRecurringPayment('nope')).toBeNull();
  });

  it('returns an empty list rather than throwing on corrupted storage', () => {
    localStorage.setItem(STORAGE_KEYS.recurringPayments, '{not json');
    expect(service.getRecurringPayments()).toEqual([]);
  });
});

describe('updating, pausing and deleting', () => {
  it('applies an update and moves updatedAt forward', () => {
    const created = service.createRecurringPayment(draft());
    const updated = service.updateRecurringPayment(created.id, { amount: '2000000' });
    expect(updated?.amount).toBe('2000000');
    expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
  });

  it('reports null for an update to something that is not there', () => {
    expect(service.updateRecurringPayment('nope', { amount: '1' })).toBeNull();
  });

  it('pauses and resumes', () => {
    const created = service.createRecurringPayment(draft());
    expect(service.pauseRecurringPayment(created.id)).toBe(true);
    expect(service.getRecurringPayment(created.id)?.status).toBe('paused');
    expect(service.resumeRecurringPayment(created.id)).toBe(true);
    expect(service.getRecurringPayment(created.id)?.status).toBe('active');
  });

  it('moves a resumed payment past a date that has already gone by', () => {
    // Resuming onto a past date would make it due the instant it resumes, and
    // the user would be asked to pay the moment they un-paused.
    const created = service.createRecurringPayment(
      draft({ nextPaymentDate: new Date('2020-01-01T00:00:00Z'), status: 'paused' })
    );
    service.resumeRecurringPayment(created.id);
    expect(service.getRecurringPayment(created.id)!.nextPaymentDate.getTime())
      .toBeGreaterThan(Date.now());
  });

  it('leaves a future date alone when resuming', () => {
    const future = new Date(Date.now() + 30 * 86_400_000);
    const created = service.createRecurringPayment(draft({ nextPaymentDate: future, status: 'paused' }));
    service.resumeRecurringPayment(created.id);
    expect(service.getRecurringPayment(created.id)!.nextPaymentDate.getTime()).toBe(future.getTime());
  });

  it('deletes, and says so when there was nothing to delete', () => {
    const created = service.createRecurringPayment(draft());
    expect(service.deleteRecurringPayment(created.id)).toBe(true);
    expect(service.getRecurringPayment(created.id)).toBeNull();
    expect(service.deleteRecurringPayment(created.id)).toBe(false);
  });
});

describe('calculateNextPaymentDate', () => {
  const from = new Date('2026-01-15T12:00:00Z');

  it('advances by the frequency', () => {
    const at = (f: RecurringPayment['frequency']) =>
      service.calculateNextPaymentDate(from, f).toISOString().slice(0, 10);
    expect(at('daily')).toBe('2026-01-16');
    expect(at('weekly')).toBe('2026-01-22');
    expect(at('biweekly')).toBe('2026-01-29');
    expect(at('monthly')).toBe('2026-02-15');
    expect(at('quarterly')).toBe('2026-04-15');
    expect(at('yearly')).toBe('2027-01-15');
  });

  it('never mutates the date it was given', () => {
    const original = new Date('2026-01-15T12:00:00Z');
    service.calculateNextPaymentDate(original, 'monthly');
    expect(original.toISOString()).toBe('2026-01-15T12:00:00.000Z');
  });

  it('rolls a 31st into the following month, the way Date does', () => {
    // Documented rather than endorsed: Jan 31 + 1 month is Mar 3 (or Mar 2 in
    // a leap year), not Feb 28. A caller that cares must pick its own day.
    const jan31 = new Date('2026-01-31T12:00:00Z');
    const next = service.calculateNextPaymentDate(jan31, 'monthly');
    expect(next.getMonth()).toBe(2);
  });
});

describe('executePayment', () => {
  it('counts a success, advances the schedule and records history', async () => {
    const created = service.createRecurringPayment(draft());
    const ok = await service.executePayment(created.id, async () => ({ success: true, txHash: 'ABC' }));
    expect(ok).toBe(true);

    const after = service.getRecurringPayment(created.id)!;
    expect(after.totalPayments).toBe(1);
    expect(after.successfulPayments).toBe(1);
    expect(after.failedPayments).toBe(0);
    expect(after.nextPaymentDate.getTime()).toBeGreaterThan(Date.now());

    const [entry] = service.getPaymentHistory(created.id);
    expect(entry).toMatchObject({ status: 'success', txHash: 'ABC' });
  });

  it('counts a failure without advancing the schedule', async () => {
    const created = service.createRecurringPayment(draft());
    const before = service.getRecurringPayment(created.id)!.nextPaymentDate.getTime();
    const ok = await service.executePayment(created.id, async () => ({ success: false, error: 'nope' }));
    expect(ok).toBe(false);

    const after = service.getRecurringPayment(created.id)!;
    expect(after.failedPayments).toBe(1);
    expect(after.successfulPayments).toBe(0);
    // A failed attempt must stay due, or the payment is silently skipped.
    expect(after.nextPaymentDate.getTime()).toBe(before);
    expect(service.getPaymentHistory(created.id)[0]).toMatchObject({ status: 'failed', error: 'nope' });
  });

  it('refuses to run for a paused payment', async () => {
    const created = service.createRecurringPayment(draft({ status: 'paused' }));
    const run = vi.fn(async () => ({ success: true }));
    expect(await service.executePayment(created.id, run)).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it('refuses to run for an id it does not have', async () => {
    expect(await service.executePayment('nope', async () => ({ success: true }))).toBe(false);
  });

  it('reports false rather than throwing when the sender throws', async () => {
    const created = service.createRecurringPayment(draft());
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await service.executePayment(created.id, async () => { throw new Error('boom'); })).toBe(false);
  });

  it('completes a schedule once it has run its stated number of times', async () => {
    const created = service.createRecurringPayment(draft({ maxPayments: 1 } as Partial<NewPayment>));
    await service.executePayment(created.id, async () => ({ success: true }));
    expect(service.getRecurringPayment(created.id)?.status).toBe('completed');
  });

  it('completes a schedule once the next date would fall past its end', async () => {
    const created = service.createRecurringPayment(
      draft({ endDate: new Date(Date.now() + 86_400_000) } as Partial<NewPayment>)
    );
    await service.executePayment(created.id, async () => ({ success: true }));
    expect(service.getRecurringPayment(created.id)?.status).toBe('completed');
  });
});

describe('history', () => {
  it('comes back newest first', () => {
    service.addPaymentHistory({
      recurringPaymentId: 'p', amount: '1', status: 'success',
      executedAt: new Date('2026-01-01T00:00:00Z'),
    } as never);
    service.addPaymentHistory({
      recurringPaymentId: 'p', amount: '2', status: 'success',
      executedAt: new Date('2026-06-01T00:00:00Z'),
    } as never);
    expect(service.getPaymentHistory('p').map((h) => h.amount)).toEqual(['2', '1']);
  });

  it('filters to one payment when asked, and returns everything otherwise', () => {
    service.addPaymentHistory({
      recurringPaymentId: 'a', amount: '1', status: 'success', executedAt: new Date(),
    } as never);
    service.addPaymentHistory({
      recurringPaymentId: 'b', amount: '2', status: 'success', executedAt: new Date(),
    } as never);
    expect(service.getPaymentHistory('a')).toHaveLength(1);
    expect(service.getPaymentHistory()).toHaveLength(2);
  });
});

describe('reminders', () => {
  it('creates one, dated the requested number of days before the payment', () => {
    const nextPaymentDate = new Date(Date.now() + 10 * 86_400_000);
    const created = service.createRecurringPayment(
      draft({ reminderEnabled: true, reminderDaysBefore: 3, nextPaymentDate })
    );
    const [reminder] = service.getReminders();
    expect(reminder.recurringPaymentId).toBe(created.id);
    const gapDays = Math.round(
      (reminder.scheduledDate.getTime() - reminder.reminderDate.getTime()) / 86_400_000
    );
    expect(gapDays).toBe(3);
  });

  it('creates none when reminders are off', () => {
    service.createRecurringPayment(draft({ reminderEnabled: false }));
    expect(service.getReminders()).toEqual([]);
  });

  it('creates none for a date that has already passed', () => {
    const payment = service.createRecurringPayment(
      draft({ reminderEnabled: true, nextPaymentDate: new Date('2020-01-01T00:00:00Z') })
    );
    expect(service.createReminder(service.getRecurringPayment(payment.id)!)).toBeNull();
  });

  it('hides a dismissed reminder without losing the others', () => {
    const soon = new Date(Date.now() + 10 * 86_400_000);
    service.createRecurringPayment(draft({ reminderEnabled: true, nextPaymentDate: soon }));
    service.createRecurringPayment(draft({ reminderEnabled: true, nextPaymentDate: soon, name: 'Other' }));
    const [first] = service.getReminders();
    expect(service.dismissReminder(first.id)).toBe(true);
    const left = service.getReminders();
    expect(left).toHaveLength(1);
    expect(left[0].id).not.toBe(first.id);
  });

  it('reports false for dismissing one that is not there', () => {
    expect(service.dismissReminder('nope')).toBe(false);
  });

  it('drops a payment’s reminders along with the payment', () => {
    const soon = new Date(Date.now() + 10 * 86_400_000);
    const created = service.createRecurringPayment(
      draft({ reminderEnabled: true, nextPaymentDate: soon })
    );
    expect(service.getReminders()).toHaveLength(1);
    service.deleteRecurringPayment(created.id);
    expect(service.getReminders()).toEqual([]);
  });
});
