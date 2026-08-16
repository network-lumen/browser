import { describe, expect, it } from 'vitest';
import {
  planTabDrop,
  reorder,
  resolveReorderIndex,
  resolveTabLabelWidth
} from '../../src/internal/services/tabStripLayout';
import type { TabStripSlot } from '../../src/types/tabStrip';

/**
 * Four tabs of 100px, laid out end to end. Centres at 50, 150, 250, 350.
 */
const slots: TabStripSlot[] = ['a', 'b', 'c', 'd'].map((id, i) => ({
  id,
  left: i * 100,
  width: 100,
  center: i * 100 + 50
}));

describe('where a dragged tab lands', () => {
  // The raw index is an insertion point, so a tab that has not moved reports
  // the slot *after* itself. `resolveReorderIndex` is what turns that back into
  // "no move" - which is why the two are tested together rather than the raw
  // index being asserted as the answer.
  it('reports the slot after itself when it has not moved', () => {
    const plan = planTabDrop(slots, 0, 0, 'a');
    expect(plan.index).toBe(1);
    expect(resolveReorderIndex(0, plan.index)).toBeNull();
  });

  it('picks the slot whose centre the dragged tab has passed', () => {
    expect(planTabDrop(slots, 0, 120, 'a').index).toBe(2);
  });

  it('answers one past the last slot when dragged off the right edge', () => {
    const plan = planTabDrop(slots, 0, 1000, 'a');
    expect(plan.index).toBe(slots.length);
    // The marker belongs after the last tab, not at a slot that is not there.
    expect(plan.left).toBe(400);
  });

  it('moves everything it passes rightwards out of the way, leftwards', () => {
    const plan = planTabDrop(slots, 0, 120, 'a');
    expect(plan.shifts).toEqual({ b: -100, c: -100 });
  });

  it('moves everything it passes leftwards out of the way, rightwards', () => {
    const plan = planTabDrop(slots, 3, -220, 'd');
    expect(plan.shifts).toEqual({ b: 100, c: 100 });
  });

  it('never shifts the tab being dragged', () => {
    const plan = planTabDrop(slots, 1, 150, 'b');
    expect(plan.shifts).not.toHaveProperty('b');
  });

  it('survives a start index that is not in the layout', () => {
    expect(planTabDrop(slots, 9, 50, 'z')).toEqual({ index: 9, left: 0, shifts: {} });
  });
});

describe('turning a drop index into a splice index', () => {
  it('loses a slot when moving rightwards, because the tab leaves its own first', () => {
    expect(resolveReorderIndex(0, 2)).toBe(1);
  });

  it('keeps the index when moving leftwards', () => {
    expect(resolveReorderIndex(3, 1)).toBe(1);
  });

  it('reports no move when the tab lands where it started', () => {
    expect(resolveReorderIndex(2, 2)).toBeNull();
    expect(resolveReorderIndex(2, 3)).toBeNull();
  });

  it('reports no move for an unstarted drag', () => {
    expect(resolveReorderIndex(-1, 2)).toBeNull();
    expect(resolveReorderIndex(2, -1)).toBeNull();
  });
});

describe('reorder', () => {
  it('moves one item and leaves the rest in order', () => {
    expect(reorder(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('round-trips a drag right then back', () => {
    const once = reorder(['a', 'b', 'c'], 0, 2);
    expect(reorder(once, 2, 0)).toEqual(['a', 'b', 'c']);
  });
});

describe('label width', () => {
  const base = { plusWidth: 44, extras: 64, gap: 1, min: 0, max: 220 };

  it('splits the strip between the tabs', () => {
    // (1000 - 44 - 5 gaps) / 6 tabs, less 64px of chrome per tab.
    expect(resolveTabLabelWidth({ ...base, total: 1000, count: 6 })).toBe(94);
  });

  it('shrinks the labels as tabs are added', () => {
    const two = resolveTabLabelWidth({ ...base, total: 1000, count: 6 });
    const ten = resolveTabLabelWidth({ ...base, total: 1000, count: 10 });
    expect(ten).toBeLessThan(two);
  });

  it('never exceeds the maximum', () => {
    expect(resolveTabLabelWidth({ ...base, total: 4000, count: 1 })).toBe(220);
    expect(resolveTabLabelWidth({ ...base, total: 1000, count: 2 })).toBe(220);
  });

  it('never goes below the minimum, however many tabs there are', () => {
    expect(resolveTabLabelWidth({ ...base, total: 600, count: 40 })).toBe(0);
  });

  it('treats zero tabs as one rather than dividing by zero', () => {
    expect(Number.isFinite(resolveTabLabelWidth({ ...base, total: 800, count: 0 }))).toBe(true);
  });
});
