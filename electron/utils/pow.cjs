// The two proof-of-work formats this app mines against, and the bit count both
// are graded on.
//
// No requires, so workers/ can import it - see the rule in workers/README.md.
//
// The digests live here rather than beside their miners because each is written
// in one place and read in another: the chain recomputes them and refuses a
// transaction whose nonce does not clear the target. A wrong separator or a
// missing field still produces a perfectly valid sha256, so nothing fails until
// the chain answers "invalid proof-of-work" - which names the proof, not the
// byte that moved. One definition, pinned by tests/unit/pow-digests.test.ts
// against vectors taken from the chain's own Go.

function leadingZeroBits(digest) {
  let total = 0;
  for (let i = 0; i < digest.length; i++) {
    const byte = digest[i];
    if (byte === 0) {
      total += 8;
      continue;
    }
    return total + Math.clz32(byte) - 24;
  }
  return total;
}

/**
 * The bytes x/pqc hashes when linking a Dilithium key:
 * sha256(creator || "|" || pubKey || nonce).
 *
 * The creator joined the challenge in chain v2.0.0. It used to cover the key
 * alone, so one solved nonce linked unlimited accounts, and a pending
 * (pub_key, pow_nonce) pair could be lifted out of the mempool and submitted
 * under another address.
 *
 * Only the fixed half is built here - the creator, the separator and the key -
 * because the miner hashes it once and copies the digest state per attempt,
 * appending the nonce. That is the hot loop, and re-hashing a 1952-byte public
 * key on every guess is what it exists to avoid.
 */
function linkPowPrefix(creator, pubKey) {
  const creatorStr = String(creator || '');
  if (!creatorStr) {
    throw new Error('pow creator address is required');
  }
  const keyBytes = Buffer.isBuffer(pubKey)
    ? pubKey
    : Buffer.from(pubKey.buffer, pubKey.byteOffset, pubKey.byteLength);
  return Buffer.concat([Buffer.from(`${creatorStr}|`, 'utf8'), keyBytes]);
}

/**
 * The bytes x/dns hashes when authorising a record update:
 * sha256(fqdn || "|" || creator || "|" || updatedAt || "|" || nonce).
 *
 * `updatedAt` is the domain's `updated_at` as it stands *before* this update,
 * and it is what makes the proof cost something per update rather than once per
 * (name, owner) pair. Until chain v2.0.0 the digest covered the name, the owner
 * and the nonce - none of which changes between two updates of the same name by
 * the same owner - so a single solved nonce authorised every update that name
 * would ever receive.
 */
function updatePowPayload(identifier, creator, updatedAt, nonce) {
  return `${String(identifier || '')}|${String(creator || '')}|${toChainUint(updatedAt)}|${nonce}`;
}

/**
 * A uint64 the LCD may answer as a decimal string, as a number, or not at all.
 *
 * Anything unreadable reads as 0, which is what a domain that has never been
 * updated carries - so a missing field mines the digest the chain checks for
 * that case rather than one it is bound to refuse.
 */
function toChainUint(input) {
  const n = typeof input === 'number' ? input : parseInt(String(input ?? '').trim(), 10);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

module.exports = {
  leadingZeroBits,
  linkPowPrefix,
  updatePowPayload,
  toChainUint
};
