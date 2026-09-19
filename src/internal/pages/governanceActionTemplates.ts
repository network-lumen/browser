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
//   ("x/pqc params are immutable"), confirmed by governance.md's
//   immutable-surface list. What is governable there is four dedicated
//   messages: the two relayer-allowlist ones, MsgUpdateLinkCost and
//   MsgUpdatePowDifficulty.
//
// Chain v2.0.0 changed the shape of this list as much as its contents. Six
// prices that used to be reachable only by replacing a whole Params block now
// have a message of their own, and that is the point of them: MsgUpdateParams
// silently zeroes every field a proposal omits, so a dedicated message is the
// difference between changing one number and rewriting a module's economics by
// accident. Where both routes exist, the dedicated one is the template offered.
// Every remaining template's fields were checked against docs/governance.md's
// governable-surface list and/or gov_param_cases.json's test scenarios.
export const GOVERNANCE_ACTION_TEMPLATES: GovernanceActionTemplate[] = [
  // One entry for the whole module, because MsgUpdateParams replaces the entire
  // Params object rather than merging. Three separate DNS templates could be
  // added to one proposal, and the chain would apply them in order, each
  // wiping the one before it - so the last message was the only one that
  // counted.
  //
  // x/dns is the one module here with no dedicated fee message, which makes
  // this the template where omission is most expensive: a proposal naming one
  // field zeroes the tiers, the minimum price, the bid fee and the rate limit
  // along with it. The form prefills every field from the chain for exactly
  // that reason - a value left alone round-trips to itself.
  {
    id: 'dns-update-params',
    paramsPath: '/lumen/dns/v1/params',
    module: 'DNS',
    label: markForTranslation('Fees & guard rails'),
    summary: markForTranslation('Update domain fees, transfer and bid fees, and the guard rails on record updates. Leave a field blank to keep it unchanged.'),
    fields: [
      { key: 'updateFeeUlmn', source: { key: 'update_fee_ulmn', unit: 'lmn' }, label: markForTranslation('Update fee (LMN)'), type: 'text', placeholder: '0.01', hint: markForTranslation('Charged on every record update. It was documented as charged and read by nothing until v2.0.0, so it is live now where it was not.') },
      { key: 'transferFeeUlmn', source: { key: 'transfer_fee_ulmn', unit: 'lmn' }, label: markForTranslation('Transfer fee (LMN)'), type: 'text', placeholder: '0.05' },
      { key: 'bidFeeUlmn', source: { key: 'bid_fee_ulmn', unit: 'lmn' }, label: markForTranslation('Bid fee (LMN)'), type: 'text', placeholder: '0.01' },
      { key: 'updateRateLimitSeconds', source: { key: 'update_rate_limit_seconds' }, label: markForTranslation('Rate limit (seconds)'), type: 'number', placeholder: '60' },
      { key: 'updatePowDifficulty', source: { key: 'update_pow_difficulty' }, label: markForTranslation('PoW difficulty'), type: 'number', placeholder: '12', hint: markForTranslation('Bits of proof-of-work per record update, capped at 24. Above roughly 30 no owner ever finds a nonce.') },
      { key: 'graceDays', source: { key: 'grace_days' }, label: markForTranslation('Grace period (days)'), type: 'number', placeholder: '1', hint: markForTranslation('The only window in which an owner may renew. Capped at 365 days.') },
      { key: 'auctionDays', source: { key: 'auction_days' }, label: markForTranslation('Auction duration (days)'), type: 'number', placeholder: '1', hint: markForTranslation('Capped at 365 days.') },
      // The single global price lever. base_fee_dns, alpha, floor, ceiling and
      // t used to sit beside it as an adaptive fee controller; none of it was
      // ever built - nothing measured demand, and base_fee_dns was pinned at
      // 1.0 by an immutability check - so v2.0.0 removed all five from the
      // proto. A proposal naming them now sets nothing and says nothing.
      { key: 'minPriceUlmnPerMonthLmn', source: { key: 'min_price_ulmn_per_month', unit: 'lmn' }, label: markForTranslation('Minimum price per month (LMN)'), type: 'text', placeholder: '2', hint: markForTranslation('The whole price is this, times the months, times the domain tier, times the extension tier.') },
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
      { key: 'platformCommissionBps', source: { key: 'platform_commission_bps' }, label: markForTranslation('Commission (bps)'), type: 'text', placeholder: '500', hint: markForTranslation('100 bps = 1%. Taken from each claimed payment and paid into the community pool.') },
      // New in v2.0.0. The module used to read x/tokenomics' tx_tax_rate for
      // this and fall back to that module's default whenever the rate was zero
      // - so it followed a vote upward and ignored it downward, and zero could
      // not be expressed at all. It is its own policy now, and zero means zero.
      { key: 'serviceTaxBps', source: { key: 'service_tax_bps' }, label: markForTranslation('Service tax (bps)'), type: 'text', placeholder: '100', hint: markForTranslation('100 bps = 1%. Taken once when a contract is created.') },
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
    // Five of the tokenomics params are refused by the keeper as immutable -
    // denom, decimals, supply cap, halving interval and the initial block
    // reward - and six more got a dedicated message of their own in v2.0.0,
    // offered below. What is left is these three. Everything else rides along
    // unchanged from the fetched params, which is the only thing standing
    // between a one-field proposal and a zeroed parameter block.
    id: 'tokenomics-update-params',
    paramsPath: '/lumen/tokenomics/v1/params',
    module: markForTranslation('Tokenomics'),
    label: markForTranslation('Tax, minimum send & distribution'),
    summary: markForTranslation('Transaction tax, smallest transferable amount, and how often rewards are distributed. Leave a field blank to keep it unchanged.'),
    fields: [
      { key: 'txTaxRate', source: { key: 'tx_tax_rate' }, label: markForTranslation('Tax rate'), type: 'text', placeholder: '0.01', hint: markForTranslation('Decimal, e.g. 0.01 = 1%, taken out of every amount sent. Must stay below 1: at exactly 1 nothing is left to deliver and every transfer is refused.') },
      { key: 'minSendUlmn', source: { key: 'min_send_ulmn' }, label: markForTranslation('Minimum send (ulmn)'), type: 'text', placeholder: '1000', hint: markForTranslation('In micro-LMN, not LMN: this is the smallest amount the chain will move. 0 switches the floor off; the ceiling is 100 LMN.') },
      { key: 'distributionIntervalBlocks', source: { key: 'distribution_interval_blocks' }, label: markForTranslation('Distribution interval (blocks)'), type: 'text', placeholder: '1' }
    ]
  },
  {
    // The per-message prices, each behind its own message.
    //
    // They are charged in the ante, before the message runs, so a transaction
    // that fails still pays for the block space it took, and they are routed to
    // the community pool rather than to the fee collector - paying block
    // producers out of anti-spam revenue would give them a stake in the spam.
    id: 'tokenomics-transfer-fee',
    paramsPath: '/lumen/tokenomics/v1/params',
    module: markForTranslation('Tokenomics'),
    label: markForTranslation('Transfer fee'),
    summary: markForTranslation('The flat price of moving value: sending, multi-sending (per recipient) and IBC transfers.'),
    fields: [
      { key: 'transferFeeLmn', source: { key: 'transfer_fee_ulmn', unit: 'lmn' }, label: markForTranslation('Transfer fee (LMN)'), type: 'text', placeholder: '0.001', hint: markForTranslation('Charged on top of the amount, in LMN whatever the transfer moves. Capped at 10 LMN; 0 switches it off.') }
    ]
  },
  {
    id: 'tokenomics-staking-fees',
    paramsPath: '/lumen/tokenomics/v1/params',
    module: markForTranslation('Tokenomics'),
    label: markForTranslation('Staking fees'),
    summary: markForTranslation('The flat price of delegating and of redelegating. Both are set together.'),
    fields: [
      { key: 'delegateFeeLmn', source: { key: 'delegate_fee_ulmn', unit: 'lmn' }, label: markForTranslation('Delegate fee (LMN)'), type: 'text', placeholder: '0.001', hint: markForTranslation('A delegation is a permanent record per delegator and validator. Capped at 10 LMN; 0 switches it off.') },
      { key: 'redelegateFeeLmn', source: { key: 'redelegate_fee_ulmn', unit: 'lmn' }, label: markForTranslation('Redelegate fee (LMN)'), type: 'text', placeholder: '0.001', hint: markForTranslation('Kept separate from the delegate fee: delegation carries the volume, redelegation is rare.') }
    ]
  },
  {
    id: 'tokenomics-withdraw-addr-fee',
    paramsPath: '/lumen/tokenomics/v1/params',
    module: markForTranslation('Tokenomics'),
    label: markForTranslation('Withdraw address fee'),
    summary: markForTranslation('The price of pointing staking rewards at another address.'),
    fields: [
      { key: 'setWithdrawAddrFeeLmn', source: { key: 'set_withdraw_addr_fee_ulmn', unit: 'lmn' }, label: markForTranslation('Set withdraw address fee (LMN)'), type: 'text', placeholder: '0.001', hint: markForTranslation('The message writes a permanent entry nothing ever deletes, and a legitimate signer sends it about once. Capped at 10 LMN; 0 switches it off.') }
    ]
  },
  {
    id: 'tokenomics-min-voting-stake',
    paramsPath: '/lumen/tokenomics/v1/params',
    module: markForTranslation('Tokenomics'),
    label: markForTranslation('Minimum voting stake'),
    summary: markForTranslation('How much an account must have delegated before its vote is accepted.'),
    fields: [
      { key: 'minVotingStakeLmn', source: { key: 'min_voting_stake_ulmn', unit: 'lmn' }, label: markForTranslation('Minimum voting stake (LMN)'), type: 'text', placeholder: '5', hint: markForTranslation('Delegated, not spent, so a voter loses nothing. 0 restores the old rule, where a single micro-LMN of delegation was enough. Capped at 1000 LMN.') }
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
    // All three deposit figures, through MsgUpdateGovDepositPolicy.
    //
    // It replaces MsgUpdateGovMinDeposit, which set the ordinary deposit alone
    // and therefore could not raise it past the expedited figure - nothing
    // reachable set that one, so the ceiling was permanent. The three move
    // together here because two invariants bind them: the expedited deposit
    // must stay strictly greater than the ordinary one, and what a proposal
    // costs to *submit* is the ratio times the ordinary deposit, so raising the
    // deposit while the ratio is zero prices nothing.
    //
    // It still goes through x/tokenomics rather than cosmos.gov.v1, for the
    // reason the builder in electron/ipc/wallet.cjs spells out: gov requires
    // every proposal message to be signed by the gov account, and gov's own
    // params handler requires an authority that is not the gov account, so the
    // two conditions exclude each other. Tried on the devnet as proposal #7.
    id: 'tokenomics-gov-deposit-policy',
    // x/gov's own params, not tokenomics': the message goes through tokenomics
    // because gov's authority is unreachable, but the values it replaces are
    // gov's and are read from there.
    paramsPath: '/cosmos/gov/v1/params/deposit',
    module: markForTranslation('Tokenomics'),
    label: markForTranslation('Governance deposit policy'),
    summary: markForTranslation('What a proposal costs: the deposit it must gather to enter voting, the expedited figure, and how much of it must arrive up front.'),
    fields: [
      {
        key: 'minDepositLmn',
        source: { key: 'min_deposit', unit: 'coins' },
        label: markForTranslation('Minimum deposit (LMN)'),
        type: 'text',
        placeholder: '100',
        hint: markForTranslation('The total a proposal must gather within the deposit period to enter voting.')
      },
      {
        key: 'expeditedMinDepositLmn',
        source: { key: 'expedited_min_deposit', unit: 'coins' },
        label: markForTranslation('Expedited minimum deposit (LMN)'),
        type: 'text',
        placeholder: '500',
        hint: markForTranslation('Must be strictly greater than the minimum deposit.')
      },
      {
        key: 'minInitialDepositRatio',
        source: { key: 'min_initial_deposit_ratio', unit: 'dec' },
        label: markForTranslation('Initial deposit ratio'),
        type: 'text',
        placeholder: '1.0',
        hint: markForTranslation('Decimal from 0 to 1. The share of the minimum deposit that must arrive with the proposal itself. At 0 a proposal can be opened for a refundable bond and sit out the deposit period for free; at 1 it arrives funded or is refused.')
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
    // New in v2.0.0, and the first release in which this penalty does anything.
    // The genesis declared 5% for equivocation and nothing read it: x/evidence
    // was not wired, so a validator could sign two blocks at one height and
    // keep both its stake and its seat. The module is wired now, and
    // x/slashing's own MsgUpdateParams sits behind an unreachable authority, so
    // this is the only route by which the figure can ever move.
    id: 'tokenomics-slashing-double-sign',
    paramsPath: '/cosmos/slashing/v1beta1/params',
    module: markForTranslation('Slashing'),
    label: markForTranslation('Equivocation penalty'),
    summary: markForTranslation('The share of a stake slashed for signing two blocks at the same height. The penalty is permanent: the validator is jailed and tombstoned.'),
    fields: [
      { key: 'slashFractionDoubleSign', source: { key: 'slash_fraction_double_sign', unit: 'dec' }, label: markForTranslation('Slash fraction'), type: 'text', placeholder: '0.05', hint: markForTranslation('Decimal, e.g. 0.05 = 5%. Bounded to between 0.01 and 0.50 - zero is refused, because it would switch equivocation slashing off without saying so.') }
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
    // The cost of a post-quantum identity, both halves of it.
    //
    // They are restated together because they share a denomination invariant:
    // min_balance_for_link is the solvency threshold the account must clear and
    // link_fee_ulmn is what is actually taken from it.
    id: 'pqc-link-cost',
    paramsPath: '/lumen/pqc/v1/params',
    module: 'PQC',
    label: markForTranslation('Linking cost'),
    summary: markForTranslation('What it costs an account to link its Dilithium key, which every account must do before it can transact.'),
    fields: [
      { key: 'minBalanceForLinkLmn', source: { key: 'min_balance_for_link', unit: 'coin' }, label: markForTranslation('Minimum balance to link (LMN)'), type: 'text', placeholder: '0.1', hint: markForTranslation('A balance the account must hold, not spend.') },
      { key: 'linkFeeLmn', source: { key: 'link_fee_ulmn', unit: 'lmn' }, label: markForTranslation('Link fee (LMN)'), type: 'text', placeholder: '0.001', hint: markForTranslation('Actually taken, and paid into the community pool. While the proof-of-work is at 0 this is the whole cost of an identity.') }
    ]
  },
  {
    // Set to 0 by the v2.0.0 upgrade handler, deliberately: that release
    // changed the link digest to commit to the account address, and nonces
    // mined under the old formula had to keep working until wallets shipped
    // the new one. This browser ships it, so raising it again is a vote away.
    id: 'pqc-pow-difficulty',
    paramsPath: '/lumen/pqc/v1/params',
    module: 'PQC',
    label: markForTranslation('Linking proof-of-work'),
    summary: markForTranslation('How much work an account must do before the network accepts its Dilithium key.'),
    fields: [
      { key: 'powDifficultyBits', source: { key: 'pow_difficulty_bits' }, label: markForTranslation('Difficulty (bits)'), type: 'number', placeholder: '21', hint: markForTranslation('Each bit doubles the work. Capped at 40; 0 switches the proof off.') }
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
      { key: 'maxNotesLen', source: { key: 'max_notes_len' }, label: markForTranslation('Max notes length'), type: 'number', placeholder: '512', hint: markForTranslation('Capped at 8192, the hard bound release notes are checked against before this parameter is ever read.') },
      { key: 'publishFeeUlmnLmn', source: { key: 'publish_fee_ulmn', unit: 'lmn' }, label: markForTranslation('Publish fee (LMN, escrowed)'), type: 'text', placeholder: '1' },
      // reject_refund_bps, dao_publishers and require_validation_for_stable
      // used to sit here. v2.0.0 removed all three from the proto: none was
      // ever read, so a vote on any of them changed nothing, silently - and the
      // two that could have been implemented would each have made the chain
      // worse, since validation is unconditional today and the rollout that
      // dao_publishers guarded is refused whatever it says.
      { key: 'maxPendingTtlSeconds', source: { key: 'max_pending_ttl' }, label: markForTranslation('Pending TTL (seconds)'), type: 'text', placeholder: '86400' }
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
