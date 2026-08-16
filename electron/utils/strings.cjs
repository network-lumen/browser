// Trim and cap anything crossing into the main process; the cap is the point.
// The 3 preloads and the generated MV3 shim keep copies - they cannot require.
function safeString(value, maxLen = 2048) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

function trimSlash(s) {
  return String(s || '').replace(/\/+$/, '');
}

/**
 * snake_case keys to camelCase, all the way down.
 *
 * The chain answers a params query over REST, which is snake_case
 * (`base_fee_dns`, `domain_tiers`, `max_len`). The protobuf types the SDK
 * generates read camelCase and nothing else: `Params.fromPartial` is a list of
 * `message.baseFeeDns = object.baseFeeDns ?? ""`, so a snake_case key is not an
 * error, it is simply never seen, and the field takes its zero value.
 *
 * Governance MsgUpdateParams replaces the whole Params object rather than
 * merging, so fetching the current params and spreading them - which is what
 * every action builder does - silently blanked every multi-word field. The only
 * survivors were the ones spelled the same either way: alpha, floor, ceiling, t.
 * The chain then rejected the proposal after it had passed, with "base_fee_dns
 * must be set", which is true and says nothing about why.
 *
 * Arrays are walked because the tiers are objects too (`max_len` -> `maxLen`).
 */
function camelizeKeysDeep(value) {
  if (Array.isArray(value)) return value.map(camelizeKeysDeep);
  // Date, Uint8Array and friends are values here, not shapes to rewrite.
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    return value;
  }

  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    const camel = String(key).replace(/_+([a-z0-9])/g, (_m, c) => String(c).toUpperCase());
    out[camel] = camelizeKeysDeep(entry);
  }
  return out;
}

module.exports = { safeString, trimSlash, camelizeKeysDeep };
