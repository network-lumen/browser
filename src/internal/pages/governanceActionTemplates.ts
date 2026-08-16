import { markForTranslation } from '../services/i18n';
import type { GovernanceActionTemplate } from '../../types/networkGovernance';

// Mirrors the authority-gated action builders registered server-side in
// electron/ipc/wallet.cjs (GOVERNANCE_ACTION_BUILDERS) - the `id` here must
// match the templateId key on that side exactly. Ported from the reference
// app's multi-action proposal builder (browser/browser DaoLanding.vue), then
// cross-checked against lumen/blockchain's docs/governance.md and
// devtools/tests/{lib_gov.sh,gov_param_cases.json,e2e_upgrade.sh} - the
// actual e2e suite for this chain's gov module - to drop anything that would
// fail on-chain:
// - x/release's MsgSetEmergency: gated on daoPublishers/Creator, not the gov
//   authority, so wrapping it in a proposal would always be rejected.
// - x/pqc's MsgUpdateParams: msg_server.go unconditionally rejects it
//   ("x/pqc params are immutable; use MsgAddIBCRelayer or
//   MsgRemoveIBCRelayer"), confirmed by governance.md's immutable-surface
//   list. Only the two relayer-allowlist messages are governable for pqc.
// Every remaining template's fields were checked against docs/governance.md's
// governable-surface list and/or gov_param_cases.json's test scenarios.
export const GOVERNANCE_ACTION_TEMPLATES: GovernanceActionTemplate[] = [
  // One entry for the whole module, because MsgUpdateParams replaces the entire
  // Params object rather than merging. Three separate DNS templates could be
  // added to one proposal, and the chain would apply them in order, each
  // wiping the one before it - so the last message was the only one that
  // counted. base_fee_dns is not offered: the keeper refuses any proposal that
  // changes it, and it is carried through from the current params untouched.
  {
    id: 'dns-update-params',
    paramsPath: '/lumen/dns/v1/params',
    module: 'DNS',
    label: markForTranslation('Fees & guard rails'),
    summary: markForTranslation('Update domain fees, transfer and bid fees, and the guard rails on record updates. Leave a field blank to keep it unchanged.'),
    fields: [
      { key: 'updateFeeUlmn', source: { key: 'update_fee_ulmn', unit: 'lmn' }, label: markForTranslation('Update fee (LMN)'), type: 'text', placeholder: '0.01' },
      { key: 'transferFeeUlmn', source: { key: 'transfer_fee_ulmn', unit: 'lmn' }, label: markForTranslation('Transfer fee (LMN)'), type: 'text', placeholder: '0.05' },
      { key: 'bidFeeUlmn', source: { key: 'bid_fee_ulmn', unit: 'lmn' }, label: markForTranslation('Bid fee (LMN)'), type: 'text', placeholder: '0.01' },
      { key: 'updateRateLimitSeconds', source: { key: 'update_rate_limit_seconds' }, label: markForTranslation('Rate limit (seconds)'), type: 'number', placeholder: '60' },
      { key: 'updatePowDifficulty', source: { key: 'update_pow_difficulty' }, label: markForTranslation('PoW difficulty'), type: 'number', placeholder: '18' },
      { key: 'graceDays', source: { key: 'grace_days' }, label: markForTranslation('Grace period (days)'), type: 'number', placeholder: '1' },
      { key: 'auctionDays', source: { key: 'auction_days' }, label: markForTranslation('Auction duration (days)'), type: 'number', placeholder: '1' },
      { key: 'minPriceUlmnPerMonthLmn', source: { key: 'min_price_ulmn_per_month', unit: 'lmn' }, label: markForTranslation('Minimum price per month (LMN)'), type: 'text', placeholder: '2' },
      // base_fee_dns is the curve's starting price and the keeper refuses any
      // change to it, so the four knobs below shape the curve around a fixed
      // base rather than moving it.
      { key: 'alpha', source: { key: 'alpha' }, label: markForTranslation('Curve alpha'), type: 'text', placeholder: '0.125', hint: markForTranslation('Decimal. How sharply the price reacts to demand.') },
      { key: 'floor', source: { key: 'floor' }, label: markForTranslation('Curve floor'), type: 'text', placeholder: '0.1' },
      { key: 'ceiling', source: { key: 'ceiling' }, label: markForTranslation('Curve ceiling'), type: 'text', placeholder: '100' },
      { key: 't', source: { key: 't' }, label: markForTranslation('Curve target'), type: 'number', placeholder: '50' },
      {
        key: 'domainTiers', source: { key: 'domain_tiers', unit: 'tiers' },
        label: markForTranslation('Domain length tiers'),
        type: 'textarea',
        placeholder: '4:40000, 8:20000, 15:10000, 0:5000',
        hint: markForTranslation('maxLength:multiplierBps pairs, in order. A max length of 0 is the catch-all and goes last.')
      },
      {
        key: 'extTiers', source: { key: 'ext_tiers', unit: 'tiers' },
        label: markForTranslation('Extension length tiers'),
        type: 'textarea',
        placeholder: '3:15000, 6:10000, 0:7000',
        hint: markForTranslation('maxLength:multiplierBps pairs, in order. A max length of 0 is the catch-all and goes last.')
      }
    ]
  },
  {
    id: 'gateways-update-params',
    paramsPath: '/lumen/gateway/v1/params',
    module: markForTranslation('Gateways'),
    label: markForTranslation('Commission, pricing & timing'),
    summary: markForTranslation('Update gateway contract commission, minimum price, action fee, and finalize delay. Leave a field blank to keep it unchanged.'),
    fields: [
      { key: 'platformCommissionBps', source: { key: 'platform_commission_bps' }, label: markForTranslation('Commission (bps)'), type: 'text', placeholder: '500', hint: markForTranslation('100 bps = 1%') },
      { key: 'minPriceUlmnPerMonthLmn', source: { key: 'min_price_ulmn_per_month', unit: 'lmn' }, label: markForTranslation('Min contract price / month (LMN)'), type: 'text', placeholder: '1' },
      { key: 'actionFeeUlmnLmn', source: { key: 'action_fee_ulmn', unit: 'lmn' }, label: markForTranslation('Action fee (LMN)'), type: 'text', placeholder: '0.01' },
      { key: 'registerGatewayFeeUlmnLmn', source: { key: 'register_gateway_fee_ulmn', unit: 'lmn' }, label: markForTranslation('Register gateway fee (LMN)'), type: 'text', placeholder: '1' },
      { key: 'finalizeDelayMonths', source: { key: 'finalize_delay_months' }, label: markForTranslation('Finalize delay (months)'), type: 'text', placeholder: '1' },
      { key: 'maxActiveContractsPerGateway', source: { key: 'max_active_contracts_per_gateway' }, label: markForTranslation('Max active contracts / gateway'), type: 'text', placeholder: '100' },
      { key: 'monthSeconds', source: { key: 'month_seconds' }, label: markForTranslation('Month length (seconds)'), type: 'text', placeholder: '2592000', hint: markForTranslation('What a contract month is worth. Changing it reprices every running contract.') },
      { key: 'finalizerRewardBps', source: { key: 'finalizer_reward_bps' }, label: markForTranslation('Finalizer reward (bps)'), type: 'text', placeholder: '100', hint: markForTranslation('100 bps = 1%') }
    ]
  },
  {
    // One entry per module for the same reason the dns ones were merged:
    // MsgUpdateParams replaces the whole object, so two of them in a proposal
    // would be two replacements and the second would undo the first.
    //
    // Five of the eight tokenomics params are refused by the keeper as
    // immutable - denom, decimals, supply cap, halving interval and the initial
    // block reward - so only these three are offered. They ride along unchanged.
    id: 'tokenomics-update-params',
    paramsPath: '/lumen/tokenomics/v1/params',
    module: markForTranslation('Tokenomics'),
    label: markForTranslation('Tax, minimum send & distribution'),
    summary: markForTranslation('Transaction tax, smallest transferable amount, and how often rewards are distributed. Leave a field blank to keep it unchanged.'),
    fields: [
      { key: 'txTaxRate', source: { key: 'tx_tax_rate' }, label: markForTranslation('Tax rate'), type: 'text', placeholder: '0.01', hint: markForTranslation('Decimal, e.g. 0.01 = 1%') },
      { key: 'minSendUlmn', source: { key: 'min_send_ulmn' }, label: markForTranslation('Minimum send (ulmn)'), type: 'text', placeholder: '1', hint: markForTranslation('In micro-LMN, not LMN: this is the smallest unit the chain will move.') },
      { key: 'distributionIntervalBlocks', source: { key: 'distribution_interval_blocks' }, label: markForTranslation('Distribution interval (blocks)'), type: 'text', placeholder: '1' }
    ]
  },
  {
    id: 'tokenomics-community-pool-spend',
    module: markForTranslation('Tokenomics'),
    label: markForTranslation('Community pool spend'),
    summary: markForTranslation('Send funds from the community pool to a recipient address.'),
    fields: [
      { key: 'recipient', label: markForTranslation('Recipient address'), type: 'text', placeholder: 'lmn1...' },
      { key: 'amountLmn', label: markForTranslation('Amount (LMN)'), type: 'text', placeholder: '1000' }
    ]
  },
  {
    // Only the ordinary deposit, because it is the only one any client can
    // set. Offering the expedited figure beside it would need
    // cosmos.gov.v1.MsgUpdateParams, which cannot execute here: gov requires
    // proposal messages to be signed by the gov account, and its own params
    // handler requires a different authority - see the builder in
    // electron/ipc/wallet.cjs. Tried on the devnet as proposal #7 and refused.
    id: 'tokenomics-gov-min-deposit',
    module: markForTranslation('Tokenomics'),
    label: markForTranslation('Governance minimum deposit'),
    summary: markForTranslation('Minimum deposit (in LMN) required for a proposal to enter voting.'),
    fields: [
      {
        key: 'minDepositLmn',
        label: markForTranslation('Minimum deposit (LMN)'),
        type: 'text',
        placeholder: '10',
        hint: markForTranslation('Must stay below the expedited minimum deposit, which no client can change on this chain.')
      }
    ]
  },
  {
    id: 'tokenomics-slashing-downtime',
    module: markForTranslation('Slashing'),
    label: markForTranslation('Downtime penalties'),
    summary: markForTranslation('Slash fraction and jail duration applied for validator downtime.'),
    fields: [
      { key: 'slashFractionDowntime', label: markForTranslation('Slash fraction'), type: 'text', placeholder: '0.01' },
      { key: 'downtimeJailDuration', label: markForTranslation('Jail duration'), type: 'text', placeholder: '600s', hint: markForTranslation('Go duration string, e.g. 600s or 1h') }
    ]
  },
  {
    id: 'tokenomics-slashing-liveness',
    module: markForTranslation('Slashing'),
    label: markForTranslation('Liveness window'),
    summary: markForTranslation('Signed-blocks window and minimum signed ratio for validator liveness.'),
    fields: [
      { key: 'signedBlocksWindow', label: markForTranslation('Signed blocks window'), type: 'number', placeholder: '10000' },
      { key: 'minSignedPerWindow', label: markForTranslation('Min signed ratio'), type: 'text', placeholder: '0.95' }
    ]
  },
  {
    id: 'pqc-add-ibc-relayer',
    module: 'PQC',
    label: markForTranslation('Add IBC relayer'),
    summary: markForTranslation('Add an address to the PQC IBC relayer allowlist.'),
    fields: [
      { key: 'relayer', label: markForTranslation('Relayer address'), type: 'text', placeholder: 'lmn1...' }
    ]
  },
  {
    id: 'pqc-remove-ibc-relayer',
    module: 'PQC',
    label: markForTranslation('Remove IBC relayer'),
    summary: markForTranslation('Remove an address from the PQC IBC relayer allowlist.'),
    fields: [
      { key: 'relayer', label: markForTranslation('Relayer address'), type: 'text', placeholder: 'lmn1...' }
    ]
  },
  {
    id: 'release-validate',
    module: markForTranslation('Release'),
    label: markForTranslation('Validate release'),
    summary: markForTranslation('Mark a pending release as validated.'),
    fields: [
      { key: 'releaseId', label: markForTranslation('Release ID'), type: 'number', placeholder: '1' }
    ]
  },
  {
    id: 'release-reject',
    module: markForTranslation('Release'),
    label: markForTranslation('Reject release'),
    summary: markForTranslation('Reject a pending release.'),
    fields: [
      { key: 'releaseId', label: markForTranslation('Release ID'), type: 'number', placeholder: '1' }
    ]
  },
  {
    id: 'release-update-params',
    paramsPath: '/lumen/release/params',
    module: markForTranslation('Release'),
    label: markForTranslation('Publishers, channels, fees & limits'),
    summary: markForTranslation('Update allowed publishers/channels, anti-spam fees, and per-release artifact limits. Leave a field blank to keep it unchanged.'),
    fields: [
      { key: 'allowedPublishers', source: { key: 'allowed_publishers', unit: 'lines' }, label: markForTranslation('Allowed publishers'), type: 'textarea', placeholder: 'lmn1...\nlmn1...', hint: markForTranslation('One bech32 address per line') },
      { key: 'channels', source: { key: 'channels', unit: 'lines' }, label: markForTranslation('Channels'), type: 'textarea', placeholder: 'stable\nbeta\nnightly', hint: markForTranslation('One channel per line') },
      { key: 'maxArtifacts', source: { key: 'max_artifacts' }, label: markForTranslation('Max artifacts'), type: 'number', placeholder: '8' },
      { key: 'maxUrlsPerArt', source: { key: 'max_urls_per_art' }, label: markForTranslation('Max URLs per artifact'), type: 'number', placeholder: '4' },
      { key: 'maxSigsPerArt', source: { key: 'max_sigs_per_art' }, label: markForTranslation('Max signatures per artifact'), type: 'number', placeholder: '4' },
      { key: 'maxNotesLen', source: { key: 'max_notes_len' }, label: markForTranslation('Max notes length'), type: 'number', placeholder: '2000' },
      { key: 'publishFeeUlmnLmn', source: { key: 'publish_fee_ulmn', unit: 'lmn' }, label: markForTranslation('Publish fee (LMN, escrowed)'), type: 'text', placeholder: '1' },
      { key: 'maxPendingTtlSeconds', source: { key: 'max_pending_ttl' }, label: markForTranslation('Pending TTL (seconds)'), type: 'text', placeholder: '86400' },
      { key: 'rejectRefundBps', source: { key: 'reject_refund_bps' }, label: markForTranslation('Reject refund (bps)'), type: 'text', placeholder: '5000', hint: markForTranslation('10000 bps = 100%') },
      {
        key: 'requireValidationForStable', source: { key: 'require_validation_for_stable', unit: 'bool' },
        label: markForTranslation('Require validation for stable channel'),
        type: 'select',
        options: [
          { value: '', label: markForTranslation('(unchanged)') },
          { value: 'true', label: markForTranslation('Required') },
          { value: 'false', label: markForTranslation('Not required') }
        ]
      },
      { key: 'daoPublishers', source: { key: 'dao_publishers', unit: 'lines' }, label: markForTranslation('DAO publishers'), type: 'textarea', placeholder: 'lmn1...\nlmn1...', hint: markForTranslation('One bech32 address per line') }
    ]
  },
  {
    id: 'upgrade-software',
    module: markForTranslation('Chain'),
    label: markForTranslation('Software upgrade'),
    summary: markForTranslation('Schedule a coordinated chain upgrade at a target block height.'),
    fields: [
      { key: 'name', label: markForTranslation('Upgrade name'), type: 'text', placeholder: 'v2' },
      { key: 'height', label: markForTranslation('Target height'), type: 'number', placeholder: '1000000' },
      { key: 'info', label: markForTranslation('Info (optional)'), type: 'textarea', placeholder: markForTranslation('Upgrade handler metadata / binary URLs…') }
    ]
  },
  {
    // The counterpart to the above, and the reason it is worth having: a plan
    // set at the wrong height halts the chain there, and the only way back is
    // another proposal - which has to pass before the plan fires.
    id: 'upgrade-cancel',
    module: markForTranslation('Chain'),
    label: markForTranslation('Cancel scheduled upgrade'),
    summary: markForTranslation('Drop the pending upgrade plan. The module holds at most one, so there is nothing to name.'),
    fields: []
  }
];

export function findGovernanceActionTemplate(id: string): GovernanceActionTemplate | undefined {
  return GOVERNANCE_ACTION_TEMPLATES.find((t) => t.id === id);
}
