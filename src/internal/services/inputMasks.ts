/**
 * Keeping a typed value to a shape as it is typed.
 *
 * These were page functions handed to dialogs as props, which meant a dialog's
 * amount field was cleaned by a handler that reached back into the page's own
 * form object to write the result. The masking is returned now, so whoever
 * owns the field assigns it.
 */

/**
 * Digits and at most one decimal point, capped to `maxDecimals` places.
 *
 * The element's value is rewritten as well as returned: without that, a
 * rejected keystroke stays on screen until the model round-trips, and the
 * caret jumps when it finally does.
 */
export function maskDecimalInput(event: Event, maxDecimals = 6): string {
  const input = event.target as HTMLInputElement;
  let value = String(input?.value || '').replace(/[^0-9.]/g, '');

  const parts = value.split('.');
  if (parts.length > 2) {
    value = `${parts[0]}.${parts.slice(1).join('')}`;
  }
  if (parts.length === 2 && parts[1].length > maxDecimals) {
    value = `${parts[0]}.${parts[1].slice(0, maxDecimals)}`;
  }

  if (input) input.value = value;
  return value;
}

/**
 * Letters, digits and hyphens - what a Lumen domain label may contain.
 *
 * The caret is put back where it was, minus what was dropped ahead of it:
 * rewriting an input's value sends the caret to the end, so without this,
 * typing a rejected character mid-word throws you to the end of the field.
 */
export function maskDomainInput(event: Event): string {
  const input = event.target as HTMLInputElement;
  const raw = String(input?.value || '');
  const value = raw.replace(/[^a-zA-Z0-9-]/g, '');
  if (!input || value === raw) return value;

  const caret = input.selectionStart ?? 0;
  const next = Math.max(0, caret - (raw.length - value.length));
  input.value = value;
  // After the model round-trips, or the assignment above wins and it jumps.
  setTimeout(() => input.setSelectionRange(next, next), 0);
  return value;
}
