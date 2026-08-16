<template>
  <div class="flex flex-column gap-24px w-full max-w-full">
    <!-- What this panel can and cannot promise. Not dismissible: it is about
         the money, not about the feature being new. -->
    <UiBanner variant="warning">
      <div class="flex-align-center gap-8px">
        <TriangleAlert :size="16" class="flex-shrink-0 color-warning" />
        <span class="line-height-15">
          {{ t('This section is under development. It exposes the public chain registry and applies standard Cosmos calls to it, so a chain that departs from the standard may not behave correctly. Try a small amount before moving a main wallet, and report anything broken so it can be fixed.') }}
          <button
            type="button"
            class="bg-transparent border-none cursor-pointer color-accent-secondary p-0px text-14px"
            @click="openExternal('https://github.com/network-lumen/browser/issues')"
          >
            {{ t('Open an issue') }}
          </button>
        </span>
      </div>
    </UiBanner>

    <!-- Migration prompt. Dismissible, never blocking: everything below works
         without a key, so there is nothing to gate behind a choice. -->
    <UiBanner v-if="showMigrationNotice" variant="info">
      <div class="flex flex-column gap-8px">
        <span class="color-text-primary txt-weight-medium">{{ t('Coming from another Cosmos wallet?') }}</span>
        <span class="color-text-secondary line-height-15">
          {{ t('Your Lumen account already works on every chain listed here: Cosmos wallets share one derivation path, so the recovery phrase you already have covers all of them. Import an existing phrase only if you want to use a different account.') }}
        </span>
        <div class="flex-align-center gap-12px mt-8px flex-wrap-wrap">
          <UiButton variant="primary" @click="emit('import-profile')">
            <Download :size="16" />
            <span>{{ t('Import a recovery phrase') }}</span>
          </UiButton>
          <UiButton variant="ghost" @click="dismissMigrationNotice">
            <span>{{ t('Dismiss') }}</span>
          </UiButton>
        </div>
      </div>
    </UiBanner>

    <UiLoadingState v-if="loading" :message="t('Loading chains…')" />

    <div v-else-if="error" class="flex flex-column gap-16px">
      <UiErrorState :message="error" wrapper-class="gap-16px min-h-160px" />
      <div class="flex-align-justify-center">
        <UiButton variant="primary" @click="reload({ force: true })">
          <RefreshCw :size="16" />
          <span>{{ t('Try again') }}</span>
        </UiButton>
      </div>
    </div>

    <template v-else>
      <!-- Followed chains lead, above the search box, and are deliberately
           outside it: this section is neither filtered by the query nor
           reordered by the directory's sort. It stays in the order they were
           followed, so a watchlist does not rearrange itself under the user. -->
      <section v-if="followedChains.length" class="flex flex-column gap-12px">
        <div class="flex-align-center flex-justify-space-between gap-16px">
          <span class="text-13px txt-weight-medium color-text-primary">
            {{ t('Following ({count})', { count: followedChains.length }) }}
          </span>
          <UiButton variant="ghost" :disabled="followedLoading" @click="refreshFollowedBalances">
            <RefreshCw :size="14" />
            <span>{{ followedLoading ? t('Reading balances…') : t('Refresh balances') }}</span>
          </UiButton>
        </div>

        <div class="grid-cols-auto-fill-340 gap-16px grid">
          <div
            v-for="chain in followedChains"
            :key="`followed-${chain.name}`"
            role="button"
            tabindex="0"
            class="border-radius-12px p-20px bg-card border-1 border-color-primary-a30 flex flex-column gap-12px transition-all-fast cursor-pointer hover-bg-hover"
            @click="openChain(chain)"
            @keydown.enter="openChain(chain)"
            @keydown.space.prevent="openChain(chain)"
          >
            <div class="flex-align-center gap-12px">
              <ChainMark :chain="chain" />
              <div class="flex flex-column gap-4px min-w-0 flex-1">
                <span class="color-text-primary txt-weight-medium text-15px truncate">{{ chain.prettyName }}</span>
                <span class="text-12px color-text-tertiary truncate">{{ chain.chainId }}</span>
              </div>
              <button
                v-if="!isPinnedChain(chain.name)"
                type="button"
                class="bg-transparent border-none cursor-pointer color-accent-secondary flex-shrink-0 p-4px"
                :title="t('Unfollow')"
                @click.stop="toggleFollow(chain)"
              >
                <Star :size="18" />
              </button>
            </div>

            <div class="flex flex-column gap-2px">
              <div class="flex-align-center flex-justify-space-between gap-8px">
                <span class="text-14px color-text-primary">{{ followedBalanceLabel(chain) }}</span>
                <div class="flex-align-center gap-6px flex-shrink-0">
                  <span v-if="followedBalanceUsd(chain)" class="text-13px color-text-secondary">
                    {{ followedBalanceUsd(chain) }}
                  </span>
                  <!-- Beside the spendable figure, which is what it draws on. -->
                  <button
                    v-if="canStakeFollowed(chain)"
                    type="button"
                    class="bg-transparent border-none cursor-pointer color-accent-secondary p-4px border-radius-6px transition-all-fast hover-bg-hover"
                    :title="t('Stake')"
                    @click.stop="openStakeFromCard(chain)"
                  >
                    <Plus :size="14" />
                  </button>
                </div>
              </div>
              <div
                v-for="line in followedStakingLines(chain)"
                :key="line.key"
                class="flex-align-center flex-justify-space-between gap-8px text-12px"
              >
                <span class="color-text-tertiary">{{ line.label }}</span>
                <div class="flex-align-center gap-6px flex-shrink-0">
                  <span class="color-text-secondary">{{ line.value }}</span>
                  <button
                    v-if="line.key === 'rewards' && canClaimFollowed(chain)"
                    type="button"
                    class="bg-transparent border-none cursor-pointer color-accent-secondary p-4px border-radius-6px transition-all-fast hover-bg-hover disabled-fade-50"
                    :disabled="Boolean(claimingChain)"
                    :title="t('Claim rewards')"
                    @click.stop="claimRewards(chain, followedBalances[chain.name])"
                  >
                    <UiSpinner v-if="claimingChain === chain.name" size="sm" />
                    <HandCoins v-else :size="14" />
                  </button>
                </div>
              </div>
              <div
                v-if="followedOtherAssetCount(chain)"
                class="flex-align-center flex-justify-space-between gap-8px text-12px"
              >
                <span class="color-text-tertiary">{{ t('Other assets') }}</span>
                <span class="color-text-secondary flex-shrink-0">{{ followedOtherAssetCount(chain) }}</span>
              </div>
              <span v-if="unitPriceLabel(chain)" class="text-12px color-text-tertiary">
                {{ unitPriceLabel(chain) }}
              </span>
            </div>

            <!-- The address the card's Receive and Send act on, so it belongs
                 on the card. Truncated to read at a glance; the copy button
                 puts the whole thing on the clipboard, never the ellipsis. -->
            <div v-if="addressFor(chain)" class="flex-align-center gap-6px">
              <span class="mono text-12px color-text-tertiary truncate">{{ shortAddress(chain) }}</span>
              <button
                type="button"
                class="bg-transparent border-none cursor-pointer color-text-tertiary flex-shrink-0 p-4px border-radius-6px transition-all-fast hover-bg-hover"
                :title="t('Copy address')"
                @click.stop="copyAddress(chain)"
              >
                <Copy :size="14" />
              </button>
            </div>

            <!-- Pushed to the bottom so the row lines up across cards of
                 different heights: a chain with staking lines is taller than
                 one without, and mid-card buttons made the grid look ragged. -->
            <div class="flex-align-center gap-8px mt-auto">
              <UiButton
                class="flex-1"
                variant="secondary"
                :disabled="!addressFor(chain)"
                @click.stop="openReceive(chain)"
              >
                <ArrowDownLeft :size="14" />
                <span>{{ t('Receive') }}</span>
              </UiButton>
              <UiButton
                class="flex-1"
                variant="secondary"
                :disabled="!canSendOn(chain)"
                :title="sendDisabledReason(chain)"
                @click.stop="requestSend(chain)"
              >
                <Send :size="14" />
                <span>{{ t('Send') }}</span>
              </UiButton>
              <UiButton
                variant="secondary"
                :disabled="!canIbcFrom(chain)"
                :title="ibcButtonTitle(chain)"
                @click.stop="requestSend(chain, 'ibc')"
              >
                <Waypoints :size="14" />
              </UiButton>
            </div>
          </div>
        </div>
      </section>

      <div class="flex-align-center flex-justify-space-between gap-16px flex-wrap-wrap">
        <UiInput
          v-model="query"
          class="flex-1 min-w-240px"
          :placeholder="t('Search by name, chain id or symbol')"
        />
        <div class="flex-align-center gap-12px">
          <span class="text-12px color-text-tertiary">{{ freshnessLabel }}</span>
          <UiButton variant="ghost" :disabled="refreshing" @click="reload({ force: true })">
            <RefreshCw :size="16" />
            <span>{{ refreshing ? t('Refreshing…') : t('Refresh') }}</span>
          </UiButton>
        </div>
      </div>

      <UiEmptyState
        v-if="!visibleChains.length"
        class="mt-32px"
        :title="t('No chains match')"
        :description="t('Try a different name, chain id or symbol.')"
      >
        <Boxes :size="32" />
      </UiEmptyState>

      <div v-else class="grid-cols-auto-fill-300 gap-16px grid">
        <div
          v-for="chain in visibleChains"
          :key="chain.name"
          role="button"
          tabindex="0"
          class="border-radius-12px p-20px bg-card border-1 transition-all-fast cursor-pointer hover-bg-hover"
          :class="{ 'opacity-55': isChainDimmed(chain) }"
          @click="openChain(chain)"
          @keydown.enter="openChain(chain)"
          @keydown.space.prevent="openChain(chain)"
        >
          <div class="flex-align-center gap-12px mb-12px">
            <ChainMark :chain="chain" />
            <div class="flex flex-column gap-4px min-w-0 flex-1">
              <span class="color-text-primary txt-weight-medium text-15px truncate">{{ chain.prettyName }}</span>
              <span class="text-12px color-text-tertiary truncate">{{ chain.chainId }}</span>
            </div>
            <button
              v-if="!isPinnedChain(chain.name)"
              type="button"
              class="bg-transparent border-none cursor-pointer flex-shrink-0 p-4px"
              :class="isFollowed(chain) ? 'color-accent-secondary' : 'color-text-tertiary'"
              :title="isFollowed(chain) ? t('Unfollow') : t('Follow')"
              @click.stop="toggleFollow(chain)"
            >
              <Star :size="18" />
            </button>
          </div>
          <div class="flex-align-center gap-8px flex-wrap-wrap text-12px color-text-tertiary">
            <!-- The equation carries the symbol, so a separate chip for it
                 would just repeat the ticker back. -->
            <span v-if="unitPriceLabel(chain)" class="color-text-secondary">{{ unitPriceLabel(chain) }}</span>
            <span v-else-if="chain.symbol">{{ chain.symbol }}</span>
            <span v-if="chain.prefix">{{ chain.prefix }}1…</span>
            <span v-if="chain.name === 'lumen'" class="color-accent-secondary">{{ t('Home chain') }}</span>
            <span v-if="!isChainUsable(chain)" class="color-warning">{{ t('No endpoint') }}</span>
          </div>
        </div>
      </div>
    </template>

    <!--
      Chain detail, in four bands of decreasing weight.

      1. Identity - who this is, with the one action that changes state here.
      2. The holding - what the user came to see, and what they can do with it.
      3. Vitals - a compact grid; these values are short and do not earn a row each.
      4. Reference - sources, IBC peers, raw identifiers, behind one tab at a time.

      The earlier version stacked all of it as equal-weight label/value rows,
      which is a data dump rather than a hierarchy: the balance read the same
      as the network type.
    -->
    <UiModal v-if="selected" :model-value="true" panel-class="w-full max-w-760px" @update:model-value="closeChain">
      <template #header>
        <div class="flex-align-center gap-16px min-w-0 flex-1">
          <ChainMark :chain="selected" />
          <div class="flex flex-column gap-4px min-w-0 flex-1">
            <span class="color-text-primary txt-weight-medium text-18px truncate">{{ selected.prettyName }}</span>
            <div class="flex-align-center gap-8px flex-wrap-wrap text-12px color-text-tertiary">
              <span class="truncate">{{ selected.chainId }}</span>
              <span v-if="unitPriceLabel(selected)" class="color-text-secondary">{{ unitPriceLabel(selected) }}</span>
              <span v-if="selected.apr !== null">{{ t('APR {value}', { value: formatPercent(selected.apr) }) }}</span>
            </div>
          </div>
          <button
            type="button"
            v-if="!isPinnedChain(selected.name)"
            class="bg-transparent border-none cursor-pointer flex-shrink-0 p-8px border-radius-8px hover-bg-hover"
            :class="isFollowed(selected) ? 'color-accent-secondary' : 'color-text-tertiary'"
            :title="isFollowed(selected) ? t('Unfollow') : t('Follow')"
            @click="toggleFollow(selected)"
          >
            <Star :size="20" />
          </button>
        </div>
      </template>

      <div class="flex flex-column gap-20px">
        <!-- 2. The holding. -->
        <div class="flex flex-column gap-16px border-radius-12px p-20px bg-secondary border-1">
          <div v-if="!derivedAddress" class="text-14px color-text-tertiary">
            {{ address
              ? t('This chain does not declare an address prefix, so your address cannot be derived for it.')
              : t('Connect a wallet to see your address and balance on this chain.') }}
          </div>

          <template v-else>
            <div class="flex flex-column gap-4px">
              <span class="text-12px color-text-tertiary text-uppercase">{{ t('Your balance') }}</span>

              <UiLoadingState v-if="balance.status === 'loading'" :message="t('Reading balance…')" wrapper-class="min-h-48px" />

              <template v-else-if="balance.status === 'error'">
                <span class="text-14px color-error">{{ balance.error }}</span>
                <button type="button" class="bg-transparent border-none cursor-pointer color-accent-secondary text-13px p-0px text-left" @click="loadBalance">
                  {{ t('Try again') }}
                </button>
              </template>

              <template v-else>
                <span class="bg-gradient-accent-text gradient-text-clip txt-weight-medium color-text-primary text-32px line-height-1">
                  {{ nativeBalanceLabel }}
                </span>
                <span v-if="nativeBalanceUsd" class="text-13px color-text-tertiary">{{ nativeBalanceUsd }}</span>
              </template>
            </div>

            <!-- Everything that acts on the balance, on one line and directly
                 under it: what the user came to do, before the detail of what
                 is already committed. The address sits with them because it is
                 what they all operate on. -->
            <div class="flex-align-center gap-8px flex-wrap-wrap">
              <UiButton variant="primary" @click="openReceive(selected)">
                <ArrowDownLeft :size="16" />
                <span>{{ t('Receive') }}</span>
              </UiButton>
              <UiButton
                variant="secondary"
                :disabled="!canSendOn(selected)"
                :title="sendDisabledReason(selected)"
                @click="requestSend(selected)"
              >
                <Send :size="16" />
                <span>{{ t('Send') }}</span>
              </UiButton>
              <UiButton
                variant="secondary"
                :disabled="!canIbcFrom(selected)"
                :title="ibcButtonTitle(selected)"
                @click="requestSend(selected, 'ibc')"
              >
                <Waypoints :size="16" />
                <span>{{ t('To other chain (IBC)') }}</span>
              </UiButton>
              <!-- The only way in for an account that stakes nothing yet: the
                   +/- live on the Staked line, and that line does not exist
                   until there is something staked. -->
              <UiButton v-if="canStake" variant="secondary" @click="openStakeDialog('delegate')">
                <Plus :size="16" />
                <span>{{ t('Stake') }}</span>
              </UiButton>
              <!-- Last, so the four buttons stay together on one line and the
                   address takes whatever width is left rather than pushing a
                   button onto its own row. -->
              <UiCopyField
                :value="derivedAddress"
                :title="t('Copy address')"
                wrapper-class="gap-8px flex-1 min-w-160px"
                code-class="bg-card color-text-primary py-8px px-12px border-1 border-radius-6px mono text-12px truncate flex-1 min-w-0"
              />
            </div>

            <!-- Locked, and therefore not part of the number above. -->
            <div v-if="selectedStakingLines.length" class="flex flex-column gap-6px">
              <div
                v-for="line in selectedStakingLines"
                :key="line.key"
                class="flex-align-center flex-justify-space-between gap-16px text-13px"
              >
                <span class="color-text-tertiary">{{ line.label }}</span>
                <div class="flex-align-center gap-8px">
                  <span class="color-text-primary txt-weight-medium">{{ line.value }}</span>
                  <template v-if="line.key === 'staked' && canStake">
                    <button
                      type="button"
                      class="bg-transparent border-none cursor-pointer color-accent-secondary p-4px border-radius-6px transition-all-fast hover-bg-hover"
                      :title="t('Stake more')"
                      @click="openStakeDialog('delegate')"
                    >
                      <Plus :size="16" />
                    </button>
                    <button
                      type="button"
                      class="bg-transparent border-none cursor-pointer color-accent-secondary p-4px border-radius-6px transition-all-fast hover-bg-hover"
                      :title="t('Unstake')"
                      @click="openStakeDialog('undelegate', firstDelegation)"
                    >
                      <Minus :size="16" />
                    </button>
                  </template>
                  <!-- Claiming needs no amount and no destination, and moves
                       money in rather than out, so it earns an icon rather
                       than a dialog. -->
                  <button
                    v-if="line.key === 'rewards' && canClaim"
                    type="button"
                    class="bg-transparent border-none cursor-pointer color-accent-secondary p-4px border-radius-6px transition-all-fast hover-bg-hover disabled-fade-50"
                    :disabled="Boolean(claimingChain)"
                    :title="t('Claim rewards')"
                    @click="claimRewards(selected, balance)"
                  >
                    <UiSpinner v-if="claimingChain === selected.name" size="sm" />
                    <HandCoins v-else :size="16" />
                  </button>
                </div>
              </div>

              <!-- Where the stake actually sits, so a single delegation can be
                   moved or withdrawn rather than only the total being visible. -->
              <div
                v-for="row in delegationRows"
                :key="row.validator"
                class="flex-align-center flex-justify-space-between gap-16px text-12px pl-12px"
              >
                <span class="color-text-tertiary truncate">{{ row.name }}</span>
                <div class="flex-align-center gap-6px flex-shrink-0">
                  <!-- Said before the signature rather than after the refusal:
                       the chain only rejects this at broadcast. -->
                  <span v-if="row.lockLabel" class="color-warning flex-align-center" :title="row.lockLabel">
                    <TriangleAlert :size="14" />
                  </span>
                  <span class="color-text-secondary">{{ row.amount }}</span>
                  <button
                    type="button"
                    class="bg-transparent border-none cursor-pointer p-4px border-radius-6px transition-all-fast hover-bg-hover disabled-fade-50"
                    :class="row.lockLabel ? 'color-text-tertiary' : 'color-accent-secondary'"
                    :disabled="Boolean(row.lockLabel)"
                    :title="row.lockLabel || t('Move to another validator')"
                    @click="openStakeDialog('redelegate', row.validator)"
                  >
                    <ArrowLeftRight :size="14" />
                  </button>
                  <button
                    type="button"
                    class="bg-transparent border-none cursor-pointer color-accent-secondary p-4px border-radius-6px transition-all-fast hover-bg-hover"
                    :title="t('Unstake')"
                    @click="openStakeDialog('undelegate', row.validator)"
                  >
                    <Minus :size="14" />
                  </button>
                </div>
              </div>

              <!-- The total above says how much; these say when. Two at a time,
                   because undelegations run in parallel and an account can hold
                   a dozen without any one of them being interesting. -->
              <template v-if="selectedUnbondingRows.length">
                <div
                  v-for="row in visibleUnbondingRows"
                  :key="row.key"
                  class="flex-align-center flex-justify-space-between gap-16px text-12px pl-12px"
                >
                  <span class="color-text-tertiary">{{ row.when }}</span>
                  <span class="color-text-secondary">{{ row.value }}</span>
                </div>
                <button
                  v-if="selectedUnbondingRows.length > 2"
                  type="button"
                  class="flex-align-center gap-6px bg-transparent border-none cursor-pointer color-accent-secondary text-12px p-0px pl-12px text-left"
                  @click="unbondingExpanded = !unbondingExpanded"
                >
                  <component :is="unbondingExpanded ? ChevronUp : ChevronDown" :size="14" />
                  <span>
                    {{ unbondingExpanded
                      ? t('Show less')
                      : t('{count} more', { count: selectedUnbondingRows.length - 2 }) }}
                  </span>
                </button>
              </template>
            </div>


            <!-- Anything on this chain that is not its own token: tokens that
                 arrived over IBC, and any denom the chain mints besides the
                 staking one. Their amounts are shown raw, in base units: the
                 exponent belongs to the asset, and only the native one's is
                 known here. -->
            <div v-if="otherBalances.length" class="flex flex-column gap-8px">
              <span class="text-12px color-text-tertiary text-uppercase">
                {{ t('Other tokens on this chain ({count})', { count: otherBalances.length }) }}
              </span>
              <div
                v-for="entry in otherBalances"
                :key="entry.denom"
                class="flex-align-center flex-justify-space-between gap-16px text-13px"
              >
                <div class="flex-align-center gap-8px min-w-0" :title="entry.denom">
                  <img
                    v-if="resolvedDenoms[entry.denom]?.image"
                    :src="resolvedDenoms[entry.denom].image"
                    :alt="resolvedDenoms[entry.denom].symbol"
                    class="size-24px border-radius-circle flex-shrink-0 object-fit-contain bg-card"
                  />
                  <div class="flex flex-column gap-2px min-w-0">
                    <span
                      class="truncate"
                      :class="resolvedDenoms[entry.denom] ? 'color-text-primary' : 'color-text-tertiary mono'"
                    >
                      {{ resolvedDenoms[entry.denom]?.symbol || denomLabel(entry.denom) }}
                    </span>
                    <span v-if="resolvedDenoms[entry.denom]?.sourceChain" class="text-12px color-text-tertiary">
                      {{ t('from {chain}', { chain: resolvedDenoms[entry.denom].sourceChain }) }}
                    </span>
                  </div>
                </div>
                <div class="flex-align-center gap-8px flex-shrink-0">
                  <span class="color-text-primary">{{ otherBalanceAmount(entry) }}</span>
                  <!-- Sends the token as it sits, on this chain. Moving it back
                       to its origin is an IBC transfer, not this. -->
                  <button
                    v-if="canSendAsset(entry)"
                    type="button"
                    class="bg-transparent border-none cursor-pointer color-accent-secondary p-4px border-radius-6px transition-all-fast hover-bg-hover"
                    :title="t('Send {symbol} on {chain}', {
                      symbol: resolvedDenoms[entry.denom]?.symbol || entry.denom,
                      chain: selected.prettyName
                    })"
                    @click="requestSendAsset(entry)"
                  >
                    <Send :size="14" />
                  </button>
                  <!-- Home, along the path it arrived by. Only ever home:
                       forwarding it onward would wrap it a second time. -->
                  <button
                    v-if="canReturnAsset(entry)"
                    type="button"
                    class="bg-transparent border-none cursor-pointer color-accent-secondary p-4px border-radius-6px transition-all-fast hover-bg-hover"
                    :title="t('Send back to {chain} (IBC)', {
                      chain: resolvedDenoms[entry.denom]?.sourceChain
                    })"
                    @click="requestReturnAsset(entry)"
                  >
                    <Waypoints :size="14" />
                  </button>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- 3. Vitals: short values, so tiles rather than rows. -->
        <div class="grid-cols-auto-fit-140 gap-12px grid">
          <UiKeyValue v-if="selected.symbol" :label="t('Symbol')" :value="selected.symbol" />
          <UiKeyValue
            v-if="selected.blockTime !== null"
            :label="t('Block time')"
            :value="t('{seconds}s', { seconds: selected.blockTime.toFixed(2) })"
          />
          <UiKeyValue
            v-if="selected.unbondingSeconds !== null"
            :label="t('Unbonding')"
            :value="formatDays(selected.unbondingSeconds)"
          />
          <UiKeyValue v-if="selected.height" :label="t('Height')" :value="formatHeight(selected.height)" />
          <UiKeyValue :label="t('Endpoints')" :value="endpointSummary" />
          <UiKeyValue :label="t('Status')">
            <ChainStatusPill :status="selected.status" />
          </UiKeyValue>
        </div>

        <!-- 4. Reference. One tab open at a time, none by default. -->
        <div class="flex flex-column gap-12px">
          <div class="flex-align-center gap-8px flex-wrap-wrap">
            <UiSegmentedButton
              v-for="tab in detailTabs"
              :key="tab.key"
              :active="detailTab === tab.key"
              @click="detailTab = detailTab === tab.key ? '' : tab.key"
            >
              <component :is="tab.icon" :size="14" />
              <span>{{ tab.label }}</span>
            </UiSegmentedButton>
          </div>

          <div v-if="detailTab" class="border-radius-12px p-16px bg-secondary border-1">
            <!-- Grouped by what the link is for, rather than listed as one
                 undifferentiated row. The registry publishes no social or
                 exchange fields, so those groups have nothing to draw from;
                 CoinGecko is the one market-facing identifier it carries. -->
            <div v-if="detailTab === 'sources'" class="flex flex-column gap-12px">
              <div v-if="selected.website" class="flex flex-column gap-6px">
                <span class="text-12px color-text-tertiary text-uppercase">{{ t('Official') }}</span>
                <div class="flex-align-center gap-8px flex-wrap-wrap">
                  <UiButton variant="ghost" @click="openExternal(selected.website)">
                    <Globe :size="14" />
                    <span>{{ t('Website') }}</span>
                  </UiButton>
                </div>
              </div>

              <div v-if="selected.explorers.length" class="flex flex-column gap-6px">
                <span class="text-12px color-text-tertiary text-uppercase">{{ t('Explorers') }}</span>
                <div class="flex-align-center gap-8px flex-wrap-wrap">
                  <UiButton
                    v-for="explorer in selected.explorers"
                    :key="explorer.kind"
                    variant="ghost"
                    @click="openExplorer(explorer)"
                  >
                    <ExternalLink :size="14" />
                    <span>{{ explorer.kind }}</span>
                  </UiButton>
                </div>
              </div>

              <div v-if="selected.coingeckoId" class="flex flex-column gap-6px">
                <span class="text-12px color-text-tertiary text-uppercase">{{ t('Market') }}</span>
                <div class="flex-align-center gap-8px flex-wrap-wrap">
                  <UiButton variant="ghost" @click="openExternal(coingeckoUrl(selected))">
                    <TrendingUp :size="14" />
                    <span>{{ t('CoinGecko') }}</span>
                  </UiButton>
                </div>
              </div>
            </div>

            <div v-else-if="detailTab === 'ibc'" class="flex-align-center gap-8px flex-wrap-wrap">
              <button
                v-for="peer in ibcPeers"
                :key="peer.name"
                type="button"
                class="border-radius-8px py-4px px-10px bg-card border-1 cursor-pointer color-text-secondary text-12px transition-all-fast hover-bg-hover"
                @click="openChainByName(peer.name)"
              >
                {{ peer.prettyName }}
              </button>
            </div>

            <!-- Newest first, and deliberately shallow: what happened, when,
                 and the hash to take elsewhere. Anything richer means decoding
                 every message type on 221 chains, which the explorers already
                 do and link to from the Sources tab. -->
            <div v-else-if="detailTab === 'history'" class="flex flex-column gap-8px">
              <UiLoadingState
                v-if="chainTxsState === 'loading'"
                :message="t('Reading history…')"
                wrapper-class="min-h-48px"
              />
              <UiEmptyState
                v-else-if="!chainTxs.length"
                :title="t('No transactions')"
                :description="t('Chains running without a transaction index cannot answer this, and say so the same way as an account that never spent.')"
              />
              <!-- One grid for the table, not one per row. Separate grid
                   containers size their columns independently, so a row of
                   rows never lines up - the columns have to share a grid. -->
              <div v-else class="grid grid-cols-1fr-auto-auto-auto gap-x-12px">
                <span class="py-6px text-11px color-text-tertiary text-uppercase">{{ t('Type') }}</span>
                <span class="py-6px text-11px color-text-tertiary text-uppercase text-right">
                  {{ t('Amount') }}
                </span>
                <span class="py-6px text-11px color-text-tertiary text-uppercase">{{ t('Date') }}</span>
                <span class="py-6px text-11px color-text-tertiary text-uppercase">{{ t('Hash') }}</span>

                <template v-for="entry in chainTxs" :key="entry.hash">
                  <!-- The arrow is the direction, which is known for free: the
                       row came back from the signer query or the recipient one. -->
                  <span class="flex flex-align-center gap-6px py-8px border-top-1 text-13px">
                    <ArrowUpRight v-if="entry.direction === 'out'" :size="14" class="color-text-tertiary" />
                    <ArrowDownLeft v-else :size="14" class="color-success" />
                    <span>{{ entry.label }}</span>
                    <span v-if="entry.messageCount > 1" class="text-11px color-text-tertiary">
                      {{ t('+{count}', { count: entry.messageCount - 1 }) }}
                    </span>
                    <span v-if="entry.failed" class="text-11px color-error">
                      {{ t('failed {code}', { code: entry.code }) }}
                    </span>
                  </span>

                  <span class="py-8px border-top-1 text-13px text-right mono">{{ txAmountLabel(entry) }}</span>

                  <span class="py-8px border-top-1 text-12px color-text-tertiary">
                    {{ formatTxDate(entry.timestamp) }}
                  </span>

                  <span class="flex flex-align-center gap-4px py-8px border-top-1">
                    <span class="text-12px color-text-tertiary mono" :title="entry.hash">
                      {{ truncateMiddle(entry.hash, { start: 6, end: 4 }) }}
                    </span>
                    <!-- Opens the transaction on its own chain, which is a page
                         of ours rather than a link out to an explorer. -->
                    <UiButton variant="ghost" :title="t('Open transaction')" @click="openTransaction(entry.hash)">
                      <ExternalLink :size="13" />
                    </UiButton>
                    <UiButton variant="ghost" :title="t('Copy hash')" @click="copyHash(entry.hash)">
                      <Copy :size="13" />
                    </UiButton>
                  </span>
                </template>
              </div>
            </div>

            <div v-else-if="detailTab === 'governance'" class="flex flex-column gap-12px">
              <UiLoadingState
                v-if="chainProposalsState === 'loading'"
                :message="t('Reading proposals…')"
                wrapper-class="min-h-48px"
              />
              <UiEmptyState
                v-else-if="!chainProposals.length"
                :title="t('No proposals')"
                :description="t('This chain has published none, or does not serve the governance module.')"
              />
              <template v-else>
                <div v-for="proposal in chainProposals" :key="proposal.id" class="flex flex-column gap-6px">
                  <div class="flex-align-center gap-8px">
                    <span class="text-12px color-text-tertiary mono">#{{ proposal.id }}</span>
                    <span class="text-13px flex-1">{{ proposal.title }}</span>
                    <span
                      class="text-12px"
                      :class="proposal.status === 'VOTING_PERIOD' ? 'color-warning' : 'color-text-tertiary'"
                    >
                      {{ proposal.statusLabel }}
                    </span>
                  </div>
                  <!-- Only while it is still open: on a closed proposal the
                       date has already passed and says nothing. -->
                  <span
                    v-if="proposal.status === 'VOTING_PERIOD' && proposal.votingEndsAt"
                    class="text-12px color-text-tertiary"
                  >
                    {{ t('Voting ends {date}', { date: formatTxDate(proposal.votingEndsAt) }) }}
                  </span>
                  <!-- Offered only while a vote can still be cast, and only
                       with an account to cast it from. A proposal that closed
                       stays listed, because how it ended is worth reading. -->
                  <div
                    v-if="proposal.status === 'VOTING_PERIOD' && derivedAddress"
                    class="flex-align-center gap-8px flex-wrap-wrap"
                  >
                    <UiSpinner v-if="votingProposal === proposal.id" size="sm" />
                    <template v-else>
                      <UiButton
                        v-for="option in voteOptions"
                        :key="option.key"
                        variant="ghost"
                        :disabled="votingProposal !== ''"
                        @click="voteOnProposal(proposal, option.key)"
                      >
                        <span>{{ option.label }}</span>
                      </UiButton>
                    </template>
                  </div>
                </div>
              </template>
            </div>

            <div v-else class="grid-cols-auto-fit-140 gap-12px grid">
              <UiKeyValue :label="t('Registry name')" :value="selected.name" value-class="mono" />
              <UiKeyValue v-if="selected.denom" :label="t('Base denom')" :value="selected.denom" value-class="mono" />
              <UiKeyValue :label="t('Prefix')" :value="selected.prefix" value-class="mono" />
              <UiKeyValue :label="t('Network')" :value="selected.networkType" />
            </div>
          </div>
        </div>

        <span v-if="balance.status === 'ok' && balance.source" class="text-12px color-text-tertiary">
          {{ t('Read from {endpoint}', { endpoint: balance.source }) }}
        </span>
      </div>
    </UiModal>

    <CosmosStakeDialog
      :model-value="Boolean(stakeAction)"
      :action="stakeAction || 'delegate'"
      :symbol="stakeChain?.symbol || stakeChain?.denom || ''"
      :source-options="stakeSourceOptions"
      :destination-options="stakeDestinationOptions"
      :from-validator="stakeFrom"
      :to-validator="stakeTo"
      :amount="stakeAmount"
      :available-label="stakeAvailableLabel"
      :unbonding-days="stakeUnbondingDays"
      :loading="validatorsLoading"
      :busy="staking"
      :error="stakeError"
      @update:model-value="closeStakeDialog"
      @update:from-validator="stakeFrom = $event"
      @update:to-validator="stakeTo = $event"
      @update:amount="stakeAmount = $event"
      @submit="submitStake"
    />

    <ReceiveDialog
      :model-value="Boolean(receiveChain)"
      :address="receiveChain ? addressFor(receiveChain) : ''"
      :qr-data-url="receiveQrDataUrl"
      :symbol="receiveChain?.symbol || ''"
      :chain-name="receiveChain?.prettyName || ''"
      @update:model-value="closeReceive"
      @copy="copyReceiveAddress"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import QRCode from 'qrcode';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Boxes,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  Globe,
  HandCoins,
  History,
  Info,
  Landmark,
  Minus,
  Plus,
  RefreshCw,
  Send,
  Star,
  TrendingUp,
  TriangleAlert,
  Waypoints
} from 'lucide-vue-next';
import { t } from '../stores/i18nStore';
import UiButton from '../ui/UiButton.vue';
import UiCopyField from '../ui/UiCopyField.vue';
import UiKeyValue from '../ui/UiKeyValue.vue';
import UiSegmentedButton from '../ui/UiSegmentedButton.vue';
import UiSpinner from '../ui/UiSpinner.vue';
import UiEmptyState from '../ui/UiEmptyState.vue';
import UiErrorState from '../ui/UiErrorState.vue';
import UiInput from '../ui/UiInput.vue';
import UiLoadingState from '../ui/UiLoadingState.vue';
import UiModal from '../ui/UiModal.vue';
import UiBanner from '../ui/UiBanner.vue';
import ChainMark from '../entities/ChainMark.vue';
import ChainStatusPill from '../entities/ChainStatusPill.vue';
import ReceiveDialog from '../dialogs/ReceiveDialog.vue';
import CosmosStakeDialog from '../dialogs/CosmosStakeDialog.vue';
import { copyToClipboardWithToast } from '../composables/useClipboard';
import { useToast } from '../composables/useToast';
import { useInternalLumen } from '../composables/useInternalLumen';
import { DEFAULT_FEE_GAS, computeFeeAmount, loadChainFeeSchedule } from '../internal/services/cosmosFees';
import {
  fetchCosmosBalances,
  fetchCosmosProposals,
  fetchCosmosStaking,
  fetchCosmosTransactions,
  fetchCosmosRedelegations,
  fetchCosmosValidators,
  getCosmosChainsAge,
  isChainUsable,
  loadCosmosChains,
  isPinnedChain,
  loadIbcIndex,
  readFollowedChains,
  resolveIbcDenoms,
  resolveIbcPeers,
  toggleFollowedChain
} from '../internal/services/cosmosDirectory';
import { useTabNavigation } from '../composables/useTabNavigation';
import { getAddressPrefix, reencodeAddressPrefix } from '../internal/services/ibcChains';
import { formatDecimal, truncateMiddle } from '../internal/services/format';
import { errorMessage } from '../internal/services/coerce';
import { describeChainError } from '../internal/services/chainErrors';
import { buildRedelegationLocks, redelegationLockUntil } from '../internal/services/stakePositions';
import type { RedelegationLockMap } from '../types/stakePosition';
import { STORAGE_KEYS, readString, writeString } from '../internal/services/storage';
import type {
  CosmosBalanceState,
  CosmosChainSummary,
  CosmosExplorer,
  CosmosIbcPeer,
  CosmosProposal,
  CosmosResolvedDenom,
  CosmosStakeAction,
  CosmosStakeOption,
  CosmosTransaction,
  CosmosValidator,
  ChainFeeSchedule
} from '../types/walletPage';

const { openInNewTab } = useTabNavigation();
const toast = useToast();

const props = defineProps<{ address: string; profileId: string }>();
const emit = defineEmits<{
  (event: 'import-profile'): void;
  (
    event: 'send',
    payload: {
      chain: CosmosChainSummary;
      address: string;
      microAmount: string;
      mode: 'send' | 'ibc';
      ibcPeers: CosmosIbcPeer[];
      asset?: { denom: string; symbol: string; decimals: number };
      /** A route decided by the caller, when there is only one. */
      ibcRoute?: {
        channelId: string;
        portId: string;
        chainId: string;
        chainLabel: string;
        iconUrl: string;
      };
    }
  ): void;
}>();

const chains = ref<CosmosChainSummary[]>([]);
const loading = ref(true);
const refreshing = ref(false);
const error = ref('');
const query = ref('');
const selected = ref<CosmosChainSummary | null>(null);
const migrationDismissed = ref(Boolean(readString(STORAGE_KEYS.cosmosMigrationDismissed)));

const idleBalance: CosmosBalanceState = {
  status: 'idle',
  balances: [],
  error: '',
  source: '',
  staking: null
};
const balance = ref<CosmosBalanceState>({ ...idleBalance });

const followedNames = ref<string[]>([]);
const followedBalances = ref<Record<string, CosmosBalanceState>>({});
const followedLoading = ref(false);

const receiveChain = ref<CosmosChainSummary | null>(null);
const receiveQrDataUrl = ref('');

const detailTab = ref<'' | 'sources' | 'ibc' | 'history' | 'governance' | 'raw'>('');

/**
 * History and governance load when their tab is opened, never with the modal.
 *
 * Both are several requests against endpoints that answer slowly or not at
 * all, and neither is what someone opens a chain for - the balance is. Loading
 * them eagerly would put that cost on every open, for two panels most opens
 * never look at. The tab strip already says "none by default"; this follows it.
 */
const chainTxs = ref<CosmosTransaction[]>([]);
const chainTxsState = ref<'idle' | 'loading' | 'ok'>('idle');
const chainProposals = ref<CosmosProposal[]>([]);
const chainProposalsState = ref<'idle' | 'loading' | 'ok'>('idle');
const votingProposal = ref('');
const unbondingExpanded = ref(false);
/** Name of the chain being claimed, so one claim at a time across both views. */
const claimingChain = ref('');

/** The staking dialog: which action, and the form it is filling. */
const stakeAction = ref<CosmosStakeAction | null>(null);
/**
 * The chain the staking dialog acts on.
 *
 * Held here rather than read from `selected`, because opening this closes the
 * chain sheet - the sheet's modal and this one both teleport to the body, and
 * the second to mount does not reliably land on top.
 */
const stakeChain = ref<CosmosChainSummary | null>(null);
/** The balance as it stood when the dialog opened, for its staked figures. */
const stakeSnapshot = ref<CosmosBalanceState | null>(null);
const stakeFrom = ref('');
const stakeTo = ref('');
const stakeAmount = ref('');
const stakeError = ref('');
const staking = ref(false);
const validators = ref<CosmosValidator[]>([]);
const validatorsLoading = ref(false);
/** Which chain the loaded set belongs to, so it is not reused across chains. */
const validatorsChain = ref('');
/** Validator -> ISO time it stops receiving a redelegation. */
const redelegationLocks = ref<RedelegationLockMap>({});

/**
 * Staking messages cost more gas than a transfer, and a redelegation more than
 * either. One figure above all three beats three that each need justifying.
 */
const STAKE_GAS = '350000';

/**
 * Per validator claimed. Matches the gas the home chain's own withdraw handler
 * has always used - claiming at less than that failed there outright.
 */
const CLAIM_GAS = '300000';

/** ibc/<hash> -> what it actually is, filled in after a balance loads. */
const resolvedDenoms = ref<Record<string, CosmosResolvedDenom>>({});
const ibcIndex = ref<Record<string, string[]>>({});

const address = computed(() => String(props.address || '').trim());

/**
 * The same account, written for a given chain.
 *
 * This is the whole argument for one key store rather than a second one: every
 * chain here derives from the same path, so a Lumen address re-encodes into a
 * valid address on each of them without touching the key.
 */
function addressFor(chain: CosmosChainSummary | null): string {
  if (!address.value || !chain?.prefix) return '';
  // The account's own chain needs no conversion, and re-encoding it would put
  // its address through a bech32 round trip that can only fail: a checksum the
  // decoder rejects turns a perfectly usable address into an empty string, and
  // with it disables every action on the home chain.
  if (getAddressPrefix(address.value) === chain.prefix) return address.value;
  return reencodeAddressPrefix(address.value, chain.prefix);
}

const derivedAddress = computed(() => addressFor(selected.value));

const showMigrationNotice = computed(() => !migrationDismissed.value && !loading.value && !error.value);

/** Followed chains, in the order they were followed rather than alphabetically. */
const followedChains = computed(() => {
  const byName = new Map(chains.value.map((chain) => [chain.name, chain]));
  return followedNames.value
    .map((name) => byName.get(name))
    .filter((chain): chain is CosmosChainSummary => Boolean(chain));
});

function isFollowed(chain: CosmosChainSummary): boolean {
  return followedNames.value.includes(chain.name);
}

/**
 * Dims the 85 chains that publish nothing to query, so the list reads at a
 * glance rather than only after finding the "No endpoint" tag.
 *
 * Following one exempts it. Sinking and dimming both say "you probably do not
 * want this", which is a guess the user has already answered by choosing it -
 * and a watchlist entry that looks disabled reads as broken rather than as
 * limited. They are still dimmed in their own section's absence, never in it.
 */
function isChainDimmed(chain: CosmosChainSummary): boolean {
  return !isChainUsable(chain) && !isFollowed(chain);
}

/**
 * Sending needs somewhere to broadcast and an address to sign for.
 *
 * The gas price is not checked here: it comes from the chain's own registry
 * entry and is fetched when the dialog opens, so a chain that publishes none is
 * refused at that point with a reason rather than being greyed out with none.
 */
function canSendOn(chain: CosmosChainSummary): boolean {
  return Boolean(chain.rpc.length) && Boolean(addressFor(chain));
}

/** Why the button is off, rather than one guess covering both reasons. */
function sendDisabledReason(chain: CosmosChainSummary): string {
  if (canSendOn(chain)) return '';
  if (!chain.rpc.length) return t('This chain publishes no RPC endpoint to broadcast through.');
  return t('No address could be derived for this chain.');
}

/**
 * Hands the page the chain, the address on it, and what is held there.
 *
 * The balance travels with the request so the dialog can show what is
 * available: it has already been read for a followed chain, and re-reading it
 * would be a second round trip for a number the panel is displaying.
 */
/**
 * Whether this chain can start an IBC transfer.
 *
 * Needs somewhere to broadcast and at least one registered path out. The paths
 * come from the registry index, so a chain the index has not loaded for yet
 * simply cannot offer it rather than offering an empty destination list.
 */
function canIbcFrom(chain: CosmosChainSummary): boolean {
  return canSendOn(chain) && resolveIbcPeers(ibcIndex.value, chain.name, chains.value).length > 0;
}

function ibcButtonTitle(chain: CosmosChainSummary): string {
  if (canIbcFrom(chain)) return t('To other chain (IBC)');
  if (!canSendOn(chain)) return sendDisabledReason(chain);
  return t('No IBC path is registered for this chain.');
}

/**
 * Sending a non-native token needs its exponent, which only the resolved trace
 * supplies - so a denom still showing as a hash cannot be sent yet.
 */
function canSendAsset(entry: { denom: string }): boolean {
  return Boolean(selected.value && canSendOn(selected.value) && resolvedDenoms.value[entry.denom]);
}

/**
 * Sends a token the chain hosts but did not issue, on that chain.
 *
 * This is a plain transfer to another address with the same prefix - the token
 * keeps its `ibc/<hash>` denom, because that is what it is called here. Sending
 * it back to the chain that issued it is an IBC transfer along the path it
 * arrived by, which is the IBC button, not this one.
 *
 * The fee stays in the host chain's own token: gas is never paid in the asset
 * being moved.
 */
function requestSendAsset(entry: { denom: string; amount: string }) {
  const chain = selected.value;
  const resolved = resolvedDenoms.value[entry.denom];
  if (!chain || !resolved || !canSendOn(chain)) return;

  closeChain();
  emit('send', {
    chain,
    address: addressFor(chain),
    microAmount: entry.amount,
    mode: 'send',
    ibcPeers: [],
    asset: { denom: entry.denom, symbol: resolved.symbol, decimals: resolved.decimals }
  });
}

/**
 * The channel this token arrived through, read off its trace.
 *
 * A trace path is `transfer/channel-10`, or a longer chain of them for a token
 * that has been forwarded more than once. Only the single-hop case is offered:
 * the last hop is the one this chain can unwind, and a multi-hop token would
 * need each leg walked in turn.
 */
function returnChannel(denom: string): string {
  const path = resolvedDenoms.value[denom]?.path || '';
  const parts = path.split('/').filter(Boolean);
  return parts.length === 2 && parts[0] === 'transfer' ? parts[1] : '';
}

function canReturnAsset(entry: { denom: string }): boolean {
  const resolved = resolvedDenoms.value[entry.denom];
  return Boolean(
    selected.value &&
      canSendOn(selected.value) &&
      resolved?.sourceName &&
      resolved.sourceChain &&
      returnChannel(entry.denom)
  );
}

/**
 * Sends a hosted token back to the chain that issued it.
 *
 * Going home unwinds the wrapping: the voucher is burned here and the original
 * released there, so what lands is the native token rather than another
 * wrapper. Sending it onward to a third chain would instead wrap it again -
 * a distinct asset from the one a direct transfer produces, with no liquidity
 * and no price anywhere - which is why only the return is offered.
 *
 * The route is the token's own trace rather than a picked channel: there is
 * exactly one way back, and it is the way it came.
 */
function requestReturnAsset(entry: { denom: string; amount: string }) {
  const chain = selected.value;
  const resolved = resolvedDenoms.value[entry.denom];
  const channelId = returnChannel(entry.denom);
  const origin = chains.value.find((item) => item.name === resolved?.sourceName);
  if (!chain || !resolved || !origin || !channelId) return;

  closeChain();
  emit('send', {
    chain,
    address: addressFor(chain),
    microAmount: entry.amount,
    mode: 'ibc',
    ibcPeers: [{ name: origin.name, prettyName: origin.prettyName, chainId: origin.chainId, image: origin.image }],
    asset: { denom: entry.denom, symbol: resolved.symbol, decimals: resolved.decimals },
    ibcRoute: {
      channelId,
      portId: 'transfer',
      chainId: origin.chainId,
      chainLabel: origin.prettyName,
      iconUrl: origin.image
    }
  });
}

function requestSend(chain: CosmosChainSummary, mode: 'send' | 'ibc' = 'send') {
  if (mode === 'ibc' ? !canIbcFrom(chain) : !canSendOn(chain)) return;

  const state = followedBalances.value[chain.name];
  const held = state?.status === 'ok'
    ? state.balances.find((entry) => entry.denom === chain.denom)?.amount
    : '';

  // The send dialog belongs to the page, not to this panel, and it opens
  // beneath the chain sheet rather than over it. Closing first is what makes
  // the transition read as moving on rather than as nothing happening.
  closeChain();

  emit('send', {
    chain,
    address: addressFor(chain),
    microAmount: held || '0',
    mode,
    ibcPeers: mode === 'ibc' ? resolveIbcPeers(ibcIndex.value, chain.name, chains.value) : []
  });
}

/**
 * Receiving works everywhere, including the 85 chains with no endpoint.
 *
 * Nothing has to be queried or signed to be paid - the address is derived
 * locally - so this is gated on having an address rather than on the chain
 * being reachable.
 */
async function openReceive(chain: CosmosChainSummary) {
  const account = addressFor(chain);
  if (!account) return;

  receiveChain.value = chain;
  receiveQrDataUrl.value = '';
  try {
    const dataUrl = await QRCode.toDataURL(account, {
      width: 240,
      margin: 2,
      color: { dark: '#0f172a', light: '#f8fafc' }
    });
    // The dialog may have been closed, or moved to another chain, while this
    // was encoding - showing the previous chain's QR would be worse than none.
    if (receiveChain.value?.name === chain.name) receiveQrDataUrl.value = dataUrl;
  } catch {
    receiveQrDataUrl.value = '';
  }
}

function closeReceive() {
  receiveChain.value = null;
  receiveQrDataUrl.value = '';
}

/**
 * What an IPC result actually failed with.
 *
 * The handlers answer `{ ok: false, error }`, and `errorMessage` looks for
 * `.message` - so every refusal here was being dropped on the floor and
 * replaced by the caller's generic fallback. The user saw "Failed to claim
 * rewards." whatever the chain had said, which is unactionable for them and
 * undiagnosable for anyone reading a bug report.
 *
 * Chain refusals go through `describeChainError` so they arrive as a sentence
 * in the user's language rather than as the module's raw text.
 */
function ipcError(res: unknown, fallback: string): string {
  const raw = String((res as { error?: unknown } | null)?.error ?? '').trim();
  if (!raw) return fallback;
  return describeChainError(raw) || raw;
}

/** Enough of each end to recognise the account, and the prefix stays visible. */
function shortAddress(chain: CosmosChainSummary): string {
  return truncateMiddle(addressFor(chain), { start: 10, end: 6 });
}

function copyAddress(chain: CosmosChainSummary) {
  const account = addressFor(chain);
  if (account) void copyToClipboardWithToast(account);
}

function copyReceiveAddress() {
  const account = addressFor(receiveChain.value);
  if (account) void copyToClipboardWithToast(account);
}

/** The headline number for a followed chain, or why there isn't one. */
function followedBalanceLabel(chain: CosmosChainSummary): string {
  const state = followedBalances.value[chain.name];
  if (!state || state.status === 'idle') return t('Not read yet');
  if (state.status === 'loading') return t('Reading balance…');
  if (state.status === 'error') return state.error;

  return t('{amount} {symbol}', {
    amount: formatAmount(followedNativeAmount(chain), chain.decimals),
    symbol: chain.symbol || chain.denom
  });
}

function followedNativeAmount(chain: CosmosChainSummary): string {
  const state = followedBalances.value[chain.name];
  if (state?.status !== 'ok') return '0';
  return state.balances.find((entry) => entry.denom === chain.denom)?.amount || '0';
}

/**
 * What the holding is worth - not what one token costs.
 *
 * The two were shown side by side unlabelled, so "0.439 BZE" sat next to
 * "$0.000468" and read as its value when it was the unit price. Value goes
 * beside the balance; the price is stated as an equation below, where it
 * cannot be mistaken for anything else.
 */
function followedBalanceUsd(chain: CosmosChainSummary): string {
  if (chain.priceUsd === null) return '';
  const state = followedBalances.value[chain.name];
  if (state?.status !== 'ok') return '';

  const raw = Number(followedNativeAmount(chain));
  if (!Number.isFinite(raw) || raw <= 0) return '';
  return `≈ ${formatUsd((raw / 10 ** chain.decimals) * chain.priceUsd)}`;
}

/**
 * A denom, shortened where it is a hash rather than a name.
 *
 * `ibc/<64 hex>` is the denom of a token that arrived over IBC: the hash is
 * the transfer path, not a ticker, and printing it whole pushes the amount off
 * the row. The full value stays in the title attribute.
 */
/**
 * An IBC amount, formatted once its exponent is known.
 *
 * Until the trace resolves there is no exponent to divide by - the hash does
 * not carry one - so the raw base units are shown rather than a number scaled
 * by a guessed six.
 */
function otherBalanceAmount(entry: { denom: string; amount: string }): string {
  const resolved = resolvedDenoms.value[entry.denom];
  if (!resolved) return entry.amount;
  return `${formatAmount(entry.amount, resolved.decimals)} ${resolved.symbol}`;
}

function denomLabel(denom: string): string {
  if (!denom.toLowerCase().startsWith('ibc/')) return denom;
  return `ibc/${truncateMiddle(denom.slice(4), { start: 6, end: 4 })}`;
}

/**
 * Staked and unclaimed amounts, each labelled, and only when non-zero.
 *
 * Kept apart from the spendable balance rather than summed into it: staked
 * tokens are locked for the unbonding period and rewards are not in the
 * account at all until claimed. A single total would say the user can send
 * money they cannot send.
 */
function stakingLines(chain: CosmosChainSummary, state: CosmosBalanceState | undefined) {
  const staking = state?.status === 'ok' ? state.staking : null;
  if (!staking) return [];

  const symbol = chain.symbol || chain.denom;
  const lines: { key: string; label: string; value: string }[] = [];

  // "Total" because each of these sums across validators or across pending
  // withdrawals, and the sheet breaks the same figures out per validator
  // directly underneath - without the word, the two read as disagreeing.
  if (staking.staked !== '0') {
    lines.push({
      key: 'staked',
      label: t('Total staked'),
      value: `${formatAmount(staking.staked, chain.decimals)} ${symbol}`
    });
  }
  if (staking.rewards !== '0') {
    lines.push({
      key: 'rewards',
      label: t('Total rewards'),
      value: `${formatAmount(staking.rewards, chain.decimals)} ${symbol}`
    });
  }
  if (staking.unbonding !== '0') {
    lines.push({
      key: 'unbonding',
      label: t('Total unbonding'),
      value: `${formatAmount(staking.unbonding, chain.decimals)} ${symbol}`
    });
  }
  return lines;
}

/** How long is left on one pending withdrawal. */
function unbondingWhen(completesAt: string): string {
  const at = completesAt ? Date.parse(completesAt) : NaN;
  if (!Number.isFinite(at)) return t('Date unknown');

  const days = Math.ceil((at - Date.now()) / 86400000);
  if (days <= 0) return t('Ready');
  if (days === 1) return t('1 day left');
  return t('{count} days left', { count: days });
}

function unbondingRows(chain: CosmosChainSummary, state: CosmosBalanceState | undefined) {
  const entries = state?.status === 'ok' ? state.staking?.unbondingEntries || [] : [];
  return entries.map((entry, index) => ({
    key: `${entry.completesAt}-${index}`,
    when: unbondingWhen(entry.completesAt),
    value: `${formatAmount(entry.amount, chain.decimals)} ${chain.symbol || chain.denom}`
  }));
}

/**
 * How many denoms other than the chain's own it holds.
 *
 * A count rather than a list: the card has no room for denom rows, and the
 * number is enough to tell the user the sheet has more to show.
 */
function followedOtherAssetCount(chain: CosmosChainSummary): number {
  const state = followedBalances.value[chain.name];
  if (state?.status !== 'ok') return 0;
  return state.balances.filter((entry) => entry.denom !== chain.denom).length;
}

function followedStakingLines(chain: CosmosChainSummary) {
  return stakingLines(chain, followedBalances.value[chain.name]);
}

const selectedStakingLines = computed(() =>
  selected.value ? stakingLines(selected.value, balance.value) : []
);

/**
 * Claiming is offered where there is something to claim, somewhere to
 * broadcast, and a validator to claim from.
 *
 * The fee is not checked here: it is loaded when the button is pressed, and a
 * chain publishing none is refused then, with a reason - the same bargain the
 * send button makes. The home chain takes the same route as any other; its
 * zero fee and PQC signing are decided in the handler, not here.
 */
function canClaimOn(chain: CosmosChainSummary, state: CosmosBalanceState | undefined): boolean {
  const staking = state?.status === 'ok' ? state.staking : null;
  // Gated on the per-validator set, not the total: a total can be non-zero
  // while an individual validator owes nothing, and that is exactly the case
  // the chain rejects.
  return Boolean(staking && staking.rewardValidators.length && chain.rpc.length);
}

const canClaim = computed(() =>
  selected.value ? canClaimOn(selected.value, balance.value) : false
);

function canClaimFollowed(chain: CosmosChainSummary): boolean {
  return canClaimOn(chain, followedBalances.value[chain.name]);
}

/**
 * Whether this chain stakes the token being displayed.
 *
 * Not every chain does, and on some the bond denom is not the token the user
 * holds - Noble bonds `ustake` while its product is USDC. Offering to stake a
 * balance the staking module will not accept is offering a failure, so the
 * check is the chain's own delegations plus a bonded validator set, both of
 * which the balance read already establishes.
 */
const canStake = computed(() => {
  const chain = selected.value;
  // Nothing to stake means nothing to offer: the dialog would open on an
  // amount field that can only be wrong.
  const held = nativeBalance.value?.amount || '0';
  return Boolean(chain && chain.rpc.length && chain.denom && addressFor(chain) && held !== '0');
});

const stakeSourceOptions = computed<CosmosStakeOption[]>(() => {
  const chain = stakeChain.value;
  if (!chain) return [];

  // Undelegating and moving start from somewhere the account already stakes.
  if (stakeAction.value === 'delegate') {
    return validators.value.map((entry) => ({
      address: entry.address,
      label: `${entry.moniker} · ${(entry.commission * 100).toFixed(1)}%`
    }));
  }

  const staking = stakeSnapshot.value?.status === 'ok' ? stakeSnapshot.value.staking : null;
  return (staking?.delegations || []).map((entry) => ({
    address: entry.validator,
    label: `${validatorName(entry.validator)} · ${formatAmount(entry.amount, chain.decimals)} ${chain.symbol || chain.denom}`
  }));
});

/** Anywhere except where the stake already sits. */
const stakeDestinationOptions = computed<CosmosStakeOption[]>(() =>
  validators.value
    .filter((entry) => entry.address !== stakeFrom.value)
    .map((entry) => ({
      address: entry.address,
      label: `${entry.moniker} · ${(entry.commission * 100).toFixed(1)}%`
    }))
);

function validatorName(address: string): string {
  return validators.value.find((entry) => entry.address === address)?.moniker
    || truncateMiddle(address, { start: 12, end: 6 });
}

/**
 * Loads the validator set for the chain whose sheet is open, so delegations
 * read as names.
 *
 * Without this the set only arrived when the staking dialog fetched it, so the
 * same delegation showed a truncated operator address before that and a moniker
 * afterwards - the same row, two identities, depending on what the user had
 * clicked earlier.
 *
 * Only fetched when there is something to name, and only once per chain: an
 * account that stakes nowhere never pays for it.
 */
async function ensureValidatorNames(chain: CosmosChainSummary, delegated: number) {
  if (!delegated || validatorsChain.value === chain.name || validatorsLoading.value) return;

  validatorsLoading.value = true;
  try {
    // Locks come along for the ride: both are per-chain, both are only wanted
    // when the account stakes somewhere, and neither blocks the balance.
    const [set, redelegations] = await Promise.all([
      fetchCosmosValidators(chain),
      fetchCosmosRedelegations(chain, addressFor(chain))
    ]);
    validators.value = set;
    redelegationLocks.value = buildRedelegationLocks(redelegations as never);
    validatorsChain.value = chain.name;
  } catch {
    // Names are a nicety; the address is already a correct label.
  } finally {
    validatorsLoading.value = false;
  }
}

/**
 * When this validator stops receiving a redelegation, or empty if it is not.
 *
 * Cosmos refuses to move stake out of a validator that is still receiving one,
 * and only says so at broadcast - after the transaction is signed. Reading the
 * lock lets the row say it first.
 */
function lockedUntil(validatorAddress: string): string {
  return redelegationLockUntil(redelegationLocks.value, validatorAddress);
}

function lockLabel(validatorAddress: string): string {
  const until = lockedUntil(validatorAddress);
  if (!until) return '';
  const days = Math.ceil((Date.parse(until) - Date.now()) / 86400000);
  return days > 1
    ? t('Receiving a redelegation for {count} more days, so stake cannot be moved out yet.', { count: days })
    : t('Receiving a redelegation, so stake cannot be moved out yet.');
}

/** What the chosen action can draw on, which is not the same pot for each. */
const stakeAvailableLabel = computed(() => {
  const chain = stakeChain.value;
  const snapshot = stakeSnapshot.value;
  if (!chain || snapshot?.status !== 'ok') return '';
  const symbol = chain.symbol || chain.denom;

  if (stakeAction.value === 'delegate') {
    const native = snapshot.balances.find((entry) => entry.denom === chain.denom)?.amount || '0';
    return t('Available: {amount} {symbol}', {
      amount: formatAmount(native, chain.decimals),
      symbol
    });
  }

  const held = snapshot.staking?.delegations.find((entry) => entry.validator === stakeFrom.value);
  if (!held) return '';
  return t('Staked here: {amount} {symbol}', {
    amount: formatAmount(held.amount, chain.decimals),
    symbol
  });
});

const stakeUnbondingDays = computed(() => {
  const seconds = stakeChain.value?.unbondingSeconds;
  return seconds ? Math.round(seconds / 86400) : null;
});

/** Where the stake sits, one row per validator, largest first. */
const delegationRows = computed(() => {
  const chain = selected.value;
  const staking = balance.value.status === 'ok' ? balance.value.staking : null;
  if (!chain || !staking) return [];

  return staking.delegations.map((entry) => ({
    validator: entry.validator,
    name: validatorName(entry.validator),
    lockLabel: lockLabel(entry.validator),
    amount: `${formatAmount(entry.amount, chain.decimals)} ${chain.symbol || chain.denom}`
  }));
});

/** Where an unstake starts when it is launched from the total rather than a row. */
const firstDelegation = computed(() => {
  const staking = balance.value.status === 'ok' ? balance.value.staking : null;
  return staking?.delegations[0]?.validator || '';
});

const selectedUnbondingRows = computed(() =>
  selected.value ? unbondingRows(selected.value, balance.value) : []
);

const visibleUnbondingRows = computed(() =>
  unbondingExpanded.value ? selectedUnbondingRows.value : selectedUnbondingRows.value.slice(0, 2)
);

/** "1 BZE = $0.000468" - self-labelling, so it needs no caption. */
function unitPriceLabel(chain: CosmosChainSummary): string {
  if (chain.priceUsd === null) return '';
  return `1 ${chain.symbol || chain.denom} = ${formatUsd(chain.priceUsd)}`;
}

const visibleChains = computed(() => {
  const needle = query.value.trim().toLowerCase();
  if (!needle) return chains.value;
  return chains.value.filter((chain) =>
    [chain.prettyName, chain.chainId, chain.symbol, chain.name].some((field) =>
      field.toLowerCase().includes(needle)
    )
  );
});

const ibcPeers = computed(() =>
  selected.value ? resolveIbcPeers(ibcIndex.value, selected.value.name, chains.value) : []
);

/** Only the tabs with something behind them - an empty panel is a dead end. */
const detailTabs = computed(() => {
  const chain = selected.value;
  if (!chain) return [];

  const tabs: {
    key: 'sources' | 'ibc' | 'history' | 'governance' | 'raw';
    label: string;
    icon: unknown;
  }[] = [];
  if (chain.explorers.length || chain.website) {
    tabs.push({ key: 'sources', label: t('Sources'), icon: ExternalLink });
  }
  if (ibcPeers.value.length) {
    tabs.push({ key: 'ibc', label: t('IBC ({count})', { count: ibcPeers.value.length }), icon: Waypoints });
  }
  // History is about an account, so it is offered only once there is one.
  // Governance belongs to the chain and is offered as soon as it answers.
  if (derivedAddress.value) tabs.push({ key: 'history', label: t('History'), icon: History });
  if (chain.rest.length) tabs.push({ key: 'governance', label: t('Governance'), icon: Landmark });
  tabs.push({ key: 'raw', label: t('Identifiers'), icon: Info });
  return tabs;
});

const voteOptions = computed(() => [
  { key: 'yes', label: t('Yes') },
  { key: 'no', label: t('No') },
  { key: 'abstain', label: t('Abstain') },
  { key: 'no_with_veto', label: t('No with veto') }
]);

/**
 * The coin the transaction moved, in the denom it actually moved.
 *
 * The chain's own decimals apply only when the denom is the chain's own: a
 * transaction can move an IBC token or a contract token whose exponent is not
 * this chain's. Those are shown in base units with their denom rather than
 * divided by the wrong power of ten, which would silently misstate an amount.
 */
function txAmountLabel(entry: CosmosTransaction): string {
  if (!entry.amount || !entry.denom) return '—';
  const chain = selected.value;

  if (chain && entry.denom === chain.denom) {
    return `${formatAmount(entry.amount, chain.decimals)} ${chain.symbol}`;
  }
  return `${entry.amount} ${truncateMiddle(entry.denom, { start: 8, end: 5 })}`;
}

/** The chain's own transaction page, rather than a link out to an explorer. */
function openTransaction(hash: string) {
  const chain = selected.value;
  if (!chain || !hash) return;
  openExternal(`lumen://tx/${chain.name}/${hash}`);
}

/** The date only: the time of day is noise in a list scanned for "when". */
function formatTxDate(timestamp: string): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
}

function copyHash(hash: string) {
  void copyToClipboardWithToast(String(hash || ''));
}

/** Opening a tab is what pays for it; reopening the same one does not. */
watch(detailTab, async (tab) => {
  const chain = selected.value;
  if (!chain) return;

  if (tab === 'history' && chainTxsState.value === 'idle' && derivedAddress.value) {
    chainTxsState.value = 'loading';
    chainTxs.value = await fetchCosmosTransactions(chain, derivedAddress.value);
    chainTxsState.value = 'ok';
  }

  if (tab === 'governance' && chainProposalsState.value === 'idle') {
    chainProposalsState.value = 'loading';
    chainProposals.value = await fetchCosmosProposals(chain);
    chainProposalsState.value = 'ok';
  }
});

/**
 * A vote is a staking-shaped transaction, so it takes the same route.
 *
 * `wallet:cosmosStake` already owns the key, the client, the fee and the
 * broadcast for an arbitrary chain; a vote differs only in the message it
 * builds. Adding an action there costs a branch, where a second handler would
 * have repeated all of it - and repeated its bugs.
 */
async function voteOnProposal(proposal: CosmosProposal, option: string) {
  const chain = selected.value;
  const account = derivedAddress.value;
  if (!chain || !account || votingProposal.value) return;

  const walletApi = useInternalLumen()?.wallet;
  if (!walletApi || typeof walletApi.cosmosStake !== 'function') {
    toast.show(t('Wallet send bridge not available.'), 'error');
    return;
  }

  let schedule: ChainFeeSchedule | null = null;
  if (chain.name !== 'lumen') {
    schedule = await loadChainFeeSchedule(chain.name);
    if (!schedule) {
      toast.show(
        t('{chain} does not publish a gas price, so a transfer cannot be priced.', {
          chain: chain.prettyName
        }),
        'warning'
      );
      return;
    }
  }

  votingProposal.value = proposal.id;
  try {
    // Primitives only: everything here is read out of a reactive proxy, which
    // the structured clone behind the bridge cannot serialise.
    const res = await walletApi.cosmosStake({
      profileId: String(props.profileId),
      address: String(account),
      action: 'vote',
      proposalId: String(proposal.id),
      voteOption: String(option),
      rpcEndpoint: String(chain.rpc[0] || ''),
      chainId: String(chain.chainId),
      feeDenom: String(schedule?.denom || chain.denom),
      feeAmount: schedule ? computeFeeAmount(schedule, 'average') : '0',
      feeGas: DEFAULT_FEE_GAS
    });

    if (!res || res.ok === false) {
      toast.show(ipcError(res, t('Failed to submit the vote.')), 'error');
      return;
    }
    toast.show(t('Vote submitted on proposal #{id}.', { id: proposal.id }), 'success');
  } finally {
    votingProposal.value = '';
  }
}

/** The chain's own token, which is the number the user is looking for. */
const nativeBalance = computed(() => {
  if (balance.value.status !== 'ok' || !selected.value) return null;
  return balance.value.balances.find((entry) => entry.denom === selected.value!.denom) || null;
});

const nativeBalanceLabel = computed(() => {
  const chain = selected.value;
  if (!chain) return '';
  const amount = nativeBalance.value?.amount || '0';
  return `${formatAmount(amount, chain.decimals)} ${chain.symbol || chain.denom}`;
});

/**
 * What the holding is worth, when the chain has a price feed.
 *
 * 87 of the 221 chains publish one, so this is absent more often than not -
 * and an absent line is better than a "$—" that reads like a zero balance.
 *
 * Formatted by the same function as the price above it. An earlier version
 * rounded this one to two decimals and said "under $0.01" below that, which
 * put "$0.000468" and "under $0.01" on the same card for the same token.
 */
const nativeBalanceUsd = computed(() => {
  const chain = selected.value;
  const price = chain?.priceUsd;
  if (!chain || price === null || price === undefined) return '';

  const raw = Number(nativeBalance.value?.amount || '0');
  if (!Number.isFinite(raw) || raw <= 0) return '';

  return `≈ ${formatUsd((raw / 10 ** chain.decimals) * price)}`;
});

/** Everything except the native token: present, but not the headline. */
const otherBalances = computed(() => {
  if (balance.value.status !== 'ok' || !selected.value) return [];
  return balance.value.balances.filter((entry) => entry.denom !== selected.value!.denom);
});

function formatHeight(height: number): string {
  if (height >= 1_000_000) return `${(height / 1_000_000).toFixed(1)}M`;
  if (height >= 1_000) return `${Math.round(height / 1_000)}k`;
  return String(height);
}

/**
 * The one place USD is formatted, for prices and for holdings alike.
 *
 * Values here span nine orders of magnitude - $63 000 for wrapped bitcoin down
 * to $0.0000052 for huahua - so a fixed number of decimals renders most of the
 * list as "$0.00". Below a dollar this switches to significant digits, which
 * stays exact instead of collapsing to a threshold.
 */
function formatUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '';
  if (value === 0) return '$0';
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toPrecision(3).replace(/0+$/, '').replace(/\.$/, '')}`;
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '';
  return `${(value * 100).toFixed(2)}%`;
}

function formatDays(seconds: number): string {
  const days = Math.round(seconds / 86400);
  return days === 1 ? t('1 day') : t('{count} days', { count: days });
}

/**
 * Opens a link and gets out of the way.
 *
 * `openInNewTab` already focuses the tab it creates, but the dialog stays
 * mounted on top of it - so following a source left the user looking at the
 * chain sheet with the page they asked for hidden behind it.
 */
function openExternal(url: string) {
  if (!url) return;
  openInNewTab?.(url);
  closeChain();
}

/**
 * Opens the explorer on the user's own account where it can, on the chain's
 * home page otherwise - which is what makes these "sources" rather than links:
 * the question is usually "what does this chain say about me".
 */
function openExplorer(explorer: CosmosExplorer) {
  const account = selected.value ? addressFor(selected.value) : '';
  const target =
    account && explorer.accountPage
      ? explorer.accountPage.replace('${accountAddress}', account)
      : explorer.url;
  openExternal(target);
}

function coingeckoUrl(chain: CosmosChainSummary): string {
  return `https://www.coingecko.com/en/coins/${encodeURIComponent(chain.coingeckoId)}`;
}

function openChainByName(name: string) {
  const next = chains.value.find((chain) => chain.name === name);
  if (next) openChain(next);
}

const endpointSummary = computed(() => {
  const chain = selected.value;
  if (!chain) return '';
  return t('{rest} REST, {rpc} RPC', { rest: chain.rest.length, rpc: chain.rpc.length });
});

/** "Updated 3 h ago", or an invitation to fetch when nothing is stored yet. */
const freshnessLabel = computed(() => {
  const age = getCosmosChainsAge();
  if (age === null) return '';
  const hours = Math.floor(age / (60 * 60 * 1000));
  if (hours < 1) return t('Updated just now');
  if (hours === 1) return t('Updated 1 hour ago');
  if (hours < 24) return t('Updated {hours} hours ago', { hours });
  const days = Math.floor(hours / 24);
  return days === 1 ? t('Updated 1 day ago') : t('Updated {days} days ago', { days });
});

/**
 * `formatMicroAmount` is not usable here: it divides by a hard-coded 1e6, and
 * the exponent varies across the registry. The chain's own exponent is applied
 * first, then the shared formatter handles the display.
 */
function formatAmount(amount: string, decimals: number): string {
  const raw = Number(amount);
  if (!Number.isFinite(raw)) return '0';
  return formatDecimal(raw / 10 ** decimals, { decimals, trimTrailingZeros: true, empty: '0' });
}

function toggleFollow(chain: CosmosChainSummary) {
  followedNames.value = toggleFollowedChain(props.profileId, chain.name);
  if (isFollowed(chain)) void loadFollowedBalance(chain);
  else delete followedBalances.value[chain.name];
}

async function loadFollowedBalance(chain: CosmosChainSummary) {
  if (!address.value || !chain.prefix) return;
  const account = reencodeAddressPrefix(address.value, chain.prefix);
  if (!account || !isChainUsable(chain)) {
    followedBalances.value[chain.name] = {
      ...idleBalance,
      status: 'error',
      error: t('This chain does not publish a REST endpoint.')
    };
    return;
  }

  followedBalances.value[chain.name] = { ...idleBalance, status: 'loading' };
  try {
    const [result, staking] = await Promise.all([
      fetchCosmosBalances(chain, account),
      fetchCosmosStaking(chain, account).catch(() => null)
    ]);
    followedBalances.value[chain.name] = {
      status: 'ok',
      balances: result.balances,
      error: '',
      source: result.source,
      staking
    };
  } catch (err) {
    followedBalances.value[chain.name] = {
      ...idleBalance,
      status: 'error',
      error: errorMessage(err, t('Failed to load balance.'))
    };
  }
}

/**
 * Reads every followed chain, a few at a time.
 *
 * Following is an explicit choice, so these are worth fetching up front - but
 * they still land on volunteer-run public endpoints, and a user following forty
 * chains should not open forty sockets at once.
 */
async function refreshFollowedBalances() {
  const queue = [...followedChains.value];
  if (!queue.length || !address.value) return;

  followedLoading.value = true;
  try {
    const workers = new Array(Math.min(4, queue.length)).fill(null).map(async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        await loadFollowedBalance(next);
      }
    });
    await Promise.all(workers);
  } finally {
    followedLoading.value = false;
  }
}

function dismissMigrationNotice() {
  migrationDismissed.value = true;
  writeString(STORAGE_KEYS.cosmosMigrationDismissed, '1');
}

function openChain(chain: CosmosChainSummary) {
  selected.value = chain;
  balance.value = { ...idleBalance };
  // Closed again per chain: the fold is a per-look decision, and carrying it
  // across would open the next chain scrolled past its own actions.
  detailTab.value = '';
  unbondingExpanded.value = false;
  // Back to idle rather than emptied: the next chain must pay for its own
  // history, and leaving these at 'ok' would show the previous chain's.
  chainTxs.value = [];
  chainTxsState.value = 'idle';
  chainProposals.value = [];
  chainProposalsState.value = 'idle';
  // Opening a chain is the request. Making the user press "check balance" after
  // choosing the chain is a second click for something they already asked for,
  // and the balance is the headline of the dialog.
  if (isChainUsable(chain) && addressFor(chain)) void loadBalance();
}

function closeChain() {
  selected.value = null;
  balance.value = { ...idleBalance };
}

/**
 * Claims every pending reward on the selected chain.
 *
 * The fee comes from the chain's registry entry, as it does for a send, and a
 * chain that publishes none is refused rather than broadcast with a guess. On
 * success the balance is re-read: the rewards line has to go to zero and the
 * spendable balance has to grow, and neither is worth making the user check.
 */
/**
 * Opens the staking dialog, loading the validator set only when it is needed.
 *
 * Undelegating and redelegating start from a delegation the account already
 * has, so their source list is those delegations and needs no lookup. A fresh
 * delegation needs the chain's active set, which is one request made on the
 * click rather than on every chain opened.
 */
function canStakeFollowed(chain: CosmosChainSummary): boolean {
  const state = followedBalances.value[chain.name];
  if (state?.status !== 'ok' || !chain.rpc.length || !addressFor(chain)) return false;
  return Boolean(state.balances.find((entry) => entry.denom === chain.denom)?.amount);
}

/**
 * Stakes straight from the card, without opening the sheet first.
 *
 * The dialog needs a chain and a balance snapshot, both of which the card
 * already has - so it is handed them directly rather than routed through a
 * sheet that would then have to close again.
 */
async function openStakeFromCard(chain: CosmosChainSummary) {
  if (!canStakeFollowed(chain)) return;

  stakeChain.value = chain;
  stakeSnapshot.value = followedBalances.value[chain.name];
  stakeAction.value = 'delegate';
  stakeFrom.value = '';
  stakeTo.value = '';
  stakeAmount.value = '';
  stakeError.value = '';

  validatorsLoading.value = true;
  try {
    validators.value = await fetchCosmosValidators(chain);
    validatorsChain.value = chain.name;
  } catch (err) {
    stakeError.value = errorMessage(err, t('Failed to load validators.'));
    validators.value = [];
  } finally {
    validatorsLoading.value = false;
  }
}

async function openStakeDialog(action: CosmosStakeAction, fromValidator = '') {
  const chain = selected.value;
  if (!chain) return;

  // Captured before the sheet closes, since that is what clears `selected`.
  stakeChain.value = chain;
  stakeSnapshot.value = balance.value;
  closeChain();

  stakeAction.value = action;
  stakeFrom.value = fromValidator;
  stakeTo.value = '';
  stakeAmount.value = '';
  stakeError.value = '';

  if (action === 'delegate' || action === 'redelegate') {
    validatorsLoading.value = true;
    try {
      validators.value = await fetchCosmosValidators(chain);
      validatorsChain.value = chain.name;
    } catch (err) {
      stakeError.value = errorMessage(err, t('Failed to load validators.'));
      validators.value = [];
    } finally {
      validatorsLoading.value = false;
    }
  }
}

function closeStakeDialog() {
  stakeAction.value = null;
  stakeChain.value = null;
  stakeError.value = '';
}

/**
 * Runs the chosen staking action, then re-reads what it changed.
 *
 * The fee comes from the registry as it does for a send, and a chain
 * publishing none is refused here rather than at broadcast.
 */
async function submitStake() {
  const chain = stakeChain.value;
  const action = stakeAction.value;
  const account = addressFor(chain);
  if (!chain || !action || !account || staking.value) return;

  staking.value = true;
  stakeError.value = '';
  try {
    let schedule: ChainFeeSchedule | null = null;
    if (chain.name !== 'lumen') {
      schedule = await loadChainFeeSchedule(chain.name);
      if (!schedule) {
        stakeError.value = t('{chain} does not publish a gas price, so a transfer cannot be priced.', {
          chain: chain.prettyName
        });
        return;
      }
    }

    const walletApi = useInternalLumen()?.wallet;
    if (!walletApi || typeof walletApi.cosmosStake !== 'function') {
      stakeError.value = t('Wallet send bridge not available.');
      return;
    }

    // Primitives only: a Vue proxy cannot cross the bridge.
    const res = await walletApi.cosmosStake({
      profileId: String(props.profileId),
      address: String(account),
      action: String(action),
      validatorAddress: String(stakeFrom.value),
      toValidatorAddress: String(stakeTo.value),
      amountText: String(stakeAmount.value),
      decimals: chain.decimals,
      denom: String(chain.denom),
      rpcEndpoint: String(chain.rpc[0] || ''),
      chainId: String(chain.chainId),
      feeDenom: String(schedule?.denom || chain.denom),
      feeAmount: schedule ? computeFeeAmount(schedule, 'average') : '0',
      feeGas: STAKE_GAS
    });

    if (!res || res.ok === false) {
      stakeError.value = ipcError(res, t('Failed to sign the transaction.'));
      return;
    }

    toast.show(t('Transaction sent.'), 'success');
    closeStakeDialog();
    // The sheet was closed to open this dialog, so the card is what the user
    // returns to and the card is what has to be right.
    if (isFollowed(chain)) await loadFollowedBalance(chain);
  } catch (err) {
    stakeError.value = errorMessage(err, t('Failed to sign the transaction.'));
  } finally {
    staking.value = false;
  }
}

async function claimRewards(chain: CosmosChainSummary | null, state: CosmosBalanceState | undefined) {
  const staking = state?.status === 'ok' ? state.staking : null;
  const account = addressFor(chain);
  if (!chain || !staking || !account || claimingChain.value) return;

  claimingChain.value = chain.name;
  try {
    let schedule: ChainFeeSchedule | null = null;
    if (chain.name !== 'lumen') {
      schedule = await loadChainFeeSchedule(chain.name);
      if (!schedule) {
        toast.show(
          t('{chain} does not publish a gas price, so a transfer cannot be priced.', {
            chain: chain.prettyName
          }),
          'warning'
        );
        return;
      }
    }

    const walletApi = useInternalLumen()?.wallet;
    if (!walletApi || typeof walletApi.withdrawAllRewards !== 'function') {
      toast.show(t('Wallet send bridge not available.'), 'error');
      return;
    }

    // Every field is copied into a primitive before crossing the bridge.
    // `staking.validators` is a Vue reactive proxy, and Electron's structured
    // clone cannot serialise a Proxy - it fails with "An object could not be
    // cloned", at the click, with nothing else to go on.
    const res = await walletApi.withdrawAllRewards({
      profileId: String(props.profileId),
      address: String(account),
      validatorAddresses: staking.rewardValidators.map((entry) => String(entry)),
      rpcEndpoint: String(chain.rpc[0] || ''),
      restEndpoint: String(chain.rest[0] || ''),
      chainId: String(chain.chainId),
      feeDenom: String(schedule?.denom || chain.denom),
      feeAmount: schedule ? computeFeeAmount(schedule, 'average') : '0',
      // Not DEFAULT_FEE_GAS: a withdraw costs more than a transfer, and the
      // handler multiplies this by the validator count.
      feeGas: CLAIM_GAS
    });

    if (!res || res.ok === false) {
      toast.show(ipcError(res, t('Failed to claim rewards.')), 'error');
      return;
    }

    toast.show(t('Rewards claimed.'), 'success');
    // Re-read whichever view asked: the rewards line has to reach zero and the
    // spendable balance has to grow, and neither is worth making the user check.
    if (selected.value?.name === chain.name) await loadBalance();
    if (isFollowed(chain)) await loadFollowedBalance(chain);
  } catch (err) {
    toast.show(errorMessage(err, t('Failed to claim rewards.')), 'error');
  } finally {
    claimingChain.value = '';
  }
}

async function loadBalance() {
  const chain = selected.value;
  const account = derivedAddress.value;
  if (!chain || !account) return;

  balance.value = { ...idleBalance, status: 'loading' };
  try {
    // Staking is read alongside the balance rather than after it: they are
    // three independent reads on the same endpoint, and serialising them would
    // triple the wait for no benefit. A chain that answers balances but not
    // the staking module still shows a balance.
    const [result, staking] = await Promise.all([
      fetchCosmosBalances(chain, account),
      fetchCosmosStaking(chain, account).catch(() => null)
    ]);
    // The modal may have been closed or switched while this was in flight.
    if (selected.value?.name !== chain.name) return;
    balance.value = {
      status: 'ok',
      balances: result.balances,
      error: '',
      source: result.source,
      staking
    };

    // Names for the delegation rows, once there is something to name. Not
    // awaited by anything above it: the rows draw with their addresses and
    // fill in.
    void ensureValidatorNames(chain, staking?.delegations.length || 0);

    // Resolved after the balance is on screen, not before: the rows draw with
    // their hashes and fill in, rather than the whole panel waiting on a
    // lookup that only affects the secondary lines.
    const foreign = result.balances
      .map((item) => item.denom)
      .filter((denom) => denom !== chain.denom);
    if (foreign.length) {
      const resolved = await resolveIbcDenoms(chain, foreign, chains.value);
      if (selected.value?.name === chain.name) {
        resolvedDenoms.value = { ...resolvedDenoms.value, ...resolved };
      }
    }
  } catch (err) {
    if (selected.value?.name !== chain.name) return;
    balance.value = {
      ...idleBalance,
      status: 'error',
      error: errorMessage(err, t('Failed to load balance.'))
    };
  }
}

async function reload({ force = false }: { force?: boolean } = {}) {
  if (force) refreshing.value = true;
  else loading.value = true;
  error.value = '';

  try {
    chains.value = await loadCosmosChains({ force });
  } catch (err) {
    error.value = errorMessage(err, t('Failed to load chains'));
  } finally {
    loading.value = false;
    refreshing.value = false;
  }
}

onMounted(async () => {
  followedNames.value = readFollowedChains(props.profileId);
  await reload();
  await refreshFollowedBalances();
  // Last, and unawaited by anything: IBC peers are a detail inside a fold, so
  // nothing above should wait on a rate-limited listing to draw.
  loadIbcIndex()
    .then((index) => {
      ibcIndex.value = index;
    })
    .catch(() => {
      ibcIndex.value = {};
    });
});

// Switching profile switches watchlists: they are stored per profile, and the
// previous one's balances must not linger under the new account's addresses.
watch(
  () => props.profileId,
  async (profileId) => {
    followedNames.value = readFollowedChains(profileId);
    followedBalances.value = {};
    await refreshFollowedBalances();
  }
);
</script>
