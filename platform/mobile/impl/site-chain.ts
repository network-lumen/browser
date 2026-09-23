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

/**
 * A domain and its extension, however the caller spelled them.
 *
 * The pages send `name` as a whole "mysite.lmn" in some places and the two
 * halves separately in others, while every x/dns message wants them apart.
 */
function splitDomain(input: { name?: string; domain?: string; ext?: string }): {
  domain: string;
  ext: string;
} {
  const explicitDomain = str(input?.domain, 128).toLowerCase();
  const explicitExt = str(input?.ext, 32).toLowerCase();
  if (explicitDomain && explicitExt) return { domain: explicitDomain, ext: explicitExt };

  const fqdn = str(input?.name, 160).toLowerCase();
  const match = fqdn.match(/^([^.]+).([^.]+)$/);
  if (match) return { domain: match[1], ext: match[2] };

  return { domain: explicitDomain || fqdn, ext: explicitExt };
}

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
  //
  // Built by the SDK rather than by hand. An earlier version wrote its own
  // typeUrls - `/lumen.dns.v1.MsgCreateDomain` and friends - and the chain
  // rejected every one of them with "unregistered type url", because those
  // messages do not exist: x/dns calls them MsgRegister, MsgUpdate, MsgRenew,
  // MsgTransfer, MsgBid and MsgSettle. `client.dns()` names them correctly and
  // encodes the fields through the generated types, so a rename on the chain
  // surfaces as a compile-time change to the SDK rather than as a transaction
  // nobody can submit.
  //
  // A domain is always a pair - `domain` and `ext` - never one joined string,
  // which is the other thing the hand-written version got wrong.
  // ---------------------------------------------------------------------

  'dns.createDomain': (input: {
    name?: string;
    domain?: string;
    ext?: string;
    records?: unknown[];
    duration_days?: number;
    durationDays?: number;
    owner?: string;
  }) =>
    submitMessages(
      (_sdk, from, client) => {
        const { domain, ext } = splitDomain(input);
        return [
          client.dns().msgRegister(from, {
            domain,
            ext,
            records: Array.isArray(input?.records) ? input.records : [],
            durationDays: Number(input?.duration_days ?? input?.durationDays ?? 365),
            owner: str(input?.owner) || from
          })
        ];
      },
      'dns:register'
    ),

  /**
   * Update carries a proof of work. `pow_difficulty_bits` ships at 0, so the
   * nonce is usually free - but the field is part of the message and omitting
   * it is not the same as sending zero.
   */
  'dns.updateDomain': (input: {
    name?: string;
    domain?: string;
    ext?: string;
    records?: unknown[];
    pow_nonce?: number;
    powNonce?: number;
  }) =>
    submitMessages((_sdk, from, client) => {
      const { domain, ext } = splitDomain(input);
      return [
        client.dns().msgUpdate(from, {
          domain,
          ext,
          records: Array.isArray(input?.records) ? input.records : [],
          powNonce: Number(input?.pow_nonce ?? input?.powNonce ?? 0)
        })
      ];
    }, 'dns:update'),

  'dns.transferDomain': (input: {
    name?: string;
    domain?: string;
    ext?: string;
    newOwner?: string;
    new_owner?: string;
  }) =>
    submitMessages((_sdk, from, client) => {
      const { domain, ext } = splitDomain(input);
      return [
        client.dns().msgTransfer(from, {
          domain,
          ext,
          newOwner: str(input?.newOwner ?? input?.new_owner)
        })
      ];
    }, 'dns:transfer'),

  'dns.renewDomain': (input: {
    name?: string;
    domain?: string;
    ext?: string;
    duration_days?: number;
    durationDays?: number;
  }) =>
    submitMessages((_sdk, from, client) => {
      const { domain, ext } = splitDomain(input);
      return [
        client.dns().msgRenew(from, {
          domain,
          ext,
          durationDays: Number(input?.duration_days ?? input?.durationDays ?? 365)
        })
      ];
    }, 'dns:renew'),

  'dns.bidDomain': (input: { name?: string; domain?: string; ext?: string; amount?: string }) =>
    submitMessages((_sdk, from, client) => {
      const { domain, ext } = splitDomain(input);
      // The amount is a plain string on this message, not a Coin.
      return [client.dns().msgBid(from, { domain, ext, amount: String(input?.amount ?? '0') })];
    }, 'dns:bid'),

  'dns.settleDomain': (input: { name?: string; domain?: string; ext?: string }) =>
    submitMessages((_sdk, from, client) => {
      const { domain, ext } = splitDomain(input);
      return [client.dns().msgSettle(from, { domain, ext })];
    }, 'dns:settle'),

  // ---------------------------------------------------------------------
  // Governance
  //
  // The wallet deliberately does not vote - governance was removed from it on
  // the desktop as a product decision, and these exist only because the
  // contract lists them. They are wired rather than stubbed so the shape is
  // right if that decision is ever revisited.
  // ---------------------------------------------------------------------

  'wallet.govVote': (input: { proposalId?: string | number; option?: number }) =>
    submitMessages((_sdk, from, client) => [
      client.gov().msgVote(from, {
        proposalId: input?.proposalId ?? 0,
        option: Number(input?.option ?? 0)
      })
    ]),

  'wallet.govSubmitProposal': (input: {
    messages?: unknown[];
    deposit?: { denom?: string; amount?: string }[];
    title?: string;
    summary?: string;
  }) =>
    submitMessages((_sdk, from, client) => [
      client.gov().msgSubmitProposal(from, {
        messages: Array.isArray(input?.messages) ? input.messages : [],
        initialDeposit: Array.isArray(input?.deposit) ? input.deposit : [],
        title: str(input?.title, 256),
        summary: str(input?.summary, 4096)
      })
    ]),

  /**
   * Cancelling has no builder on the SDK's gov module, so the message is
   * written out - but the type is one cosmjs already registers, which is the
   * part that matters.
   */
  'wallet.govCancelProposal': (input: { proposalId?: string | number }) =>
    submitMessages((_sdk, from) => [
      {
        typeUrl: '/cosmos.gov.v1.MsgCancelProposal',
        value: { proposalId: String(input?.proposalId ?? '0'), proposer: from }
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
