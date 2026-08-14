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
    module: 'DNS',
    label: markForTranslation('Fees & guard rails'),
    summary: markForTranslation('Update domain fees, transfer and bid fees, and the guard rails on record updates. Leave a field blank to keep it unchanged.'),
    fields: [
      { key: 'updateFeeUlmn', label: markForTranslation('Update fee (LMN)'), type: 'text', placeholder: '0.01' },
      { key: 'transferFeeUlmn', label: markForTranslation('Transfer fee (LMN)'), type: 'text', placeholder: '0.05' },
      { key: 'bidFeeUlmn', label: markForTranslation('Bid fee (LMN)'), type: 'text', placeholder: '0.01' },
      { key: 'updateRateLimitSeconds', label: markForTranslation('Rate limit (seconds)'), type: 'number', placeholder: '60' },
      { key: 'updatePowDifficulty', label: markForTranslation('PoW difficulty'), type: 'number', placeholder: '18' }
    ]
  },
  {
    id: 'gateways-update-params',
    module: markForTranslation('Gateways'),
    label: markForTranslation('Commission, pricing & timing'),
    summary: markForTranslation('Update gateway contract commission, minimum price, action fee, and finalize delay. Leave a field blank to keep it unchanged.'),
    fields: [
      { key: 'platformCommissionBps', label: markForTranslation('Commission (bps)'), type: 'text', placeholder: '500', hint: markForTranslation('100 bps = 1%') },
      { key: 'minPriceUlmnPerMonthLmn', label: markForTranslation('Min contract price / month (LMN)'), type: 'text', placeholder: '1' },
      { key: 'actionFeeUlmnLmn', label: markForTranslation('Action fee (LMN)'), type: 'text', placeholder: '0.01' },
      { key: 'registerGatewayFeeUlmnLmn', label: markForTranslation('Register gateway fee (LMN)'), type: 'text', placeholder: '1' },
      { key: 'finalizeDelayMonths', label: markForTranslation('Finalize delay (months)'), type: 'text', placeholder: '1' },
      { key: 'maxActiveContractsPerGateway', label: markForTranslation('Max active contracts / gateway'), type: 'text', placeholder: '100' }
    ]
  },
  {
    id: 'tokenomics-tax-rate',
    module: markForTranslation('Tokenomics'),
    label: markForTranslation('Transaction tax rate'),
    summary: markForTranslation('Tax rate applied to transactions, as a decimal (e.g. 0.01 = 1%).'),
    fields: [
      { key: 'txTaxRate', label: markForTranslation('Tax rate'), type: 'text', placeholder: '0.01' }
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
    id: 'tokenomics-gov-min-deposit',
    module: markForTranslation('Tokenomics'),
    label: markForTranslation('Governance minimum deposit'),
    summary: markForTranslation('Minimum deposit (in LMN) required for a proposal to enter voting.'),
    fields: [
      { key: 'minDepositLmn', label: markForTranslation('Minimum deposit (LMN)'), type: 'text', placeholder: '10' }
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
    module: markForTranslation('Release'),
    label: markForTranslation('Publishers, channels, fees & limits'),
    summary: markForTranslation('Update allowed publishers/channels, anti-spam fees, and per-release artifact limits. Leave a field blank to keep it unchanged.'),
    fields: [
      { key: 'allowedPublishers', label: markForTranslation('Allowed publishers'), type: 'textarea', placeholder: 'lmn1...\nlmn1...', hint: markForTranslation('One bech32 address per line') },
      { key: 'channels', label: markForTranslation('Channels'), type: 'textarea', placeholder: 'stable\nbeta\nnightly', hint: markForTranslation('One channel per line') },
      { key: 'maxArtifacts', label: markForTranslation('Max artifacts'), type: 'number', placeholder: '8' },
      { key: 'maxUrlsPerArt', label: markForTranslation('Max URLs per artifact'), type: 'number', placeholder: '4' },
      { key: 'maxSigsPerArt', label: markForTranslation('Max signatures per artifact'), type: 'number', placeholder: '4' },
      { key: 'maxNotesLen', label: markForTranslation('Max notes length'), type: 'number', placeholder: '2000' },
      { key: 'publishFeeUlmnLmn', label: markForTranslation('Publish fee (LMN, escrowed)'), type: 'text', placeholder: '1' },
      { key: 'maxPendingTtlSeconds', label: markForTranslation('Pending TTL (seconds)'), type: 'text', placeholder: '86400' },
      { key: 'rejectRefundBps', label: markForTranslation('Reject refund (bps)'), type: 'text', placeholder: '5000', hint: markForTranslation('10000 bps = 100%') },
      {
        key: 'requireValidationForStable',
        label: markForTranslation('Require validation for stable channel'),
        type: 'select',
        options: [
          { value: '', label: markForTranslation('(unchanged)') },
          { value: 'true', label: markForTranslation('Required') },
          { value: 'false', label: markForTranslation('Not required') }
        ]
      }
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
  }
];

export function findGovernanceActionTemplate(id: string): GovernanceActionTemplate | undefined {
  return GOVERNANCE_ACTION_TEMPLATES.find((t) => t.id === id);
}
