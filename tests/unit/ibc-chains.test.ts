import { describe, expect, it } from 'vitest';
import { fromBech32, toBech32 } from '@cosmjs/encoding';
import {
  derivePrefixHintsFromChainId,
  estimateRemoteFeeAmount,
  getAddressPrefix,
  humanizeChainId,
  pickIbcChannel,
  reencodeAddressPrefix,
  resolveKnownChainMeta,
  scoreIbcChannel,
} from '../../src/internal/services/ibcChains';
import type { IbcChannelOption } from '../../src/types/walletPage';

const channel = (over: Partial<IbcChannelOption> = {}): IbcChannelOption =>
  ({
    channelId: 'channel-0',
    portId: 'transfer',
    chainId: 'other-1',
    label: 'Other',
    prefixHints: [],
    ...over,
  }) as IbcChannelOption;

describe('reading an address prefix', () => {
  it('takes the part before the bech32 separator', () => {
    expect(getAddressPrefix('lmn1qqqqqqqqqqqqq')).toBe('lmn');
    expect(getAddressPrefix('bze1qqqqqqqqqqqqq')).toBe('bze');
  });

  it('is case-insensitive and tolerates surrounding space', () => {
    expect(getAddressPrefix('  LMN1QQQQQQQQQQQQQ  ')).toBe('lmn');
  });

  it('returns nothing for what is not an address', () => {
    for (const junk of ['', 'lmn', 'not an address', 'lmn1short']) {
      expect(getAddressPrefix(junk)).toBe('');
    }
  });
});

describe('guessing prefixes from a chain id', () => {
  it('drops the revision number', () => {
    expect(derivePrefixHintsFromChainId('beezee-1')).toContain('beezee');
    expect(derivePrefixHintsFromChainId('cosmoshub-4')).toContain('cosmoshub');
  });

  it('drops the environment', () => {
    for (const env of ['testnet', 'mainnet', 'devnet', 'localnet', 'stage', 'alpha', 'beta']) {
      expect(derivePrefixHintsFromChainId(`osmo-${env}-2`)).toContain('osmo');
    }
  });

  it('offers the first token of a compound name as well as the whole', () => {
    expect(derivePrefixHintsFromChainId('cosmos-hub')).toEqual(
      expect.arrayContaining(['cosmoshub', 'cosmos'])
    );
  });

  it('handles the id whose environment has no separator', () => {
    // "bzetestnet-3" does not match the strip pattern, so the prefix is named
    // outright rather than by loosening a rule that would eat real names.
    expect(derivePrefixHintsFromChainId('bzetestnet-3')).toContain('bze');
  });

  it('gives nothing back for nothing', () => {
    expect(derivePrefixHintsFromChainId('')).toEqual([]);
    expect(derivePrefixHintsFromChainId('   ')).toEqual([]);
  });
});

describe('scoring a channel against a recipient', () => {
  it('ranks a declared prefix above a chain id above a label', () => {
    expect(scoreIbcChannel(channel({ prefixHints: ['bze'] }), 'bze')).toBe(100);
    expect(scoreIbcChannel(channel({ chainId: 'bze-1' }), 'bze')).toBe(40);
    expect(scoreIbcChannel(channel({ label: 'BZE hub' }), 'bze')).toBe(10);
    expect(scoreIbcChannel(channel(), 'bze')).toBe(0);
  });

  it('scores nothing when there is no recipient to match', () => {
    expect(scoreIbcChannel(channel({ prefixHints: ['bze'] }), '')).toBe(0);
  });
});

describe('picking the channel a transfer leaves through', () => {
  it('takes the best match', () => {
    const weak = channel({ channelId: 'weak', label: 'bze mentions it' });
    const strong = channel({ channelId: 'strong', prefixHints: ['bze'] });
    expect(pickIbcChannel([weak, strong], 'bze')?.channelId).toBe('strong');
  });

  it('falls back to the first channel when nothing matches', () => {
    // A real decision, not an accident: an unrecognised recipient still gets a
    // route rather than leaving the form without one.
    const first = channel({ channelId: 'first' });
    const second = channel({ channelId: 'second' });
    expect(pickIbcChannel([first, second], 'unknown')?.channelId).toBe('first');
    expect(pickIbcChannel([first, second], '')?.channelId).toBe('first');
  });

  it('breaks a tie by label, so the same input always picks the same channel', () => {
    const b = channel({ channelId: 'b', label: 'Beta', prefixHints: ['bze'] });
    const a = channel({ channelId: 'a', label: 'Alpha', prefixHints: ['bze'] });
    expect(pickIbcChannel([b, a], 'bze')?.channelId).toBe('a');
  });

  it('does not ask for a match when there is only one route', () => {
    expect(pickIbcChannel([channel({ channelId: 'only' })], 'nomatch')?.channelId).toBe('only');
  });

  it('returns nothing when there is nothing to pick', () => {
    expect(pickIbcChannel([], 'bze')).toBeNull();
  });
});

describe('naming a chain', () => {
  it('prefers a known label', () => {
    expect(humanizeChainId('beezee-1')).toBe('BeeZee');
  });

  it('makes an unknown id readable', () => {
    expect(humanizeChainId('cosmos_hub-4')).toBe('Cosmos Hub 4');
    expect(humanizeChainId('')).toBe('Unknown chain');
  });
});

describe('resolving chain metadata', () => {
  it('returns the known entry as-is', () => {
    expect(resolveKnownChainMeta('beezee-1').addressPrefix).toBe('bze');
  });

  it('builds a usable stand-in from a prefix hint', () => {
    const meta = resolveKnownChainMeta('mystery-1', ['osmo']);
    expect(meta.addressPrefix).toBe('osmo');
    expect(meta.nativeDenom).toBe('uosmo');
    expect(meta.iconText).toBe('OSM');
  });

  it('still returns something when it knows nothing at all', () => {
    const meta = resolveKnownChainMeta('', []);
    expect(meta.iconText).toBe('IBC');
    expect(meta.feeDenom).toBe('ulmn');
  });
});

describe('estimating a remote fee', () => {
  it('rounds up, because a fee short by rounding is a rejected transaction', () => {
    expect(estimateRemoteFeeAmount('beezee-1', '150001')).toBe('1501');
  });

  it('falls back when the gas or the chain gives it nothing to work with', () => {
    expect(estimateRemoteFeeAmount('beezee-1', '0')).toBe('1000');
    expect(estimateRemoteFeeAmount('beezee-1', 'lots')).toBe('1000');
    expect(estimateRemoteFeeAmount('unknown-1', '200000')).toBe('1000');
    expect(estimateRemoteFeeAmount('unknown-1', '200000', '42')).toBe('42');
  });
});

describe('rewriting an address for another chain', () => {
  it('keeps the account and swaps the prefix', () => {
    // Built with the library rather than typed out: a bech32 string carries a
    // checksum over its prefix, so a hand-written one is rejected as invalid
    // and the test would pass for the wrong reason.
    const account = new Uint8Array(20).fill(7);
    const lumen = toBech32('lmn', account);

    const swapped = reencodeAddressPrefix(lumen, 'bze');
    expect(swapped.startsWith('bze1')).toBe(true);
    expect(fromBech32(swapped).data).toEqual(account);
    expect(reencodeAddressPrefix(swapped, 'lmn')).toBe(lumen);
  });

  it('returns empty rather than throwing on something that is not an address', () => {
    expect(reencodeAddressPrefix('nonsense', 'bze')).toBe('');
    expect(reencodeAddressPrefix('', 'bze')).toBe('');
  });
});
