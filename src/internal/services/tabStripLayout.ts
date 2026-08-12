import type { TabDropPlan, TabLabelWidthInput, TabStripSlot } from '../../types/tabStrip';

export type { TabDropPlan, TabStripSlot };

/**
 * The geometry behind dragging a tab, separated from the pointer handling that
 * feeds it. What is left in the component is measuring the DOM and applying the
 * result; the two off-by-one traps live here, where a test can reach them:
 *
 * - the returned index is an insertion point in the array *before* the move, so
 *   dragging rightwards has to subtract one before splicing (see
 *   `resolveReorderIndex`);
 * - `index === slots.length` means "past the last tab", which is a real answer
 *   and not an error, so the drop marker has to be placed off the right edge of
 *   the last slot rather than at the left edge of a slot that is not there.
 */
export function planTabDrop(
  slots: TabStripSlot[],
  startIndex: number,
  dx: number,
  draggingId: string
): TabDropPlan {
  const start = slots[startIndex];
  if (!start) return { index: startIndex, left: 0, shifts: {} };

  const centerX = start.left + dx + start.width / 2;
  const found = slots.findIndex((slot) => centerX < slot.center);
  const index = found === -1 ? slots.length : found;

  const last = slots[slots.length - 1];
  const left =
    index === slots.length
      ? (last?.left ?? 0) + (last?.width ?? 0)
      : slots[index]?.left ?? 0;

  const width = start.width;
  const shifts: Record<string, number> = {};
  for (let i = 0; i < slots.length; i++) {
    const id = slots[i]?.id;
    if (!id || id === draggingId) continue;
    // Everything the dragged tab passes moves one tab-width the other way, so
    // the gap it leaves closes and a gap opens where it is going.
    if (index > startIndex && i >= startIndex + 1 && i <= index) shifts[id] = -width;
    if (index < startIndex && i >= index && i <= startIndex - 1) shifts[id] = width;
  }

  return { index, left, shifts };
}

/**
 * The array index to splice the tab into, or `null` when the drag ends where it
 * began. Dragging rightwards loses a slot when the tab is removed from its old
 * position, which is where the -1 comes from.
 */
export function resolveReorderIndex(fromIndex: number, dropIndex: number): number | null {
  if (fromIndex < 0 || dropIndex < 0) return null;
  const to = dropIndex > fromIndex ? dropIndex - 1 : dropIndex;
  return to === fromIndex ? null : to;
}

export function reorder<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = items.slice();
  const [moved] = next.splice(fromIndex, 1);
  if (moved === undefined) return items;
  next.splice(toIndex, 0, moved);
  return next;
}

/** How wide each tab's label may be so that `count` tabs fit the strip. */
export function resolveTabLabelWidth(input: TabLabelWidthInput): number {
  const count = Math.max(1, Math.floor(input.count) || 1);
  const available = input.total - input.plusWidth - input.gap * Math.max(0, count - 1);
  const per = Math.floor((available - count * input.extras) / count);
  return Math.max(input.min, Math.min(input.max, per));
}
