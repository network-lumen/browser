import { describe, expect, it } from 'vitest';
import { activityBadgeStyle, describeActivity } from '../../src/internal/services/chainMessages';

describe('recognising a chain message', () => {
  it('matches with and without the leading slash', () => {
    // Which one arrives depends on the endpoint that reported it, so both are
    // matched rather than guessing.
    expect(describeActivity({ action: 'lumen.dns.v1.MsgUpdate' }).label).toBe('Dns update');
    expect(describeActivity({ action: '/lumen.dns.v1.MsgUpdate' }).label).toBe('Dns update');
  });

  it('names each type it knows', () => {
    const labels = [
      ['lumen.dns.v1.MsgUpdate', 'Dns update'],
      ['lumen.dns.v1.MsgTransfer', 'Dns transfer'],
      ['lumen.dns.v1.MsgRegister', 'Dns register'],
      ['cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward', 'Withdraw rewards'],
      ['lumen.release.v1.MsgPublishRelease', 'Publish release'],
      ['lumen.pqc.v1.MsgLinkAccountPQC', 'PQC link'],
    ];
    for (const [action, label] of labels) {
      expect(describeActivity({ action }).label).toBe(label);
    }
  });

  it('does not match a type that merely contains a known one', () => {
    expect(describeActivity({ action: 'evil.lumen.dns.v1.MsgUpdate' }).label).toBe('Unknown');
    expect(describeActivity({ action: 'lumen.dns.v1.MsgUpdateOther' }).label).toBe('Unknown');
  });

  it('falls back to the direction when there is no message type', () => {
    expect(describeActivity({ type: 'send' }).label).toBe('Send');
    expect(describeActivity({ type: 'receive' }).label).toBe('Receive');
  });

  it('has something to show for anything at all', () => {
    for (const junk of [{}, { action: '' }, { type: 'sideways' }]) {
      const described = describeActivity(junk);
      expect(described.label).toBe('Unknown');
      expect(described.icon).toBeTruthy();
    }
  });
});

describe('which messages carry a domain name', () => {
  it('is true for the DNS messages and their neighbours', () => {
    for (const action of [
      'lumen.dns.v1.MsgUpdate',
      'lumen.dns.v1.MsgTransfer',
      'lumen.dns.v1.MsgRegister',
      'cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
      'lumen.release.v1.MsgPublishRelease',
    ]) {
      expect(describeActivity({ action }).carriesDomainName).toBe(true);
    }
  });

  it('is false for the PQC link, which is the one exception', () => {
    // It used to be said by leaving this type out of two long chains of ORs,
    // where the absence looked exactly like an oversight.
    expect(describeActivity({ action: 'lumen.pqc.v1.MsgLinkAccountPQC' }).carriesDomainName).toBe(
      false
    );
  });

  it('is false for a plain transfer', () => {
    expect(describeActivity({ type: 'send' }).carriesDomainName).toBe(false);
    expect(describeActivity({ type: 'receive' }).carriesDomainName).toBe(false);
  });
});

describe('the badge', () => {
  it('tints from the message colour', () => {
    expect(activityBadgeStyle({ action: 'lumen.dns.v1.MsgUpdate' })).toEqual({
      background: 'rgba(var(--color-purple-rgb), 0.1)',
      color: 'var(--color-purple)',
    });
  });

  it('gives every known type a distinct colour', () => {
    const actions = [
      'lumen.dns.v1.MsgUpdate',
      'lumen.dns.v1.MsgTransfer',
      'lumen.dns.v1.MsgRegister',
      'cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
      'lumen.release.v1.MsgPublishRelease',
      'lumen.pqc.v1.MsgLinkAccountPQC',
    ];
    const tints = actions.map((action) => describeActivity({ action }).tint);
    expect(new Set(tints).size).toBe(actions.length);
  });

  it('stays bare for an unrecognised message rather than inventing a colour', () => {
    expect(activityBadgeStyle({})).toEqual({});
    expect(activityBadgeStyle({ action: 'who.knows.v1.MsgWhatever' })).toEqual({});
  });
});
