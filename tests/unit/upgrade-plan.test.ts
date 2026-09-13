import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const { GO_ZERO_TIME_SECONDS, softwareUpgradePlan } = require_('../../electron/chain/upgradePlan.cjs');
const { MsgSoftwareUpgrade } = require_('cosmjs-types/cosmos/upgrade/v1beta1/tx');
const { Timestamp } = require_('cosmjs-types/google/protobuf/timestamp');
const { BinaryReader } = require_('cosmjs-types/binary');
const { Registry } = require_('@cosmjs/proto-signing');

/**
 * The plan of a software upgrade proposal.
 *
 * Testnet proposal #2 passed its vote and then failed on execution with "time-
 * based upgrades have been deprecated in the SDK", because the plan reached the
 * chain with `time` = 1970-01-01. These tests encode through the same
 * `Registry.encode` the proposal is packed with, and read the time field off the
 * wire - not off a decoder, which fills in a default and would hide the bug.
 */

const TYPE_URL = '/cosmos.upgrade.v1beta1.MsgSoftwareUpgrade';
const AUTHORITY = 'lmn10d07y265gmmuvt4z0w9aw880jnsr700j050uar';

const registry = new Registry();
registry.register(TYPE_URL, MsgSoftwareUpgrade);

/** Exactly how wallet.cjs packs a proposal's messages. */
function encodeThroughRegistry(plan: Record<string, unknown>): Uint8Array {
  return registry.encode({
    typeUrl: TYPE_URL,
    value: MsgSoftwareUpgrade.fromPartial({ authority: AUTHORITY, plan })
  });
}

/**
 * The seconds of `plan.time` as they are on the wire, or null when the field is
 * absent. Absent decodes to Go's zero value on the chain; present decodes to
 * `time.Unix(seconds, nanos)`.
 */
function planTimeOnWire(bytes: Uint8Array): bigint | null {
  const msg = new BinaryReader(bytes);
  while (msg.pos < msg.len) {
    const tag = msg.uint32();
    if (tag >>> 3 !== 2) {
      msg.skipType(tag & 7);
      continue;
    }
    const plan = new BinaryReader(msg.bytes());
    while (plan.pos < plan.len) {
      const planTag = plan.uint32();
      if (planTag >>> 3 === 2) return BigInt(Timestamp.decode(plan.bytes()).seconds);
      plan.skipType(planTag & 7);
    }
    return null;
  }
  return null;
}

/**
 * x/upgrade `Plan.ValidateBasic`: `if !p.Time.IsZero()` rejects. An absent field
 * is Go's zero value; a present one is zero only at 0001-01-01.
 */
function chainRejectsTime(seconds: bigint | null): boolean {
  return seconds !== null && seconds !== GO_ZERO_TIME_SECONDS;
}

const PLAN = { name: 'v2.0.0', height: 114000, info: 'Binary: https://example.test/v2.0.0' };

describe('the Go zero time', () => {
  it('is 0001-01-01, the value mainnet proposal #19 carried and passed with', () => {
    expect(new Date(Number(GO_ZERO_TIME_SECONDS) * 1000).toISOString()).toBe('0001-01-01T00:00:00.000Z');
  });
});

describe('softwareUpgradePlan', () => {
  it('reaches the chain with a time the chain accepts', () => {
    const seconds = planTimeOnWire(encodeThroughRegistry(softwareUpgradePlan(PLAN)));
    expect(seconds).toBe(GO_ZERO_TIME_SECONDS);
    expect(chainRejectsTime(seconds)).toBe(false);
  });

  it('keeps name, height and info as given', () => {
    const decoded = MsgSoftwareUpgrade.decode(encodeThroughRegistry(softwareUpgradePlan(PLAN)));
    expect(decoded.plan.name).toBe('v2.0.0');
    expect(decoded.plan.height).toBe(114000n);
    expect(decoded.plan.info).toBe('Binary: https://example.test/v2.0.0');
  });
});

describe('the two ways this goes wrong', () => {
  it('a plan without time reaches the chain as 1970, which is testnet proposal #2', () => {
    // cosmjs-types defaults the field to an empty Timestamp and encodes it.
    const seconds = planTimeOnWire(encodeThroughRegistry({ name: 'v2.0.0', height: 114000n, info: '' }));
    expect(seconds).toBe(0n);
    expect(chainRejectsTime(seconds)).toBe(true);
  });

  it('deleting time after fromPartial is undone by Registry.encode', () => {
    // The fix that looks right: it removes the field from a direct encode, and
    // the registry's own fromPartial puts the empty Timestamp straight back.
    const value = MsgSoftwareUpgrade.fromPartial({
      authority: AUTHORITY,
      plan: { name: 'v2.0.0', height: 114000n, info: '' }
    });
    value.plan.time = undefined;
    expect(planTimeOnWire(MsgSoftwareUpgrade.encode(value).finish())).toBe(null);

    const seconds = planTimeOnWire(registry.encode({ typeUrl: TYPE_URL, value }));
    expect(seconds).toBe(0n);
    expect(chainRejectsTime(seconds)).toBe(true);
  });
});
