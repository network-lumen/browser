/** One tab as it is currently laid out, measured from the strip's left edge. */
export interface TabStripSlot {
  id: string;
  left: number;
  width: number;
  center: number;
}

/** Where a drag in progress would drop, and how the tabs it passes have to move aside. */
export interface TabDropPlan {
  /** Insertion index in the *pre-move* array, so `length` means "past the last tab". */
  index: number;
  /** Left edge of the gap the dragged tab would land in, for the drop marker. */
  left: number;
  /** Tab id to the pixels it shifts while the drag is held. Absent means it stays put. */
  shifts: Record<string, number>;
}

export interface TabLabelWidthInput {
  /** Width of the strip. */
  total: number;
  count: number;
  /** The "+" button and its gap. */
  plusWidth: number;
  /** Everything in a tab that is not the label: icon, close button, padding. */
  extras: number;
  gap: number;
  min: number;
  max: number;
}
