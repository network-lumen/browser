/**
 * Validator avatars, looked up on Keybase.
 *
 * Only the request and the shape of its answer live here. NetworkPage and
 * BlockDetailPage both need this, but they write the result into different
 * state (a validator list, a proposer map), so the loop that applies it stays
 * with each caller - the same split as `format.ts`: the service carries what
 * is genuinely shared, the call site keeps what is its own.
 */

const KEYBASE_LOOKUP = 'https://keybase.io/_/api/1.0/user/lookup.json';

/**
 * Primary picture URL for a Keybase id, or `''` when there is none.
 *
 * Never throws: a validator without an avatar, an unreachable Keybase or a
 * changed payload are all the same non-event to a caller that is only
 * decorating a list.
 */
export async function fetchKeybaseAvatarUrl(keybaseId: string): Promise<string> {
  const id = String(keybaseId || '').trim();
  if (!id) return '';
  try {
    const response = await fetch(`${KEYBASE_LOOKUP}?key_suffix=${encodeURIComponent(id)}`);
    const data = await response.json();
    return String(data?.them?.[0]?.pictures?.primary?.url || '');
  } catch {
    return '';
  }
}
