import { describe, expect, it } from 'vitest';
import { getProfileImportErrorMessage } from '../../src/internal/services/profileImportErrors';

describe('profile import error codes', () => {
  it('turns a known code into a sentence', () => {
    expect(getProfileImportErrorMessage('invalid_mnemonic')).toBe(
      'Invalid mnemonic. Check the words and try again.'
    );
  });

  it('falls back to a generic message when there is no code at all', () => {
    expect(getProfileImportErrorMessage('')).toBe('Import failed');
    expect(getProfileImportErrorMessage(undefined)).toBe('Import failed');
  });

  it('returns an unknown code unchanged rather than hiding it', () => {
    expect(getProfileImportErrorMessage('keystore_on_fire')).toBe('keystore_on_fire');
  });

  it('never answers with an empty string', () => {
    for (const input of ['', '   ', undefined, 'anything']) {
      expect(getProfileImportErrorMessage(input).length).toBeGreaterThan(0);
    }
  });
});
