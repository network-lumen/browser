/**
 * The last of the stubs: site origins, the chain writes behind domains and
 * governance, and the two helpers a lumen:// page calls back into.
 *
 * Two different kinds of thing live here, and they fail differently on
 * purpose.
 *
 * `site.*` is about giving a lumen:// page a stable origin. The desktop
 * registers the host with Chromium's session so the page keeps its storage
 * across republishes, since the gateway URL carries the CID and changes every
 * time. There is no equivalent in a WebView, so these answer honestly rather
 * than pretending - and `SitePage` already treats a refusal as "use the gateway
 * URL", which is exactly the right fallback.
 *
 * The chain writes are the opposite: they work, through the same SDK signing
 * path `wallet.ts` uses. A transaction is a transaction on any platform.
 */

import { submitMessages } from './wallet';

const str = (value: unknown, max = 256) => String(value ?? '').trim().slice(0, max);

export const SITE_CHAIN_MEMBERS = {
  // ---------------------------------------------------------------------
  // Site origins - no WebView equivalent, answered rather than faked
  // ---------------------------------------------------------------------

  /**
   * The desktop pins a lumen:// origin onto a Chromium webContents so the page
   * keeps its storage across republishes. A WebView exposes nothing like it,
   * and the caller already falls back to the gateway URL - the page still
   * works, it just gets CID-scoped storage.
   */
  'site.registerHost': async () => ({ ok: false, error: 'stable_origin_unavailable_on_mobile' }),

  'site.hostStatus': async () => ({ ok: true, registered: false }),

  'site.registerDomainTarget': async () => ({ ok: false, error: 'no_webview_target_on_mobile' }),

  'site.unregisterDomainTarget': async () => ({ ok: true }),

  // ---------------------------------------------------------------------
  // Domain writes
  // ---------------------------------------------------------------------

  'dns.createDomain': (input: { name?: string; ext?: string; years?: number }) =>
    submitMessages((_sdk, from) => [
      {
        typeUrl: '/lumen.dns.v1.MsgCreateDomain',
        value: {
          creator: from,
          name: str(input?.name, 128),
          ext: str(input?.ext, 32),
          years: Number(input?.years ?? 1)
        }
      }
    ]),

  'dns.updateDomain': (input: { name?: string; ext?: string; records?: unknown[] }) =>
    submitMessages((_sdk, from) => [
      {
        typeUrl: '/lumen.dns.v1.MsgUpdateDomain',
        value: {
          creator: from,
          name: str(input?.name, 128),
          ext: str(input?.ext, 32),
          records: Array.isArray(input?.records) ? input.records : []
        }
      }
    ]),

  'dns.transferDomain': (input: { name?: string; ext?: string; newOwner?: string }) =>
    submitMessages((_sdk, from) => [
      {
        typeUrl: '/lumen.dns.v1.MsgTransferDomain',
        value: {
          creator: from,
          name: str(input?.name, 128),
          ext: str(input?.ext, 32),
          newOwner: str(input?.newOwner)
        }
      }
    ]),

  'dns.renewDomain': (input: { name?: string; ext?: string; years?: number }) =>
    submitMessages((_sdk, from) => [
      {
        typeUrl: '/lumen.dns.v1.MsgRenewDomain',
        value: {
          creator: from,
          name: str(input?.name, 128),
          ext: str(input?.ext, 32),
          years: Number(input?.years ?? 1)
        }
      }
    ]),

  'dns.bidDomain': (input: { name?: string; ext?: string; amount?: string; denom?: string }) =>
    submitMessages((_sdk, from) => [
      {
        typeUrl: '/lumen.dns.v1.MsgBidDomain',
        value: {
          creator: from,
          name: str(input?.name, 128),
          ext: str(input?.ext, 32),
          amount: { denom: str(input?.denom, 32) || 'ulmn', amount: String(input?.amount ?? '0') }
        }
      }
    ]),

  'dns.settleDomain': (input: { name?: string; ext?: string }) =>
    submitMessages((_sdk, from) => [
      {
        typeUrl: '/lumen.dns.v1.MsgSettleDomain',
        value: { creator: from, name: str(input?.name, 128), ext: str(input?.ext, 32) }
      }
    ]),

  // ---------------------------------------------------------------------
  // Governance
  //
  // The wallet deliberately does not vote - governance was removed from it on
  // the desktop as a product decision, and these exist only because the
  // contract lists them. They are wired rather than stubbed so the shape is
  // right if that decision is ever revisited.
  // ---------------------------------------------------------------------

  'wallet.govVote': (input: { proposalId?: string | number; option?: number }) =>
    submitMessages((_sdk, from) => [
      {
        typeUrl: '/cosmos.gov.v1.MsgVote',
        value: {
          proposalId: String(input?.proposalId ?? ''),
          voter: from,
          option: Number(input?.option ?? 0)
        }
      }
    ]),

  'wallet.govSubmitProposal': (input: {
    messages?: unknown[];
    deposit?: { denom?: string; amount?: string }[];
    title?: string;
    summary?: string;
  }) =>
    submitMessages((_sdk, from) => [
      {
        typeUrl: '/cosmos.gov.v1.MsgSubmitProposal',
        value: {
          messages: Array.isArray(input?.messages) ? input.messages : [],
          initialDeposit: Array.isArray(input?.deposit) ? input.deposit : [],
          proposer: from,
          title: str(input?.title, 256),
          summary: str(input?.summary, 4096)
        }
      }
    ]),

  'wallet.govCancelProposal': (input: { proposalId?: string | number }) =>
    submitMessages((_sdk, from) => [
      {
        typeUrl: '/cosmos.gov.v1.MsgCancelProposal',
        value: { proposalId: String(input?.proposalId ?? ''), proposer: from }
      }
    ]),

  /** Staking on another Cosmos chain, which this target does not reach. */
  'wallet.cosmosStake': async () => ({
    ok: false,
    error: 'cross_chain_staking_unavailable_on_mobile'
  }),

  // ---------------------------------------------------------------------
  // lumen:// page callbacks
  // ---------------------------------------------------------------------

  /**
   * A page inside a lumen:// site asking the app for something - a signature,
   * a pin. The desktop routes it from the guest preload; a cross-origin iframe
   * has no such channel, so nothing ever arrives and the unsubscribe is all
   * there is to hand back.
   */
  'lumenSite.onUiRequest': () => () => {},

  'lumenSite.respondUiRequest': async () => ({ ok: true }),

  'domainSite.sendToken': async () => ({ ok: false, error: 'site_bridge_unavailable_on_mobile' }),

  'domainSite.pin': async () => ({ ok: false, error: 'site_bridge_unavailable_on_mobile' })
};
