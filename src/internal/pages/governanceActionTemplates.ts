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
  {
    id: 'dns-update-fee',
    module: 'DNS',
    label: 'Update record fee',
    summary: 'Change the flat fee (in LMN) charged on every domain record update.',
    fields: [
      { key: 'updateFeeUlmn', label: 'Update fee (LMN)', type: 'text', placeholder: '0.01' }
    ]
  },
  {
    id: 'dns-update-guards',
    module: 'DNS',
    label: 'Guard rails',
    summary: 'Rate limit and proof-of-work difficulty applied to domain record updates.',
    fields: [
      { key: 'updateRateLimitSeconds', label: 'Rate limit (seconds)', type: 'number', placeholder: '60' },
      { key: 'updatePowDifficulty', label: 'PoW difficulty', type: 'number', placeholder: '18' }
    ]
  },
  {
    id: 'dns-update-transfer-bid-fee',
    module: 'DNS',
    label: 'Transfer & bid fees',
    summary: 'Fees (in LMN) charged on domain transfers and auction bids.',
    fields: [
      { key: 'transferFeeUlmn', label: 'Transfer fee (LMN)', type: 'text', placeholder: '0.05' },
      { key: 'bidFeeUlmn', label: 'Bid fee (LMN)', type: 'text', placeholder: '0.01' }
    ]
  },
  {
    id: 'gateways-update-params',
    module: 'Gateways',
    label: 'Commission, pricing & timing',
    summary: 'Update gateway contract commission, minimum price, action fee, and finalize delay. Leave a field blank to keep it unchanged.',
    fields: [
      { key: 'platformCommissionBps', label: 'Commission (bps)', type: 'text', placeholder: '500', hint: '100 bps = 1%' },
      { key: 'minPriceUlmnPerMonthLmn', label: 'Min contract price / month (LMN)', type: 'text', placeholder: '1' },
      { key: 'actionFeeUlmnLmn', label: 'Action fee (LMN)', type: 'text', placeholder: '0.01' },
      { key: 'registerGatewayFeeUlmnLmn', label: 'Register gateway fee (LMN)', type: 'text', placeholder: '1' },
      { key: 'finalizeDelayMonths', label: 'Finalize delay (months)', type: 'text', placeholder: '1' },
      { key: 'maxActiveContractsPerGateway', label: 'Max active contracts / gateway', type: 'text', placeholder: '100' }
    ]
  },
  {
    id: 'tokenomics-tax-rate',
    module: 'Tokenomics',
    label: 'Transaction tax rate',
    summary: 'Tax rate applied to transactions, as a decimal (e.g. 0.01 = 1%).',
    fields: [
      { key: 'txTaxRate', label: 'Tax rate', type: 'text', placeholder: '0.01' }
    ]
  },
  {
    id: 'tokenomics-community-pool-spend',
    module: 'Tokenomics',
    label: 'Community pool spend',
    summary: 'Send funds from the community pool to a recipient address.',
    fields: [
      { key: 'recipient', label: 'Recipient address', type: 'text', placeholder: 'lmn1...' },
      { key: 'amountLmn', label: 'Amount (LMN)', type: 'text', placeholder: '1000' }
    ]
  },
  {
    id: 'tokenomics-gov-min-deposit',
    module: 'Tokenomics',
    label: 'Governance minimum deposit',
    summary: 'Minimum deposit (in LMN) required for a proposal to enter voting.',
    fields: [
      { key: 'minDepositLmn', label: 'Minimum deposit (LMN)', type: 'text', placeholder: '10' }
    ]
  },
  {
    id: 'tokenomics-slashing-downtime',
    module: 'Slashing',
    label: 'Downtime penalties',
    summary: 'Slash fraction and jail duration applied for validator downtime.',
    fields: [
      { key: 'slashFractionDowntime', label: 'Slash fraction', type: 'text', placeholder: '0.01' },
      { key: 'downtimeJailDuration', label: 'Jail duration', type: 'text', placeholder: '600s', hint: 'Go duration string, e.g. 600s or 1h' }
    ]
  },
  {
    id: 'tokenomics-slashing-liveness',
    module: 'Slashing',
    label: 'Liveness window',
    summary: 'Signed-blocks window and minimum signed ratio for validator liveness.',
    fields: [
      { key: 'signedBlocksWindow', label: 'Signed blocks window', type: 'number', placeholder: '10000' },
      { key: 'minSignedPerWindow', label: 'Min signed ratio', type: 'text', placeholder: '0.95' }
    ]
  },
  {
    id: 'pqc-add-ibc-relayer',
    module: 'PQC',
    label: 'Add IBC relayer',
    summary: 'Add an address to the PQC IBC relayer allowlist.',
    fields: [
      { key: 'relayer', label: 'Relayer address', type: 'text', placeholder: 'lmn1...' }
    ]
  },
  {
    id: 'pqc-remove-ibc-relayer',
    module: 'PQC',
    label: 'Remove IBC relayer',
    summary: 'Remove an address from the PQC IBC relayer allowlist.',
    fields: [
      { key: 'relayer', label: 'Relayer address', type: 'text', placeholder: 'lmn1...' }
    ]
  },
  {
    id: 'release-validate',
    module: 'Release',
    label: 'Validate release',
    summary: 'Mark a pending release as validated.',
    fields: [
      { key: 'releaseId', label: 'Release ID', type: 'number', placeholder: '1' }
    ]
  },
  {
    id: 'release-reject',
    module: 'Release',
    label: 'Reject release',
    summary: 'Reject a pending release.',
    fields: [
      { key: 'releaseId', label: 'Release ID', type: 'number', placeholder: '1' }
    ]
  },
  {
    id: 'release-update-params',
    module: 'Release',
    label: 'Publishers, channels, fees & limits',
    summary: 'Update allowed publishers/channels, anti-spam fees, and per-release artifact limits. Leave a field blank to keep it unchanged.',
    fields: [
      { key: 'allowedPublishers', label: 'Allowed publishers', type: 'textarea', placeholder: 'lmn1...\nlmn1...', hint: 'One bech32 address per line' },
      { key: 'channels', label: 'Channels', type: 'textarea', placeholder: 'stable\nbeta\nnightly', hint: 'One channel per line' },
      { key: 'maxArtifacts', label: 'Max artifacts', type: 'number', placeholder: '8' },
      { key: 'maxUrlsPerArt', label: 'Max URLs per artifact', type: 'number', placeholder: '4' },
      { key: 'maxSigsPerArt', label: 'Max signatures per artifact', type: 'number', placeholder: '4' },
      { key: 'maxNotesLen', label: 'Max notes length', type: 'number', placeholder: '2000' },
      { key: 'publishFeeUlmnLmn', label: 'Publish fee (LMN, escrowed)', type: 'text', placeholder: '1' },
      { key: 'maxPendingTtlSeconds', label: 'Pending TTL (seconds)', type: 'text', placeholder: '86400' },
      { key: 'rejectRefundBps', label: 'Reject refund (bps)', type: 'text', placeholder: '5000', hint: '10000 bps = 100%' },
      {
        key: 'requireValidationForStable',
        label: 'Require validation for stable channel',
        type: 'select',
        options: [
          { value: '', label: '(unchanged)' },
          { value: 'true', label: 'Required' },
          { value: 'false', label: 'Not required' }
        ]
      }
    ]
  },
  {
    id: 'upgrade-software',
    module: 'Chain',
    label: 'Software upgrade',
    summary: 'Schedule a coordinated chain upgrade at a target block height.',
    fields: [
      { key: 'name', label: 'Upgrade name', type: 'text', placeholder: 'v2' },
      { key: 'height', label: 'Target height', type: 'number', placeholder: '1000000' },
      { key: 'info', label: 'Info (optional)', type: 'textarea', placeholder: 'Upgrade handler metadata / binary URLs...' }
    ]
  }
];

export function findGovernanceActionTemplate(id: string): GovernanceActionTemplate | undefined {
  return GOVERNANCE_ACTION_TEMPLATES.find((t) => t.id === id);
}
