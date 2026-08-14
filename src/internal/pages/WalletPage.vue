<template>
  <!-- ####### lumen://wallet WALLET ####### -->
  <div class="internal-page flex">
    <!-- ####### lumen://wallet SIDEBAR ####### -->
    <InternalSidebar :title="t('Wallet')" :icon="Wallet" activeKey="wallet">
      <nav class="flex flex-column gap-12px">
        <UiSidebarNavSection :title="t('Activity')">
          <UiSidebarNavItem :active="currentView === 'overview'" @click="currentView = 'overview'">
            <Wallet :size="18" />
            <span>{{ t('Wallet') }}</span>
          </UiSidebarNavItem>
          <UiSidebarNavItem :active="currentView === 'assets'" @click="currentView = 'assets'">
            <Coins :size="18" />
            <span>{{ t('Assets') }}</span>
          </UiSidebarNavItem>
          <UiSidebarNavItem :active="currentView === 'dex'" @click="currentView = 'dex'">
            <LayoutDashboard :size="18" />
            <span>{{ t('DEX') }}</span>
          </UiSidebarNavItem>
          <UiSidebarNavItem :active="currentView === 'transactions'" @click="currentView = 'transactions'">
            <ArrowLeftRight :size="18" />
            <span>{{ t('Transactions') }}</span>
          </UiSidebarNavItem>
          <UiSidebarNavItem :active="currentView === 'recurring'" @click="currentView = 'recurring'">
            <Calendar :size="18" />
            <span>{{ t('Reminders') }}</span>
          </UiSidebarNavItem>
          <UiSidebarNavItem :active="currentView === 'addressbook'" @click="currentView = 'addressbook'">
            <Users :size="18" />
            <span>{{ t('Address book') }}</span>
          </UiSidebarNavItem>
        </UiSidebarNavSection>
      </nav>
    </InternalSidebar>

    <!-- ####### lumen://wallet MAIN CONTENT ####### -->
    <main class="flex flex-column flex-1 m-0px min-w-0 overflow-y-auto py-32px px-40px bg-secondary border-radius-0">
      <UiPageHeader :title="getViewTitle()" title-size="20px" title-weight="light" :subtitle="getViewDescription()">
        <template v-if="currentView !== 'dex'" #actions>
          <UiButton variant="primary" @click="connectWallet" v-if="!isConnected">
            <Link :size="16" />
            <span>{{ t('Connect wallet') }}</span>
          </UiButton>
          <UiButton variant="primary" @click="subscriptionsRef?.openCreateModal()" v-else-if="currentView === 'recurring'">
            <Plus :size="16" />
            <span>{{ t('New payment') }}</span>
          </UiButton>
          <UiButton variant="primary" @click="openAddContactModal" v-else-if="currentView === 'addressbook'">
            <Plus :size="16" />
            <span>{{ t('Add contact') }}</span>
          </UiButton>
          <UiButton variant="primary" @click="sendTransaction" v-else>
            <Send :size="16" />
            <span>{{ t('Send') }}</span>
          </UiButton>
        </template>
      </UiPageHeader>

      <!-- ####### lumen://wallet OVERVIEW VIEW ####### -->
      <div v-if="currentView === 'overview'" class="flex flex-column gap-24px">
        <div class="border-radius-20px p-32px bg-gradient-primary color-white relative overflow-hidden border-1-white-a1 shadow-glow-primary-lg">
          <div class="flex-align-center-justify-space-between mb-16px">
            <span class="text-uppercase txt-weight-light text-13px letter-spacing-008em color-white-a85">{{ t('Total balance') }}</span>
            <UiButton variant="icon" icon-padding-class="" @click="showBalance = !showBalance" class="hover-bg-card flex-inline-align-justify-center size-32px color-white backdrop-blur-10">
              <Eye v-if="showBalance" :size="18" />
              <EyeOff v-else :size="18" />
            </UiButton>
          </div>
          <div class="flex gap-12px flex-align-baseline mb-12px">
            <span class="txt-weight-light text-18px color-white-a90">{{ t('LMN') }}</span>
            <span class="txt-weight-strong letter-spacing-n002 text-48px text-shadow-soft">
              {{ showBalance ? balanceLabel : '••••••' }}
            </span>
          </div>
          <div class="flex-align-center gap-8px fw-500 text-14px color-white-a85">
            <TrendingUp :size="14" />
            <span v-if="isConnected && !balanceError">{{ t('On-chain balance') }}</span>
            <span v-else-if="balanceError">{{ t('Failed to load balance.') }}</span>
            <span v-else>{{ t('Connect a wallet to view balance') }}</span>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="grid-cols-auto-fit-140 gap-16px grid">
          <UiButton variant="cta" @click="sendTransaction" class="hover-lift-6-border-primary-a50 disabled-fade-50 flex-column">
            <div class="flex-align-justify-center size-64px border-radius-14px transition-all-03 color-white bg-gradient-primary shadow-primary">
              <ArrowUpRight :size="20" />
            </div>
            <span>{{ t('Send') }}</span>
          </UiButton>
          <UiButton variant="cta" @click="openReceiveModal" class="hover-lift-6-border-primary-a50 disabled-fade-50 flex-column">
            <div class="flex-align-justify-center size-64px border-radius-14px transition-all-03 color-white bg-gradient-primary shadow-primary">
              <ArrowDownLeft :size="20" />
            </div>
            <span>{{ t('Receive') }}</span>
          </UiButton>
          <UiButton variant="cta" disabled class="hover-lift-6-border-primary-a50 disabled-fade-50 flex-column">
            <div class="flex-align-justify-center size-64px border-radius-14px transition-all-03 color-white bg-gradient-gray opacity-55 shadow-primary">
              <ArrowLeftRight :size="20" />
            </div>
            <span>{{ t('Swap (soon)') }}</span>
          </UiButton>
          <UiButton variant="cta" disabled class="hover-lift-6-border-primary-a50 disabled-fade-50 flex-column">
            <div class="flex-align-justify-center size-64px border-radius-14px transition-all-03 color-white bg-gradient-gray opacity-55 shadow-primary">
              <CreditCard :size="20" />
            </div>
            <span>{{ t('Buy (soon)') }}</span>
          </UiButton>
        </div>

        <!-- Address + summary -->
        <div class="flex flex-wrap-wrap gap-16px">
          <div class="flex-1 bg-card border-radius-16px py-16px px-20px border-1 min-w-260px">
            <div class="text-uppercase color-text-tertiary text-13px letter-spacing-008em mb-4px">{{ t('Address') }}</div>
            <div class="mono break-all color-text-primary text-14px" :title="address || '-'">
              {{ address || '-' }}
            </div>
          </div>
        </div>
      </div>

      <!-- ####### lumen://wallet ASSETS VIEW ####### -->
      <div v-else-if="currentView === 'assets'" class="flex flex-column gap-24px w-full max-w-full">
        <UiChartHeader :title="t('Cross-chain assets')" />
        <UiEmptyState v-if="!isConnected" class="mt-32px" :title="t('Connect your wallet')" :description="t('Connect a wallet to view your assets across linked IBC chains.')">
          <Coins :size="32" />
          <template #actions>
            <UiButton variant="primary" @click="connectWallet">
              <Link :size="16" />
              <span>{{ t('Connect wallet') }}</span>
            </UiButton>
          </template>
        </UiEmptyState>
        <UiEmptyState v-else-if="assetsLoading && !assetRows.length" class="mt-32px" :title="t('Loading assets…')" :description="t('Fetching balances on Lumen and linked IBC chains.')">
          <Coins :size="32" />
        </UiEmptyState>
        <UiEmptyState v-else-if="assetsError && !assetRows.length" class="mt-32px" :title="t('Failed to load assets.')" :description="assetsError">
          <AlertCircle :size="32" />
        </UiEmptyState>
        <div v-else>
          <UiBanner v-if="assetsError && assetRows.length" variant="warning" class="mb-16px">
            <span>{{ assetsError }}</span>
          </UiBanner>
          <div v-if="assetRows.length" class="flex flex-column gap-16px">
            <div
              v-for="asset in assetRows"
              :key="asset.id"
              class="flex-align-center-justify-space-between gap-16px border-radius-14px bg-card border-1 py-12px px-16px flex-align-stretch flex-wrap-wrap"
            >
              <div class="flex-align-start gap-12px flex-1 min-w-220px">
                <div class="flex-align-justify-center size-40px border-radius-full txt-weight-light text-14px color-white overflow-hidden flex-shrink-0" :style="assetIconStyle(asset.iconClass)">
                  <img
                    v-if="asset.iconUrl"
                    :src="asset.iconUrl"
                    :alt="t('{name} icon', { name: asset.displayName })"
                    class="w-full h-full object-fit-cover block bg-white"
                    @error="handleAssetIconError(asset)"
                  />
                  <span v-else>{{ asset.iconText }}</span>
                </div>
                <div class="flex flex-column flex-1 gap-4px min-w-0">
                  <div class="flex-align-center flex-wrap-wrap gap-8px">
                    <span class="fw-500 color-text-primary text-14px">{{ asset.displayName }}</span>
                    <UiTag>{{ asset.chainLabel }}</UiTag>
                  </div>
                  <span class="color-text-tertiary text-13px">{{ asset.displaySymbol }}</span>
                  <span class="color-text-secondary text-12px truncate">{{ asset.addressLabel }}</span>
                  <span v-if="asset.traceLabel" class="color-text-secondary text-12px truncate">{{ asset.traceLabel }}</span>
                  <span v-if="asset.routeLabel" class="color-text-secondary text-12px truncate">{{ asset.routeLabel }}</span>
                  <span v-if="asset.error" class="color-error text-12px truncate">{{ asset.error }}</span>
                </div>
              </div>
              <div class="flex-align-end flex-column gap-12px flex-justify-space-between flex-1">
                <div class="text-right fw-500 color-text-primary flex-align-end flex-column gap-2px text-14px">
                  <span>{{ asset.displayAmount }}</span>
                  <span class="text-12px color-text-tertiary txt-weight-light">{{ asset.displaySymbol }}</span>
                </div>
                <div class="flex-align-center flex-wrap-wrap gap-8px">
                  <UiButton variant="secondary" @click="refreshAssetRow(asset)"
                    :disabled="assetRowRefreshingId === asset.id"
                    :title="t('Refresh this asset')"
                    :aria-label="t('Refresh this asset')" class="disabled-opacity-60-not-allowed-no-transform hover-border-accent hover-color-accent bg-card-disabled-hover">
                    <RefreshCw :size="14" :class="{ spinning: assetRowRefreshingId === asset.id }" />
                  </UiButton>
                  <UiButton variant="secondary" @click="copyToClipboardWithToast(asset.ownerAddress)"
                    :title="t('Copy chain address')"
                    :aria-label="t('Copy chain address')" class="disabled-opacity-60-not-allowed-no-transform hover-border-accent hover-color-accent bg-card-disabled-hover">
                    <Copy :size="14" />
                  </UiButton>
                  <UiButton variant="secondary" @click="openAssetSendModal(asset)"
                    :disabled="!asset.sendEnabled">
                    <Send :size="16" />
                    <span>{{ asset.sendButtonLabel }}</span>
                  </UiButton>
                  <UiButton variant="secondary" @click="openAssetTransferModal(asset)"
                    :disabled="!asset.transferTargets.length || !asset.transferEnabled">
                    <ArrowLeftRight :size="16" />
                    <span>{{ asset.transferButtonLabel }}</span>
                  </UiButton>
                </div>
              </div>
            </div>
          </div>
          <UiEmptyState v-else class="mt-32px" :title="t('No assets yet')" :description="t('No balances were found on Lumen or the linked IBC chains.')">
            <Coins :size="32" />
          </UiEmptyState>
        </div>
      </div>

      <!-- ####### lumen://wallet DEX VIEW ####### -->
      <div v-else-if="currentView === 'dex'" class="flex flex-column gap-24px w-full max-w-full">
        <UiBanner v-if="dexError" variant="warning" class="mb-16px">
          <span>{{ dexError }}</span>
        </UiBanner>

        <div class="flex flex-column gap-16px">
          <div
            v-for="dex in dexRows"
            :key="dex.key"
            class="border-1 border-radius-16px bg-card overflow-hidden"
            :style="dexItemStyle(dex.status)"
          >
            <div class="flex-justify-space-between gap-16px py-16px px-20px flex-align-stretch flex-wrap-wrap">
              <button
                type="button"
                class="color-inherit flex-align-start gap-12px flex-1 p-0px text-left cursor-pointer min-w-220px border-none bg-transparent"
                @click="toggleDexExpanded(dex.key)"
              >
                <div class="flex-align-justify-center color-primary txt-weight-medium border-radius-16px border-1 bg-secondary overflow-hidden flex-shrink-0 text-15px w-48px h-48px" :class="{ 'bg-slate-900 border-color-slate-900-a65': dex.logoTheme === 'dark', 'bg-navy-950 border-color-navy-950-a65': dex.logoTheme === 'navy' }">
                  <img
                    v-if="dex.logoUrl"
                    :src="dex.logoUrl"
                    :alt="t('{name} logo', { name: dex.name })"
                    class="h-74pct block bg-transparent w-74pct object-fit-contain object-position-center"
                    @error="handleDexLogoError(dex)"
                  />
                  <span v-else>{{ dex.iconText }}</span>
                </div>

                <div class="flex flex-column min-w-0 gap-4px">
                  <div class="flex-align-center flex-wrap-wrap gap-8px">
                    <span class="txt-weight-light color-text-primary text-16px">{{ t(dex.name) }}</span>
                    <UiTag>{{ t(dex.chainLabel) }}</UiTag>
                    <span class="flex-inline-align-center border-radius-full txt-weight-medium text-12px py-4px px-8px" :class="getDexStatusBadgeClass(dex.status)">
                      {{ getDexStatusLabel(dex.status) }}
                    </span>
                  </div>

                  <span v-if="dex.error" class="color-error text-13px">{{ dex.error }}</span>
                </div>
              </button>

              <div class="flex-align-end flex-column flex-justify-space-between gap-12px flex-1">
                <div class="flex-align-center-justify-end flex-wrap-wrap gap-8px">
                  <UiButton variant="secondary" type="button"
                    @click="toggleDexExpanded(dex.key)">
                    <ChevronDown
                      :size="16"
                      class="transition-transform-02"
                      :class="{ 'rotate-180': isDexExpanded(dex.key) }"
                    />
                    <span>{{ isDexExpanded(dex.key) ? t('Hide details') : t('Details') }}</span>
                  </UiButton>
                  <UiButton variant="primary" type="button"
                    @click="openDexTab(dex.openUrl || dex.baseUrl)">
                    <ExternalLink :size="16" />
                    <span>{{ t('Open DEX') }}</span>
                  </UiButton>
                </div>
              </div>
            </div>

            <div v-if="isDexExpanded(dex.key)" class="bg-secondary border-top-1-light pt-16px pr-20px pb-20px pl-20px">
              <div class="gap-12px flex flex-wrap-wrap">
                <div class="flex flex-column gap-6px min-w-0 border-radius-14px border-1 bg-card py-12px px-16px flex-1-1-140px">
                  <span class="txt-weight-medium color-text-tertiary text-uppercase text-12px letter-spacing-004em">{{ t('Trading pairs') }}</span>
                  <span class="txt-weight-medium color-text-primary text-15px truncate">{{ formatDexCount(dex.tradingPairsCount) }}</span>
                </div>

                <div class="flex flex-column gap-6px min-w-0 border-radius-14px border-1 bg-card py-12px px-16px flex-1-1-140px">
                  <span class="txt-weight-medium color-text-tertiary text-uppercase text-12px letter-spacing-004em">{{ t('Liquidity pools') }}</span>
                  <span class="txt-weight-medium color-text-primary text-15px truncate">{{ formatDexCount(dex.liquidityPoolsCount) }}</span>
                </div>

                <div class="flex flex-column gap-6px min-w-0 border-radius-14px border-1 bg-card py-12px px-16px flex-1-1-140px">
                  <span class="txt-weight-medium color-text-tertiary text-uppercase text-12px letter-spacing-004em">{{ t('24h price') }}</span>
                  <span class="txt-weight-medium color-text-primary text-15px truncate">{{ getDexPriceLabel(dex) }}</span>
                </div>

                <div class="flex flex-column gap-6px min-w-0 border-radius-14px border-1 bg-card py-12px px-16px flex-1-1-140px">
                  <span class="txt-weight-medium color-text-tertiary text-uppercase text-12px letter-spacing-004em">{{ t('24h volume') }}</span>
                  <span class="txt-weight-medium color-text-primary text-15px truncate">{{ getDexVolumeLabel(dex) }}</span>
                </div>
              </div>

              <div v-if="dex.quickLinks.length" class="flex flex-wrap-wrap mt-16px gap-8px">
                <UiButton variant="secondary" v-for="link in dex.quickLinks"
                  :key="`${dex.key}:${link.label}:${link.url}`"
                  type="button"
                  @click="openDexTab(link.url)">
                  <span>{{ t(link.label) }}</span>
                  <ExternalLink :size="13" />
                </UiButton>
              </div>
            </div>
          </div>
        </div>
      </div>

        <!-- ####### lumen://wallet TRANSACTIONS VIEW ####### -->
        <div v-else-if="currentView === 'transactions'" class="flex flex-column gap-24px w-full max-w-full">

        <UiChartHeader v-if="activities.length > 0" :title="t('Recent transactions')">
          <div class="flex-align-center flex-wrap-wrap gap-12px">
            <div class="flex-align-center gap-8px">
              <select v-model="txFilterStatus" class="hover-border-accent focus-border-primary color-text-primary cursor-pointer py-8px px-12px border-1 border-radius-8px bg-card text-14px transition-all-02 focus-outline-none focus-ring focus-shadow">
                <option value="all">{{ t('All statuses') }}</option>
                <option value="success">{{ t('Success') }}</option>
                <option value="failed">{{ t('Failed') }}</option>
              </select>
              <input
                v-model="txSearchQuery"
                type="text"
                :placeholder="t('Search by hash…')"
                class="hover-border-accent focus-border-primary color-text-primary py-8px px-12px border-1 border-radius-8px bg-card text-14px transition-all-02 focus-outline-none focus-ring focus-shadow min-w-200px placeholder-tertiary"
              />
            </div>
            <UiButton variant="secondary" @click="exportTransactions">
              <Download :size="16" />
              <span>{{ t('Export CSV') }}</span>
            </UiButton>
          </div>
        </UiChartHeader>

        <UiEmptyState v-if="!isConnected || !address" class="mt-32px" :title="t('No wallet connected')" :description="t('Connect a wallet to see your recent transactions.')">
          <ArrowLeftRight :size="32" />
        </UiEmptyState>

        <UiEmptyState v-else-if="activitiesLoading" class="mt-32px" :title="t('Loading transactions…')" :description="t('Please wait while we fetch your recent activity from the indexer.')">
          <ArrowLeftRight :size="32" />
        </UiEmptyState>

        <UiEmptyState v-else-if="activitiesError" class="mt-32px" :title="t('Failed to load transactions.')">
          <ArrowLeftRight :size="32" />
          <template #description>
            <p class="m-0px max-w-520px text-14px line-height-15">{{ activitiesError }}</p>
            <UiBanner variant="warning" class="mt-16px max-w-500px">
              <span>
                {{ t('💡 If transaction indexing is disabled on the node, transactions cannot be queried via API. Your balance is still accurate and transactions are recorded on-chain.') }}
              </span>
            </UiBanner>
          </template>
        </UiEmptyState>

        <UiEmptyState v-else-if="!activities.length" class="mt-32px" :title="t('No recent transactions')">
          <ArrowLeftRight :size="32" />
          <template #description>
            <p class="m-0px max-w-520px text-14px line-height-15">{{ t('Transaction history is not available because indexing is disabled on all RPC nodes.') }}</p>
            <UiBanner variant="warning" class="mt-16px max-w-600px">
              <div class="mb-12px">
                <strong>{{ t('💡 Why can\'t I see my transactions?') }}</strong>
              </div>
              <div class="mb-8px">
                {{ t('All Lumen Network RPC nodes currently have transaction indexing disabled. This means:') }}
              </div>
              <ul class="text-left mt-8px mb-12px ml-24px list-style-disc pl-24px">
                <li class="m-0px mt-4px mb-4px">{{ t('Your balance is still accurate and updated') }}</li>
                <li class="m-0px mt-4px mb-4px">{{ t('All transactions are recorded on-chain') }}</li>
                <li class="m-0px mt-4px mb-4px">{{ t('Transaction history cannot be queried via API') }}</li>
              </ul>
              <div class="mt-12px">
                <strong>{{ t('Alternative:') }}</strong> {{ t('Use a block explorer to view your transaction history:') }}
                <br>
                <a
                  :href="`https://explorer.lumen.network/account/${address}`"
                  target="_blank"
                  class="mt-4px inline-block color-primary underline"
                >
                  {{ t('View on Lumen Explorer →') }}
                </a>
              </div>
            </UiBanner>
          </template>
        </UiEmptyState>

        <div v-else class="flex flex-column border-radius-12px w-full border-1 overflow-hidden bg-card">
          <div class="grid-cols-170-1fr-12fr-12fr-15fr-100-120 gap-16px text-12px txt-weight-medium color-text-secondary text-uppercase w-full grid bg-secondary letter-spacing-005em py-12px px-20px border-bottom-2-color">
            <div class="min-w-0">{{ t('Type') }}</div>
            <div class="min-w-0">{{ t('Amount') }}</div>
            <div class="flex-align-center gap-8px min-w-0">{{ t('From') }}</div>
            <div class="flex-align-center gap-8px min-w-0">{{ t('To') }}</div>
            <div class="flex-align-center gap-8px min-w-0">{{ t('Hash') }}</div>
            <div class="min-w-0">{{ t('Status') }}</div>
            <div class="min-w-0">{{ t('Time') }}</div>
          </div>

          <div
            v-for="tx in enhancedActivities"
            :key="tx.id"
            class="grid-cols-170-1fr-12fr-12fr-15fr-100-120 hover-pl-calc-125rem-3px last-border-bottom-none gap-16px grid py-16px px-20px flex-inline-align-center transition-all-02 border-bottom-1-light hover-bg-hover border-left-3-accent-primary-hover"
          >
            <div class="min-w-0">
              <div class="inline-flex text-12px txt-weight-light flex-align-start gap-6px border-radius-6px nowrap py-8px px-10px" :style="activityBadgeStyle(tx)">
                <component :is="describeActivity(tx).icon" :size="14" />
                <div class="flex flex-column gap-2px min-w-0 line-height-12">
                  <span>{{ t(describeActivity(tx).label) }}</span>
                  <span
                    v-if="describeActivity(tx).carriesDomainName && tx.dnsName"
                    class="fw-500 color-text-tertiary text-11px truncate max-w-140px"
                    :title="tx.dnsName"
                  >{{ tx.dnsName }}</span>
                </div>
              </div>
            </div>

            <div class="min-w-0">
              <span class="txt-weight-medium text-14px mono" :style="tx.type === 'send' ? { color: 'var(--color-error)' } : tx.type === 'receive' ? { color: 'var(--color-success)' } : {}">
                <template v-if="tx.amounts && tx.amounts.length && tx.amounts[0].amount">
                  {{ tx.type === 'send' ? '-' : '+' }}{{ (Number(tx.amounts[0].amount) / 1_000_000).toFixed(6).replace(/\.?0+$/, '') }} {{ formatDenom(tx.amounts[0].denom) }}
                </template>
                <template v-else>
                  <span class="color-text-tertiary italic">N/A</span>
                </template>
              </span>
            </div>

            <div class="flex-align-center gap-8px min-w-0">
              <span class="mono text-13px color-text-secondary flex-0-1-auto min-w-0 block max-w-full truncate" :title="tx.from || '-'">
                <template v-if="tx.from && tx.from.length > 10">
                  {{ tx.from.slice(0, 10) }}…{{ tx.from.slice(-8) }}
                </template>
                <template v-else-if="tx.from">
                  {{ tx.from }}
                </template>
                <template v-else>
                  <span class="color-text-tertiary italic">-</span>
                </template>
              </span>
              <UiButton variant="icon" icon-radius-class="border-radius-10px" v-if="tx.from"
                @click.stop="copyToClipboardWithToast(tx.from)"
                :title="t('Copy address')"
                :aria-label="t('Copy from address')" class="disabled-opacity-60-not-allowed-no-transform hover-border-accent hover-color-accent bg-card-disabled-hover">
                <Copy :size="14" />
              </UiButton>
            </div>

            <div class="flex-align-center gap-8px min-w-0">
              <span class="mono text-13px color-text-secondary flex-0-1-auto min-w-0 block max-w-full truncate" :title="tx.to || '-'">
                <template v-if="tx.to && tx.to.length > 10">
                  {{ tx.to.slice(0, 10) }}…{{ tx.to.slice(-8) }}
                </template>
                <template v-else-if="tx.to">
                  {{ tx.to }}
                </template>
                <template v-else>
                  <span class="color-text-tertiary italic">-</span>
                </template>
              </span>
              <UiButton variant="icon" icon-radius-class="border-radius-10px" v-if="tx.to"
                @click.stop="copyToClipboardWithToast(tx.to)"
                :title="t('Copy address')"
                :aria-label="t('Copy to address')" class="disabled-opacity-60-not-allowed-no-transform hover-border-accent hover-color-accent bg-card-disabled-hover">
                <Copy :size="14" />
              </UiButton>
            </div>

            <div class="flex-align-center gap-8px min-w-0">
              <span class="color-text-secondary text-13px mono" :title="tx.txhash">
                {{ tx.txhash.slice(0, 8) }}…{{ tx.txhash.slice(-6) }}
              </span>
              <UiButton variant="icon" icon-radius-class="border-radius-10px" @click.stop="openTransactionTab(tx.txhash)"
                :title="t('Open in explorer')"
                :aria-label="t('Open transaction in new tab')" class="disabled-opacity-60-not-allowed-no-transform bg-card-disabled-hover">
                <ExternalLink :size="14" />
              </UiButton>
              <UiButton variant="icon" icon-radius-class="border-radius-10px" @click.stop="copyToClipboardWithToast(tx.txhash)" :title="t('Copy hash')" class="disabled-opacity-60-not-allowed-no-transform hover-border-accent hover-color-accent bg-card-disabled-hover">
                <Copy :size="14" />
              </UiButton>
            </div>

            <div class="min-w-0">
              <TxStatusPill :success="tx.code === undefined || tx.code === 0" />
            </div>

            <div class="min-w-0">
              <span class="flex flex-column color-text-primary fw-500 text-13px gap-2px">
                {{ new Date(tx.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }}
                <span class="text-12px color-text-tertiary txt-weight-normal">{{ new Date(tx.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- ####### lumen://wallet ADDRESS BOOK PANEL ####### -->
      <AddressBookPanel
        v-else-if="currentView === 'addressbook'"
        :contacts="contacts"
        :loading="contactsLoading"
        @add="openAddContactModal"
        @send="sendToContact"
        @edit="editContact"
        @delete="deleteContact"
      />

      <!-- ####### lumen://wallet RECURRING PAYMENTS PANEL ####### -->
      <div v-else-if="currentView === 'recurring'" class="flex flex-column gap-24px w-full p-0px gap-0px max-w-full">
        <SubscriptionsPanel 
          ref="subscriptionsRef"
          @execute-payment="executeRecurringPayment"
          @toast="showToast"
        />
      </div>

    </main>

    <!-- ####### lumen://wallet ASSET TRANSFER MODAL ####### -->
    <AssetTransferDialog :model-value="showAssetTransferModal" :context="assetTransferContext" :form="assetTransferForm" :selected-target="selectedAssetTransferTarget" :can-submit="canSubmitAssetTransfer" :validate-amount-input="validateAssetTransferAmountInput" :sending="assetTransferSending" @update:model-value="closeAssetTransferModal" @submit="confirmAssetTransfer" />

    <!-- ####### lumen://wallet SEND MODAL ####### -->
    <SendTokensDialog :model-value="showSendModal" :title="sendModalTitle" :form="sendForm" :ibc-form="ibcForm" v-model:target-mode="sendTargetMode" :is-ibc-send="isIbcSend" :asset-context="sendAssetContext" :asset-name="sendAssetName" :asset-symbol="sendAssetSymbol" :source-address="sendSourceAddress" :source-chain-label="sendSourceChainLabel" :contacts="contacts" :ibc-channels="ibcChannels" :ibc-channels-loading="ibcChannelsLoading" :ibc-channels-error="ibcChannelsError" :selected-ibc-channel="selectedIbcChannel" :summary="sendSummary" :can-send="canSend" :source-prefix="sendSourcePrefix" :recipient-placeholder="sendRecipientPlaceholder" :available-label="sendAvailableLabel" :primary-action-label="sendPrimaryActionLabel" :show-tax-breakdown="showSendTaxBreakdown" :show-first-transaction-notice="showFirstTransactionNotice" v-model:show-contact-picker="showContactPicker" :sending="sendingTransaction" @update:model-value="closeSendModal" @submit="confirmSend" @scan-qr="openQrScanner" @select-contact="selectContactForSend" />

    <!-- ####### lumen://wallet RECEIVE MODAL ####### -->
    <ReceiveDialog :model-value="showReceiveModal" :address="address" :qr-data-url="qrCodeDataUrl" @update:model-value="closeReceiveModal" @copy="copyAddressWithToast" />

    <!-- ####### lumen://wallet ADD/EDIT CONTACT MODAL ####### -->
    <ContactEditorDialog :model-value="showContactModal" :editing="!!editingContact" :form="contactForm" :saving="savingContact" @update:model-value="closeContactModal" @submit="saveContact" />

    <!-- ####### lumen://wallet QR SCANNER MODAL ####### -->
    <QrScanner
      v-if="showQrScanner" 
      @close="closeQrScanner"
      @scan="handleQrScan"
      :title="qrScannerTitle"
    />

    <!-- ####### lumen://wallet DELETE CONFIRMATION MODAL ####### -->
    <ConfirmDialog
      v-model="showDeleteConfirmModal"
      :title="t('Delete contact')"
      panel-class=""
      @update:model-value="cancelDeleteContact"
      @confirm="confirmDeleteContact"
    >
      <p class="color-text-primary text-15px mb-8px line-height-15">
        {{ t('Are you sure you want to delete “{name}”?', { name: contactToDelete?.name || '' }) }}
      </p>
      <p class="color-text-tertiary text-14px">
        {{ t('This action cannot be undone.') }}
      </p>
      <template #confirm>
        <Trash2 :size="18" />
        <span>{{ t('Delete') }}</span>
      </template>
    </ConfirmDialog>
  </div>
</template>

<script setup lang="ts">
import { markForTranslation } from '../services/i18n';
import { t } from '../../stores/i18nStore';
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import ConfirmDialog from '../../dialogs/ConfirmDialog.vue';
import ContactEditorDialog from '../../dialogs/ContactEditorDialog.vue';
import ReceiveDialog from '../../dialogs/ReceiveDialog.vue';
import SendTokensDialog from '../../dialogs/SendTokensDialog.vue';
import AssetTransferDialog from '../../dialogs/AssetTransferDialog.vue';
import UiButton from '../../ui/UiButton.vue';
import TxStatusPill from '../../entities/TxStatusPill.vue';
import UiPageHeader from '../../ui/UiPageHeader.vue';
import UiEmptyState from '../../ui/UiEmptyState.vue';
import UiTag from '../../ui/UiTag.vue';
import UiSidebarNavSection from '../../ui/UiSidebarNavSection.vue';
import UiSidebarNavItem from '../../ui/UiSidebarNavItem.vue';
import UiChartHeader from '../../ui/UiChartHeader.vue';
import UiBanner from '../../ui/UiBanner.vue';
import { buildAbsoluteUrl, fetchAbsoluteJson, trimTrailingSlash } from '../services/httpJson';
import { fetchIbcTransferChannels } from '../services/ibcChannels';
import { activityBadgeStyle, describeActivity } from '../services/chainMessages';
import {
  clearDenomTraceCache,
  clearChainRegistryCache,
  resolveChainRegistryIconUrl,
  resolveDenomTrace,
} from '../services/chainRegistry';
import {
  estimateRemoteFeeAmount,
  getAddressPrefix,
  humanizeChainId,
  pickIbcChannel,
  reencodeAddressPrefix,
  resolveKnownChainMeta,
} from '../services/ibcChains';
import { useInternalLumen } from '../../composables/useInternalLumen';
import { copyToClipboardWithToast } from '../../composables/useClipboard';
import { explorerTransactionUrl } from '../services/explorerLinks';

const { currentTabRefresh } = useTabState();
import {
  Wallet,
  LayoutDashboard,
  Coins,
  ArrowLeftRight,
  Link,
  Send,
  Eye,
  EyeOff,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  CreditCard,
  Plus,
  Copy,
  ExternalLink,
  ChevronDown,
  AlertCircle,
  Users,
  Trash2,
  Download,
  Calendar,
  RefreshCw
} from 'lucide-vue-next';
import { profilesState, activeProfileId } from '../../stores/profilesStore';
import { fetchActivities, type Activity, type ActivityType, clearActivitiesCache } from '../services/activities';
import QRCode from 'qrcode';
import InternalSidebar from '../../components/InternalSidebar.vue';
import QrScanner from '../../dialogs/QrScanner.vue';
import SubscriptionsPanel from '../../panels/SubscriptionsPanel.vue';
import AddressBookPanel from '../../panels/AddressBookPanel.vue';
import osmosisLogoUrl from '../../img/osmosis.svg';
import { payReminder } from '../services/paymentReminders';
import { formatDenom as formatDenomValue, truncateMiddle } from '../services/format';
import { downloadTextFile } from '../services/download';
import { useToast } from '../../composables/useToast';
import type {
  SendTargetMode,
  IbcChannelOption,
  KnownIbcChainMeta,
  AssetTransferTarget,
  AssetRow,
  DexQuickLink,
  DexMarketPreview,
  DexListingConfig,
  DexStatus,
  DexRow
, ContactForm, SendForm, IbcForm, AssetTransferForm } from '../../types/walletPage';

import { errorMessage } from '../services/coerce';
import { useTabNavigation, useTabState } from '../../composables/useTabNavigation';
const { openInNewTab } = useTabNavigation();
const currentView = ref<'overview' | 'assets' | 'dex' | 'transactions' | 'addressbook' | 'recurring'>('overview');
const isConnected = ref(false);
const showBalance = ref(true);
const manualDisconnected = ref(false);

const profiles = profilesState;
const activeProfile = computed(() => profiles.value.find((p) => p.id === activeProfileId.value) || null);

const address = computed(() => {
  const p: any = activeProfile.value as any;
  return (p && (p.address || p.walletAddress)) || '';
});

const balanceLmn = ref<number | null>(null);
const balanceLoading = ref(false);
const balanceError = ref('');

const showSendModal = ref(false);

/**
 * The first transaction from a wallet with no Dilithium key on this device has
 * to create one and link it on chain, which is the up-to-a-minute wait the send
 * dialog warns about. Anyone whose key already exists locally has been through
 * that once and does not need telling again.
 */
const showFirstTransactionNotice = ref(true);

watch([showSendModal, address], async ([open, addr]) => {
  if (!open) return;
  const pqcApi = useInternalLumen()?.pqc;
  if (typeof pqcApi?.hasLocalKey !== 'function') {
    showFirstTransactionNotice.value = true;
    return;
  }
  const res = await pqcApi
    .hasLocalKey({ profileId: activeProfileId.value, address: addr })
    .catch(() => null);
  showFirstTransactionNotice.value = !res?.hasLocalKey;
});

const showReceiveModal = ref(false);
const sendingTransaction = ref(false);
const qrCodeDataUrl = ref<string>('');

// Generate QR Code when address changes
watch([address, showReceiveModal], async ([newAddress, isModalOpen]) => {
  if (isModalOpen && newAddress) {
    try {
      qrCodeDataUrl.value = await QRCode.toDataURL(newAddress, {
        width: 240,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#f8fafc'
        }
      });
    } catch (err) {
      console.error('Failed to generate QR code:', err);
      qrCodeDataUrl.value = '';
    }
  }
});

// Address Book
const contacts = ref<any[]>([]);
const contactsLoading = ref(false);
const showContactModal = ref(false);
const showDeleteConfirmModal = ref(false);
const contactToDelete = ref<any>(null);
const showContactPicker = ref(false);
const editingContact = ref<any>(null);
const savingContact = ref(false);
const contactForm = ref<ContactForm>({
  name: '',
  address: '',
  note: ''
});

const activities = ref<Activity[]>([]);
const activitiesLoading = ref(false);
const activitiesError = ref('');
const txMetaByHash = ref<
  Record<string, { action?: string; dnsName?: string; overrideFrom?: string; overrideTo?: string }>
>({});

// Transaction Filters
const txFilterStatus = ref<'all' | 'success' | 'pending' | 'failed'>('all');
const txSearchQuery = ref('');

// A table built once per mount, so `t()` here would hold whichever language was
// active when the wallet first opened. The quick-link labels are also replaced
// by whatever the DEX itself advertises once the snapshot loads - `t()` at the
// draw site passes those through untouched, since they are not keys.
const DEX_LISTINGS: DexListingConfig[] = [
  {
    key: 'beezee',
    name: markForTranslation('BeeZee DEX'),
    chainId: 'beezee-1',
    chainLabel: markForTranslation('BeeZee'),
    restEndpoint: 'https://rest.getbze.com',
    baseUrl: 'https://dex.getbze.com/',
    openUrl: 'https://dex.getbze.com/',
    logoUrl: 'https://dex.getbze.com/images/beezee_light.svg',
    logoTheme: 'dark',
    iconText: 'BZE',
    description: markForTranslation('Browse mainnet markets and pools before jumping into the BeeZee DEX.'),
    fallbackLinks: [
      { label: markForTranslation('Swap'), url: 'https://dex.getbze.com/' },
      { label: markForTranslation('Exchange'), url: 'https://dex.getbze.com/exchange' },
      { label: markForTranslation('Pools'), url: 'https://dex.getbze.com/pools' },
      { label: markForTranslation('Staking'), url: 'https://staking.getbze.com/' },
      { label: markForTranslation('Website'), url: 'https://getbze.com/' }
    ]
  },
  {
    key: 'osmosis',
    name: markForTranslation('Osmosis'),
    chainId: 'osmosis-1',
    chainLabel: markForTranslation('Osmosis'),
    // No REST endpoint: the chain overview below reads BeeZee's tradebin
    // module, which Osmosis does not have. It lists as a link, with its own
    // page supplying the title and description.
    restEndpoint: '',
    baseUrl: 'https://app.osmosis.zone/',
    openUrl: 'https://app.osmosis.zone/assets/ibc/88DBE57372690630D2DD9779C247479CE124E777C5D695FA90699F3140CEC59F',
    // Bundled rather than hotlinked, unlike BeeZee's above: this one is drawn
    // on a page that is reachable offline, and a DEX tile that loses its logo
    // the moment the network drops looks broken rather than offline.
    logoUrl: osmosisLogoUrl,
    logoTheme: 'navy',
    iconText: 'OSMO',
    description: markForTranslation('Trade LMN against the wider Cosmos market, and look at its pools.'),
    probePaths: ['/', '/pools'],
    fallbackLinks: [
      {
        label: markForTranslation('LMN on Osmosis'),
        url: 'https://app.osmosis.zone/assets/ibc/88DBE57372690630D2DD9779C247479CE124E777C5D695FA90699F3140CEC59F'
      },
      { label: markForTranslation('Swap'), url: 'https://app.osmosis.zone/' },
      { label: markForTranslation('Pools'), url: 'https://app.osmosis.zone/pools' },
      { label: markForTranslation('Website'), url: 'https://osmosis.zone/' }
    ]
  }
];

const sendForm = ref<SendForm>({
  recipient: '',
  amount: '',
  gasFee: 'medium'
});
const sendAssetContext = ref<AssetRow | null>(null);
const sendTargetMode = ref<SendTargetMode>('lumen');
const ibcForm = ref<IbcForm>({
  sourceChannel: '',
  sourcePort: 'transfer'
});
const ibcChannels = ref<IbcChannelOption[]>([]);
const ibcChannelsLoading = ref(false);
const ibcChannelsLoaded = ref(false);
const ibcChannelsError = ref('');
const assetRows = ref<AssetRow[]>([]);
const assetsLoading = ref(false);
const assetsError = ref('');
let assetRefreshRequestId = 0;
const assetRowRefreshingId = ref('');
let assetPollingTimer: number | null = null;
const ASSET_POLL_INTERVAL_MS = 15_000;
const currentNetworkChainId = ref('');
const showAssetTransferModal = ref(false);
const assetTransferSending = ref(false);
const assetTransferContext = ref<AssetRow | null>(null);
const assetTransferForm = ref<AssetTransferForm>({
  destinationKey: '',
  recipient: '',
  amount: ''
});
const dexRows = ref<DexRow[]>(
  DEX_LISTINGS.map((config) => ({
    ...config,
    status: 'idle',
    siteTitle: config.name,
    tradingPairsCount: null,
    liquidityPoolsCount: null,
    featuredMarketPair: '',
    featuredPoolPair: '',
    quickLinks: config.fallbackLinks.slice(),
    marketPreview: null,
    error: '',
    lastCheckedAt: ''
  }))
);
const dexLoading = ref(false);
const dexError = ref('');
const dexExpandedKeys = ref<string[]>([]);
const dexLastLoadedAt = ref(0);
const DEX_REFRESH_TTL_MS = 60_000;

const showQrScanner = ref(false);
const qrScannerTitle = ref(t('Scan QR code'));

// Recurring Payments
const subscriptionsRef = ref<any>(null);
const pendingPostTxRefreshTimers = ref<number[]>([]);

const tokenomicsTaxRate = ref<number | null>(null); // 0.01 = 1%

// Use global toast system
const toast = useToast();

onMounted(() => {
  loadContacts();
});

onBeforeUnmount(() => {
  if (assetPollingTimer !== null) {
    window.clearInterval(assetPollingTimer);
    assetPollingTimer = null;
  }
  clearPendingPostTransactionRefreshes();
});

const balanceLabel = computed(() => {
  if (!isConnected.value) return t('Not connected');
  if (balanceLoading.value) return t('Loading…');
  if (balanceError.value) return t('Error');
  if (balanceLmn.value == null) return '0.000000 LMN';
  return `${balanceLmn.value.toFixed(6)} LMN`;
});

const balanceLmnDisplay = computed(() => {
  if (balanceLmn.value == null) return '0.000000';
  return balanceLmn.value.toFixed(6);
});

function guessSendTargetMode(value: string): SendTargetMode | null {
  const prefix = getAddressPrefix(value);
  if (!prefix) return null;
  return prefix === senderPrefix.value ? 'lumen' : 'ibc';
}

const senderPrefix = computed(() => getAddressPrefix(address.value) || 'lmn');
const isIbcSend = computed(() => sendTargetMode.value === 'ibc');
const sendSourceAddress = computed(() => String(sendAssetContext.value?.ownerAddress || address.value || '').trim());
const sendSourcePrefix = computed(() => getAddressPrefix(sendSourceAddress.value) || senderPrefix.value || 'lmn');
const sendAssetDenom = computed(() => String(sendAssetContext.value?.denom || 'ulmn').trim() || 'ulmn');
const sendAssetName = computed(() => sendAssetContext.value?.displayName || 'Lumen');
const sendAssetSymbol = computed(() => sendAssetContext.value?.displaySymbol || 'LMN');
const sendSourceChainLabel = computed(() => {
  if (sendAssetContext.value?.chainLabel) return sendAssetContext.value.chainLabel;
  return currentNetworkChainId.value ? humanizeChainId(currentNetworkChainId.value) : 'Lumen';
});
const sendAvailableMicro = computed<bigint | null>(() => {
  if (sendAssetContext.value) return BigInt(sendAssetContext.value.microAmount || '0');
  if (balanceLmn.value == null) return null;
  return decimalToMicroUnits(balanceLmn.value.toFixed(6));
});
const sendAvailableLabel = computed(() => {
  if (sendAssetContext.value) return sendAssetContext.value.displayAmount;
  if (balanceLmn.value == null) return '';
  return balanceLmnDisplay.value;
});
const showSendTaxBreakdown = computed(
  () =>
    !isIbcSend.value &&
    sendAssetDenom.value.toLowerCase() === 'ulmn' &&
    sendSourcePrefix.value === 'lmn'
);
const selectedIbcChannel = computed(() =>
  ibcChannels.value.find(
    (channel) =>
      channel.channelId === ibcForm.value.sourceChannel &&
      channel.portId === ibcForm.value.sourcePort
  ) || null
);
const sendModalTitle = computed(() => {
  if (isIbcSend.value) return t('Transfer {symbol} to other chain', { symbol: sendAssetSymbol.value });
  return sendAssetContext.value
    ? t('Send {symbol} on {chain}', { symbol: sendAssetSymbol.value, chain: sendSourceChainLabel.value })
    : t('Send');
});
const sendRecipientPlaceholder = computed(() =>
  isIbcSend.value
    ? t('Enter recipient address on the other chain')
    : t('Enter recipient address ({prefix}1…)', { prefix: sendSourcePrefix.value })
);
// Not "Preview": this button signs and broadcasts. There is no preview step and
// never was, so the label was a promise of a confirmation that does not exist.
const sendPrimaryActionLabel = computed(() => {
  if (sendingTransaction.value) return isIbcSend.value ? t('Transferring…') : t('Sending…');
  return isIbcSend.value ? t('IBC transfer') : t('Send');
});

function autoSelectIbcChannel(force = false) {
  const channels = ibcChannels.value;
  if (!channels.length) {
    ibcForm.value.sourceChannel = '';
    return;
  }

  if (!force && selectedIbcChannel.value) return;

  const next = pickIbcChannel(channels, getAddressPrefix(sendForm.value.recipient));
  if (!next) return;
  ibcForm.value.sourceChannel = next.channelId;
  ibcForm.value.sourcePort = next.portId;
}

async function loadIbcChannels(force = false) {
  if (ibcChannelsLoading.value) return;
  if (ibcChannelsLoaded.value && !force) {
    autoSelectIbcChannel();
    return;
  }

  ibcChannelsLoading.value = true;
  ibcChannelsError.value = '';

  try {
    ibcChannels.value = await fetchIbcTransferChannels();
    ibcChannelsLoaded.value = true;

    if (!ibcChannels.value.length) {
      ibcChannelsError.value = t('No open IBC transfer channels found on this network.');
      ibcForm.value.sourceChannel = '';
      return;
    }

    autoSelectIbcChannel(true);
  } catch (error) {
    ibcChannels.value = [];
    ibcChannelsLoaded.value = false;
    ibcForm.value.sourceChannel = '';
    ibcChannelsError.value = errorMessage(error, t('Failed to load IBC channels.'));
  } finally {
    ibcChannelsLoading.value = false;
  }
}

const enhancedActivities = computed(() => {
  const userAddr = address.value?.toLowerCase();
  if (!userAddr) return activities.value;
  
  let filtered = activities.value.map(tx => {
    const meta = tx.txhash ? txMetaByHash.value[tx.txhash] : undefined;
    // Use from/to from backend data
    const fromAddr = (meta?.overrideFrom || tx.from || tx.sender || '').trim();
    const toAddr = (meta?.overrideTo || tx.to || tx.recipient || '').trim();
    
    const from = fromAddr?.toLowerCase();
    const to = toAddr?.toLowerCase();
    
    // Determine type based on user address
    let actualType: ActivityType = tx.type || 'unknown';
    
    // Override type based on actual from/to addresses
    if (from && to) {
      if (from === userAddr && to !== userAddr) {
        actualType = 'send';
      } else if (to === userAddr && from !== userAddr) {
        actualType = 'receive';
      } else if (from === userAddr && to === userAddr) {
        // Self-transfer
        actualType = 'send';
      }
    } else if (from === userAddr) {
      actualType = 'send';
    } else if (to === userAddr) {
      actualType = 'receive';
    }
    
    return {
      ...tx,
      ...(meta || {}),
      type: actualType,
      from: fromAddr || undefined,
      to: toAddr || undefined
    };
  });

  // Apply status filter
  if (txFilterStatus.value !== 'all') {
    filtered = filtered.filter(tx => {
      const isSuccess = tx.code === undefined || tx.code === 0;
      if (txFilterStatus.value === 'success') return isSuccess;
      if (txFilterStatus.value === 'failed') return !isSuccess;
      return true;
    });
  }

  // Apply search query (hash only)
  if (txSearchQuery.value.trim()) {
    const query = txSearchQuery.value.toLowerCase().trim();
    filtered = filtered.filter(tx => {
      const hash = (tx.txhash || '').toLowerCase();
      return hash.includes(query);
    });
  }

  return filtered;
});

function findEventAttr(events: any, type: string, key: string): string {
  const list: any[] = Array.isArray(events) ? events : [];
  const typeLower = String(type || '').toLowerCase();
  const keyLower = String(key || '').toLowerCase();

  for (const ev of list) {
    const evType = String(ev && ev.type ? ev.type : '').toLowerCase();
    if (!evType || evType !== typeLower) continue;

    const attrs: any[] = Array.isArray(ev && ev.attributes ? ev.attributes : []) ? ev.attributes : [];
    for (const a of attrs) {
      const k = String(a && a.key ? a.key : '').toLowerCase();
      if (k !== keyLower) continue;
      const v = a && a.value != null ? String(a.value) : '';
      if (v) return v;
    }
  }
  return '';
}

async function hydrateTxMeta(list: Activity[]) {
  try {
    const net = useInternalLumen()?.net;
    if (!net || typeof net.restGet !== 'function') return;

    const candidates = (Array.isArray(list) ? list : []).filter((tx) => {
      const h = String(tx?.txhash || '').trim();
      if (!h) return false;
      if (txMetaByHash.value[h]) return false;

      const action = String(tx.action ?? '').trim();
      const isDnsUpdate =
        action === '/lumen.dns.v1.MsgUpdate' || action === 'lumen.dns.v1.MsgUpdate';
      const isDnsTransfer =
        action === '/lumen.dns.v1.MsgTransfer' || action === 'lumen.dns.v1.MsgTransfer';
      const isDnsRegister =
        action === '/lumen.dns.v1.MsgRegister' || action === 'lumen.dns.v1.MsgRegister';
      const isWithdrawRewards =
        action === '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward' ||
        action === 'cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward';
      const isPublishRelease =
        action === '/lumen.release.v1.MsgPublishRelease' ||
        action === 'lumen.release.v1.MsgPublishRelease';

      if (
        action &&
        !isDnsUpdate &&
        !isDnsTransfer &&
        !isDnsRegister &&
        !isWithdrawRewards &&
        !isPublishRelease
      ) {
        return false;
      }
      if (isDnsUpdate && tx.dnsName) return false;
      if (isDnsTransfer && tx.dnsName && tx.from && tx.to) return false;
      if (isDnsRegister && tx.dnsName && tx.from && tx.to) return false;
      if (
        isWithdrawRewards &&
        tx.dnsName &&
        tx.from &&
        tx.to &&
        String(tx.from).startsWith('lmnvaloper')
      ) {
        return false;
      }
      if (isPublishRelease && tx.dnsName && tx.from) return false;
      return true;
    });

    const queue = candidates.map((tx) => String(tx.txhash).trim());
    if (!queue.length) return;

    const concurrency = 4;
    let idx = 0;

    async function worker() {
      // Re-checked here: the guard above narrows `net` for the enclosing flow,
      // but not inside this hoisted declaration.
      if (!net) return;
      while (idx < queue.length) {
        const hash = queue[idx++];
        try {
          const r = await net.restGet(`/cosmos/tx/v1beta1/txs/${hash}`, { timeout: 15000 });
          if (!r || r.ok === false) continue;
          const txResp = r?.json?.tx_response;
          if (!txResp) continue;

          let action = findEventAttr(txResp.events, 'message', 'action');
          if (!action) {
            action = String(txResp?.tx?.body?.messages?.[0]?.['@type'] || '').trim();
          }

          let dnsName = '';
          let overrideFrom = '';
          let overrideTo = '';

          if (action === '/lumen.dns.v1.MsgUpdate') {
            dnsName = findEventAttr(txResp.events, 'dns_update', 'name');
            if (!dnsName) {
              const msg = txResp?.tx?.body?.messages?.find?.((m: any) => m?.['@type'] === '/lumen.dns.v1.MsgUpdate') || null;
              if (msg?.name) dnsName = String(msg.name);
              else if (msg?.fqdn) dnsName = String(msg.fqdn);
              else if (msg?.domain && msg?.ext) dnsName = `${String(msg.domain)}.${String(msg.ext)}`;
              else if (msg?.domain) dnsName = String(msg.domain);
            }
          } else if (action === '/lumen.dns.v1.MsgTransfer') {
            dnsName = findEventAttr(txResp.events, 'dns_transfer', 'name');
            overrideFrom = findEventAttr(txResp.events, 'dns_transfer', 'from');
            overrideTo = findEventAttr(txResp.events, 'dns_transfer', 'to');

            if (!dnsName || !overrideFrom || !overrideTo) {
              const msg = txResp?.tx?.body?.messages?.find?.((m: any) => m?.['@type'] === '/lumen.dns.v1.MsgTransfer') || null;

              if (!dnsName) {
                if (msg?.name) dnsName = String(msg.name);
                else if (msg?.fqdn) dnsName = String(msg.fqdn);
                else if (msg?.domain && msg?.ext) dnsName = `${String(msg.domain)}.${String(msg.ext)}`;
                else if (msg?.domain) dnsName = String(msg.domain);
              }

              if (!overrideFrom) {
                if (msg?.from) overrideFrom = String(msg.from);
                else if (msg?.creator) overrideFrom = String(msg.creator);
                else if (msg?.sender) overrideFrom = String(msg.sender);
              }

              if (!overrideTo) {
                if (msg?.to) overrideTo = String(msg.to);
                else if (msg?.recipient) overrideTo = String(msg.recipient);
              }
            }
          } else if (action === '/lumen.dns.v1.MsgRegister') {
            dnsName = findEventAttr(txResp.events, 'dns_register', 'name');
            overrideFrom = findEventAttr(txResp.events, 'dns_register', 'created_by');
            overrideTo = findEventAttr(txResp.events, 'dns_register', 'owner');

            if (!dnsName || !overrideFrom || !overrideTo) {
              const msg =
                txResp?.tx?.body?.messages?.find?.((m: any) => m?.['@type'] === '/lumen.dns.v1.MsgRegister') || null;

              if (!dnsName) {
                if (msg?.name) dnsName = String(msg.name);
                else if (msg?.fqdn) dnsName = String(msg.fqdn);
                else if (msg?.domain && msg?.ext) dnsName = `${String(msg.domain)}.${String(msg.ext)}`;
                else if (msg?.domain) dnsName = String(msg.domain);
              }

              if (!overrideFrom) {
                if (msg?.created_by) overrideFrom = String(msg.created_by);
                else if (msg?.createdBy) overrideFrom = String(msg.createdBy);
                else if (msg?.creator) overrideFrom = String(msg.creator);
                else if (msg?.sender) overrideFrom = String(msg.sender);
              }

              if (!overrideTo) {
                if (msg?.owner) overrideTo = String(msg.owner);
              }
            }
          } else if (action === '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward') {
            dnsName = findEventAttr(txResp.events, 'withdraw_rewards', 'validator');
            overrideFrom = dnsName;
            overrideTo = findEventAttr(txResp.events, 'withdraw_rewards', 'delegator');

            if (!dnsName || !overrideFrom || !overrideTo) {
              const msg =
                txResp?.tx?.body?.messages?.find?.(
                  (m: any) => m?.['@type'] === '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward'
                ) || null;

              if (!dnsName) {
                if (msg?.validator_address) dnsName = String(msg.validator_address);
                else if (msg?.validatorAddress) dnsName = String(msg.validatorAddress);
              }

              if (!overrideFrom) overrideFrom = dnsName;

              if (!overrideTo) {
                if (msg?.delegator_address) overrideTo = String(msg.delegator_address);
                else if (msg?.delegatorAddress) overrideTo = String(msg.delegatorAddress);
              }
            }
          } else if (action === '/lumen.release.v1.MsgPublishRelease') {
            const version = findEventAttr(txResp.events, 'release_publish', 'version');
            const channel = findEventAttr(txResp.events, 'release_publish', 'channel');
            const id = findEventAttr(txResp.events, 'release_publish', 'id');
            const publisher = findEventAttr(txResp.events, 'release_publish', 'publisher');

            let details = '';
            if (version && channel) details = `${version} • ${channel}`;
            else details = version || channel || '';
            if (id) details = details ? `${details} (#${id})` : `#${id}`;

            dnsName = details;
            overrideFrom = publisher;

            if (!dnsName || !overrideFrom) {
              const msg =
                txResp?.tx?.body?.messages?.find?.(
                  (m: any) => m?.['@type'] === '/lumen.release.v1.MsgPublishRelease'
                ) || null;

              if (!overrideFrom) {
                if (msg?.publisher) overrideFrom = String(msg.publisher);
                else if (msg?.sender) overrideFrom = String(msg.sender);
                else if (msg?.creator) overrideFrom = String(msg.creator);
              }

              if (!dnsName) {
                const msgVersion = msg?.version ? String(msg.version) : '';
                const msgChannel = msg?.channel ? String(msg.channel) : '';
                const msgId = msg?.id != null ? String(msg.id) : '';

                let msgDetails = '';
                if (msgVersion && msgChannel) msgDetails = `${msgVersion} • ${msgChannel}`;
                else msgDetails = msgVersion || msgChannel || '';
                if (msgId) msgDetails = msgDetails ? `${msgDetails} (#${msgId})` : `#${msgId}`;

                dnsName = msgDetails;
              }
            }
          }

          if (action || dnsName || overrideFrom || overrideTo) {
            txMetaByHash.value = {
              ...txMetaByHash.value,
              [hash]: {
                action: action || undefined,
                dnsName: dnsName || undefined,
                overrideFrom: overrideFrom || undefined,
                overrideTo: overrideTo || undefined
              }
            };
          }
        } catch {
          // ignore
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()));
  } catch {
    // ignore
  }
}

function getViewTitle(): string {
  const titles: Record<string, string> = {
    overview: t('Wallet overview'),
    assets: t('Assets'),
    dex: t('DEX'),
    transactions: t('Transactions'),
    addressbook: t('Address book'),
    recurring: t('Payment reminders')
  };
  return titles[currentView.value] || 'Wallet';
}

function getViewDescription(): string {
  const descs: Record<string, string> = {
    overview: t('Manage your Lumen address and on-chain balance (read-only).'),
    assets: t('View balances and move assets across linked IBC chains.'),
    dex: t('Inspect linked DEXs, check their current state, and open them in a new tab.'),
    transactions: t('Recent on-chain transactions for this wallet.'),
    addressbook: t('Save frequently used addresses for quick access.'),
    recurring: t('Schedule and manage automatic payments and subscriptions.')
  };
  return descs[currentView.value] || '';
}

async function refreshActivities() {
  activitiesLoading.value = true;
  activitiesError.value = '';
  try {
    if (!address.value) {
      activities.value = [];
      return;
    }
    const list = await fetchActivities({ walletId: address.value, limit: 20, offset: 0 });
    activities.value = list;
    void hydrateTxMeta(list);
  } catch (e) {
    activitiesError.value = errorMessage(e, t('Failed to load activities'));
    activities.value = [];
  } finally {
    activitiesLoading.value = false;
  }
}

function connectWallet() {
  if (!address.value) {
    showToast(t('Select or create a profile first.'), 'error');
    return;
  }
  manualDisconnected.value = false;
  isConnected.value = true;
  void refreshWallet();
  if (currentView.value === 'assets') {
    void refreshAssets({ force: true });
  }
}

watch(
  [address, manualDisconnected],
  ([addr, manual]) => {
    if (!addr || manual) {
      isConnected.value = false;
      balanceLmn.value = null;
      balanceError.value = '';
      activities.value = [];
      assetRows.value = [];
      assetsError.value = '';
      return;
    }
    isConnected.value = true;
    void refreshWallet();
    if (currentView.value === 'transactions') {
      void refreshActivities();
    }
    if (currentView.value === 'assets') {
      void refreshAssets({ force: true });
    }
  },
  { immediate: true }
);

watch(activeProfileId, () => {
  // Switching active profiles should re-enable wallet view for that profile.
  manualDisconnected.value = false;
});

watch(currentView, (next) => {
  if (next === 'dex') {
    void ensureDexListingsLoaded();
    return;
  }
  if (next === 'transactions' && isConnected.value) {
    void refreshActivities();
    return;
  }
  if (next === 'assets' && isConnected.value) {
    void refreshAssets({ force: true });
  }
});

watch(
  [currentView, isConnected],
  ([view, connected]) => {
    if (view === 'assets' && connected) {
      startAssetPolling();
      return;
    }
    stopAssetPolling();
  },
  { immediate: true }
);

// Watch for refresh signal from navbar
watch(
  () => currentTabRefresh?.value,
  () => {
    if (currentView.value === 'dex') {
      void refreshDexListings();
    }
    if (isConnected.value) {
      clearActivitiesCache();
      void refreshWallet();
      if (currentView.value === 'transactions') {
        void refreshActivities();
      }
      if (currentView.value === 'assets') {
        void refreshAssets({ force: true });
      }
    }
  }
);

async function refreshWallet() {
  if (!isConnected.value || !address.value) {
    balanceLmn.value = null;
    balanceError.value = '';
    return;
  }
  balanceLoading.value = true;
  balanceError.value = '';
  try {
    const walletApi = useInternalLumen()?.wallet;
    if (!walletApi || typeof walletApi.getBalance !== 'function') {
      balanceError.value = t('Wallet bridge not available.');
      balanceLmn.value = null;
      return;
    }
    const res = await walletApi.getBalance(address.value, { denom: 'ulmn' });
    if (!res || res.ok === false) {
      balanceError.value = res?.error || t('Failed to load balance.');
      balanceLmn.value = null;
      return;
    }
    const amt = Number(res.balance?.amount ?? '0') || 0;
    balanceLmn.value = amt / 1_000_000;

    try {
      if (typeof walletApi.getTokenomicsParams === 'function') {
        const tRes = await walletApi.getTokenomicsParams();
        if (tRes && tRes.ok !== false) {
          const raw = tRes.data?.params?.tx_tax_rate ?? tRes.data?.params?.txTaxRate;
          const n = Number(raw);
          tokenomicsTaxRate.value = Number.isFinite(n) ? n : null;
        }
      }
    } catch {
    }
  } catch (e) {
    console.error('[wallet] refreshWallet error', e);
    balanceError.value = t('Unexpected error');
    balanceLmn.value = null;
  } finally {
    balanceLoading.value = false;
  }
}

function clearPendingPostTransactionRefreshes() {
  for (const timer of pendingPostTxRefreshTimers.value) {
    window.clearTimeout(timer);
  }
  pendingPostTxRefreshTimers.value = [];
}

function stopAssetPolling() {
  if (assetPollingTimer !== null) {
    window.clearInterval(assetPollingTimer);
    assetPollingTimer = null;
  }
}

function startAssetPolling() {
  if (assetPollingTimer !== null) return;
  assetPollingTimer = window.setInterval(() => {
    if (document.hidden) return;
    if (currentView.value !== 'assets' || !isConnected.value) return;
    if (assetsLoading.value || assetTransferSending.value || sendingTransaction.value) return;
    void refreshAssets({ force: true, silent: true });
  }, ASSET_POLL_INTERVAL_MS);
}

async function runPostTransactionRefresh(options: { includeSubscriptions?: boolean } = {}) {
  await Promise.allSettled([
    refreshWallet(),
    refreshAssets({ force: true }),
    refreshActivities()
  ]);
  if (options.includeSubscriptions && subscriptionsRef.value?.loadData) {
    subscriptionsRef.value.loadData();
  }
}

function schedulePostTransactionRefresh(options: { includeSubscriptions?: boolean } = {}) {
  clearActivitiesCache();
  clearPendingPostTransactionRefreshes();
  void runPostTransactionRefresh(options);

  for (const delay of [1500, 5000, 15000, 30000, 60000, 120000]) {
    const timer = window.setTimeout(() => {
      void runPostTransactionRefresh(options);
    }, delay);
    pendingPostTxRefreshTimers.value.push(timer);
  }
}

function sendTransaction() {
  if (!isConnected.value || !address.value) {
    showToast(t('Connect a wallet first.'), 'error');
    return;
  }
  void refreshActivities();
  sendAssetContext.value = null;
  showContactPicker.value = false;
  sendTargetMode.value = 'lumen';
  ibcForm.value = { sourceChannel: '', sourcePort: 'transfer' };
  sendForm.value = { recipient: '', amount: '', gasFee: 'medium' };
  showSendModal.value = true;
}

function closeSendModal() {
  if (sendingTransaction.value) {
    showToast(t('Transaction in progress. Please wait…'), 'info');
    return;
  }
  showSendModal.value = false;
  showContactPicker.value = false;
  sendAssetContext.value = null;
  sendTargetMode.value = 'lumen';
  ibcForm.value = { sourceChannel: '', sourcePort: 'transfer' };
  sendForm.value = { recipient: '', amount: '', gasFee: 'medium' };
}

function openQrScanner() {
  qrScannerTitle.value = t('Scan wallet address or payment');
  showQrScanner.value = true;
}

function closeQrScanner() {
  showQrScanner.value = false;
}

function handleQrScan(data: { type: string; content: string; raw: string }) {
  closeQrScanner();
  
  const { type, content, raw } = data;
  
  // WalletConnect is not supported: say so rather than pretending to pair.
  if (type === 'walletconnect' || raw.startsWith('wc:')) {
    showToast(t('WalletConnect is not supported yet'), 'warning');
    return;
  }
  
  // Handle payment requests
  if (type === 'paymentrequest' || raw.includes('amount=')) {
    try {
      // Parse payment request format: lumen:address?amount=1.5&memo=test
      const url = new URL(raw.startsWith('lumen:') ? raw : `lumen:${raw}`);
      const address = url.pathname.replace('//', '');
      const amount = url.searchParams.get('amount');

      if (address) {
        sendForm.value.recipient = address;
      }
      if (amount) {
        sendForm.value.amount = amount;
      }
      
      if (!showSendModal.value) {
        showSendModal.value = true;
      }
      
      showToast(t('Payment request scanned successfully'), 'success');
    } catch {
      // If not a valid URL, treat as simple address
      sendForm.value.recipient = content;
      if (!showSendModal.value) {
        showSendModal.value = true;
      }
      showToast(t('Wallet address scanned successfully'), 'success');
    }
    return;
  }
  
  // Handle regular wallet address
  if (type === 'walletaddress' || type === 'unknown') {
    sendForm.value.recipient = content;
    if (!showSendModal.value) {
      showSendModal.value = true;
    }
    showToast(t('Wallet address scanned successfully'), 'success');
    return;
  }
  
  // A plain URL in a QR code has no wallet action attached to it.
  if (type === 'url') {
    showToast(t('This QR code holds a link, not a wallet action'), 'warning');
    return;
  }
  
  showToast(t('QR code scanned'), 'success');
}


async function executeRecurringPayment(paymentId: string) {
  const result = await payReminder(paymentId);
  if (result.ok) {
    showToast(t('Reminder paid'), 'success');
    schedulePostTransactionRefresh({ includeSubscriptions: true });
    return;
  }
  showToast(result.error, result.locked ? 'warning' : 'error');
}

const showToast = toast.show;

function openTransactionTab(txHash: string) {
  const explorerUrl = explorerTransactionUrl(txHash);
  if (openInNewTab) {
    openInNewTab(explorerUrl);
    return;
  }
  window.location.href = explorerUrl;
}

const canSend = computed(() => {
  if (!sendSourceAddress.value) return false;
  if (!String(sendForm.value.recipient || '').trim()) return false;
  const amount = Number(sendForm.value.amount || '0');
  if (!Number.isFinite(amount) || amount <= 0) return false;
  if (isIbcSend.value && (!selectedIbcChannel.value || ibcChannelsLoading.value)) return false;
  return true;
});

function formatLmnAmount(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const fixed = value.toFixed(6);
  return fixed.replace(/\.?0+$/, '');
}

function formatDenom(denom: string): string {
  return formatDenomValue(denom, { uppercaseFallback: true });
}

function shortenAddress(value: string, start = 10, end = 8): string {
  return truncateMiddle(value, { start, end, separator: '…', empty: '-' });
}

function normalizeWhitespace(value: string): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function buildAbsoluteHref(baseUrl: string, href: string): string {
  try {
    const rawHref = String(href || '').trim();
    const base = trimTrailingSlash(baseUrl);
    const resolved = base ? new URL(rawHref, base) : new URL(rawHref);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return trimTrailingSlash(baseUrl);
    return resolved.toString();
  } catch {
    return trimTrailingSlash(baseUrl);
  }
}

async function fetchAbsoluteTextViaBridge(url: string, timeout = 15000): Promise<string> {
  const httpGet = useInternalLumen()?.http?.get || useInternalLumen()?.httpGet;
  if (typeof httpGet !== 'function') {
    throw new Error(t('HTTP bridge not available.'));
  }

  const res = await httpGet(String(url || ''), {
    timeout,
    headers: {
      accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8'
    }
  });

  if (!res || res.ok === false) {
    throw new Error(String(res?.error || `HTTP ${res?.status || 0}`));
  }

  return String(res.text || '');
}

function parseHtmlDocument(html: string): Document | null {
  const source = String(html || '').trim();
  if (!source) return null;

  try {
    return new DOMParser().parseFromString(source, 'text/html');
  } catch {
    return null;
  }
}

function parseCountFromText(text: string, pattern: RegExp): number | null {
  const match = normalizeWhitespace(text).match(pattern);
  if (!match?.[1]) return null;
  const parsed = Number(String(match[1]).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function getMetaContent(doc: Document | null, selector: string): string {
  return normalizeWhitespace(doc?.querySelector(selector)?.getAttribute('content') || '');
}

function extractDexQuickLinks(doc: Document | null, config: DexListingConfig): DexQuickLink[] {
  const baseUrl = trimTrailingSlash(config.baseUrl);
  const fallback = config.fallbackLinks.slice();
  if (!doc) return fallback;

  const allowedLabels = new Set([
    'swap',
    'exchange',
    'staking',
    'pools',
    'assets',
    'burner',
    'website',
    t('factory (coming soon)')
  ]);
  const preferredOrder = ['swap', 'exchange', 'pools', 'staking', 'assets', 'burner', 'website', t('factory (coming soon)')];
  const deduped = new Map<string, DexQuickLink>();

  for (const anchor of Array.from(doc.querySelectorAll('a[href]'))) {
    const label = normalizeWhitespace(anchor.textContent || '');
    const normalizedLabel = label.toLowerCase();
    if (!allowedLabels.has(normalizedLabel)) continue;

    const href = normalizeWhitespace(anchor.getAttribute('href') || '');
    if (!href || href.startsWith('#')) continue;

    const absoluteUrl = buildAbsoluteHref(baseUrl, href);
    if (!absoluteUrl) continue;

    if (!deduped.has(normalizedLabel)) {
      deduped.set(normalizedLabel, { label, url: absoluteUrl });
    }
  }

  for (const link of fallback) {
    const normalizedLabel = normalizeWhitespace(link.label).toLowerCase();
    if (!deduped.has(normalizedLabel)) {
      deduped.set(normalizedLabel, link);
    }
  }

  return Array.from(deduped.entries())
    .sort((a, b) => preferredOrder.indexOf(a[0]) - preferredOrder.indexOf(b[0]))
    .map((entry) => entry[1]);
}

function extractDexMarketPreview(doc: Document | null): DexMarketPreview | null {
  if (!doc?.body) return null;

  const candidates = Array.from(doc.body.querySelectorAll('a, button, article, section, div'))
    .map((element) => normalizeWhitespace(element.textContent || ''))
    .filter((text) => text.length >= 8 && text.length <= 260);

  for (const text of candidates) {
    const pairMatch = text.match(/\b([A-Z0-9]{2,12}\/[A-Z0-9]{2,12})\b/);
    if (!pairMatch) continue;

    const numericTokens = Array.from(text.matchAll(/\b\d[\d,]*(?:\.\d+)?\b/g))
      .map((match) => String(match[0] || '').trim())
      .filter((token) => token !== '24');

    const [lastPrice = '', quoteVolume = ''] = numericTokens;
    return {
      pair: pairMatch[1],
      lastPrice,
      quoteVolume
    };
  }

  return null;
}

function getDexDenomLabel(denom: string): string {
  const raw = String(denom || '').trim();
  if (!raw) return '';

  const lower = raw.toLowerCase();
  if (lower === 'ubze') return 'BZE';
  if (lower === 'ibc/9da252f9f9c86132cc282ea431dfb7de7729501f6dc9a3e0f50ec8c6ee380cc7') return 'LMN';
  if (lower.endsWith('/testusd')) return 'TUSDC';

  if (lower.startsWith('factory/')) {
    const tail = raw.split('/').pop() || raw;
    if (tail.toLowerCase() === 'testusd') return 'TUSDC';
    return tail.toUpperCase();
  }

  if (lower.startsWith('ibc/')) return 'IBC';
  return formatDenom(raw);
}

function buildDexPairLabel(baseDenom: string, quoteDenom: string): string {
  const base = getDexDenomLabel(baseDenom);
  const quote = getDexDenomLabel(quoteDenom);
  if (base && quote) return `${base}/${quote}`;
  return normalizeWhitespace([base, quote].filter(Boolean).join('/')) || t('Unknown pair');
}

async function fetchDexChainOverview(config: DexListingConfig): Promise<{
  tradingPairsCount: number | null;
  liquidityPoolsCount: number | null;
  featuredMarketPair: string;
  featuredPoolPair: string;
}> {
  if (!config.restEndpoint) {
    return {
      tradingPairsCount: null,
      liquidityPoolsCount: null,
      featuredMarketPair: '',
      featuredPoolPair: ''
    };
  }

  const [marketsJson, poolsJson] = await Promise.all([
    fetchAbsoluteJson(buildAbsoluteUrl(config.restEndpoint, '/bze/tradebin/all_markets'), 12000).catch(() => null),
    fetchAbsoluteJson(buildAbsoluteUrl(config.restEndpoint, '/bze/tradebin/all_liquidity_pools'), 12000).catch(() => null)
  ]);

  const markets = Array.isArray(marketsJson?.market) ? marketsJson.market : null;
  const pools = Array.isArray(poolsJson?.list) ? poolsJson.list : null;

  const firstMarket = markets?.[0] || null;
  const firstPool = pools?.[0] || null;

  return {
    tradingPairsCount: markets ? markets.length : null,
    liquidityPoolsCount: pools ? pools.length : null,
    featuredMarketPair: firstMarket ? buildDexPairLabel(firstMarket.base, firstMarket.quote) : '',
    featuredPoolPair: firstPool ? buildDexPairLabel(firstPool.base, firstPool.quote) : ''
  };
}

function updateDexRow(key: string, updater: (row: DexRow) => DexRow) {
  dexRows.value = dexRows.value.map((row) => (row.key === key ? updater(row) : row));
}

async function fetchDexSnapshot(config: DexListingConfig): Promise<DexRow> {
  const probePaths = config.probePaths?.length ? config.probePaths : ['/', '/exchange', '/pools'];
  const [pages, chainOverview] = await Promise.all([
    Promise.allSettled(
      probePaths.map((probePath) =>
        fetchAbsoluteTextViaBridge(buildAbsoluteUrl(config.baseUrl, probePath), 15000),
      ),
    ),
    fetchDexChainOverview(config).catch(() => ({
      tradingPairsCount: null,
      liquidityPoolsCount: null,
      featuredMarketPair: '',
      featuredPoolPair: ''
    }))
  ]);

  // Indexed by what each probe was for, not by position, so a DEX that probes
  // two pages does not read the pools document as its exchange one.
  const htmlFor = (probePath: string) => {
    const index = probePaths.indexOf(probePath);
    if (index < 0) return '';
    const result = pages[index];
    return result?.status === 'fulfilled' ? result.value : '';
  };

  const homeHtml = htmlFor(probePaths[0]);
  const exchangeHtml = htmlFor('/exchange');
  const poolsHtml = htmlFor('/pools');
  const successCount = pages.filter((result) => result.status === 'fulfilled').length;

  const homeDoc = parseHtmlDocument(homeHtml);
  const exchangeDoc = parseHtmlDocument(exchangeHtml);
  const poolsDoc = parseHtmlDocument(poolsHtml);

  const exchangeText = normalizeWhitespace(exchangeDoc?.body?.textContent || '');
  const poolsText = normalizeWhitespace(poolsDoc?.body?.textContent || '');

  const htmlTradingPairsCount = parseCountFromText(exchangeText, /(\d+)\s+trading pairs/i);
  const htmlLiquidityPoolsCount = parseCountFromText(poolsText, /(\d+)\s+liquidity pools/i);
  const title =
    getMetaContent(homeDoc, 'meta[property="og:title"]') ||
    getMetaContent(homeDoc, 'meta[name="twitter:title"]') ||
    normalizeWhitespace(homeDoc?.title || '') ||
    config.name;
  const description =
    getMetaContent(homeDoc, 'meta[name="description"]') ||
    getMetaContent(homeDoc, 'meta[property="og:description"]') ||
    config.description;
  const quickLinks = extractDexQuickLinks(homeDoc, config);
  const htmlMarketPreview = extractDexMarketPreview(exchangeDoc);
  const marketPreview =
    htmlMarketPreview ||
    (chainOverview.featuredMarketPair
      ? {
          pair: chainOverview.featuredMarketPair,
          lastPrice: '',
          quoteVolume: ''
        }
      : null);
  const tradingPairsCount =
    chainOverview.tradingPairsCount != null ? chainOverview.tradingPairsCount : htmlTradingPairsCount;
  const liquidityPoolsCount =
    chainOverview.liquidityPoolsCount != null ? chainOverview.liquidityPoolsCount : htmlLiquidityPoolsCount;
  const pageErrors = pages
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map((result) => String(result.reason?.message || result.reason || t('Request failed')));

  let status: DexStatus = 'error';
  if (successCount === pages.length) status = 'online';
  else if (successCount > 0) status = 'degraded';

  return {
    ...config,
    logoUrl: config.logoUrl,
    siteTitle: title || config.name,
    description: description || config.description,
    status,
    tradingPairsCount,
    liquidityPoolsCount,
    featuredMarketPair: chainOverview.featuredMarketPair,
    featuredPoolPair: chainOverview.featuredPoolPair,
    quickLinks,
    marketPreview,
    error: pageErrors.join(' | '),
    lastCheckedAt: new Date().toISOString()
  };
}

async function refreshDexListings() {
  dexLoading.value = true;
  dexError.value = '';

  dexRows.value = dexRows.value.map((row) => ({
    ...row,
    status: 'loading',
    error: ''
  }));

  try {
    const nextRows = await Promise.all(DEX_LISTINGS.map((config) => fetchDexSnapshot(config)));
    dexRows.value = nextRows;
    dexLastLoadedAt.value = Date.now();

    if (nextRows.some((row) => row.status === 'error')) {
      dexError.value = t('Some DEX snapshots could not be loaded.');
    } else if (nextRows.some((row) => row.status === 'degraded')) {
      dexError.value = t('Some DEX details are partial right now, but the listings remain usable.');
    }
  } catch (error) {
    dexRows.value = dexRows.value.map((row) => ({
      ...row,
      status: 'error',
      error: errorMessage(error, t('Failed to load DEX snapshot'))
    }));
    dexError.value = errorMessage(error, t('Failed to load DEX snapshot'));
  } finally {
    dexLoading.value = false;
  }
}

async function ensureDexListingsLoaded(force = false) {
  const shouldRefresh =
    force ||
    !dexLastLoadedAt.value ||
    Date.now() - dexLastLoadedAt.value > DEX_REFRESH_TTL_MS ||
    dexRows.value.every((row) => row.status === 'idle');

  if (!shouldRefresh || dexLoading.value) return;
  await refreshDexListings();
}

function isDexExpanded(key: string): boolean {
  return dexExpandedKeys.value.includes(String(key || '').trim());
}

function toggleDexExpanded(key: string) {
  const normalized = String(key || '').trim();
  if (!normalized) return;

  if (isDexExpanded(normalized)) {
    dexExpandedKeys.value = dexExpandedKeys.value.filter((entry) => entry !== normalized);
    return;
  }

  dexExpandedKeys.value = [...dexExpandedKeys.value, normalized];
}

function handleDexLogoError(dex: DexRow) {
  updateDexRow(dex.key, (row) => ({
    ...row,
    logoUrl: ''
  }));
}

function openDexTab(url: string) {
  const target = String(url || '').trim();
  if (!target) return;

  if (openInNewTab) {
    openInNewTab(target);
    return;
  }

  window.open(target, '_blank', 'noopener,noreferrer');
}

function getDexStatusLabel(status: DexStatus): string {
  if (status === 'loading') return t('Refreshing…');
  if (status === 'online') return t('Online');
  if (status === 'degraded') return t('Partial');
  if (status === 'error') return t('Offline');
  return t('Idle');
}

function assetIconStyle(iconClass: string): Record<string, string> {
  if (iconClass === 'lmn') return { background: 'var(--color-secondary)' };
  if (iconClass === 'remote') return { background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary))' };
  return {};
}

function dexItemStyle(status: DexStatus): Record<string, string> {
  if (status === 'online') return { boxShadow: '0 10px 30px rgba(15, 23, 42, 0.04)' };
  if (status === 'degraded') return { borderColor: 'rgba(var(--color-warning-rgb), 0.35)' };
  if (status === 'error') return { borderColor: 'rgba(var(--color-error-rgb), 0.28)' };
  return {};
}

function getDexStatusBadgeClass(status: DexStatus): string {
  if (status === 'online') return 'bg-fill-success color-success';
  if (status === 'degraded') return 'bg-warning-a15 color-warning';
  if (status === 'error') return 'bg-fill-error color-error';
  return 'bg-fill-blue color-primary';
}

function formatDexCount(value: number | null): string {
  if (value == null) return t('Not available');
  return String(value);
}

function getDexPriceLabel(dex: DexRow): string {
  return dex.marketPreview?.lastPrice || t('Not available');
}

function getDexVolumeLabel(dex: DexRow): string {
  return dex.marketPreview?.quoteVolume || t('Not available');
}

async function fetchLocalBalances(ownerAddress: string): Promise<Array<{ denom: string; amount: string }>> {
  const net = useInternalLumen()?.net;
  if (!net || typeof net.restGet !== 'function') {
    throw new Error(t('Network API not available.'));
  }
  const res = await net.restGet(`/cosmos/bank/v1beta1/balances/${encodeURIComponent(ownerAddress)}`, {
    timeout: 15000
  });
  if (!res || res.ok === false) {
    throw new Error(String(res?.error || t('Failed to fetch balances on Lumen.')));
  }
  const balances = Array.isArray(res?.json?.balances) ? res.json.balances : [];
  return balances.map((coin: any) => ({
    denom: String(coin?.denom || '').trim(),
    amount: String(coin?.amount || '0').trim() || '0'
  }));
}

async function fetchRemoteBalances(restEndpoint: string, ownerAddress: string): Promise<Array<{ denom: string; amount: string }>> {
  const json = await fetchAbsoluteJson(
    buildAbsoluteUrl(restEndpoint, `/cosmos/bank/v1beta1/balances/${encodeURIComponent(ownerAddress)}`),
    15000
  );
  const balances = Array.isArray(json?.balances) ? json.balances : [];
  return balances.map((coin: any) => ({
    denom: String(coin?.denom || '').trim(),
    amount: String(coin?.amount || '0').trim() || '0'
  }));
}

function buildAssetDisplayName(denom: string, displaySymbol: string, trace: { baseDenom: string; path: string } | null): string {
  const lower = String(denom || '').trim().toLowerCase();
  if (trace?.baseDenom) return t('{symbol} via IBC', { symbol: displaySymbol });
  if (lower === 'ulmn') return 'Lumen';
  if (lower === 'ubze') return 'BeeZee';
  if (lower.startsWith('ibc/')) return `${displaySymbol} (IBC)`;
  return displaySymbol;
}

function formatAssetAmount(amount: string): string {
  const raw = Number(amount || '0');
  if (!Number.isFinite(raw)) return '0';
  return (raw / 1_000_000).toFixed(6).replace(/\.?0+$/, '');
}

function decimalToMicroUnits(value: string): bigint | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const match = raw.match(/^(\d*)(?:\.(\d{0,6})?)?$/);
  if (!match) return null;
  const whole = match[1] || '0';
  const frac = (match[2] || '').padEnd(6, '0').slice(0, 6);
  return BigInt(whole || '0') * 1_000_000n + BigInt(frac || '0');
}

async function loadCurrentNetworkChainId(): Promise<string> {
  const net = useInternalLumen()?.net;
  if (!net || typeof net.getState !== 'function') {
    currentNetworkChainId.value = currentNetworkChainId.value || '';
    return currentNetworkChainId.value;
  }
  const res = await net.getState();
  currentNetworkChainId.value = String(res?.state?.networkChainId || currentNetworkChainId.value || '').trim();
  return currentNetworkChainId.value;
}

async function createAssetRow(input: {
  chainId: string;
  chainLabel: string;
  ownerAddress: string;
  coin: { denom: string; amount: string };
  iconText: string;
  iconClass: string;
  chainRegistryName?: string;
  transferTargets: AssetTransferTarget[];
  routeLabel?: string;
  restEndpoint?: string;
  rpcEndpoint?: string;
  feeDenom?: string;
  isLocal?: boolean;
  error?: string;
}): Promise<AssetRow> {
  const rawDenom = String(input.coin?.denom || '').trim();
  const rawAmount = String(input.coin?.amount || '0').trim() || '0';
  const trace = rawDenom
    ? await resolveDenomTrace(String(input.restEndpoint || ''), rawDenom, { isLocal: !!input.isLocal })
    : null;
  const iconUrl = await resolveChainRegistryIconUrl(input.chainRegistryName, rawDenom, trace);
  const baseDenom = trace?.baseDenom || rawDenom;
  const displaySymbol = formatDenom(baseDenom);
  const displayName = buildAssetDisplayName(rawDenom, displaySymbol, trace);
  const addressPrefix = getAddressPrefix(input.ownerAddress);
  const sendEnabled = BigInt(rawAmount || '0') > 0n;
  const transferEnabled = input.transferTargets.length > 0 && BigInt(rawAmount || '0') > 0n;
  const sendButtonLabel = input.chainLabel
    ? t('Send on {chain}', { chain: input.chainLabel })
    : t('Send');

  return {
    id: `${input.chainId}:${rawDenom || 'unknown'}`,
    chainId: input.chainId,
    chainLabel: input.chainLabel,
    ownerAddress: input.ownerAddress,
    denom: rawDenom,
    microAmount: rawAmount,
    displayAmount: formatAssetAmount(rawAmount),
    displayName,
    displaySymbol,
    iconText: input.iconText,
    iconClass: input.iconClass,
    iconUrl,
    addressLabel: `${shortenAddress(input.ownerAddress)}${addressPrefix ? ` · ${addressPrefix.toUpperCase()}` : ''}`,
    traceLabel: trace?.path ? `Trace: ${trace.path}` : '',
    routeLabel: String(input.routeLabel || ''),
    error: String(input.error || ''),
    sendEnabled,
    sendButtonLabel,
    transferTargets: input.transferTargets,
    transferEnabled,
    transferButtonLabel: input.transferTargets.length ? t('To other chain') : t('No route'),
    rpcEndpoint: String(input.rpcEndpoint || ''),
    restEndpoint: String(input.restEndpoint || ''),
    feeDenom: String(input.feeDenom || 'ulmn')
  };
}

const selectedAssetTransferTarget = computed(() => {
  const context = assetTransferContext.value;
  if (!context) return null;
  return (
    context.transferTargets.find((target) => target.key === assetTransferForm.value.destinationKey) ||
    context.transferTargets[0] ||
    null
  );
});

const canSubmitAssetTransfer = computed(() => {
  const context = assetTransferContext.value;
  const target = selectedAssetTransferTarget.value;
  if (!context || !target) return false;
  const recipient = String(assetTransferForm.value.recipient || '').trim();
  if (!recipient) return false;
  const amountMicro = decimalToMicroUnits(assetTransferForm.value.amount);
  if (amountMicro == null || amountMicro <= 0n) return false;
  return amountMicro <= BigInt(context.microAmount || '0');
});

function handleAssetIconError(asset: AssetRow) {
  asset.iconUrl = '';
}

function refreshAssetRow(asset: AssetRow) {
  assetRowRefreshingId.value = asset.id;
  void refreshAssets({
    force: true,
    silent: true,
    contextAssetId: asset.id
  });
}

function openAssetSendModal(asset: AssetRow) {
  if (!asset.sendEnabled) {
    showToast(t('No balance available for this asset.'), 'warning');
    return;
  }
  void refreshActivities();
  sendAssetContext.value = asset;
  showContactPicker.value = false;
  sendTargetMode.value = 'lumen';
  ibcForm.value = { sourceChannel: '', sourcePort: 'transfer' };
  sendForm.value = {
    recipient: '',
    amount: '',
    gasFee: 'medium'
  };
  showSendModal.value = true;
}

const sendSummary = computed(() => {
  const amount = Number(sendForm.value.amount || '0') || 0;
  const rate = tokenomicsTaxRate.value ?? 0;
  const fee = amount * rate;
  const received = Math.max(amount - fee, 0);
  const pct = rate * 100;
  const taxLabel = Number.isFinite(pct) ? `${pct.toFixed(2).replace(/\.?0+$/, '')}%` : 'unknown';
  return {
    amount: formatLmnAmount(amount),
    receiver: formatLmnAmount(received),
    taxLabel,
    routeLabel: selectedIbcChannel.value
      ? `${selectedIbcChannel.value.portId}/${selectedIbcChannel.value.channelId}`
      : t('Select an IBC route'),
    destinationChain: selectedIbcChannel.value?.chainId || 'Unknown'
  };
});

async function confirmSend() {
  if (sendingTransaction.value) return;
  
  if (!sendSourceAddress.value) {
    showToast(t('No sender address available'), 'error');
    return;
  }
  const from = sendSourceAddress.value;
  const to = String(sendForm.value.recipient || '').trim();
  const recipientPrefix = getAddressPrefix(to);
  const amountNum = Number(sendForm.value.amount || '0');
  const amountMicro = decimalToMicroUnits(sendForm.value.amount);
  
  if (!to) {
    showToast(t('Please enter recipient address.'), 'error');
    return;
  }
  
  if (!(amountNum > 0)) {
    showToast(t('Please enter a valid amount.'), 'error');
    return;
  }

  if (amountMicro == null || amountMicro <= 0n) {
    showToast(t('Please enter a valid amount.'), 'error');
    return;
  }

  if (sendAvailableMicro.value !== null && amountMicro > sendAvailableMicro.value) {
    showToast(t('Insufficient {symbol} balance', { symbol: sendAssetSymbol.value }), 'error');
    return;
  }

  const walletApi = useInternalLumen()?.wallet;
  const activeId = activeProfileId.value;
  if (!activeId) {
    showToast(t('No active profile.'), 'error');
    return;
  }

  sendingTransaction.value = true;

  try {
    let sendParams: Record<string, any>;
    let sendOperation: (params: Record<string, any>) => Promise<any>;
    let successLabel = 'Send';
    let failureLabel = 'Send';

    if (isIbcSend.value) {
      if (recipientPrefix && recipientPrefix === sendSourcePrefix.value) {
        showToast(t('This address looks like the current chain. Use Send instead of IBC transfer for {symbol}.', { symbol: sendAssetSymbol.value }), 'warning');
        return;
      }

      if (!walletApi || typeof walletApi.ibcTransfer !== 'function') {
        showToast(t('Wallet IBC bridge not available.'), 'error');
        return;
      }

      if (!selectedIbcChannel.value) {
        showToast(t('Select an IBC route'), 'error');
        return;
      }

      sendParams = {
        profileId: activeId,
        from,
        to,
        amount: amountNum,
        denom: sendAssetDenom.value,
        memo: '',
        sourceChannel: selectedIbcChannel.value.channelId,
        sourcePort: selectedIbcChannel.value.portId,
        timeoutSeconds: 600
      };
      successLabel = t('IBC transfer');
      failureLabel = t('IBC transfer');
      sendOperation = async (params: Record<string, any>) => {
        const sendPromise = walletApi.ibcTransfer(params);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(t('Transaction timeout after 2 minutes'))), 120000)
        );
        return Promise.race([sendPromise, timeoutPromise]);
      };
    } else {
      if (recipientPrefix && recipientPrefix !== sendSourcePrefix.value) {
        showToast(t('Recipient must use the {prefix} address format.', { prefix: sendSourcePrefix.value }), 'warning');
        return;
      }

      if (!walletApi || typeof walletApi.sendTokens !== 'function') {
        showToast(t('Wallet send bridge not available.'), 'error');
        return;
      }

      sendParams = {
        profileId: activeId,
        from,
        to,
        amount: amountNum,
        denom: sendAssetDenom.value,
        memo: ''
      };
      if (sendAssetContext.value?.rpcEndpoint) {
        const feeGas = '250000';
        sendParams.rpcEndpoint = sendAssetContext.value.rpcEndpoint;
        sendParams.restEndpoint = sendAssetContext.value.restEndpoint;
        sendParams.chainId = sendAssetContext.value.chainId;
        sendParams.feeDenom = sendAssetContext.value.feeDenom;
        sendParams.feeAmount = estimateRemoteFeeAmount(sendAssetContext.value.chainId, feeGas, '2500');
        sendParams.feeGas = feeGas;
      }
      sendOperation = async (params: Record<string, any>) => {
        const sendPromise = walletApi.sendTokens(params);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(t('Transaction timeout after 2 minutes'))), 120000)
        );
        return Promise.race([sendPromise, timeoutPromise]);
      };
    }

    const res = await sendOperation(sendParams);

    if (!res || res.ok === false) {
      const err = String(res?.error || t('Unknown error'));
      if (err === 'password_required' || err === 'invalid_password') {
        try { await useInternalLumen()?.security?.lockSession?.(); } catch {}
        showToast(t('Wallet locked. Unlock to continue.'), 'warning');
        return;
      }
      
      // Handle indexing disabled error
      if (err === 'indexing_disabled') {
        showToast(errorMessage(res, t('Transaction may have been sent but node indexing is disabled. Check your balance in a moment.')), 'warning');
        closeSendModal();
        schedulePostTransactionRefresh();
        return;
      }
      
      showToast(`${failureLabel} failed: ${res?.error || t('Unknown error')}`, 'error');
      return;
    }
    
    showToast(t('{action} successful. TxHash: {hash}', { action: successLabel, hash: res.txhash || t('Not available') }), 'success');
    closeSendModal();
    schedulePostTransactionRefresh();
  } catch (e) {
    showToast(errorMessage(e, t('Unexpected error while sending transaction')), 'error');
  } finally {
    sendingTransaction.value = false;
  }
}

async function refreshAssets(options: { force?: boolean; silent?: boolean; contextAssetId?: string } = {}) {
  const requestId = ++assetRefreshRequestId;
  const hadRows = assetRows.value.length > 0;
  const force = !!options.force;
  const silent = !!options.silent && hadRows;
  const contextAssetId = String(options.contextAssetId || '').trim();
  if (contextAssetId) {
    assetRowRefreshingId.value = contextAssetId;
  }
  if (!isConnected.value || !address.value) {
    if (requestId === assetRefreshRequestId) {
      assetRows.value = [];
      assetsError.value = '';
    }
    if (contextAssetId && assetRowRefreshingId.value === contextAssetId) {
      assetRowRefreshingId.value = '';
    }
    return;
  }

  if (force) {
    clearDenomTraceCache();
    // The registry too: a chain whose assets failed to load is exactly why
    // someone presses refresh, and clearing only the traces left it blank.
    clearChainRegistryCache();
    ibcChannelsLoaded.value = false;
  }

  if (!silent) {
    assetsLoading.value = true;
  }
  assetsError.value = '';

  try {
    await loadIbcChannels(force);
    const localChainId = (await loadCurrentNetworkChainId()) || 'lumen';
    const localChainLabel = humanizeChainId(localChainId);

    const linkedChains = Array.from(
      ibcChannels.value.reduce((map, channel) => {
        const existing = map.get(channel.chainId || channel.channelId);
        if (existing) return map;
        const meta = resolveKnownChainMeta(channel.chainId, channel.prefixHints);
        const ownerAddress = meta.addressPrefix
          ? reencodeAddressPrefix(address.value, meta.addressPrefix)
          : '';
        map.set(channel.chainId || channel.channelId, {
          channel,
          meta,
          ownerAddress
        });
        return map;
      }, new Map<string, { channel: IbcChannelOption; meta: KnownIbcChainMeta; ownerAddress: string }>())
    ).map(([, value]) => value);

    const outboundTargets: AssetTransferTarget[] = linkedChains
      .filter((entry) => !!entry.ownerAddress)
      .map((entry) => ({
        key: `${entry.channel.chainId}:${entry.channel.channelId}`,
        chainId: entry.channel.chainId,
        chainLabel: entry.meta.label,
        addressPrefix: entry.meta.addressPrefix,
        defaultRecipient: entry.ownerAddress,
        sourceChannel: entry.channel.channelId,
        sourcePort: entry.channel.portId,
        routeLabel: `${entry.channel.portId}/${entry.channel.channelId}`
      }));

    const localBalances = await fetchLocalBalances(address.value);
    const localCoins = localBalances.length ? localBalances : [{ denom: 'ulmn', amount: '0' }];
    const localRows = await Promise.all(
      localCoins.map((coin) =>
        createAssetRow({
          chainId: localChainId,
          chainLabel: localChainLabel,
          ownerAddress: address.value,
          coin,
          iconText: 'LMN',
          iconClass: 'lmn',
          chainRegistryName: senderPrefix.value === 'lmn' ? 'lumen' : '',
          transferTargets: outboundTargets,
          routeLabel: outboundTargets.length
            ? `Destinations: ${outboundTargets.map((target) => target.chainLabel).join(', ')}`
            : t('No linked IBC destination available.'),
          feeDenom: 'ulmn',
          isLocal: true
        })
      )
    );

    const remoteErrors: string[] = [];
    const remoteRowsNested = await Promise.all(
      linkedChains.map(async (entry) => {
        const returnTargets: AssetTransferTarget[] =
          entry.channel.counterpartyChannelId && entry.ownerAddress && entry.meta.rpcEndpoint
            ? [
                {
                  key: `${localChainId}:${entry.channel.counterpartyChannelId}`,
                  chainId: localChainId,
                  chainLabel: localChainLabel,
                  addressPrefix: senderPrefix.value,
                  defaultRecipient: address.value,
                  sourceChannel: entry.channel.counterpartyChannelId,
                  sourcePort: entry.channel.counterpartyPortId || 'transfer',
                  routeLabel: `${entry.channel.counterpartyPortId || 'transfer'}/${entry.channel.counterpartyChannelId}`
                }
              ]
            : [];

        const fallbackCoin = {
          denom: entry.meta.nativeDenom || `${entry.meta.addressPrefix ? `u${entry.meta.addressPrefix}` : 'uasset'}`,
          amount: '0'
        };

        if (!entry.ownerAddress) {
          return [
            await createAssetRow({
              chainId: entry.channel.chainId || entry.channel.channelId,
              chainLabel: entry.meta.label,
              ownerAddress: entry.ownerAddress,
              coin: fallbackCoin,
              iconText: entry.meta.iconText,
              iconClass: 'remote',
              chainRegistryName: entry.meta.chainRegistryName,
              transferTargets: [],
              routeLabel: t('Failed to derive the destination address.'),
              restEndpoint: entry.meta.restEndpoint,
              rpcEndpoint: entry.meta.rpcEndpoint,
              feeDenom: entry.meta.feeDenom,
              error: t('Failed to derive an address for this chain.')
            })
          ];
        }

        if (!entry.meta.restEndpoint) {
          return [
            await createAssetRow({
              chainId: entry.channel.chainId || entry.channel.channelId,
              chainLabel: entry.meta.label,
              ownerAddress: entry.ownerAddress,
              coin: fallbackCoin,
              iconText: entry.meta.iconText,
              iconClass: 'remote',
              chainRegistryName: entry.meta.chainRegistryName,
              transferTargets: returnTargets,
              routeLabel: returnTargets.length
                ? t('Return route: {route}', { route: returnTargets[0].routeLabel })
                : t('No return route configured.'),
              restEndpoint: entry.meta.restEndpoint,
              rpcEndpoint: entry.meta.rpcEndpoint,
              feeDenom: entry.meta.feeDenom,
              error: t('REST endpoint not configured for this chain.')
            })
          ];
        }

        try {
          const balances = await fetchRemoteBalances(entry.meta.restEndpoint, entry.ownerAddress);
          const coins = balances.length ? balances : [fallbackCoin];
          return Promise.all(
            coins.map((coin) =>
              createAssetRow({
                chainId: entry.channel.chainId || entry.channel.channelId,
                chainLabel: entry.meta.label,
                ownerAddress: entry.ownerAddress,
                coin,
                iconText: entry.meta.iconText,
                iconClass: 'remote',
                chainRegistryName: entry.meta.chainRegistryName,
                transferTargets: returnTargets,
                routeLabel: returnTargets.length
                  ? t('Return route: {route}', { route: returnTargets[0].routeLabel })
                  : t('No return route configured.'),
                restEndpoint: entry.meta.restEndpoint,
                rpcEndpoint: entry.meta.rpcEndpoint,
                feeDenom: entry.meta.feeDenom
              })
            )
          );
        } catch (error) {
          remoteErrors.push(`${entry.meta.label}: ${errorMessage(error, t('Failed to load balances'))}`);
          return [
            await createAssetRow({
              chainId: entry.channel.chainId || entry.channel.channelId,
              chainLabel: entry.meta.label,
              ownerAddress: entry.ownerAddress,
              coin: fallbackCoin,
              iconText: entry.meta.iconText,
              iconClass: 'remote',
              chainRegistryName: entry.meta.chainRegistryName,
              transferTargets: returnTargets,
              routeLabel: returnTargets.length
                ? t('Return route: {route}', { route: returnTargets[0].routeLabel })
                : t('No return route configured.'),
              restEndpoint: entry.meta.restEndpoint,
              rpcEndpoint: entry.meta.rpcEndpoint,
              feeDenom: entry.meta.feeDenom,
              error: errorMessage(error, t('Failed to load balances'))
            })
          ];
        }
      })
    );

    const nextRows = [...localRows, ...remoteRowsNested.flat()].sort((a, b) => {
      if (a.chainId !== b.chainId) {
        if (a.chainId === localChainId) return -1;
        if (b.chainId === localChainId) return 1;
        return a.chainLabel.localeCompare(b.chainLabel);
      }
      const aEnabled = a.transferEnabled ? 1 : 0;
      const bEnabled = b.transferEnabled ? 1 : 0;
      if (aEnabled !== bEnabled) return bEnabled - aEnabled;
      return a.displayName.localeCompare(b.displayName);
    });

    if (requestId !== assetRefreshRequestId) {
      return;
    }

    assetRows.value = nextRows;
    if (remoteErrors.length) {
      assetsError.value = remoteErrors.join(' | ');
    }
  } catch (error) {
    if (requestId !== assetRefreshRequestId) {
      return;
    }
    if (!hadRows) {
      assetRows.value = [];
    }
    assetsError.value = errorMessage(error, t('Failed to load assets.'));
  } finally {
    if (!silent && requestId === assetRefreshRequestId) {
      assetsLoading.value = false;
    }
    if (contextAssetId && assetRowRefreshingId.value === contextAssetId) {
      assetRowRefreshingId.value = '';
    }
  }
}

function openAssetTransferModal(asset: AssetRow) {
  if (!asset.transferTargets.length) {
    showToast(t('No IBC route available for this asset.'), 'warning');
    return;
  }
  assetTransferContext.value = asset;
  assetTransferForm.value = {
    destinationKey: asset.transferTargets[0].key,
    recipient: asset.transferTargets[0].defaultRecipient,
    amount: ''
  };
  showAssetTransferModal.value = true;
}

function closeAssetTransferModal() {
  if (assetTransferSending.value) {
    showToast(t('Transfer in progress. Please wait…'), 'info');
    return;
  }
  showAssetTransferModal.value = false;
  assetTransferContext.value = null;
  assetTransferForm.value = {
    destinationKey: '',
    recipient: '',
    amount: ''
  };
}

function validateAssetTransferAmountInput(event: Event) {
  const input = event.target as HTMLInputElement;
  let value = input.value;
  value = value.replace(/[^0-9.]/g, '');
  const parts = value.split('.');
  if (parts.length > 2) {
    value = parts[0] + '.' + parts.slice(1).join('');
  }
  if (parts.length === 2 && parts[1].length > 6) {
    value = parts[0] + '.' + parts[1].slice(0, 6);
  }
  assetTransferForm.value.amount = value;
  input.value = value;
}

async function confirmAssetTransfer() {
  if (assetTransferSending.value) return;

  const context = assetTransferContext.value;
  const target = selectedAssetTransferTarget.value;
  if (!context || !target) {
    showToast(t('No asset transfer context available.'), 'error');
    return;
  }

  const recipient = String(assetTransferForm.value.recipient || '').trim();
  const amountRaw = String(assetTransferForm.value.amount || '').trim();
  const amountMicro = decimalToMicroUnits(amountRaw);
  const availableMicro = BigInt(context.microAmount || '0');

  if (!recipient) {
    showToast(t('Please enter a destination address.'), 'error');
    return;
  }
  if (amountMicro == null || amountMicro <= 0n) {
    showToast(t('Please enter a valid amount.'), 'error');
    return;
  }
  if (amountMicro > availableMicro) {
    showToast(t('Insufficient balance for this transfer.'), 'error');
    return;
  }

  const recipientPrefix = getAddressPrefix(recipient);
  if (target.addressPrefix && recipientPrefix && recipientPrefix !== target.addressPrefix) {
    showToast(t('Recipient must use the {prefix} address format.', { prefix: target.addressPrefix }), 'error');
    return;
  }

  const activeId = activeProfileId.value;
  if (!activeId) {
    showToast(t('No active profile.'), 'error');
    return;
  }

  const walletApi = useInternalLumen()?.wallet;
  if (!walletApi || typeof walletApi.ibcTransfer !== 'function') {
    showToast(t('Wallet IBC bridge not available.'), 'error');
    return;
  }

  assetTransferSending.value = true;

  try {
    const params: Record<string, any> = {
      profileId: activeId,
      from: context.ownerAddress,
      to: recipient,
      amount: Number(amountRaw || '0'),
      denom: context.denom,
      memo: '',
      sourceChannel: target.sourceChannel,
      sourcePort: target.sourcePort,
      timeoutSeconds: 600
    };

    if (context.rpcEndpoint) {
      const feeGas = '350000';
      params.rpcEndpoint = context.rpcEndpoint;
      params.restEndpoint = context.restEndpoint;
      params.chainId = context.chainId;
      params.feeDenom = context.feeDenom;
      params.feeAmount = estimateRemoteFeeAmount(context.chainId, feeGas, '3500');
      params.feeGas = feeGas;
    }

    const sendPromise = walletApi.ibcTransfer(params);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(t('Transaction timeout after 2 minutes'))), 120000)
    );
    const res = await Promise.race([sendPromise, timeoutPromise]);

    if (!res || res.ok === false) {
      const err = String(res?.error || t('Unknown error'));
      if (err === 'password_required' || err === 'invalid_password') {
        try { await useInternalLumen()?.security?.lockSession?.(); } catch {}
        showToast(t('Wallet locked. Unlock to continue.'), 'warning');
        return;
      }
      if (err === 'indexing_disabled') {
        showToast(
          errorMessage(res, t('Transfer may have been broadcast but node indexing is disabled. Check balances shortly.')),
          'warning'
        );
        closeAssetTransferModal();
        schedulePostTransactionRefresh();
        return;
      }
      showToast(t('Asset transfer failed: {reason}', { reason: String(err) }), 'error');
      return;
    }

    showToast(t('Asset transfer submitted. TxHash: {hash}', { hash: res.txhash || t('Not available') }), 'success');
    closeAssetTransferModal();
    schedulePostTransactionRefresh();
  } catch (error) {
    showToast(errorMessage(error, t('Unexpected error while transferring asset')), 'error');
  } finally {
    assetTransferSending.value = false;
  }
}

watch(sendTargetMode, (mode) => {
  if (mode === 'ibc') {
    void loadIbcChannels();
    return;
  }
});

watch(showSendModal, (open) => {
  if (open && sendTargetMode.value === 'ibc') {
    void loadIbcChannels();
  }
});

watch(() => sendForm.value.recipient, (next) => {
  if (sendAssetContext.value) return;
  const guess = guessSendTargetMode(next);
  if (guess) {
    sendTargetMode.value = guess;
  }
  if (sendTargetMode.value === 'ibc') {
    autoSelectIbcChannel();
  }
});

watch(
  () => assetTransferForm.value.destinationKey,
  (next, prev) => {
    const context = assetTransferContext.value;
    if (!context || !next) return;
    const nextTarget = context.transferTargets.find((target) => target.key === next);
    const prevTarget = context.transferTargets.find((target) => target.key === prev);
    const currentRecipient = String(assetTransferForm.value.recipient || '').trim();
    if (!nextTarget) return;
    if (!currentRecipient || currentRecipient === prevTarget?.defaultRecipient) {
      assetTransferForm.value.recipient = nextTarget.defaultRecipient;
    }
  }
);

function openReceiveModal() {
  showReceiveModal.value = true;
}

function closeReceiveModal() {
  showReceiveModal.value = false;
}

async function copyAddressWithToast() {
  if (!address.value) return;
  await copyToClipboardWithToast(address.value);
}

// Address Book Functions
async function loadContacts() {
  contactsLoading.value = true;
  try {
    const result = await useInternalLumen()?.addressBook.list();
    if (result.ok) {
      contacts.value = result.contacts || [];
    }
  } catch (err) {
    console.error('Failed to load contacts:', err);
  } finally {
    contactsLoading.value = false;
  }
}

function openAddContactModal() {
  editingContact.value = null;
  contactForm.value = {
    name: '',
    address: '',
    note: ''
  };
  showContactModal.value = true;
}

function closeContactModal() {
  showContactModal.value = false;
  editingContact.value = null;
  contactForm.value = {
    name: '',
    address: '',
    note: ''
  };
}

function editContact(contact: any) {
  editingContact.value = contact;
  contactForm.value = {
    name: contact.name,
    address: contact.address,
    note: contact.note || ''
  };
  showContactModal.value = true;
}

async function saveContact() {
  savingContact.value = true;
  try {
    const plainContact = {
      name: contactForm.value.name,
      address: contactForm.value.address,
      note: contactForm.value.note
    };

    if (editingContact.value) {
      const result = await useInternalLumen()?.addressBook.update(
        editingContact.value.id,
        plainContact
      );
      if (result.ok) {
        showToast(t('Contact updated.'), 'success');
        await loadContacts();
        closeContactModal();
      } else {
        showToast(result.error || t('Failed to update contact'), 'error');
      }
    } else {
      // Add new contact
      const result = await useInternalLumen()?.addressBook.add(plainContact);
      if (result.ok) {
        showToast(t('Contact added.'), 'success');
        await loadContacts();
        closeContactModal();
      } else {
        showToast(result.error || t('Failed to add contact'), 'error');
      }
    }
  } catch (err) {
    showToast(errorMessage(err, t('Failed to save contact')), 'error');
  } finally {
    savingContact.value = false;
  }
}

async function deleteContact(contact: any) {
  contactToDelete.value = contact;
  showDeleteConfirmModal.value = true;
}

async function confirmDeleteContact() {
  if (!contactToDelete.value) return;
  
  try {
    const result = await useInternalLumen()?.addressBook.delete(contactToDelete.value.id);
    if (result.ok) {
      showToast(t('Contact deleted'), 'success');
      await loadContacts();
    } else {
      showToast(result.error || t('Failed to delete contact'), 'error');
    }
  } catch (err) {
    showToast(errorMessage(err, t('Failed to delete contact')), 'error');
  } finally {
    showDeleteConfirmModal.value = false;
    contactToDelete.value = null;
  }
}

function cancelDeleteContact() {
  showDeleteConfirmModal.value = false;
  contactToDelete.value = null;
}

function sendToContact(contact: any) {
  sendAssetContext.value = null;
  sendTargetMode.value = 'lumen';
  ibcForm.value = { sourceChannel: '', sourcePort: 'transfer' };
  sendForm.value = { recipient: contact.address, amount: '', gasFee: 'medium' };
  showContactPicker.value = false;
  showSendModal.value = true;
}

function selectContactForSend(contact: any) {
  sendForm.value.recipient = contact.address;
  showContactPicker.value = false;
}

function exportTransactions() {
  if (!activities.value.length) return;

  // CSV header
  const headers = ['Date', 'Time', 'Type', 'From', 'To', t('Amount (LMN)'), 'Status', 'Hash'];
  
  // CSV rows
  const rows = enhancedActivities.value.map(tx => {
    const date = new Date(tx.timestamp);
    const dateStr = date.toLocaleDateString('en-US');
    const timeStr = date.toLocaleTimeString('en-US');
    const { label, carriesDomainName } = describeActivity(tx);
    const type = carriesDomainName && tx.dnsName ? `${label} (${tx.dnsName})` : label;
    const from = tx.from || address.value || '-';
    const to = tx.to || '-';
    const amount = tx.amounts && tx.amounts.length 
      ? (Number(tx.amounts[0].amount || '0') / 1_000_000).toFixed(6)
      : '0';
    const status = (tx.code === undefined || tx.code === 0) ? t('Success') : t('Failed');
    const hash = tx.txhash;
    
    return [dateStr, timeStr, type, from, to, amount, status, hash];
  });

  // Combine
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  downloadTextFile(
    `lumen-transactions-${address.value.slice(0, 8)}-${Date.now()}.csv`,
    csvContent,
    'text/csv;charset=utf-8;'
  );
  
  showToast(t('Transactions exported.'), 'success');
}
</script>