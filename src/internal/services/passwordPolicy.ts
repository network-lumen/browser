/**
 * How long a user-chosen password has to be.
 *
 * The number was written out at seven call sites and one of them disagreed:
 * everything demanded 8 except the profile export, which accepted 6 - for the
 * password protecting the wallet mnemonic, the most sensitive thing the app
 * can hand to a file. Raising it costs nothing on the way in: importing an
 * older backup only tries the password it is given, it never re-checks the
 * minimum, so backups made under the old rule still open.
 */
export const MIN_PASSWORD_LENGTH = 8;

/** True when a password is long enough to be accepted. */
export function isPasswordLongEnough(password: string): boolean {
  return String(password || '').length >= MIN_PASSWORD_LENGTH;
}
