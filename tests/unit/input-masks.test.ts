import { describe, expect, it, vi } from 'vitest';
import { maskDecimalInput, maskDomainInput } from '../../src/internal/services/inputMasks';

/**
 * Keeping a typed value to a shape while it is being typed.
 *
 * Both masks rewrite the element as well as returning the value, and that is
 * the part worth pinning: without it a rejected keystroke stays on screen
 * until the model round-trips. The domain mask also has to put the caret back,
 * because assigning to `input.value` sends it to the end of the field.
 */

function typeInto(value: string, selectionStart = value.length) {
  const input = document.createElement('input');
  input.value = value;
  document.body.appendChild(input);
  try {
    input.setSelectionRange(selectionStart, selectionStart);
  } catch {
    // A type that does not support selection; irrelevant to the decimal mask.
  }
  return { input, event: { target: input } as unknown as Event };
}

describe('maskDecimalInput', () => {
  it('drops anything that is not a digit or a point', () => {
    const { event } = typeInto('12a.3b4');
    expect(maskDecimalInput(event)).toBe('12.34');
  });

  it('keeps only the first decimal point', () => {
    const { event } = typeInto('1.2.3.4');
    expect(maskDecimalInput(event)).toBe('1.234');
  });

  it('caps the decimals, six by default', () => {
    const { event } = typeInto('1.1234567890');
    expect(maskDecimalInput(event)).toBe('1.123456');
  });

  it('honours a tighter cap for a field that wants one', () => {
    const { event } = typeInto('1.987654');
    expect(maskDecimalInput(event, 2)).toBe('1.98');
  });

  it('writes the cleaned value back onto the element', () => {
    // Without this the rejected character stays visible until the model
    // round-trips, and the caret jumps when it finally does.
    const { input, event } = typeInto('9x9');
    maskDecimalInput(event);
    expect(input.value).toBe('99');
  });

  it('leaves an already valid value untouched', () => {
    const { event } = typeInto('123.45');
    expect(maskDecimalInput(event)).toBe('123.45');
  });

  it('survives an event with no element behind it', () => {
    expect(maskDecimalInput({ target: null } as unknown as Event)).toBe('');
  });
});

describe('maskDomainInput', () => {
  it('keeps letters, digits and hyphens, and drops the rest', () => {
    const { event } = typeInto('my_site!.com');
    expect(maskDomainInput(event)).toBe('mysitecom');
  });

  it('leaves a valid label alone, element included', () => {
    const { input, event } = typeInto('my-site-2');
    expect(maskDomainInput(event)).toBe('my-site-2');
    expect(input.value).toBe('my-site-2');
  });

  it('puts the caret back where it was, minus what was dropped before it', () => {
    // Typing a rejected character mid-word used to throw the caret to the end
    // of the field.
    vi.useFakeTimers();
    const { input, event } = typeInto('ab!cd', 3);
    maskDomainInput(event);
    vi.runAllTimers();
    expect(input.value).toBe('abcd');
    expect(input.selectionStart).toBe(2);
    vi.useRealTimers();
  });

  it('never moves the caret before the start of the field', () => {
    vi.useFakeTimers();
    const { input, event } = typeInto('!!!ab', 0);
    maskDomainInput(event);
    vi.runAllTimers();
    expect(input.selectionStart).toBe(0);
    vi.useRealTimers();
  });

  it('survives an event with no element behind it', () => {
    expect(maskDomainInput({ target: null } as unknown as Event)).toBe('');
  });
});
