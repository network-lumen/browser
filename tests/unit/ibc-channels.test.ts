import { describe, expect, it } from 'vitest';
import {
  describeIbcChannel,
  normalizeIbcChannels,
  readClientStateChainId,
} from '../../src/internal/services/ibcChannels';
import type { RawIbcChannel } from '../../src/types/walletPage';

const raw = (over: Partial<RawIbcChannel> = {}): RawIbcChannel => ({
  channelId: 'channel-0',
  portId: 'transfer',
  counterpartyChannelId: '',
  counterpartyPortId: '',
  connectionId: '',
  state: 'STATE_OPEN',
  ...over,
});

describe('normalising what the chain reports', () => {
  it('reads snake_case and camelCase alike', () => {
    // A channel spelled one way and read the other silently vanishes from the
    // list, which is the whole reason both are accepted.
    const snake = normalizeIbcChannels([
      {
        channel_id: 'channel-1',
        port_id: 'transfer',
        state: 'STATE_OPEN',
        counterparty: { channel_id: 'channel-9', port_id: 'transfer' },
        connection_hops: ['connection-3'],
      },
    ]);
    const camel = normalizeIbcChannels([
      {
        channelId: 'channel-1',
        portId: 'transfer',
        state: 'STATE_OPEN',
        counterparty: { channelId: 'channel-9', portId: 'transfer' },
        connectionHops: ['connection-3'],
      },
    ]);
    expect(snake).toEqual(camel);
    expect(snake[0]).toMatchObject({
      channelId: 'channel-1',
      counterpartyChannelId: 'channel-9',
      connectionId: 'connection-3',
    });
  });

  it('keeps only open transfer channels', () => {
    const channels = normalizeIbcChannels([
      { channel_id: 'a', port_id: 'transfer', state: 'STATE_OPEN' },
      { channel_id: 'b', port_id: 'transfer', state: 'OPEN' },
      { channel_id: 'c', port_id: 'transfer', state: 'STATE_CLOSED' },
      { channel_id: 'd', port_id: 'icahost', state: 'STATE_OPEN' },
      { port_id: 'transfer', state: 'STATE_OPEN' },
    ]);
    expect(channels.map((c) => c.channelId)).toEqual(['a', 'b']);
  });

  it('keeps a channel whose state the endpoint did not report', () => {
    // Some endpoints omit it; dropping those would empty the list on a chain
    // that works perfectly well.
    expect(normalizeIbcChannels([{ channel_id: 'a', port_id: 'transfer' }])).toHaveLength(1);
  });

  it('defaults a missing port to transfer rather than discarding the channel', () => {
    expect(normalizeIbcChannels([{ channel_id: 'a', state: 'OPEN' }])[0].portId).toBe('transfer');
    expect(normalizeIbcChannels([{ channel_id: 'a', port_id: '   ', state: 'OPEN' }])[0].portId).toBe(
      'transfer'
    );
  });

  it('survives a payload that is not a list', () => {
    for (const junk of [null, undefined, {}, 'nope', 7]) {
      expect(normalizeIbcChannels(junk)).toEqual([]);
    }
  });

  it('compares state case-insensitively', () => {
    expect(normalizeIbcChannels([{ channel_id: 'a', port_id: 'transfer', state: 'open' }])).toHaveLength(1);
  });
});

describe('describing a channel', () => {
  it('names the destination chain when it is known', () => {
    const described = describeIbcChannel(raw({ channelId: 'channel-2' }), 'beezee-1');
    expect(described.label).toBe('channel-2 -> beezee-1');
    expect(described.prefixHints).toContain('beezee');
  });

  it('falls back to the counterparty channel when the chain is unknown', () => {
    // An unidentified chain is not fatal - the channel still works, it just
    // cannot be matched to a recipient by prefix.
    const described = describeIbcChannel(
      raw({ channelId: 'channel-2', counterpartyChannelId: 'channel-7' }),
      ''
    );
    expect(described.label).toBe('channel-2 -> channel-7');
    expect(described.prefixHints).toEqual([]);
  });

  it('names itself alone when it knows neither', () => {
    expect(describeIbcChannel(raw({ channelId: 'channel-2' }), '').label).toBe('channel-2');
  });
});

describe('finding the chain id in a client state', () => {
  it('accepts each shape a node might answer with', () => {
    const shapes = [
      { identified_client_state: { client_state: { chain_id: 'x-1' } } },
      { identified_client_state: { client_state: { chainId: 'x-1' } } },
      { client_state: { chain_id: 'x-1' } },
      { client_state: { chainId: 'x-1' } },
    ];
    for (const shape of shapes) {
      expect(readClientStateChainId(shape)).toBe('x-1');
    }
  });

  it('returns empty rather than throwing on anything else', () => {
    for (const junk of [null, undefined, {}, { client_state: {} }]) {
      expect(readClientStateChainId(junk)).toBe('');
    }
  });
});
