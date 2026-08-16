import { describe, expect, it } from 'vitest';
import { MIN_PASSWORD_LENGTH, isPasswordLongEnough } from '../../src/internal/services/passwordPolicy';

/**
 * One minimum length, everywhere.
 *
 * The number was written out at seven call sites and one disagreed: everything
 * demanded 8 except the profile export, which took 6 - for the password
 * protecting the wallet mnemonic, the most sensitive thing the app can write
 * to a file. The constant is asserted literally here so that lowering it takes
 * a deliberate edit to a test that says why it is 8.
 */

describe('the password minimum', () => {
  it('is 8, and the export path no longer gets to disagree', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });

  it('accepts a password at the boundary and rejects one below it', () => {
    expect(isPasswordLongEnough('12345678')).toBe(true);
    expect(isPasswordLongEnough('1234567')).toBe(false);
  });

  it('rejects the empty cases without throwing', () => {
    expect(isPasswordLongEnough('')).toBe(false);
    expect(isPasswordLongEnough(null as never)).toBe(false);
    expect(isPasswordLongEnough(undefined as never)).toBe(false);
  });

  it('counts characters as typed, spaces included', () => {
    // A passphrase is mostly spaces; trimming here would reject a valid one.
    expect(isPasswordLongEnough('a b c d ')).toBe(true);
  });
});
