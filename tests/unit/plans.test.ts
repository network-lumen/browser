import { describe, expect, it } from 'vitest';
import {
  formatPlanPrice,
  formatPlanPriceShort,
  planDisplayName,
  planStatusBadgeClass,
  planStatusLabel,
} from '../../src/internal/services/plans';
import type { PlanView } from '../../src/types/drivePage';

const plan = (planId: string) => ({ planId }) as PlanView;

describe('naming a plan', () => {
  it('takes the last segment of the id', () => {
    expect(planDisplayName(plan('gw:eu:pro'))).toBe('pro');
    expect(planDisplayName(plan('basic'))).toBe('basic');
  });

  it('falls back rather than showing an empty name', () => {
    expect(planDisplayName(null)).toBe('Plan');
    expect(planDisplayName(plan(''))).toBe('Plan');
  });
});

describe('pricing a plan', () => {
  it('says Free rather than 0.00 LMN', () => {
    expect(formatPlanPrice(0)).toBe('Free');
    expect(formatPlanPriceShort(0)).toBe('Free');
  });

  it('keeps two decimals below ten and drops them at ten', () => {
    // The threshold is inclusive, which is the part worth pinning down.
    expect(formatPlanPrice(9_990_000)).toBe('9.99 LMN / mo');
    expect(formatPlanPrice(10_000_000)).toBe('10 LMN / mo');
    expect(formatPlanPrice(1_500_000)).toBe('1.50 LMN / mo');
  });

  it('drops only the period in the short form', () => {
    expect(formatPlanPriceShort(1_500_000)).toBe('1.50 LMN');
    expect(formatPlanPriceShort(10_000_000)).toBe('10 LMN');
  });
});

describe('showing a subscription status', () => {
  it('reads an unsubscribed plan as the action to take', () => {
    expect(planStatusLabel('none')).toBe('Subscribe');
    expect(planStatusLabel('unknown')).toBe('Subscribe');
  });

  it('names the states it knows', () => {
    expect(planStatusLabel('active')).toBe('Subscribed');
    expect(planStatusLabel('pending')).toBe('Pending');
    expect(planStatusLabel('completed')).toBe('Completed');
  });

  it('accepts both spellings of cancelled', () => {
    expect(planStatusLabel('cancelled')).toBe('Cancelled');
    expect(planStatusLabel('canceled')).toBe('Cancelled');
  });

  it('tints only the two states worth colouring', () => {
    expect(planStatusBadgeClass('active')).toContain('success');
    expect(planStatusBadgeClass('pending')).toContain('warning');
    expect(planStatusBadgeClass('cancelled')).toBe('');
    expect(planStatusBadgeClass('none')).toBe('');
  });
});
