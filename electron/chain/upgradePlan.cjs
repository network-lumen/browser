// The plan inside a /cosmos.upgrade.v1beta1.MsgSoftwareUpgrade.
//
// x/upgrade refuses any plan whose `time` is set: `Plan.ValidateBasic` opens
// with `if !p.Time.IsZero()` and fails with "time-based upgrades have been
// deprecated in the SDK". The trap is what counts as zero. Go's zero
// `time.Time` is 0001-01-01T00:00:00Z; the Unix epoch, 1970-01-01, is a real
// instant and is not zero.
//
// Leaving `time` out does not produce Go's zero. cosmjs-types builds every
// Plan from a base whose `time` is an empty Timestamp - `{seconds: 0, nanos:
// 0}` - and encodes it whenever it is defined, which it always is. The chain
// decodes that as `time.Unix(0, 0)`, 1970, and the proposal fails when it
// executes, after the whole voting period has been spent on it. Testnet
// proposal #2 (v2.0.0) went that way; mainnet #19 (v1.6.0) carried
// 0001-01-01 and passed.
//
// Deleting `time` after `fromPartial` does not help either, and is the fix that
// looks right: the proposal's messages are packed with `Registry.encode`, which
// runs `fromPartial` again and puts the empty Timestamp back. The only value
// that survives the real encoding path is an explicit Go zero, which is also
// byte for byte what a Go client such as `lumend` sends.

/** Go's zero `time.Time` (0001-01-01T00:00:00Z) in Unix seconds. */
const GO_ZERO_TIME_SECONDS = -62135596800n;

/**
 * @param {{name: string, height: number|bigint|string, info?: string}} input
 *   already validated by the caller - this only shapes the plan.
 */
function softwareUpgradePlan({ name, height, info }) {
  return {
    name: String(name),
    height: BigInt(height),
    info: String(info || ''),
    time: { seconds: GO_ZERO_TIME_SECONDS, nanos: 0 }
  };
}

module.exports = {
  GO_ZERO_TIME_SECONDS,
  softwareUpgradePlan
};
