/**
 * The main process answers a failed profile import with a code, never a
 * sentence - see the "no raw error message back to a site" rule. This is the
 * one place those codes become English.
 *
 * An unrecognised code is returned as-is rather than swallowed into a generic
 * "Import failed": a code on screen is ugly, but it is something the user can
 * quote in a bug report, where a generic message loses the only fact worth
 * having.
 */
const MESSAGES: Record<string, string> = {
  backup_api_unavailable: 'Import API not available.',
  missing_profile_name: 'Profile name is required.',
  missing_mnemonic: 'Mnemonic is required.',
  invalid_mnemonic: 'Invalid mnemonic. Check the words and try again.',
  pqc_keys_incomplete: 'Enter both PQC public and private keys, or leave both empty.',
  password_required: 'Unlock the app first to import PQC keys.',
  invalid_password: 'Unlock the app with the correct password to import PQC keys.',
  invalid_profile_backup: 'The selected profile backup file is invalid or unsupported.',
  encrypted_backup_source_unsupported: 'Encrypted backups cannot prefill manual import. Use Via file instead.',
  mnemonic_missing_in_selected_file: 'The selected file does not contain a mnemonic.',
  pqc_missing_in_selected_file: 'The selected file does not contain Dilithium key material.',
  invalid_pqc_backup: 'The selected Dilithium backup is invalid or unsupported.',
  no_valid_backups_found: 'No valid backup file was found.',
  profile_json_missing: 'No profile backup file was found.'
};

export function getProfileImportErrorMessage(error?: string): string {
  const code = String(error || '').trim();
  if (!code) return 'Import failed.';
  return MESSAGES[code] || code;
}
