import { describe, expect, it } from 'vitest';

const { toBaseUnits } = require('../../electron/utils/tx.cjs');

/**
 * A display amount to the chain's own base units.
 *
 * Every send used to scale by a hard-coded 1e6, which is right only where the
 * exponent is six. It is 18 on 75 of the 221 chains in the registry, and there
 * "send 1 token" moved a trillionth of one. Not a loss, and not what anyone
 * typed either.
 */
describe('toBaseUnits', () => {
  it('scales by the exponent it is given', () => {
    expect(toBaseUnits('1', 6)).toBe('1000000');
    expect(toBaseUnits('1', 18)).toBe('1000000000000000000');
    expect(toBaseUnits('1', 0)).toBe('1');
  });

  it('defaults to six, which is what every existing caller assumed', () => {
    expect(toBaseUnits('1')).toBe('1000000');
  });

  it('keeps an 18-decimal amount exact, past what a double holds', () => {
    // 123.456789012345678 * 1e18 is not representable as a double, so the
    // multiplication itself would round. Going through the decimal string is
    // what makes the last digits survive.
    expect(toBaseUnits('123.456789012345678', 18)).toBe('123456789012345678000');
  });

  it('handles a fraction shorter than the exponent', () => {
    expect(toBaseUnits('0.5', 6)).toBe('500000');
    expect(toBaseUnits('1.25', 18)).toBe('1250000000000000000');
  });

  it('truncates beyond the exponent rather than rounding up', () => {
    // A send must never exceed the figure the user confirmed.
    expect(toBaseUnits('1.9999999', 6)).toBe('1999999');
    expect(toBaseUnits('0.0000009', 6)).toBe('0');
  });

  it('reads a number as readily as a string', () => {
    expect(toBaseUnits(2.5, 6)).toBe('2500000');
  });

  it('is zero for anything that is not a positive decimal', () => {
    expect(toBaseUnits('', 6)).toBe('0');
    expect(toBaseUnits('.', 6)).toBe('0');
    expect(toBaseUnits('abc', 6)).toBe('0');
    expect(toBaseUnits('-1', 6)).toBe('0');
    expect(toBaseUnits(null, 6)).toBe('0');
    expect(toBaseUnits(undefined, 6)).toBe('0');
  });

  it('falls back to six when the exponent is not a number', () => {
    expect(toBaseUnits('1', NaN)).toBe('1000000');
    expect(toBaseUnits('1', 'x')).toBe('1000000');
  });

  it('clamps a negative exponent to zero rather than dividing', () => {
    expect(toBaseUnits('1', -3)).toBe('1');
  });

  it('carries a fraction into the whole part correctly', () => {
    expect(toBaseUnits('12.000001', 6)).toBe('12000001');
    expect(toBaseUnits('0.000001', 6)).toBe('1');
  });
});
