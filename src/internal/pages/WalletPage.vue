<template>
  <div class="wallet-page internal-page">
    <!-- Sidebar -->
    <InternalSidebar title="Wallet" :icon="Wallet" activeKey="wallet">
      <nav class="lsb-nav flex flex-column gap-75">
        <div class="lsb-section flex flex-column gap-2px">
          <span class="lsb-label fs-11px txt-weight-light color-text-tertiary text-uppercase letter-spacing-005em margin-bottom-25">Activity</span>
          <button
            type="button"
            class="lsb-item border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-62 border-radius-sm w-full fs-13px fw-500 text-left padding-50-62 transition-all-015"
            :class="{ active: currentView === 'overview' }"
            @click="currentView = 'overview'"
          >
            <Wallet :size="18" />
            <span>Wallet</span>
          </button>
          <button
            type="button"
            class="lsb-item border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-62 border-radius-sm w-full fs-13px fw-500 text-left padding-50-62 transition-all-015"
            :class="{ active: currentView === 'assets' }"
            @click="currentView = 'assets'"
          >
            <Coins :size="18" />
            <span>Assets</span>
          </button>
          <button
            type="button"
            class="lsb-item border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-62 border-radius-sm w-full fs-13px fw-500 text-left padding-50-62 transition-all-015"
            :class="{ active: currentView === 'dex' }"
            @click="currentView = 'dex'"
          >
            <LayoutDashboard :size="18" />
            <span>DEX</span>
          </button>
          <button
            type="button"
            class="lsb-item border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-62 border-radius-sm w-full fs-13px fw-500 text-left padding-50-62 transition-all-015"
            :class="{ active: currentView === 'transactions' }"
            @click="currentView = 'transactions'"
          >
            <ArrowLeftRight :size="18" />
            <span>Transactions</span>
          </button>
          <button
            type="button"
            class="lsb-item border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-62 border-radius-sm w-full fs-13px fw-500 text-left padding-50-62 transition-all-015"
            :class="{ active: currentView === 'recurring' }"
            @click="currentView = 'recurring'"
          >
            <Calendar :size="18" />
            <span>Recurring</span>
          </button>
          <button
            type="button"
            class="lsb-item border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-62 border-radius-sm w-full fs-13px fw-500 text-left padding-50-62 transition-all-015"
            :class="{ active: currentView === 'addressbook' }"
            @click="currentView = 'addressbook'"
          >
            <Users :size="18" />
            <span>Address Book</span>
          </button>
        </div>
      </nav>
    </InternalSidebar>

    <!-- Main Content -->
    <main class="walletpage-main-content flex flex-column flex-1 margin-0 min-w-0 overflow-y-auto padding-200-250 bg-secondary border-radius-0">
      <!-- Header -->
      <header class="walletpage-content-header flex-align-center-justify-space-between margin-bottom-150">
        <div>
          <h1>{{ getViewTitle() }}</h1>
          <p>{{ getViewDescription() }}</p>
        </div>

        <div v-if="currentView !== 'dex'" class="walletpage-header-actions flex gap-75">
          <button class="walletpage-action-btn primary flex-inline-align-center gap-62 border-radius-10px fw-500 cursor-pointer fs-14px border-1-transparent transition-all-02" @click="connectWallet" v-if="!isConnected">
            <Link :size="16" />
            <span>Connect Wallet</span>
          </button>
          <button class="walletpage-action-btn primary flex-inline-align-center gap-62 border-radius-10px fw-500 cursor-pointer fs-14px border-1-transparent transition-all-02" @click="sendTransaction" v-else>
            <Send :size="16" />
            <span>Send</span>
          </button>
        </div>
      </header>

      <!-- Overview View -->
      <div v-if="currentView === 'overview'" class="overview-section flex flex-column gap-150">
        <!-- Balance Card -->
        <div class="walletpage-balance-card border-radius-20px padding-200 bg-gradient-primary color-white relative overflow-hidden">
          <div class="walletpage-balance-header flex-align-center-justify-space-between margin-bottom-100">
            <span class="walletpage-balance-label text-uppercase txt-weight-light fs-13px letter-spacing-008em">Total Balance</span>
            <button class="walletpage-eye-btn flex-align-justify-center size-32px color-text-primary cursor-pointer border-none bg-tertiary border-radius-8px transition-all-02" @click="showBalance = !showBalance">
              <Eye v-if="showBalance" :size="18" />
              <EyeOff v-else :size="18" />
            </button>
          </div>
          <div class="walletpage-balance-amount flex gap-75 flex-align-baseline margin-bottom-75">
            <span class="walletpage-currency txt-weight-light fs-18px">LMN</span>
            <span class="walletpage-amount txt-weight-strong letter-spacing-n002">
              {{ showBalance ? balanceLabel : '••••••' }}
            </span>
          </div>
          <div class="walletpage-balance-change flex-align-center gap-50 fw-500 fs-14px">
            <TrendingUp :size="14" />
            <span v-if="isConnected && !balanceError">On-chain balance</span>
            <span v-else-if="balanceError">Error loading balance</span>
            <span v-else>Connect a wallet to view balance</span>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="walletpage-quick-actions gap-100 grid">
          <button class="walletpage-quick-btn disabled-fade-50 flex-align-center flex-column gap-75 cursor-pointer txt-weight-light color-text-primary border-radius-16px border-2 bg-card fs-14px relative overflow-hidden" @click="sendTransaction">
            <div class="walletpage-quick-icon send flex-align-justify-center size-56px border-radius-14px transition-all-03">
              <ArrowUpRight :size="20" />
            </div>
            <span>Send</span>
          </button>
          <button class="walletpage-quick-btn disabled-fade-50 flex-align-center flex-column gap-75 cursor-pointer txt-weight-light color-text-primary border-radius-16px border-2 bg-card fs-14px relative overflow-hidden" @click="openReceiveModal">
            <div class="walletpage-quick-icon receive flex-align-justify-center size-56px border-radius-14px transition-all-03">
              <ArrowDownLeft :size="20" />
            </div>
            <span>Receive</span>
          </button>
          <button class="walletpage-quick-btn disabled-fade-50 flex-align-center flex-column gap-75 cursor-pointer txt-weight-light color-text-primary border-radius-16px border-2 bg-card fs-14px relative overflow-hidden" disabled>
            <div class="walletpage-quick-icon swap disabled flex-align-justify-center size-56px border-radius-14px transition-all-03">
              <ArrowLeftRight :size="20" />
            </div>
            <span>Swap (soon)</span>
          </button>
          <button class="walletpage-quick-btn disabled-fade-50 flex-align-center flex-column gap-75 cursor-pointer txt-weight-light color-text-primary border-radius-16px border-2 bg-card fs-14px relative overflow-hidden" disabled>
            <div class="walletpage-quick-icon buy disabled flex-align-justify-center size-56px border-radius-14px transition-all-03">
              <CreditCard :size="20" />
            </div>
            <span>Buy (soon)</span>
          </button>
        </div>

        <!-- Address + summary -->
        <div class="walletpage-info-section flex flex-wrap-wrap gap-100">
          <div class="walletpage-info-card flex-1 bg-card border-radius-16px padding-100-125 border-1">
            <div class="walletpage-info-label text-uppercase color-text-tertiary fs-13px letter-spacing-008em margin-bottom-25">Address</div>
            <div class="walletpage-info-value mono color-text-primary fs-14px" :title="address || '-'">
              {{ address || '-' }}
            </div>
          </div>
        </div>
      </div>

      <!-- Assets View -->
      <div v-else-if="currentView === 'assets'" class="walletpage-content-section flex flex-column gap-150 w-full">
        <div class="walletpage-section-header flex-align-center-justify-space-between flex-wrap-wrap gap-100">
          <h3>Cross-chain Assets</h3>
        </div>
        <div class="walletpage-empty-state margin-top-200 padding-200 text-center border-radius-16px bg-secondary" v-if="!isConnected">
          <div class="walletpage-empty-icon flex-align-justify-center size-48px border-radius-full bg-secondary color-accent-secondary">
            <Coins :size="32" />
          </div>
          <h3>Connect Your Wallet</h3>
          <p>Connect a wallet to view your assets across linked IBC chains.</p>
          <button class="walletpage-connect-btn flex-inline-align-center border-radius-full fs-085rem cursor-pointer gap-35 border-none color-white padding-62-100" @click="connectWallet">
            <Link :size="16" />
            <span>Connect Wallet</span>
          </button>
        </div>
        <div v-else-if="assetsLoading && !assetRows.length" class="walletpage-empty-state margin-top-200 padding-200 text-center border-radius-16px bg-secondary">
          <div class="walletpage-empty-icon flex-align-justify-center size-48px border-radius-full bg-secondary color-accent-secondary">
            <Coins :size="32" />
          </div>
          <h3>Loading assets…</h3>
          <p>Fetching balances on Lumen and linked IBC chains.</p>
        </div>
        <div v-else-if="assetsError && !assetRows.length" class="walletpage-empty-state margin-top-200 padding-200 text-center border-radius-16px bg-secondary">
          <div class="walletpage-empty-icon flex-align-justify-center size-48px border-radius-full bg-secondary color-accent-secondary">
            <AlertCircle :size="32" />
          </div>
          <h3>Unable to load assets</h3>
          <p>{{ assetsError }}</p>
        </div>
        <div v-else>
          <div v-if="assetsError && assetRows.length" class="walletpage-info-banner warning margin-bottom-100 border-radius-10px margin-bottom-150 color-text-primary bg-secondary border-1 fs-14px line-height-15 padding-87-100">
            <span>{{ assetsError }}</span>
          </div>
          <div v-if="assetRows.length" class="walletpage-assets-list walletpage-rich-assets-list flex flex-column margin-top-100 gap-75 gap-100">
            <div
              v-for="asset in assetRows"
              :key="asset.id"
              class="walletpage-asset-item walletpage-asset-item-rich flex-align-center-justify-space-between gap-100 border-radius-14px bg-card border-1 padding-87-100"
            >
              <div class="walletpage-asset-main flex-align-start gap-75 flex-1 min-w-0">
                <div class="walletpage-asset-icon flex-align-justify-center size-40px border-radius-full txt-weight-light fs-14px color-white overflow-hidden flex-shrink-0" :class="asset.iconClass">
                  <img
                    v-if="asset.iconUrl"
                    :src="asset.iconUrl"
                    :alt="`${asset.displayName} icon`"
                    class="walletpage-asset-icon-image w-full h-full object-fit-cover block"
                    @error="handleAssetIconError(asset)"
                  />
                  <span v-else>{{ asset.iconText }}</span>
                </div>
                <div class="walletpage-asset-info flex flex-column flex-1 gap-20 min-w-0">
                  <div class="walletpage-asset-title-row flex-align-center flex-wrap-wrap gap-50">
                    <span class="walletpage-asset-name fw-500 color-text-primary fs-14px">{{ asset.displayName }}</span>
                    <span class="walletpage-asset-chain-pill flex-inline-align-center border-radius-full color-text-secondary bg-secondary border-1 fs-12px">{{ asset.chainLabel }}</span>
                  </div>
                  <span class="walletpage-asset-symbol color-text-tertiary fs-13px">{{ asset.displaySymbol }}</span>
                  <span class="walletpage-asset-meta color-text-secondary fs-12px overflow-hidden txt-overflow-ellipsis nowrap">{{ asset.addressLabel }}</span>
                  <span v-if="asset.traceLabel" class="walletpage-asset-meta color-text-secondary fs-12px overflow-hidden txt-overflow-ellipsis nowrap">{{ asset.traceLabel }}</span>
                  <span v-if="asset.routeLabel" class="walletpage-asset-meta color-text-secondary fs-12px overflow-hidden txt-overflow-ellipsis nowrap">{{ asset.routeLabel }}</span>
                  <span v-if="asset.error" class="walletpage-asset-meta error color-text-secondary fs-12px overflow-hidden txt-overflow-ellipsis nowrap">{{ asset.error }}</span>
                </div>
              </div>
              <div class="walletpage-asset-side flex-align-end flex-column gap-75 flex-justify-space-between">
                <div class="walletpage-asset-balance walletpage-balance-column text-right fw-500 color-text-primary flex-align-end flex-column gap-15 fs-14px">
                  <span class="asset-amount">{{ asset.displayAmount }}</span>
                  <span class="walletpage-asset-balance-symbol fs-075rem color-text-tertiary txt-weight-light">{{ asset.displaySymbol }}</span>
                </div>
                <div class="walletpage-asset-actions flex-align-center flex-wrap-wrap gap-50">
                  <button
                    class="walletpage-action-icon walletpage-asset-refresh-btn flex-align-justify-center color-text-secondary cursor-pointer border-radius-6px border-1 bg-card transition-all-02 flex-shrink-0"
                    @click="refreshAssetRow(asset)"
                    :disabled="assetRowRefreshingId === asset.id"
                    title="Refresh this asset"
                    aria-label="Refresh this asset"
                  >
                    <RefreshCw :size="14" :class="{ 'spin-icon': assetRowRefreshingId === asset.id }" />
                  </button>
                  <button
                    class="walletpage-action-icon walletpage-copy-btn flex-align-justify-center color-text-secondary cursor-pointer border-radius-6px border-1 bg-card transition-all-02 flex-shrink-0"
                    @click="copyToClipboard(asset.ownerAddress, 'Address copied!')"
                    title="Copy chain address"
                    aria-label="Copy chain address"
                  >
                    <Copy :size="14" />
                  </button>
                  <button
                    class="walletpage-action-btn secondary walletpage-asset-send-btn flex-inline-align-center gap-62 border-radius-10px fw-500 cursor-pointer fs-14px border-1-transparent transition-all-02 inline-flex gap-35"
                    @click="openAssetSendModal(asset)"
                    :disabled="!asset.sendEnabled"
                  >
                    <Send :size="16" />
                    <span>{{ asset.sendButtonLabel }}</span>
                  </button>
                  <button
                    class="walletpage-action-btn secondary walletpage-asset-transfer-btn flex-inline-align-center gap-62 border-radius-10px fw-500 cursor-pointer fs-14px border-1-transparent transition-all-02 inline-flex gap-35"
                    @click="openAssetTransferModal(asset)"
                    :disabled="!asset.transferTargets.length || !asset.transferEnabled"
                  >
                    <ArrowLeftRight :size="16" />
                    <span>{{ asset.transferButtonLabel }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="walletpage-empty-state margin-top-200 padding-200 text-center border-radius-16px bg-secondary">
            <div class="walletpage-empty-icon flex-align-justify-center size-48px border-radius-full bg-secondary color-accent-secondary">
              <Coins :size="32" />
            </div>
            <h3>No assets yet</h3>
            <p>No balances were found on Lumen or the linked IBC chains.</p>
          </div>
        </div>
      </div>

      <!-- DEX View -->
      <div v-else-if="currentView === 'dex'" class="walletpage-content-section flex flex-column gap-150 w-full">
        <div v-if="dexError" class="walletpage-info-banner warning margin-bottom-100 border-radius-10px margin-bottom-150 color-text-primary bg-secondary border-1 fs-14px line-height-15 padding-87-100">
          <span>{{ dexError }}</span>
        </div>

        <div class="dex-list flex flex-column gap-100">
          <div
            v-for="dex in dexRows"
            :key="dex.key"
            class="walletpage-dex-item border-1 border-radius-16px bg-card overflow-hidden"
            :class="`dex-item-${dex.status}`"
          >
            <div class="walletpage-dex-top flex-justify-space-between gap-100 padding-100-125">
              <button
                type="button"
                class="walletpage-dex-summary-btn flex-align-start gap-90 flex-1 padding-0 text-left cursor-pointer min-w-0 border-none bg-transparent"
                @click="toggleDexExpanded(dex.key)"
              >
                <div class="walletpage-dex-logo flex-align-justify-center color-primary txt-weight-medium border-radius-16px border-1 bg-secondary overflow-hidden flex-shrink-0 fs-15px" :class="{ 'dex-logo-dark': dex.logoTheme === 'dark' }">
                  <img
                    v-if="dex.logoUrl"
                    :src="dex.logoUrl"
                    :alt="`${dex.name} logo`"
                    class="walletpage-dex-logo-image margin-auto block bg-transparent"
                    @error="handleDexLogoError(dex)"
                  />
                  <span v-else>{{ dex.iconText }}</span>
                </div>

                <div class="walletpage-dex-main flex flex-column min-w-0 gap-25">
                  <div class="walletpage-dex-title-row flex-align-center flex-wrap-wrap gap-50">
                    <span class="walletpage-dex-name txt-weight-light color-text-primary fs-16px">{{ dex.name }}</span>
                    <span class="walletpage-asset-chain-pill flex-inline-align-center border-radius-full color-text-secondary bg-secondary border-1 fs-12px">{{ dex.chainLabel }}</span>
                    <span class="walletpage-dex-status-badge flex-inline-align-center border-radius-full txt-weight-medium fs-12px border-1-transparent" :class="`status-${dex.status}`">
                      {{ getDexStatusLabel(dex.status) }}
                    </span>
                  </div>

                  <span v-if="dex.error" class="walletpage-dex-meta error color-text-tertiary fs-13px">{{ dex.error }}</span>
                </div>
              </button>

              <div class="walletpage-dex-side flex-align-end flex-column flex-justify-space-between gap-75">
                <div class="walletpage-dex-actions flex-align-center-justify-end flex-wrap-wrap gap-50">
                  <button
                    type="button"
                    class="walletpage-action-btn secondary walletpage-dex-detail-toggle flex-inline-align-center gap-62 border-radius-10px fw-500 cursor-pointer fs-14px border-1-transparent transition-all-02 flex-justify-center"
                    @click="toggleDexExpanded(dex.key)"
                  >
                    <ChevronDown
                      :size="16"
                      class="walletpage-dex-chevron"
                      :class="{ open: isDexExpanded(dex.key) }"
                    />
                    <span>{{ isDexExpanded(dex.key) ? 'Hide details' : 'Details' }}</span>
                  </button>
                  <button
                    type="button"
                    class="walletpage-action-btn primary walletpage-dex-open-btn flex-inline-align-center gap-62 border-radius-10px fw-500 cursor-pointer fs-14px border-1-transparent transition-all-02 flex-justify-center"
                    @click="openDexTab(dex.openUrl || dex.baseUrl)"
                  >
                    <ExternalLink :size="16" />
                    <span>Open DEX</span>
                  </button>
                </div>
              </div>
            </div>

            <div v-if="isDexExpanded(dex.key)" class="walletpage-dex-details bg-secondary">
              <div class="walletpage-dex-detail-grid gap-75 grid">
                <div class="walletpage-dex-detail-card compact flex flex-column gap-35 min-w-0 border-radius-14px border-1 bg-card padding-87-100">
                  <span class="walletpage-dex-detail-label txt-weight-medium color-text-tertiary text-uppercase fs-12px letter-spacing-004em">Trading pairs</span>
                  <span class="walletpage-dex-detail-value txt-weight-medium color-text-primary fs-15px overflow-hidden txt-overflow-ellipsis nowrap">{{ formatDexCount(dex.tradingPairsCount) }}</span>
                </div>

                <div class="walletpage-dex-detail-card compact flex flex-column gap-35 min-w-0 border-radius-14px border-1 bg-card padding-87-100">
                  <span class="walletpage-dex-detail-label txt-weight-medium color-text-tertiary text-uppercase fs-12px letter-spacing-004em">Liquidity pools</span>
                  <span class="walletpage-dex-detail-value txt-weight-medium color-text-primary fs-15px overflow-hidden txt-overflow-ellipsis nowrap">{{ formatDexCount(dex.liquidityPoolsCount) }}</span>
                </div>

                <div class="walletpage-dex-detail-card flex flex-column gap-35 min-w-0 border-radius-14px border-1 bg-card padding-87-100">
                  <span class="walletpage-dex-detail-label txt-weight-medium color-text-tertiary text-uppercase fs-12px letter-spacing-004em">24h price</span>
                  <span class="walletpage-dex-detail-value txt-weight-medium color-text-primary fs-15px overflow-hidden txt-overflow-ellipsis nowrap">{{ getDexPriceLabel(dex) }}</span>
                </div>

                <div class="walletpage-dex-detail-card flex flex-column gap-35 min-w-0 border-radius-14px border-1 bg-card padding-87-100">
                  <span class="walletpage-dex-detail-label txt-weight-medium color-text-tertiary text-uppercase fs-12px letter-spacing-004em">24h volume</span>
                  <span class="walletpage-dex-detail-value txt-weight-medium color-text-primary fs-15px overflow-hidden txt-overflow-ellipsis nowrap">{{ getDexVolumeLabel(dex) }}</span>
                </div>
              </div>

              <div v-if="dex.quickLinks.length" class="walletpage-dex-links flex flex-wrap-wrap margin-top-87 gap-50">
                <button
                  v-for="link in dex.quickLinks"
                  :key="`${dex.key}:${link.label}:${link.url}`"
                  type="button"
                  class="walletpage-dex-link-chip flex-inline-align-center gap-35 border-radius-full color-text-secondary cursor-pointer border-1 bg-card fs-13px transition-all-02 padding-50-75"
                  @click="openDexTab(link.url)"
                >
                  <span>{{ link.label }}</span>
                  <ExternalLink :size="13" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

        <!-- Transactions View -->
        <div v-else-if="currentView === 'transactions'" class="walletpage-content-section flex flex-column gap-150 w-full">

        <div class="walletpage-section-header flex-align-center-justify-space-between flex-wrap-wrap gap-100" v-if="activities.length > 0">
          <h3>Recent Transactions</h3>
          <div class="walletpage-header-actions-group flex-align-center flex-wrap-wrap gap-75">
            <div class="filter-group flex-align-center gap-50">
              <select v-model="txFilterType" class="walletpage-filter-select color-text-primary cursor-pointer padding-50-75 border-1 border-radius-8px bg-card fs-14px transition-all-02">
                <option value="all">All Types</option>
                <option value="send">Send</option>
                <option value="receive">Receive</option>
              </select>
              <select v-model="txFilterStatus" class="walletpage-filter-select color-text-primary cursor-pointer padding-50-75 border-1 border-radius-8px bg-card fs-14px transition-all-02">
                <option value="all">All Status</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
              </select>
              <input
                v-model="txSearchQuery"
                type="text"
                placeholder="Search by hash..."
                class="walletpage-search-input color-text-primary padding-50-75 border-1 border-radius-8px bg-card fs-14px transition-all-02"
              />
            </div>
            <button class="walletpage-action-btn secondary flex-inline-align-center gap-62 border-radius-10px fw-500 cursor-pointer fs-14px border-1-transparent transition-all-02" @click="exportTransactions">
              <Download :size="16" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div class="walletpage-empty-state margin-top-200 padding-200 text-center border-radius-16px bg-secondary" v-if="!isConnected || !address">
          <div class="walletpage-empty-icon flex-align-justify-center size-48px border-radius-full bg-secondary color-accent-secondary">
            <ArrowLeftRight :size="32" />
          </div>
          <h3>No wallet connected</h3>
          <p>Connect a wallet to see your recent transactions.</p>
        </div>

        <div v-else-if="activitiesLoading" class="walletpage-empty-state margin-top-200 padding-200 text-center border-radius-16px bg-secondary">
          <div class="walletpage-empty-icon flex-align-justify-center size-48px border-radius-full bg-secondary color-accent-secondary">
            <ArrowLeftRight :size="32" />
          </div>
          <h3>Loading transactions…</h3>
          <p>Please wait while we fetch your recent activity from the indexer.</p>
        </div>

        <div v-else-if="activitiesError" class="walletpage-empty-state margin-top-200 padding-200 text-center border-radius-16px bg-secondary">
          <div class="walletpage-empty-icon flex-align-justify-center size-48px border-radius-full bg-secondary color-accent-secondary">
            <ArrowLeftRight :size="32" />
          </div>
          <h3>Unable to load transactions</h3>
          <p>{{ activitiesError }}</p>
          <div class="walletpage-info-banner warning margin-top-100 max-w-500px border-radius-10px margin-bottom-150 color-text-primary bg-secondary border-1 fs-14px line-height-15 padding-87-100">
            <span>
              💡 If transaction indexing is disabled on the node, transactions cannot be queried via API. 
              Your balance is still accurate and transactions are recorded on-chain.
            </span>
          </div>
        </div>

        <div v-else-if="!activities.length" class="walletpage-empty-state margin-top-200 padding-200 text-center border-radius-16px bg-secondary">
          <div class="walletpage-empty-icon flex-align-justify-center size-48px border-radius-full bg-secondary color-accent-secondary">
            <ArrowLeftRight :size="32" />
          </div>
          <h3>No recent transactions</h3>
          <p>Transaction history is not available because indexing is disabled on all RPC nodes.</p>
          <div class="walletpage-info-banner warning margin-top-100 max-w-600px border-radius-10px margin-bottom-150 color-text-primary bg-secondary border-1 fs-14px line-height-15 padding-87-100">
            <div class="margin-bottom-75">
              <strong>💡 Why can't I see my transactions?</strong>
            </div>
            <div class="margin-bottom-50">
              All Lumen Network RPC nodes currently have transaction indexing disabled. This means:
            </div>
            <ul class="text-left margin-top-50 margin-bottom-75 margin-left-150">
              <li>Your balance is still accurate and updated</li>
              <li>All transactions are recorded on-chain</li>
              <li>Transaction history cannot be queried via API</li>
            </ul>
            <div class="margin-top-75">
              <strong>Alternative:</strong> Use a block explorer to view your transaction history:
              <br>
              <a
                :href="`https://explorer.lumen.network/account/${address}`"
                target="_blank"
                class="margin-top-25 inline-block color-primary underline"
              >
                View on Lumen Explorer →
              </a>
            </div>
          </div>
        </div>

        <div v-else class="walletpage-activities-list flex flex-column border-radius-12px w-full border-1 overflow-hidden">
          <div class="walletpage-table-header gap-100 fs-075rem txt-weight-medium color-text-secondary text-uppercase w-full grid bg-secondary letter-spacing-005em">
            <div class="col-type">Type</div>
            <div class="col-amount">Amount</div>
            <div class="walletpage-col-from flex-align-center gap-50">From</div>
            <div class="walletpage-col-to flex-align-center gap-50">To</div>
            <div class="col-hash flex-align-center gap-50">Hash</div>
            <div class="col-status">Status</div>
            <div class="col-time">Time</div>
          </div>

          <div
            v-for="tx in enhancedActivities"
            :key="tx.id"
            class="walletpage-activity-row gap-100 grid padding-100-125 flex-inline-align-center transition-all-02 border-bottom-1-light"
          >
            <div class="col-type">
              <div class="walletpage-type-badge flex-inline fs-075rem txt-weight-light flex-align-start gap-35 border-radius-6px nowrap" :class="getActivityBadgeClass(tx)">
                <Edit v-if="isDnsUpdateTx(tx)" :size="14" />
                <Users v-else-if="isDnsTransferTx(tx)" :size="14" />
                <Plus v-else-if="isDnsRegisterTx(tx)" :size="14" />
                <TrendingUp v-else-if="isWithdrawRewardsTx(tx)" :size="14" />
                <Upload v-else-if="isPublishReleaseTx(tx)" :size="14" />
                <ArrowUpRight v-else-if="tx.type === 'send'" :size="14" />
                <ArrowDownLeft v-else-if="tx.type === 'receive'" :size="14" />
                <ArrowLeftRight v-else :size="14" />
                <div class="walletpage-type-text flex flex-column gap-2px min-w-0">
                  <span class="type-main">{{ getActivityLabel(tx) }}</span>
                  <span
                    v-if="(isDnsUpdateTx(tx) || isDnsTransferTx(tx) || isDnsRegisterTx(tx) || isWithdrawRewardsTx(tx) || isPublishReleaseTx(tx)) && tx.dnsName"
                    class="walletpage-type-sub fw-500 color-text-tertiary fs-11px overflow-hidden txt-overflow-ellipsis nowrap"
                    :title="tx.dnsName"
                  >{{ tx.dnsName }}</span>
                </div>
              </div>
            </div>

            <div class="col-amount">
              <span class="walletpage-amount-value txt-weight-medium fs-14px mono" :class="tx.type">
                <template v-if="tx.amounts && tx.amounts.length && tx.amounts[0].amount">
                  {{ tx.type === 'send' ? '-' : '+' }}{{ (Number(tx.amounts[0].amount) / 1_000_000).toFixed(6).replace(/\.?0+$/, '') }} {{ formatDenom(tx.amounts[0].denom) }}
                </template>
                <template v-else>
                  <span class="walletpage-text-muted color-text-tertiary">N/A</span>
                </template>
              </span>
            </div>

            <div class="walletpage-col-from flex-align-center gap-50">
              <span class="walletpage-address-value mono fs-13px color-text-secondary" :title="tx.from || '-'">
                <template v-if="tx.from && tx.from.length > 10">
                  {{ tx.from.slice(0, 10) }}…{{ tx.from.slice(-8) }}
                </template>
                <template v-else-if="tx.from">
                  {{ tx.from }}
                </template>
                <template v-else>
                  <span class="walletpage-text-muted color-text-tertiary">-</span>
                </template>
              </span>
              <button
                v-if="tx.from"
                class="walletpage-action-icon walletpage-copy-btn flex-align-justify-center color-text-secondary cursor-pointer border-radius-6px border-1 bg-card transition-all-02 flex-shrink-0"
                @click.stop="copyToClipboard(tx.from, 'Address copied!')"
                title="Copy address"
                aria-label="Copy from address"
              >
                <Copy :size="14" />
              </button>
            </div>

            <div class="walletpage-col-to flex-align-center gap-50">
              <span class="walletpage-address-value mono fs-13px color-text-secondary" :title="tx.to || '-'">
                <template v-if="tx.to && tx.to.length > 10">
                  {{ tx.to.slice(0, 10) }}…{{ tx.to.slice(-8) }}
                </template>
                <template v-else-if="tx.to">
                  {{ tx.to }}
                </template>
                <template v-else>
                  <span class="walletpage-text-muted color-text-tertiary">-</span>
                </template>
              </span>
              <button
                v-if="tx.to"
                class="walletpage-action-icon walletpage-copy-btn flex-align-justify-center color-text-secondary cursor-pointer border-radius-6px border-1 bg-card transition-all-02 flex-shrink-0"
                @click.stop="copyToClipboard(tx.to, 'Address copied!')"
                title="Copy address"
                aria-label="Copy to address"
              >
                <Copy :size="14" />
              </button>
            </div>

            <div class="col-hash flex-align-center gap-50">
              <span class="walletpage-hash-value color-text-secondary fs-13px mono" :title="tx.txhash">
                {{ tx.txhash.slice(0, 8) }}…{{ tx.txhash.slice(-6) }}
              </span>
              <button
                class="walletpage-action-icon walletpage-explorer-btn flex-align-justify-center color-text-secondary cursor-pointer border-radius-6px border-1 bg-card transition-all-02 flex-shrink-0"
                @click.stop="openTransactionTab(tx.txhash)"
                title="Open in explorer"
                aria-label="Open transaction in new tab"
              >
                <ExternalLink :size="14" />
              </button>
              <button class="walletpage-action-icon walletpage-copy-btn flex-align-justify-center color-text-secondary cursor-pointer border-radius-6px border-1 bg-card transition-all-02 flex-shrink-0" @click.stop="copyToClipboard(tx.txhash, 'Hash copied!')" title="Copy hash">
                <Copy :size="14" />
              </button>
            </div>

            <div class="col-status">
              <span class="walletpage-status-badge flex-inline-align-center fs-075rem txt-weight-light border-radius-6px nowrap" :class="(tx.code === undefined || tx.code === 0) ? 'success badge-success' : 'failed badge-error'">
                {{ (tx.code === undefined || tx.code === 0) ? 'Success' : 'Failed' }}
              </span>
            </div>

            <div class="col-time">
              <span class="walletpage-time-value flex flex-column color-text-primary fw-500 fs-13px gap-2px">
                {{ new Date(tx.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }}
                <span class="walletpage-time-hour fs-075rem color-text-tertiary txt-weight-normal">{{ new Date(tx.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Address Book View -->
      <div v-else-if="currentView === 'addressbook'" class="walletpage-content-section flex flex-column gap-150 w-full">
        <div class="walletpage-section-header flex-align-center-justify-space-between flex-wrap-wrap gap-100">
          <h3>Saved Addresses</h3>
          <button class="walletpage-action-btn primary flex-inline-align-center gap-62 border-radius-10px fw-500 cursor-pointer fs-14px border-1-transparent transition-all-02" @click="openAddContactModal">
            <Plus :size="16" />
            <span>Add Contact</span>
          </button>
        </div>

        <div class="walletpage-empty-state margin-top-200 padding-200 text-center border-radius-16px bg-secondary" v-if="!contacts.length && !contactsLoading">
          <div class="walletpage-empty-icon flex-align-justify-center size-48px border-radius-full bg-secondary color-accent-secondary">
            <Users :size="32" />
          </div>
          <h3>No Contacts Yet</h3>
          <p>Add addresses you frequently send to for quick access.</p>
          <button class="walletpage-connect-btn flex-inline-align-center border-radius-full fs-085rem cursor-pointer gap-35 border-none color-white padding-62-100" @click="openAddContactModal">
            <Plus :size="16" />
            <span>Add First Contact</span>
          </button>
        </div>

        <div v-else-if="contactsLoading" class="walletpage-empty-state margin-top-200 padding-200 text-center border-radius-16px bg-secondary">
          <div class="walletpage-empty-icon flex-align-justify-center size-48px border-radius-full bg-secondary color-accent-secondary">
            <Users :size="32" />
          </div>
          <h3>Loading contacts…</h3>
        </div>

        <div v-else class="walletpage-contacts-grid gap-100 margin-top-150 grid">
          <div v-for="contact in contacts" :key="contact.id" class="walletpage-contact-card border-radius-12px padding-125 bg-card border-1 transition-all-02">
            <div class="walletpage-contact-header flex-align-center gap-87 margin-bottom-75">
              <div class="walletpage-contact-avatar flex-align-justify-center size-48px border-radius-circle txt-weight-medium bg-gradient-primary color-white fs-125rem flex-shrink-0">
                {{ contact.name.charAt(0).toUpperCase() }}
              </div>
              <div class="walletpage-contact-info flex-1 min-w-0">
                <h4>{{ contact.name }}</h4>
                <p class="walletpage-contact-address color-text-tertiary fs-13px overflow-hidden txt-overflow-ellipsis nowrap mono" :title="contact.address">
                  {{ contact.address.slice(0, 12) }}...{{ contact.address.slice(-8) }}
                </p>
              </div>
            </div>
            <p class="walletpage-contact-note color-text-secondary margin-bottom-87 fs-14px line-height-15" v-if="contact.note">{{ contact.note }}</p>
            <div class="walletpage-contact-actions flex flex-wrap-wrap gap-50">
              <button class="walletpage-contact-btn send flex-align-justify-center flex-1 color-text-secondary fw-500 cursor-pointer padding-50-75 border-1 border-radius-8px bg-primary fs-13px gap-35 transition-all-02" @click="sendToContact(contact)">
                <Send :size="16" />
                <span>Send</span>
              </button>
              <button class="walletpage-contact-btn copy flex-align-justify-center flex-1 color-text-secondary fw-500 cursor-pointer padding-50-75 border-1 border-radius-8px bg-primary fs-13px gap-35 transition-all-02" @click="copyToClipboard(contact.address, 'Address copied!')">
                <Copy :size="16" />
                <span>Copy</span>
              </button>
              <button class="walletpage-contact-btn edit flex-align-justify-center flex-1 color-text-secondary fw-500 cursor-pointer padding-50-75 border-1 border-radius-8px bg-primary fs-13px gap-35 transition-all-02" @click="editContact(contact)">
                <Edit :size="16" />
                <span>Edit</span>
              </button>
              <button class="walletpage-contact-btn delete flex-align-justify-center flex-1 color-text-secondary fw-500 cursor-pointer padding-50-75 border-1 border-radius-8px bg-primary fs-13px gap-35 transition-all-02" @click="deleteContact(contact)">
                <Trash2 :size="16" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Recurring Payments View -->
      <div v-else-if="currentView === 'recurring'" class="walletpage-content-section walletpage-recurring-section flex flex-column gap-150 w-full padding-0 gap-0">
        <SubscriptionsView 
          ref="subscriptionsRef"
          @execute-payment="executeRecurringPayment"
          @toast="showToast"
        />
      </div>

    </main>

    <!-- Asset Transfer Modal -->
    <Transition name="fade">
      <div v-if="showAssetTransferModal" class="walletpage-modal-overlay flex-align-justify-center padding-100 fixed inset-0" @click="closeAssetTransferModal">
        <div class="walletpage-modal-content send-modal asset-transfer-modal w-full bg-primary border-radius-16px overflow-y-auto max-w-500px max-h-90vh" @click.stop>
          <div class="walletpage-modal-header flex-align-center-justify-space-between border-bottom-1">
            <div class="modal-title-wrapper flex-align-center gap-75">
              <div class="walletpage-modal-icon flex-align-justify-center size-40px border-radius-10px bg-gradient-primary color-white">
                <ArrowLeftRight :size="20" />
              </div>
              <h3>IBC Transfer</h3>
            </div>
            <button class="walletpage-modal-close flex-align-justify-center size-36px border-radius-10px color-text-secondary cursor-pointer border-1 bg-card transition-all-02" @click="closeAssetTransferModal">
              <X :size="18" />
            </button>
          </div>
          <div class="walletpage-modal-body padding-150" v-if="assetTransferContext">
            <div class="walletpage-info-banner border-radius-10px margin-bottom-150 color-text-primary bg-secondary border-1 fs-14px line-height-15 padding-87-100">
              <span>
                Move this asset across linked IBC chains. Use Send to move it on its current chain, or keep the prefilled destination wallet to bridge it back.
              </span>
            </div>

            <div class="walletpage-form-group margin-bottom-125">
              <label>Asset</label>
              <div class="walletpage-input-wrapper readonly relative">
                <input
                  class="walletpage-form-input w-full border-radius-10px color-text-primary padding-75-100 border-2 fs-15px bg-card transition-all-02 mono"
                  type="text"
                  :value="`${assetTransferContext.displayName} (${assetTransferContext.displaySymbol})`"
                  readonly
                />
              </div>
            </div>

            <div class="walletpage-asset-modal-grid gap-100 grid">
              <div class="walletpage-form-group margin-bottom-125">
                <label>From chain</label>
                <div class="walletpage-input-wrapper readonly relative">
                  <input class="walletpage-form-input w-full border-radius-10px color-text-primary padding-75-100 border-2 fs-15px bg-card transition-all-02 mono" type="text" :value="assetTransferContext.chainLabel" readonly />
                </div>
              </div>
              <div class="walletpage-form-group margin-bottom-125">
                <label>To chain</label>
                <div class="walletpage-input-wrapper relative">
                  <select class="walletpage-form-input walletpage-form-select w-full border-radius-10px color-text-primary cursor-pointer padding-75-100 border-2 fs-15px bg-card transition-all-02 mono" v-model="assetTransferForm.destinationKey">
                    <option
                      v-for="target in assetTransferContext.transferTargets"
                      :key="target.key"
                      :value="target.key"
                    >
                      {{ target.chainLabel }}
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <div class="walletpage-form-group margin-bottom-125">
              <label>From address</label>
              <div class="walletpage-input-wrapper readonly relative">
                <input class="walletpage-form-input w-full border-radius-10px color-text-primary padding-75-100 border-2 fs-15px bg-card transition-all-02 mono" type="text" :value="assetTransferContext.ownerAddress" readonly />
              </div>
            </div>

            <div class="walletpage-form-group margin-bottom-125">
              <label>Recipient <span class="walletpage-required color-error">*</span></label>
              <div class="walletpage-input-wrapper relative">
                <input
                  class="walletpage-form-input w-full border-radius-10px color-text-primary padding-75-100 border-2 fs-15px bg-card transition-all-02 mono"
                  type="text"
                  v-model="assetTransferForm.recipient"
                  :placeholder="selectedAssetTransferTarget?.defaultRecipient || 'Destination address'"
                />
              </div>
              <div v-if="selectedAssetTransferTarget" class="walletpage-field-hint color-text-secondary margin-top-50 fs-13px">
                Default wallet on destination: {{ selectedAssetTransferTarget.defaultRecipient }}
              </div>
            </div>

            <div class="walletpage-form-group margin-bottom-125">
              <label>Amount <span class="walletpage-required color-error">*</span></label>
              <div class="walletpage-input-wrapper walletpage-amount-input relative">
                <input
                  class="walletpage-form-input w-full border-radius-10px color-text-primary padding-75-100 border-2 fs-15px bg-card transition-all-02 mono"
                  type="text"
                  inputmode="decimal"
                  v-model="assetTransferForm.amount"
                  placeholder="0.000000"
                  @input="validateAssetTransferAmountInput"
                />
                <span class="walletpage-input-suffix txt-weight-light color-text-secondary absolute fs-14px cursor-events-none top-half">{{ assetTransferContext.displaySymbol }}</span>
              </div>
              <div class="walletpage-balance-hint color-text-secondary margin-top-50 fs-13px">
                Available: {{ assetTransferContext.displayAmount }} {{ assetTransferContext.displaySymbol }}
              </div>
            </div>

            <div class="walletpage-tx-summary margin-top-150 margin-bottom-150 border-radius-12px padding-0 border-1 bg-secondary overflow-hidden">
              <div class="walletpage-summary-header txt-weight-medium color-text-secondary text-uppercase bg-hover border-bottom-1 fs-13px letter-spacing-005em padding-87-100">
                <span>Transfer Summary</span>
              </div>
              <div class="walletpage-summary-row flex-align-center-justify-space-between color-text-secondary fs-15px border-bottom-1 padding-87-100">
                <span>Route</span>
                <span class="walletpage-summary-value txt-weight-light color-text-primary mono">{{ selectedAssetTransferTarget?.routeLabel || 'Select destination' }}</span>
              </div>
              <div class="walletpage-summary-row flex-align-center-justify-space-between color-text-secondary fs-15px border-bottom-1 padding-87-100">
                <span>Source chain</span>
                <span class="walletpage-summary-value txt-weight-light color-text-primary mono">{{ assetTransferContext.chainLabel }}</span>
              </div>
              <div class="walletpage-summary-row total flex-align-center-justify-space-between color-text-secondary fs-15px border-bottom-1 padding-87-100">
                <span>Destination chain</span>
                <span class="walletpage-summary-value txt-weight-light color-text-primary mono">{{ selectedAssetTransferTarget?.chainLabel || 'Unknown' }}</span>
              </div>
            </div>

            <button
              class="walletpage-btn-modal-primary disabled-fade-50 flex-align-justify-center w-full border-radius-12px txt-weight-light gap-62 cursor-pointer border-none bg-gradient-primary color-white fs-16px transition-all-02"
              @click="confirmAssetTransfer"
              :disabled="!canSubmitAssetTransfer || assetTransferSending"
            >
              <ArrowLeftRight :size="18" v-if="!assetTransferSending" />
              <span class="walletpage-spinner ring-spinner-sm border-radius-circle" v-else></span>
              <span>{{ assetTransferSending ? 'Transferring...' : 'IBC Transfer' }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Send Modal -->
    <Transition name="fade">
      <div v-if="showSendModal" class="walletpage-modal-overlay flex-align-justify-center padding-100 fixed inset-0" @click="closeSendModal">
        <div class="walletpage-modal-content send-modal w-full bg-primary border-radius-16px overflow-y-auto max-w-500px max-h-90vh" @click.stop>
          <div class="walletpage-modal-header flex-align-center-justify-space-between border-bottom-1">
            <div class="modal-title-wrapper flex-align-center gap-75">
              <div class="walletpage-modal-icon flex-align-justify-center size-40px border-radius-10px bg-gradient-primary color-white">
                <Send :size="20" />
              </div>
              <h3>{{ sendModalTitle }}</h3>
            </div>
            <button class="walletpage-modal-close flex-align-justify-center size-36px border-radius-10px color-text-secondary cursor-pointer border-1 bg-card transition-all-02" @click="closeSendModal">
              <X :size="18" />
            </button>
          </div>
          <div class="walletpage-modal-body padding-150">
            <div class="walletpage-info-banner border-radius-10px margin-bottom-150 color-text-primary bg-secondary border-1 fs-14px line-height-15 padding-87-100">
              <span v-if="sendAssetContext">
                <template v-if="isIbcSend">
                  Move this asset from {{ sendSourceChainLabel }} to another linked chain over IBC.
                </template>
                <template v-else>
                  Send this asset on {{ sendSourceChainLabel }} to any {{ sendSourcePrefix }}1... address. Use “To Other Chain” only when you want to bridge it.
                </template>
              </span>
              <span v-else>
                💡 Your first transaction may take up to 60 seconds. <br>
                After that, transactions are confirmed within ~6 seconds.</span>
            </div>

            <div class="walletpage-form-group margin-bottom-125">
              <label>From</label>
              <div class="walletpage-input-wrapper readonly relative">
                <input class="walletpage-form-input w-full border-radius-10px color-text-primary padding-75-100 border-2 fs-15px bg-card transition-all-02 mono" type="text" :value="sendSourceAddress" readonly />
              </div>
              <div class="walletpage-field-hint color-text-secondary margin-top-50 fs-13px">Chain: {{ sendSourceChainLabel }}</div>
            </div>

            <div class="walletpage-form-group margin-bottom-125">
              <label>Asset</label>
              <div class="walletpage-input-wrapper readonly relative">
                <input class="walletpage-form-input w-full border-radius-10px color-text-primary padding-75-100 border-2 fs-15px bg-card transition-all-02 mono" type="text" :value="`${sendAssetName} (${sendAssetSymbol})`" readonly />
              </div>
            </div>

            <div v-if="!sendAssetContext" class="walletpage-form-group margin-bottom-125">
              <label>Send to</label>
              <div class="walletpage-input-wrapper relative">
                <select class="walletpage-form-input walletpage-form-select w-full border-radius-10px color-text-primary cursor-pointer padding-75-100 border-2 fs-15px bg-card transition-all-02 mono" v-model="sendTargetMode">
                  <option value="lumen">On the current chain</option>
                  <option value="ibc">Across IBC to another chain</option>
                </select>
              </div>
            </div>

            <div v-if="isIbcSend" class="walletpage-form-group margin-bottom-125">
              <label>IBC route <span class="walletpage-required color-error">*</span></label>
              <div class="walletpage-input-wrapper relative">
                <select
                  class="walletpage-form-input walletpage-form-select w-full border-radius-10px color-text-primary cursor-pointer padding-75-100 border-2 fs-15px bg-card transition-all-02 mono"
                  v-model="ibcForm.sourceChannel"
                  :disabled="ibcChannelsLoading || !ibcChannels.length"
                >
                  <option value="" disabled>
                    {{ ibcChannelsLoading ? 'Loading IBC channels...' : 'Select an IBC route' }}
                  </option>
                  <option
                    v-for="channel in ibcChannels"
                    :key="`${channel.portId}:${channel.channelId}`"
                    :value="channel.channelId"
                  >
                    {{ channel.label }}
                  </option>
                </select>
              </div>
              <div v-if="selectedIbcChannel" class="walletpage-field-hint color-text-secondary margin-top-50 fs-13px">
                Route: {{ selectedIbcChannel.portId }}/{{ selectedIbcChannel.channelId }}
                <span v-if="selectedIbcChannel.chainId"> · Destination chain: {{ selectedIbcChannel.chainId }}</span>
              </div>
              <div v-else-if="ibcChannelsError" class="walletpage-field-hint error color-text-secondary margin-top-50 fs-13px">
                {{ ibcChannelsError }}
              </div>
            </div>

            <div class="walletpage-form-group margin-bottom-125">
              <label>{{ isIbcSend ? 'Destination address' : 'Recipient' }} <span class="walletpage-required color-error">*</span></label>
              <div class="walletpage-input-wrapper-relative relative">
                <div class="walletpage-input-wrapper relative">
                  <input 
                    class="walletpage-form-input w-full border-radius-10px color-text-primary padding-75-100 border-2 fs-15px bg-card transition-all-02 mono" 
                    type="text" 
                    v-model="sendForm.recipient" 
                    :placeholder="sendRecipientPlaceholder"
                  />
                  <button 
                    class="walletpage-input-action-btn flex-align-justify-center color-text-secondary cursor-pointer absolute padding-50 border-none bg-hover border-radius-6px transition-all-02 top-half" 
                    @click="openQrScanner"
                    type="button"
                    title="Scan QR Code"
                  >
                    <QrCode :size="16" />
                  </button>
                  <button 
                    v-if="contacts.length > 0" 
                    class="walletpage-input-action-btn flex-align-justify-center color-text-secondary cursor-pointer absolute padding-50 border-none bg-hover border-radius-6px transition-all-02 top-half" 
                    @click="showContactPicker = !showContactPicker"
                    type="button"
                    title="Select from contacts"
                  >
                    <Users :size="16" />
                  </button>
                </div>
                <div v-if="showContactPicker" class="walletpage-contact-picker border-radius-12px absolute top-full margin-top-50 bg-card border-1 overflow-hidden">
                  <div class="walletpage-picker-header flex-align-center-justify-space-between txt-weight-light color-text-primary padding-75-100 bg-secondary border-bottom-1 fs-14px">
                    <span>Select Contact</span>
                    <button class="walletpage-picker-close hover-fill-primary flex-align-center color-text-tertiary cursor-pointer padding-25 border-none bg-transparent border-radius-4px transition-all-02" @click="showContactPicker = false">
                      <X :size="14" />
                    </button>
                  </div>
                  <div class="walletpage-picker-list overflow-y-auto">
                    <button 
                      v-for="contact in contacts" 
                      :key="contact.id"
                      class="walletpage-picker-item flex-align-center gap-75 w-full text-left cursor-pointer padding-75-100 border-none bg-transparent transition-all-02 border-bottom-1"
                      @click="selectContactForSend(contact)"
                    >
                      <div class="walletpage-picker-avatar flex-align-justify-center size-36px border-radius-circle txt-weight-medium bg-gradient-primary color-white fs-14px flex-shrink-0">{{ contact.name.charAt(0).toUpperCase() }}</div>
                      <div class="walletpage-picker-info flex flex-column flex-1 gap-25 min-w-0">
                        <span class="walletpage-picker-name txt-weight-light color-text-primary fs-14px">{{ contact.name }}</span>
                        <span class="walletpage-picker-address fs-075rem color-text-tertiary mono">{{ contact.address.slice(0, 12) }}...{{ contact.address.slice(-8) }}</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="walletpage-form-group margin-bottom-125">
              <label>Amount ({{ sendAssetSymbol }}) <span class="walletpage-required color-error">*</span></label>
              <div class="walletpage-input-wrapper walletpage-amount-input relative">
                <input 
                  class="walletpage-form-input w-full border-radius-10px color-text-primary padding-75-100 border-2 fs-15px bg-card transition-all-02 mono" 
                  type="text" 
                  inputmode="decimal"
                  v-model="sendForm.amount"
                  placeholder="0.000000"
                  @input="validateAmountInput"
                />
                <span class="walletpage-input-suffix txt-weight-light color-text-secondary absolute fs-14px cursor-events-none top-half">{{ sendAssetSymbol }}</span>
              </div>
              <div class="walletpage-balance-hint color-text-secondary margin-top-50 fs-13px" v-if="sendAvailableLabel">
                Available: {{ sendAvailableLabel }} {{ sendAssetSymbol }}
              </div>
            </div>

            <div class="walletpage-tx-summary margin-top-150 margin-bottom-150 border-radius-12px padding-0 border-1 bg-secondary overflow-hidden">
              <div class="walletpage-summary-header txt-weight-medium color-text-secondary text-uppercase bg-hover border-bottom-1 fs-13px letter-spacing-005em padding-87-100">
                <span>{{ isIbcSend ? 'Transfer Summary' : 'Transaction Summary' }}</span>
              </div>
              <div class="walletpage-summary-row flex-align-center-justify-space-between color-text-secondary fs-15px border-bottom-1 padding-87-100">
                <span>{{ isIbcSend ? 'Transfer amount' : 'Amount debited' }}</span>
                <span class="walletpage-summary-value txt-weight-light color-text-primary mono">{{ sendSummary.amount }} {{ sendAssetSymbol }}</span>
              </div>
              <div v-if="!isIbcSend" class="walletpage-summary-row flex-align-center-justify-space-between color-text-secondary fs-15px border-bottom-1 padding-87-100">
                <span>Chain</span>
                <span class="walletpage-summary-value txt-weight-light color-text-primary mono">{{ sendSourceChainLabel }}</span>
              </div>
              <div v-if="showSendTaxBreakdown" class="walletpage-summary-row flex-align-center-justify-space-between color-text-secondary fs-15px border-bottom-1 padding-87-100">
                <span>Tax</span>
                <span class="walletpage-summary-value tax txt-weight-light color-text-primary mono">{{ sendSummary.taxLabel }}</span>
              </div>
              <div v-if="showSendTaxBreakdown" class="walletpage-summary-row total flex-align-center-justify-space-between color-text-secondary fs-15px border-bottom-1 padding-87-100">
                <span>Receiver net</span>
                <span class="walletpage-summary-value txt-weight-light color-text-primary mono">{{ sendSummary.receiver }} {{ sendAssetSymbol }}</span>
              </div>
              <div v-if="isIbcSend" class="walletpage-summary-row flex-align-center-justify-space-between color-text-secondary fs-15px border-bottom-1 padding-87-100">
                <span>Route</span>
                <span class="walletpage-summary-value txt-weight-light color-text-primary mono">{{ sendSummary.routeLabel }}</span>
              </div>
              <div v-if="isIbcSend" class="walletpage-summary-row total flex-align-center-justify-space-between color-text-secondary fs-15px border-bottom-1 padding-87-100">
                <span>Destination chain</span>
                <span class="walletpage-summary-value txt-weight-light color-text-primary mono">{{ sendSummary.destinationChain }}</span>
              </div>
            </div>

            <button class="walletpage-btn-modal-primary disabled-fade-50 flex-align-justify-center w-full border-radius-12px txt-weight-light gap-62 cursor-pointer border-none bg-gradient-primary color-white fs-16px transition-all-02" @click="confirmSendPreview" :disabled="!canSend || sendingTransaction">
              <Send :size="18" v-if="!sendingTransaction" />
              <span class="walletpage-spinner ring-spinner-sm border-radius-circle" v-else></span>
              <span>{{ sendPrimaryActionLabel }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Receive Modal -->
    <Transition name="fade">
      <div v-if="showReceiveModal" class="walletpage-modal-overlay flex-align-justify-center padding-100 fixed inset-0" @click="closeReceiveModal">
        <div class="walletpage-modal-content receive-modal w-full bg-primary border-radius-16px overflow-y-auto max-w-500px max-h-90vh" @click.stop>
          <div class="walletpage-modal-header flex-align-center-justify-space-between border-bottom-1">
            <div class="modal-title-wrapper flex-align-center gap-75">
              <div class="walletpage-modal-icon receive flex-align-justify-center size-40px border-radius-10px bg-gradient-primary color-white">
                <ArrowDownLeft :size="20" />
              </div>
              <h3>Receive LMN</h3>
            </div>
            <button class="walletpage-modal-close flex-align-justify-center size-36px border-radius-10px color-text-secondary cursor-pointer border-1 bg-card transition-all-02" @click="closeReceiveModal">
              <X :size="18" />
            </button>
          </div>
          <div class="walletpage-modal-body padding-150">
            <div class="walletpage-info-banner border-radius-10px margin-bottom-150 color-text-primary bg-secondary border-1 fs-14px line-height-15 padding-87-100">
              <span>📱 Share your wallet address or QR code to receive LMN from another wallet.</span>
            </div>

            <div class="walletpage-qr-section flex-justify-center">
              <div class="walletpage-qr-wrapper padding-125 bg-card border-2 border-radius-16px">
                <img 
                  v-if="qrCodeDataUrl" 
                  :src="qrCodeDataUrl"
                  alt="QR Code"
                  class="walletpage-qr-image block border-radius-8px"
                />
                <div v-else class="walletpage-qr-placeholder flex-align-justify-center color-text-tertiary bg-secondary border-radius-8px fs-14px">
                  <div class="walletpage-qr-loading flex-align-center gap-50 color-text-secondary">Generating QR Code...</div>
                </div>
              </div>
            </div>

            <div class="walletpage-address-box border-radius-12px padding-125 border-2 bg-secondary">
              <div class="walletpage-address-label txt-weight-medium color-text-secondary text-uppercase fs-14px margin-bottom-75 letter-spacing-005em">Your Wallet Address</div>
              <div class="walletpage-address-value mono fs-13px color-text-secondary">{{ address || '-' }}</div>
              <button class="walletpage-btn-copy-address disabled-fade-50 flex-align-justify-center w-full border-radius-10px txt-weight-light color-primary gap-50 cursor-pointer bg-card padding-75 fs-15px transition-all-02" type="button" @click="copyAddressWithToast" :disabled="!address">
                <Copy :size="16" />
                <span>Copy Address</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Add/Edit Contact Modal -->
    <Transition name="fade">
      <div v-if="showContactModal" class="walletpage-modal-overlay flex-align-justify-center padding-100 fixed inset-0" @click="closeContactModal">
        <div class="walletpage-modal-content walletpage-contact-modal w-full bg-primary border-radius-16px overflow-y-auto max-w-500px max-h-90vh" @click.stop>
          <div class="walletpage-modal-header flex-align-center-justify-space-between border-bottom-1">
            <div class="modal-title-wrapper flex-align-center gap-75">
              <div class="walletpage-modal-icon flex-align-justify-center size-40px border-radius-10px bg-gradient-primary color-white">
                <Users :size="20" />
              </div>
              <h3>{{ editingContact ? 'Edit Contact' : 'Add Contact' }}</h3>
            </div>
            <button class="walletpage-modal-close flex-align-justify-center size-36px border-radius-10px color-text-secondary cursor-pointer border-1 bg-card transition-all-02" @click="closeContactModal">
              <X :size="18" />
            </button>
          </div>
          <div class="walletpage-modal-body padding-150">
            <div class="walletpage-form-group margin-bottom-125">
              <label>Name <span class="walletpage-required color-error">*</span></label>
              <div class="walletpage-input-wrapper relative">
                <input 
                  class="walletpage-form-input w-full border-radius-10px color-text-primary padding-75-100 border-2 fs-15px bg-card transition-all-02 mono" 
                  type="text" 
                  v-model="contactForm.name" 
                  placeholder="Enter contact name" 
                />
              </div>
            </div>

            <div class="walletpage-form-group margin-bottom-125">
              <label>Address <span class="walletpage-required color-error">*</span></label>
              <div class="walletpage-input-wrapper relative">
                <input 
                  class="walletpage-form-input w-full border-radius-10px color-text-primary padding-75-100 border-2 fs-15px bg-card transition-all-02 mono" 
                  type="text" 
                  v-model="contactForm.address" 
                  placeholder="lmn1..." 
                  :readonly="!!editingContact"
                />
              </div>
            </div>

            <div class="walletpage-form-group margin-bottom-125">
              <label>Note (optional)</label>
              <div class="walletpage-input-wrapper relative">
                <textarea 
                  class="walletpage-form-input walletpage-form-textarea w-full border-radius-10px color-text-primary padding-75-100 border-2 fs-15px bg-card transition-all-02 mono" 
                  v-model="contactForm.note" 
                  placeholder="Add a note about this contact"
                  rows="3"
                ></textarea>
              </div>
            </div>

            <button 
              class="walletpage-btn-modal-primary disabled-fade-50 flex-align-justify-center w-full border-radius-12px txt-weight-light gap-62 cursor-pointer border-none bg-gradient-primary color-white fs-16px transition-all-02" 
              @click="saveContact" 
              :disabled="!contactForm.name || !contactForm.address || savingContact"
            >
              <Check :size="18" v-if="!savingContact" />
              <span class="walletpage-spinner ring-spinner-sm border-radius-circle" v-else></span>
              <span>{{ savingContact ? 'Saving...' : (editingContact ? 'Update Contact' : 'Add Contact') }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- QR Scanner Modal -->
    <QrScanner 
      v-if="showQrScanner" 
      @close="closeQrScanner"
      @scan="handleQrScan"
      :title="qrScannerTitle"
    />

    <!-- Delete Confirmation Modal -->
    <Transition name="fade">
      <div v-if="showDeleteConfirmModal" class="walletpage-modal-overlay flex-align-justify-center padding-100 fixed inset-0" @click="cancelDeleteContact">
        <div class="walletpage-modal-content walletpage-delete-confirm-modal w-full bg-primary border-radius-16px overflow-y-auto max-w-500px max-h-90vh" @click.stop>
          <div class="walletpage-modal-header flex-align-center-justify-space-between border-bottom-1">
            <div class="modal-title-wrapper flex-align-center gap-75">
              <div class="walletpage-modal-icon delete flex-align-justify-center size-40px border-radius-10px bg-gradient-primary color-white">
                <Trash2 :size="20" />
              </div>
              <h3>Delete Contact</h3>
            </div>
            <button class="walletpage-modal-close flex-align-justify-center size-36px border-radius-10px color-text-secondary cursor-pointer border-1 bg-card transition-all-02" @click="cancelDeleteContact">
              <X :size="18" />
            </button>
          </div>
          <div class="walletpage-modal-body padding-150">
            <p class="walletpage-confirm-message color-text-primary fs-15px margin-bottom-50 line-height-15">
              Are you sure you want to delete <strong>{{ contactToDelete?.name }}</strong>?
            </p>
            <p class="walletpage-confirm-submessage color-text-tertiary margin-bottom-150 fs-14px">
              This action cannot be undone.
            </p>
            <div class="walletpage-modal-actions flex gap-75 margin-top-150">
              <button class="walletpage-btn-modal-secondary flex-align-justify-center flex-1 border-radius-10px color-text-primary txt-weight-light cursor-pointer gap-50 padding-75-125 border-1 bg-secondary fs-15px transition-all-02" @click="cancelDeleteContact">
                Cancel
              </button>
              <button class="walletpage-btn-modal-danger flex-align-justify-center flex-1 border-radius-10px txt-weight-light cursor-pointer gap-50 padding-75-125 border-none color-white fs-15px transition-all-02" @click="confirmDeleteContact">
                <Trash2 :size="18" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount, inject } from 'vue';
import { fromBech32, toBech32 } from '@cosmjs/encoding';
import { useInternalLumen } from '../../composables/useInternalLumen';

const currentTabRefresh = inject<any>('currentTabRefresh', null);
const openInNewTab = inject<((url: string) => void) | null>('openInNewTab', null);
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
  X,
  Copy,
  ExternalLink,
  ChevronDown,
  Check,
  AlertCircle,
  User,
  Users,
  Edit,
  Trash2,
  Download,
  Upload,
  QrCode,
  Calendar,
  RefreshCw
} from 'lucide-vue-next';
import { profilesState, activeProfileId } from '../profilesStore';
import { fetchActivities, type Activity, type ActivityType, clearActivitiesCache } from '../services/activities';
import QRCode from 'qrcode';
import InternalSidebar from '../../components/InternalSidebar.vue';
import QrScanner from '../../components/QrScanner.vue';
import SubscriptionsView from '../../components/SubscriptionsView.vue';
import { getWalletConnectService, parseWalletConnectUri } from '../services/walletconnect';
import { getRecurringPaymentsService } from '../services/recurringPayments';
import { useToast } from '../../composables/useToast';
import { useTheme } from '../../composables/useTheme';

const currentView = ref<'overview' | 'assets' | 'dex' | 'transactions' | 'addressbook' | 'recurring'>('overview');
const isConnected = ref(false);
const showBalance = ref(true);
const manualDisconnected = ref(false);

const profiles = profilesState;
const activeProfile = computed(() => profiles.value.find((p) => p.id === activeProfileId.value) || null);
const activeProfileDisplay = computed(() => activeProfile.value?.name || activeProfile.value?.id || '');

const address = computed(() => {
  const p: any = activeProfile.value as any;
  return (p && (p.address || p.walletAddress)) || '';
});

const balanceLmn = ref<number | null>(null);
const balanceLoading = ref(false);
const balanceError = ref('');

const showSendModal = ref(false);
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
const contactForm = ref({
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
const txFilterType = ref<'all' | 'send' | 'receive'>('all');
const txFilterStatus = ref<'all' | 'success' | 'pending' | 'failed'>('all');
const txSearchQuery = ref('');

type SendTargetMode = 'lumen' | 'ibc';
type IbcChannelOption = {
  channelId: string;
  portId: string;
  counterpartyChannelId: string;
  counterpartyPortId: string;
  connectionId: string;
  state: string;
  chainId: string;
  prefixHints: string[];
  label: string;
};

type KnownIbcChainMeta = {
  label: string;
  addressPrefix: string;
  restEndpoint: string;
  rpcEndpoint: string;
  nativeDenom: string;
  feeDenom: string;
  minGasPrice: number;
  iconText: string;
  chainRegistryName?: string;
};

type AssetTransferTarget = {
  key: string;
  chainId: string;
  chainLabel: string;
  addressPrefix: string;
  defaultRecipient: string;
  sourceChannel: string;
  sourcePort: string;
  routeLabel: string;
};

type AssetRow = {
  id: string;
  chainId: string;
  chainLabel: string;
  ownerAddress: string;
  denom: string;
  microAmount: string;
  displayAmount: string;
  displayName: string;
  displaySymbol: string;
  iconText: string;
  iconClass: string;
  iconUrl: string;
  addressLabel: string;
  traceLabel: string;
  routeLabel: string;
  error: string;
  sendEnabled: boolean;
  sendButtonLabel: string;
  transferTargets: AssetTransferTarget[];
  transferEnabled: boolean;
  transferButtonLabel: string;
  rpcEndpoint: string;
  restEndpoint: string;
  feeDenom: string;
};

type DexQuickLink = {
  label: string;
  url: string;
};

type DexMarketPreview = {
  pair: string;
  lastPrice: string;
  quoteVolume: string;
};

type DexListingConfig = {
  key: string;
  name: string;
  chainId: string;
  chainLabel: string;
  restEndpoint: string;
  baseUrl: string;
  openUrl?: string;
  logoUrl: string;
  logoTheme?: 'default' | 'dark';
  iconText: string;
  description: string;
  fallbackLinks: DexQuickLink[];
};

type DexStatus = 'idle' | 'loading' | 'online' | 'degraded' | 'error';

type DexRow = DexListingConfig & {
  status: DexStatus;
  siteTitle: string;
  tradingPairsCount: number | null;
  liquidityPoolsCount: number | null;
  featuredMarketPair: string;
  featuredPoolPair: string;
  quickLinks: DexQuickLink[];
  marketPreview: DexMarketPreview | null;
  error: string;
  lastCheckedAt: string;
};

const KNOWN_IBC_CHAIN_METADATA: Record<string, KnownIbcChainMeta> = {
  'beezee-1': {
    label: 'BeeZee',
    addressPrefix: 'bze',
    restEndpoint: 'https://rest.getbze.com',
    rpcEndpoint: 'https://rpc.getbze.com',
    nativeDenom: 'ubze',
    feeDenom: 'ubze',
    minGasPrice: 0.01,
    iconText: 'BZE',
    chainRegistryName: 'beezee'
  },
  'bzetestnet-3': {
    label: 'BeeZee Testnet',
    addressPrefix: 'bze',
    restEndpoint: 'https://testnet.getbze.com',
    rpcEndpoint: 'https://testnet-rpc.getbze.com',
    nativeDenom: 'ubze',
    feeDenom: 'ubze',
    minGasPrice: 0.01,
    iconText: 'BZE',
    chainRegistryName: 'beezee'
  }
};

const DEX_LISTINGS: DexListingConfig[] = [
  {
    key: 'beezee',
    name: 'BeeZee DEX',
    chainId: 'beezee-1',
    chainLabel: 'BeeZee',
    restEndpoint: 'https://rest.getbze.com',
    baseUrl: 'https://dex.getbze.com/',
    openUrl: 'https://dex.getbze.com/',
    logoUrl: 'https://dex.getbze.com/images/beezee_light.svg',
    logoTheme: 'dark',
    iconText: 'BZE',
    description: 'Browse mainnet markets and pools before jumping into the BeeZee DEX.',
    fallbackLinks: [
      { label: 'Swap', url: 'https://dex.getbze.com/' },
      { label: 'Exchange', url: 'https://dex.getbze.com/exchange' },
      { label: 'Pools', url: 'https://dex.getbze.com/pools' },
      { label: 'Staking', url: 'https://staking.getbze.com/' },
      { label: 'Website', url: 'https://getbze.com/' }
    ]
  }
];

const sendForm = ref({
  recipient: '',
  amount: '',
  gasFee: 'medium'
});
const sendAssetContext = ref<AssetRow | null>(null);
const sendTargetMode = ref<SendTargetMode>('lumen');
const ibcForm = ref({
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
const assetTransferForm = ref({
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
const denomTraceCache = new Map<string, { baseDenom: string; path: string } | null>();
const chainRegistryCache = new Map<string, Promise<{ chain: any | null; assets: any[] }>>();
const CHAIN_REGISTRY_CACHE_STORAGE_KEY = 'lumen_chain_registry_cache_v2';
const CHAIN_REGISTRY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// QR Scanner
const showQrScanner = ref(false);
const qrScannerTitle = ref('Scan QR Code');

// Recurring Payments
const subscriptionsRef = ref<any>(null);
const recurringPaymentsService = getRecurringPaymentsService();
const pendingPostTxRefreshTimers = ref<number[]>([]);

const tokenomicsTaxRate = ref<number | null>(null); // 0.01 = 1%

// Use global toast system
const toast = useToast();
const { effectiveTheme } = useTheme();

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
  if (!isConnected.value) return 'Not connected';
  if (balanceLoading.value) return 'Loading...';
  if (balanceError.value) return 'Error';
  if (balanceLmn.value == null) return '0.000000 LMN';
  return `${balanceLmn.value.toFixed(6)} LMN`;
});

const balanceLmnDisplay = computed(() => {
  if (balanceLmn.value == null) return '0.000000';
  return balanceLmn.value.toFixed(6);
});

function getAddressPrefix(value: string): string {
  const raw = String(value || '').trim().toLowerCase();
  const match = raw.match(/^([a-z0-9]{1,24})1[ac-hj-np-z02-9]{6,}$/);
  return match ? match[1] : '';
}

function guessSendTargetMode(value: string): SendTargetMode | null {
  const prefix = getAddressPrefix(value);
  if (!prefix) return null;
  return prefix === senderPrefix.value ? 'lumen' : 'ibc';
}

function derivePrefixHintsFromChainId(chainId: string): string[] {
  const raw = String(chainId || '').trim().toLowerCase();
  if (!raw) return [];

  const candidates = new Set<string>();
  const normalized = raw
    .replace(/(?:[_-]?testnet.*$)|(?:[_-]?mainnet.*$)|(?:[_-]?devnet.*$)|(?:[_-]?localnet.*$)|(?:[_-]?stage.*$)|(?:[_-]?alpha.*$)|(?:[_-]?beta.*$)/, '')
    .replace(/[_-]?\d+$/, '')
    .replace(/[_-]+$/, '');
  const firstToken = normalized.split(/[_-]/)[0] || normalized;

  for (const entry of [normalized, firstToken]) {
    const cleaned = entry.replace(/[^a-z0-9]/g, '');
    if (cleaned) candidates.add(cleaned);
  }

  if (raw.includes('bzetestnet')) candidates.add('bze');
  return Array.from(candidates);
}

function scoreIbcChannel(channel: IbcChannelOption, recipientPrefix: string): number {
  const prefix = String(recipientPrefix || '').trim().toLowerCase();
  if (!prefix) return 0;
  if (channel.prefixHints.includes(prefix)) return 100;
  if (channel.chainId.toLowerCase().includes(prefix)) return 40;
  if (channel.label.toLowerCase().includes(prefix)) return 10;
  return 0;
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
  if (isIbcSend.value) return `Transfer ${sendAssetSymbol.value} To Other Chain`;
  return sendAssetContext.value ? `Send ${sendAssetSymbol.value} On ${sendSourceChainLabel.value}` : 'Send';
});
const sendRecipientPlaceholder = computed(() =>
  isIbcSend.value
    ? 'Enter recipient address on the other chain'
    : `Enter recipient address (${sendSourcePrefix.value}1...)`
);
const sendPrimaryActionLabel = computed(() => {
  if (sendingTransaction.value) return isIbcSend.value ? 'Transferring...' : 'Sending...';
  return isIbcSend.value ? 'Preview Transfer' : 'Preview Send';
});

function autoSelectIbcChannel(force = false) {
  const channels = ibcChannels.value;
  if (!channels.length) {
    ibcForm.value.sourceChannel = '';
    return;
  }

  const current = selectedIbcChannel.value;
  if (!force && current) return;

  if (channels.length === 1) {
    ibcForm.value.sourceChannel = channels[0].channelId;
    ibcForm.value.sourcePort = channels[0].portId;
    return;
  }

  const recipientPrefix = getAddressPrefix(sendForm.value.recipient);
  const ranked = channels
    .map((channel) => ({ channel, score: scoreIbcChannel(channel, recipientPrefix) }))
    .sort((a, b) => b.score - a.score || a.channel.label.localeCompare(b.channel.label));

  const best = ranked[0];
  const fallback = channels[0];
  const next = best && best.score > 0 ? best.channel : fallback;
  ibcForm.value.sourceChannel = next.channelId;
  ibcForm.value.sourcePort = next.portId;
}

async function loadIbcChannels(force = false) {
  if (ibcChannelsLoading.value) return;
  if (ibcChannelsLoaded.value && !force) {
    autoSelectIbcChannel();
    return;
  }

  const net = useInternalLumen()?.net;
  if (!net || typeof net.restGet !== 'function') {
    ibcChannelsError.value = 'Network API not available.';
    ibcChannels.value = [];
    ibcChannelsLoaded.value = false;
    return;
  }

  ibcChannelsLoading.value = true;
  ibcChannelsError.value = '';

  try {
    let payload: any[] = [];
    const transferRes = await net.restGet('/ibc/apps/transfer/v1/channels', { timeout: 15000 });
    if (transferRes && transferRes.ok !== false && Array.isArray(transferRes?.json?.channels)) {
      payload = transferRes.json.channels;
    }

    if (!payload.length) {
      const fallbackRes = await net.restGet('/ibc/core/channel/v1/channels?pagination.limit=200', { timeout: 15000 });
      if (fallbackRes && fallbackRes.ok !== false && Array.isArray(fallbackRes?.json?.channels)) {
        payload = fallbackRes.json.channels;
      }
    }

    const normalized = payload
      .map((entry) => {
        const counterparty = entry?.counterparty || {};
        return {
          channelId: String(entry?.channel_id ?? entry?.channelId ?? '').trim(),
          portId: String(entry?.port_id ?? entry?.portId ?? 'transfer').trim() || 'transfer',
          counterpartyChannelId: String(counterparty?.channel_id ?? counterparty?.channelId ?? '').trim(),
          counterpartyPortId: String(counterparty?.port_id ?? counterparty?.portId ?? '').trim(),
          connectionId: String(entry?.connection_hops?.[0] ?? entry?.connectionHops?.[0] ?? '').trim(),
          state: String(entry?.state || '').trim().toUpperCase()
        };
      })
      .filter((entry) => {
        if (!entry.channelId) return false;
        if (entry.state && entry.state !== 'STATE_OPEN' && entry.state !== 'OPEN') return false;
        return entry.portId === 'transfer';
      });

    const channels = await Promise.all(
      normalized.map(async (entry) => {
        let chainId = '';
        try {
          const clientRes = await net.restGet(
            `/ibc/core/channel/v1/channels/${encodeURIComponent(entry.channelId)}/ports/${encodeURIComponent(entry.portId)}/client_state`,
            { timeout: 10000 }
          );
          chainId = String(
            clientRes?.json?.identified_client_state?.client_state?.chain_id ||
            clientRes?.json?.identified_client_state?.client_state?.chainId ||
            clientRes?.json?.client_state?.chain_id ||
            clientRes?.json?.client_state?.chainId ||
            ''
          ).trim();
        } catch {
          chainId = '';
        }

        const prefixHints = derivePrefixHintsFromChainId(chainId);
        const label = chainId
          ? `${entry.channelId} -> ${chainId}`
          : `${entry.channelId}${entry.counterpartyChannelId ? ` -> ${entry.counterpartyChannelId}` : ''}`;

        return {
          ...entry,
          chainId,
          prefixHints,
          label
        } satisfies IbcChannelOption;
      })
    );

    ibcChannels.value = channels.sort((a, b) => a.label.localeCompare(b.label));
    ibcChannelsLoaded.value = true;

    if (!ibcChannels.value.length) {
      ibcChannelsError.value = 'No open IBC transfer channels found on this network.';
      ibcForm.value.sourceChannel = '';
      return;
    }

    autoSelectIbcChannel(true);
  } catch (error: any) {
    ibcChannels.value = [];
    ibcChannelsLoaded.value = false;
    ibcForm.value.sourceChannel = '';
    ibcChannelsError.value = error?.message || 'Failed to load IBC channels.';
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

  // Apply type filter
  if (txFilterType.value !== 'all') {
    filtered = filtered.filter(tx => tx.type === txFilterType.value);
  }

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

function isDnsUpdateTx(tx: Activity): boolean {
  const action = String(tx.action ?? '').trim();
  return action === '/lumen.dns.v1.MsgUpdate' || action === 'lumen.dns.v1.MsgUpdate';
}

function isDnsTransferTx(tx: Activity): boolean {
  const action = String(tx.action ?? '').trim();
  return action === '/lumen.dns.v1.MsgTransfer' || action === 'lumen.dns.v1.MsgTransfer';
}

function isDnsRegisterTx(tx: Activity): boolean {
  const action = String(tx.action ?? '').trim();
  return action === '/lumen.dns.v1.MsgRegister' || action === 'lumen.dns.v1.MsgRegister';
}

function isWithdrawRewardsTx(tx: Activity): boolean {
  const action = String(tx.action ?? '').trim();
  return (
    action === '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward' ||
    action === 'cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward'
  );
}

function isPublishReleaseTx(tx: Activity): boolean {
  const action = String(tx.action ?? '').trim();
  return (
    action === '/lumen.release.v1.MsgPublishRelease' ||
    action === 'lumen.release.v1.MsgPublishRelease'
  );
}

function getActivityLabel(tx: Activity): string {
  if (isDnsUpdateTx(tx)) return 'Dns update';
  if (isDnsTransferTx(tx)) return 'Dns transfer';
  if (isDnsRegisterTx(tx)) return 'Dns register';
  if (isWithdrawRewardsTx(tx)) return 'Withdraw rewards';
  if (isPublishReleaseTx(tx)) return 'Publish release';
  if (tx.type === 'send') return 'Send';
  if (tx.type === 'receive') return 'Receive';
  return 'Unknown';
}

function getActivityBadgeClass(tx: Activity): string {
  if (isDnsUpdateTx(tx)) return 'dns-update';
  if (isDnsTransferTx(tx)) return 'dns-transfer';
  if (isDnsRegisterTx(tx)) return 'dns-register';
  if (isWithdrawRewardsTx(tx)) return 'withdraw-rewards';
  if (isPublishReleaseTx(tx)) return 'publish-release';
  return tx.type;
}

function getViewTitle(): string {
  const titles: Record<string, string> = {
    overview: 'Wallet Overview',
    assets: 'Assets',
    dex: 'DEX',
    transactions: 'Transactions',
    addressbook: 'Address Book',
    recurring: 'Recurring Payments'
  };
  return titles[currentView.value] || 'Wallet';
}

function getViewDescription(): string {
  const descs: Record<string, string> = {
    overview: 'Manage your Lumen address and on-chain balance (read-only).',
    assets: 'View balances and move assets across linked IBC chains.',
    dex: 'Inspect linked DEXs, check their current state, and open them in a new tab.',
    transactions: 'Recent on-chain transactions for this wallet.',
    addressbook: 'Save frequently used addresses for quick access.',
    recurring: 'Schedule and manage automatic payments and subscriptions.'
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
  } catch (e: any) {
    activitiesError.value = String(e?.message || e || 'Failed to load activities');
    activities.value = [];
  } finally {
    activitiesLoading.value = false;
  }
}

function connectWallet() {
  if (!address.value) {
    window.alert('Create or select a profile first in the top navigation.');
    return;
  }
  manualDisconnected.value = false;
  isConnected.value = true;
  void refreshWallet();
  if (currentView.value === 'assets') {
    void refreshAssets({ force: true });
  }
}

function disconnectWallet() {
  manualDisconnected.value = true;
  isConnected.value = false;
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
      balanceError.value = 'Wallet bridge not available';
      balanceLmn.value = null;
      return;
    }
    const res = await walletApi.getBalance(address.value, { denom: 'ulmn' });
    if (!res || res.ok === false) {
      balanceError.value = res?.error || 'Unable to load balance';
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
    balanceError.value = 'Unexpected error';
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
    window.alert('Connect a wallet first.');
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
    showToast('Transaction in progress. Please wait...', 'info');
    return;
  }
  showSendModal.value = false;
  showContactPicker.value = false;
  sendAssetContext.value = null;
  sendTargetMode.value = 'lumen';
  ibcForm.value = { sourceChannel: '', sourcePort: 'transfer' };
  sendForm.value = { recipient: '', amount: '', gasFee: 'medium' };
}

// QR Scanner functions
function openQrScanner() {
  qrScannerTitle.value = 'Scan Wallet Address or Payment';
  showQrScanner.value = true;
}

function closeQrScanner() {
  showQrScanner.value = false;
}

function handleQrScan(data: { type: string; content: string; raw: string }) {
  closeQrScanner();
  
  const { type, content, raw } = data;
  
  // Handle WalletConnect
  if (type === 'walletconnect' || raw.startsWith('wc:')) {
    handleWalletConnectUri(raw);
    return;
  }
  
  // Handle payment requests
  if (type === 'paymentrequest' || raw.includes('amount=')) {
    try {
      // Parse payment request format: lumen:address?amount=1.5&memo=test
      const url = new URL(raw.startsWith('lumen:') ? raw : `lumen:${raw}`);
      const address = url.pathname.replace('//', '');
      const amount = url.searchParams.get('amount');
      const memo = url.searchParams.get('memo');
      
      if (address) {
        sendForm.value.recipient = address;
      }
      if (amount) {
        sendForm.value.amount = amount;
      }
      
      if (!showSendModal.value) {
        showSendModal.value = true;
      }
      
      showToast('Payment request scanned successfully', 'success');
    } catch (e) {
      // If not a valid URL, treat as simple address
      sendForm.value.recipient = content;
      if (!showSendModal.value) {
        showSendModal.value = true;
      }
      showToast('Address scanned successfully', 'success');
    }
    return;
  }
  
  // Handle regular wallet address
  if (type === 'walletaddress' || type === 'unknown') {
    sendForm.value.recipient = content;
    if (!showSendModal.value) {
      showSendModal.value = true;
    }
    showToast('Wallet address scanned successfully', 'success');
    return;
  }
  
  // Handle URL (maybe for WalletConnect or other integrations)
  if (type === 'url') {
    showToast('URL scanned. Feature integration coming soon.', 'success');
    return;
  }
  
  showToast('QR code scanned', 'success');
}

async function handleWalletConnectUri(uri: string) {
  try {
    const parsedUri = parseWalletConnectUri(uri);
    if (!parsedUri) {
      showToast('Invalid WalletConnect URI', 'error');
      return;
    }

    showToast(`WalletConnect v${parsedUri.version} detected`, 'success');
    
    // TODO: Show WalletConnect connection dialog
    // const wcService = getWalletConnectService();
    // await wcService.connect(uri);
    
    showToast('WalletConnect integration coming soon!', 'success');
  } catch (error: any) {
    console.error('WalletConnect error:', error);
    showToast(error.message || 'Failed to connect via WalletConnect', 'error');
  }
}

// Recurring Payments
async function executeRecurringPayment(paymentId: string) {
  const payment = recurringPaymentsService.getRecurringPayment(paymentId);
  if (!payment) {
    showToast('Payment not found', 'error');
    return;
  }

  const walletApi = useInternalLumen()?.wallet;
  if (!walletApi || typeof walletApi.sendTokens !== 'function') {
    showToast('Wallet bridge not available', 'error');
    return;
  }

  const activeId = activeProfileId.value;
  if (!activeId) {
    showToast('No active profile selected', 'error');
    return;
  }

  if (!address.value) {
    showToast('No sender address available', 'error');
    return;
  }

  const sendParams: any = {
    profileId: activeId,
    from: address.value,
    to: payment.recipient,
    amount: payment.amount,
    denom: 'ulmn',
    memo: `Recurring: ${payment.name}`
  };

  try {
    const res = await walletApi.sendTokens(sendParams);

    if (!res || res.ok === false) {
      const err = String(res?.error || 'Transaction failed');
      if (err === 'password_required' || err === 'invalid_password') {
        try { await useInternalLumen()?.security?.lockSession?.(); } catch {}
        showToast('Wallet locked. Unlock to continue.', 'warning');
        return;
      }
      showToast(`Failed to execute recurring payment: ${err}`, 'error');
      return;
    }

    const result = { success: true, txHash: res.txhash };
    showToast('Recurring payment executed successfully', 'success');
    schedulePostTransactionRefresh({ includeSubscriptions: true });
    await recurringPaymentsService.executePayment(paymentId, async () => result);
  } catch (e: any) {
    showToast(`Failed to execute recurring payment: ${e?.message || 'Unexpected error'}`, 'error');
  }
}

function validateAmountInput(event: Event) {
  const input = event.target as HTMLInputElement;
  let value = input.value;
  
  // Allow only numbers and single decimal point
  value = value.replace(/[^0-9.]/g, '');
  
  // Ensure only one decimal point
  const parts = value.split('.');
  if (parts.length > 2) {
    value = parts[0] + '.' + parts.slice(1).join('');
  }
  
  // Limit to 6 decimal places
  if (parts.length === 2 && parts[1].length > 6) {
    value = parts[0] + '.' + parts[1].slice(0, 6);
  }
  
  sendForm.value.amount = value;
  input.value = value;
}

function copyToClipboard(text: string, message: string = 'Copied to clipboard!') {
  navigator.clipboard.writeText(text).then(() => {
    showToast(message, 'success');
  }).catch((err) => {
    console.error('Failed to copy:', err);
    showToast('Failed to copy', 'error');
  });
}

function showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') {
  if (type === 'error') {
    toast.error(message);
  } else if (type === 'warning') {
    toast.warning(message);
  } else if (type === 'info') {
    toast.info(message);
  } else {
    toast.success(message);
  }
}

function openTransactionTab(txHash: string) {
  const explorerUrl = `lumen://explorer/tx/${txHash}`;
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
  // Convert micro denoms to display format
  // ulmn -> LMN, ulumen -> LUMEN, etc.
  if (!denom) return '';
  const lower = denom.toLowerCase();
  if (lower === 'ulmn') return 'LMN';
  if (lower === 'ulumen') return 'LUMEN';
  if (lower.startsWith('u')) {
    // Generic micro denom: utoken -> TOKEN
    return denom.slice(1).toUpperCase();
  }
  return denom.toUpperCase();
}

function shortenAddress(value: string, start = 10, end = 8): string {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  if (raw.length <= start + end + 1) return raw;
  return `${raw.slice(0, start)}…${raw.slice(-end)}`;
}

function trimTrailingSlash(value: string): string {
  return String(value || '').replace(/\/+$/, '');
}

function humanizeChainId(chainId: string): string {
  const raw = String(chainId || '').trim();
  if (!raw) return 'Unknown chain';
  const known = KNOWN_IBC_CHAIN_METADATA[raw];
  if (known?.label) return known.label;
  return raw
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (part) => part.toUpperCase());
}

function resolveKnownChainMeta(chainId: string, prefixHints: string[] = []): KnownIbcChainMeta {
  const known = KNOWN_IBC_CHAIN_METADATA[String(chainId || '').trim()];
  if (known) return known;

  const prefix = String(prefixHints[0] || '').trim().toLowerCase();
  return {
    label: humanizeChainId(chainId || prefix || 'IBC chain'),
    addressPrefix: prefix,
    restEndpoint: '',
    rpcEndpoint: '',
    nativeDenom: prefix ? `u${prefix}` : '',
    feeDenom: prefix ? `u${prefix}` : 'ulmn',
    minGasPrice: 0,
    iconText: prefix ? prefix.slice(0, 3).toUpperCase() : 'IBC'
  };
}

function estimateRemoteFeeAmount(chainId: string, gas: string, fallback = '1000'): string {
  const gasUnits = Number(String(gas || '').trim());
  if (!Number.isFinite(gasUnits) || gasUnits <= 0) return fallback;

  const meta = KNOWN_IBC_CHAIN_METADATA[String(chainId || '').trim()];
  const minGasPrice = Number(meta?.minGasPrice || 0);
  if (!Number.isFinite(minGasPrice) || minGasPrice <= 0) return fallback;

  return String(Math.ceil(gasUnits * minGasPrice));
}

function reencodeAddressPrefix(value: string, targetPrefix: string): string {
  try {
    const decoded = fromBech32(String(value || '').trim());
    return toBech32(String(targetPrefix || '').trim(), decoded.data);
  } catch {
    return '';
  }
}

function buildAbsoluteUrl(base: string, path: string): string {
  const normalizedBase = trimTrailingSlash(base);
  const normalizedPath = String(path || '').startsWith('/') ? String(path || '') : `/${String(path || '')}`;
  return `${normalizedBase}${normalizedPath}`;
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
    throw new Error('HTTP bridge not available.');
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
    'factory (coming soon)'
  ]);
  const preferredOrder = ['swap', 'exchange', 'pools', 'staking', 'assets', 'burner', 'website', 'factory (coming soon)'];
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
  return normalizeWhitespace([base, quote].filter(Boolean).join('/')) || 'Unknown pair';
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
  const [pages, chainOverview] = await Promise.all([
    Promise.allSettled([
      fetchAbsoluteTextViaBridge(config.baseUrl, 15000),
      fetchAbsoluteTextViaBridge(buildAbsoluteUrl(config.baseUrl, '/exchange'), 15000),
      fetchAbsoluteTextViaBridge(buildAbsoluteUrl(config.baseUrl, '/pools'), 15000)
    ]),
    fetchDexChainOverview(config).catch(() => ({
      tradingPairsCount: null,
      liquidityPoolsCount: null,
      featuredMarketPair: '',
      featuredPoolPair: ''
    }))
  ]);

  const homeHtml = pages[0].status === 'fulfilled' ? pages[0].value : '';
  const exchangeHtml = pages[1].status === 'fulfilled' ? pages[1].value : '';
  const poolsHtml = pages[2].status === 'fulfilled' ? pages[2].value : '';
  const successCount = pages.filter((result) => result.status === 'fulfilled').length;

  const homeDoc = parseHtmlDocument(homeHtml);
  const exchangeDoc = parseHtmlDocument(exchangeHtml);
  const poolsDoc = parseHtmlDocument(poolsHtml);

  const homeText = normalizeWhitespace(homeDoc?.body?.textContent || '');
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
    .map((result) => String(result.reason?.message || result.reason || 'Request failed'));

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
      dexError.value = 'Some DEX snapshots could not be loaded.';
    } else if (nextRows.some((row) => row.status === 'degraded')) {
      dexError.value = 'Some DEX details are partial right now, but the listings remain usable.';
    }
  } catch (error: any) {
    dexRows.value = dexRows.value.map((row) => ({
      ...row,
      status: 'error',
      error: String(error?.message || error || 'Failed to load DEX snapshot')
    }));
    dexError.value = String(error?.message || error || 'Failed to load DEX snapshot');
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
  if (status === 'loading') return 'Refreshing';
  if (status === 'online') return 'Online';
  if (status === 'degraded') return 'Partial';
  if (status === 'error') return 'Offline';
  return 'Idle';
}

function formatDexCount(value: number | null): string {
  if (value == null) return 'N/A';
  return String(value);
}

function getDexPriceLabel(dex: DexRow): string {
  return dex.marketPreview?.lastPrice || (dex.tradingPairsCount === 0 ? 'N/A' : 'Unavailable');
}

function getDexVolumeLabel(dex: DexRow): string {
  return dex.marketPreview?.quoteVolume || (dex.tradingPairsCount === 0 ? 'N/A' : 'Unavailable');
}

function buildChainRegistryRawUrl(chainRegistryName: string, fileName: string): string {
  return `https://raw.githubusercontent.com/cosmos/chain-registry/master/${encodeURIComponent(chainRegistryName)}/${fileName}`;
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isTransientFetchError(error: unknown): boolean {
  const message = String((error as any)?.message || error || '').toLowerCase();
  if (!message) return false;
  return (
    message.includes('failed to fetch') ||
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('aborted') ||
    message.includes('econnreset') ||
    message.includes('eai_again') ||
    message.includes('enotfound') ||
    message.includes('socket')
  );
}

async function fetchAbsoluteJsonOnce(url: string, timeout = 15000): Promise<any> {
  const httpGet = useInternalLumen()?.http?.get || useInternalLumen()?.httpGet;
  if (typeof httpGet === 'function') {
    const res = await httpGet(String(url || ''), {
      timeout,
      headers: { accept: 'application/json' }
    });

    let json: any = res?.json ?? null;
    if (json == null) {
      const text = String(res?.text || '');
      if (text) {
        try {
          json = JSON.parse(text);
        } catch {
          json = null;
        }
      }
    }

    if (!res || res.ok === false) {
      const detail =
        json?.message ||
        json?.error ||
        String(res?.text || '').trim() ||
        String(res?.error || `HTTP ${res?.status || 0}`);
      throw new Error(String(detail));
    }

    return json;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: { accept: 'application/json' },
      signal: controller.signal
    });
    const text = await response.text().catch(() => '');
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!response.ok) {
      const detail =
        json?.message ||
        json?.error ||
        (typeof text === 'string' && text.trim() ? text.trim() : '') ||
        `HTTP ${response.status}`;
      throw new Error(String(detail));
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAbsoluteJson(url: string, timeout = 15000): Promise<any> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await fetchAbsoluteJsonOnce(url, timeout);
    } catch (error) {
      lastError = error;
      if (attempt >= 2 || !isTransientFetchError(error)) {
        throw error;
      }
      await waitMs(350 * (attempt + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Failed to fetch JSON.');
}

function readChainRegistryStorageCache(): Record<string, { updatedAt: number; chain: any | null; assets: any[] }> {
  try {
    const raw = localStorage.getItem(CHAIN_REGISTRY_CACHE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeChainRegistryStorageCache(
  next: Record<string, { updatedAt: number; chain: any | null; assets: any[] }>
) {
  try {
    localStorage.setItem(CHAIN_REGISTRY_CACHE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota or serialization errors.
  }
}

function getStoredChainRegistryBundle(
  chainRegistryName: string,
  { allowStale = false }: { allowStale?: boolean } = {}
): { chain: any | null; assets: any[] } | null {
  const cache = readChainRegistryStorageCache();
  const entry = cache[String(chainRegistryName || '').trim()];
  if (!entry) return null;

  const age = Date.now() - Number(entry.updatedAt || 0);
  const isFresh = Number.isFinite(age) && age >= 0 && age <= CHAIN_REGISTRY_CACHE_TTL_MS;
  if (!isFresh && !allowStale) return null;

  return {
    chain: entry.chain || null,
    assets: Array.isArray(entry.assets) ? entry.assets : []
  };
}

function persistChainRegistryBundle(chainRegistryName: string, bundle: { chain: any | null; assets: any[] }) {
  const key = String(chainRegistryName || '').trim();
  if (!key) return;

  const cache = readChainRegistryStorageCache();
  cache[key] = {
    updatedAt: Date.now(),
    chain: bundle.chain || null,
    assets: Array.isArray(bundle.assets) ? bundle.assets : []
  };
  writeChainRegistryStorageCache(cache);
}

async function loadChainRegistryBundle(chainRegistryName: string): Promise<{ chain: any | null; assets: any[] }> {
  const key = String(chainRegistryName || '').trim();
  if (!key) return { chain: null, assets: [] };

  if (!chainRegistryCache.has(key)) {
    chainRegistryCache.set(
      key,
      (async () => {
        const freshStored = getStoredChainRegistryBundle(key);
        if (freshStored) return freshStored;

        try {
          const [chain, assetList] = await Promise.all([
            fetchAbsoluteJson(buildChainRegistryRawUrl(key, 'chain.json'), 10000).catch(() => null),
            fetchAbsoluteJson(buildChainRegistryRawUrl(key, 'assetlist.json'), 10000).catch(() => null)
          ]);

          const bundle = {
            chain: chain || null,
            assets: Array.isArray(assetList?.assets) ? assetList.assets : []
          };

          if (bundle.chain || bundle.assets.length) {
            persistChainRegistryBundle(key, bundle);
            return bundle;
          }

          const staleStored = getStoredChainRegistryBundle(key, { allowStale: true });
          const fallback = staleStored || bundle;
          if (!fallback.chain && !fallback.assets.length) {
            chainRegistryCache.delete(key);
          }
          return fallback;
        } catch {
          const staleStored = getStoredChainRegistryBundle(key, { allowStale: true });
          const fallback = staleStored || { chain: null, assets: [] };
          if (!fallback.chain && !fallback.assets.length) {
            chainRegistryCache.delete(key);
          }
          return fallback;
        }
      })()
    );
  }

  return chainRegistryCache.get(key)!;
}

function pickPreferredRegistryImage(entry: any): string {
  const images = Array.isArray(entry?.images) ? entry.images : [];
  for (const image of images) {
    const svg = String(image?.svg || '').trim();
    if (svg) return svg;
    const png = String(image?.png || '').trim();
    if (png) return png;
  }

  const logoSvg = String(entry?.logo_URIs?.svg || entry?.logo_uris?.svg || '').trim();
  if (logoSvg) return logoSvg;
  const logoPng = String(entry?.logo_URIs?.png || entry?.logo_uris?.png || '').trim();
  if (logoPng) return logoPng;
  return '';
}

async function resolveChainRegistryIconUrl(
  chainRegistryName: string | undefined,
  rawDenom: string,
  trace: { baseDenom: string; path: string } | null
): Promise<string> {
  const registryName = String(chainRegistryName || '').trim();
  if (!registryName) return '';

  try {
    const bundle = await loadChainRegistryBundle(registryName);
    const denomCandidates = Array.from(
      new Set(
        [String(trace?.baseDenom || '').trim(), String(rawDenom || '').trim()]
          .filter(Boolean)
          .map((value) => value.toLowerCase())
      )
    );

    for (const asset of bundle.assets) {
      const base = String(asset?.base || '').trim().toLowerCase();
      const denoms = Array.isArray(asset?.denom_units)
        ? asset.denom_units.map((unit: any) => String(unit?.denom || '').trim().toLowerCase()).filter(Boolean)
        : [];
      const assetKeys = new Set([base, ...denoms]);
      if (denomCandidates.some((candidate) => assetKeys.has(candidate))) {
        const image = pickPreferredRegistryImage(asset);
        if (image) return image;
      }
    }

    return pickPreferredRegistryImage(bundle.chain);
  } catch {
    return '';
  }
}

async function fetchLocalBalances(ownerAddress: string): Promise<Array<{ denom: string; amount: string }>> {
  const net = useInternalLumen()?.net;
  if (!net || typeof net.restGet !== 'function') {
    throw new Error('Network API not available.');
  }
  const res = await net.restGet(`/cosmos/bank/v1beta1/balances/${encodeURIComponent(ownerAddress)}`, {
    timeout: 15000
  });
  if (!res || res.ok === false) {
    throw new Error(String(res?.error || 'Failed to fetch balances on Lumen.'));
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

async function resolveDenomTrace(
  restEndpoint: string,
  denom: string,
  { isLocal = false }: { isLocal?: boolean } = {}
): Promise<{ baseDenom: string; path: string } | null> {
  const rawDenom = String(denom || '').trim();
  if (!rawDenom || !rawDenom.toUpperCase().startsWith('IBC/')) return null;

  const hash = rawDenom.slice(4);
  const cacheKey = `${isLocal ? '__local__' : trimTrailingSlash(restEndpoint)}|${hash}`;
  if (denomTraceCache.has(cacheKey)) {
    return denomTraceCache.get(cacheKey) || null;
  }

  try {
    let trace: any = null;
    if (isLocal) {
      const net = useInternalLumen()?.net;
      if (!net || typeof net.restGet !== 'function') {
        throw new Error('Network API not available.');
      }
      const res = await net.restGet(`/ibc/apps/transfer/v1/denom_traces/${encodeURIComponent(hash)}`, {
        timeout: 10000
      });
      if (!res || res.ok === false) {
        throw new Error(String(res?.error || 'Failed to resolve denom trace.'));
      }
      trace = res?.json?.denom_trace || res?.json?.denomTrace || null;
    } else {
      const json = await fetchAbsoluteJson(
        buildAbsoluteUrl(restEndpoint, `/ibc/apps/transfer/v1/denom_traces/${encodeURIComponent(hash)}`),
        10000
      );
      trace = json?.denom_trace || json?.denomTrace || null;
    }

    const resolved = trace
      ? {
          baseDenom: String(trace?.base_denom || trace?.baseDenom || '').trim(),
          path: String(trace?.path || '').trim()
        }
      : null;
    denomTraceCache.set(cacheKey, resolved);
    return resolved;
  } catch {
    denomTraceCache.set(cacheKey, null);
    return null;
  }
}

function buildAssetDisplayName(denom: string, displaySymbol: string, trace: { baseDenom: string; path: string } | null): string {
  const lower = String(denom || '').trim().toLowerCase();
  if (trace?.baseDenom) return `${displaySymbol} via IBC`;
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
  const sendButtonLabel = input.chainLabel ? `Send on ${input.chainLabel}` : 'Send';

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
    transferButtonLabel: input.transferTargets.length ? 'To Other Chain' : 'No route',
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
    showToast('No balance available for this asset.', 'warning');
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
      : 'Select an IBC route',
    destinationChain: selectedIbcChannel.value?.chainId || 'Unknown'
  };
});

async function confirmSendPreview() {
  if (sendingTransaction.value) return;
  
  if (!sendSourceAddress.value) {
    showToast('No sender address available', 'error');
    return;
  }
  const from = sendSourceAddress.value;
  const to = String(sendForm.value.recipient || '').trim();
  const recipientPrefix = getAddressPrefix(to);
  const amountNum = Number(sendForm.value.amount || '0');
  const amountMicro = decimalToMicroUnits(sendForm.value.amount);
  
  if (!to) {
    showToast('Please enter recipient address', 'error');
    return;
  }
  
  if (!(amountNum > 0)) {
    showToast('Please enter a valid amount', 'error');
    return;
  }

  if (amountMicro == null || amountMicro <= 0n) {
    showToast('Please enter a valid amount', 'error');
    return;
  }

  if (sendAvailableMicro.value !== null && amountMicro > sendAvailableMicro.value) {
    showToast(`Insufficient ${sendAssetSymbol.value} balance`, 'error');
    return;
  }

  const walletApi = useInternalLumen()?.wallet;
  const activeId = activeProfileId.value;
  if (!activeId) {
    showToast('No active profile selected', 'error');
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
        showToast(`This address looks like the current chain. Use Send instead of IBC transfer for ${sendAssetSymbol.value}.`, 'warning');
        return;
      }

      if (!walletApi || typeof walletApi.ibcTransfer !== 'function') {
        showToast('Wallet IBC bridge not available', 'error');
        return;
      }

      if (!selectedIbcChannel.value) {
        showToast('Please select an IBC route', 'error');
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
      successLabel = 'IBC transfer';
      failureLabel = 'IBC transfer';
      sendOperation = async (params: Record<string, any>) => {
        const sendPromise = walletApi.ibcTransfer(params);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Transaction timeout after 2 minutes')), 120000)
        );
        return Promise.race([sendPromise, timeoutPromise]);
      };
    } else {
      if (recipientPrefix && recipientPrefix !== sendSourcePrefix.value) {
        showToast(`Recipient must use the ${sendSourcePrefix.value} address format.`, 'warning');
        return;
      }

      if (!walletApi || typeof walletApi.sendTokens !== 'function') {
        showToast('Wallet send bridge not available', 'error');
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
          setTimeout(() => reject(new Error('Transaction timeout after 2 minutes')), 120000)
        );
        return Promise.race([sendPromise, timeoutPromise]);
      };
    }

    const res = await sendOperation(sendParams);

    if (!res || res.ok === false) {
      const err = String(res?.error || 'unknown error');
      if (err === 'password_required' || err === 'invalid_password') {
        try { await useInternalLumen()?.security?.lockSession?.(); } catch {}
        showToast('Wallet locked. Unlock to continue.', 'warning');
        return;
      }
      
      // Handle indexing disabled error
      if (err === 'indexing_disabled') {
        showToast(res?.message || 'Transaction may have been sent but node indexing is disabled. Check your balance in a moment.', 'warning');
        closeSendModal();
        schedulePostTransactionRefresh();
        return;
      }
      
      showToast(`${failureLabel} failed: ${res?.error || 'unknown error'}`, 'error');
      return;
    }
    
    showToast(`${successLabel} successful! TxHash: ${res.txhash || 'N/A'}`, 'success');
    closeSendModal();
    schedulePostTransactionRefresh();
  } catch (e: any) {
    showToast(e?.message || 'Unexpected error while sending transaction', 'error');
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
    denomTraceCache.clear();
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
            : 'No linked IBC destination available.',
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
              routeLabel: 'Unable to derive destination address.',
              restEndpoint: entry.meta.restEndpoint,
              rpcEndpoint: entry.meta.rpcEndpoint,
              feeDenom: entry.meta.feeDenom,
              error: 'Unable to derive an address for this chain.'
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
                ? `Return route: ${returnTargets[0].routeLabel}`
                : 'No return route configured.',
              restEndpoint: entry.meta.restEndpoint,
              rpcEndpoint: entry.meta.rpcEndpoint,
              feeDenom: entry.meta.feeDenom,
              error: 'REST endpoint not configured for this chain.'
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
                  ? `Return route: ${returnTargets[0].routeLabel}`
                  : 'No return route configured.',
                restEndpoint: entry.meta.restEndpoint,
                rpcEndpoint: entry.meta.rpcEndpoint,
                feeDenom: entry.meta.feeDenom
              })
            )
          );
        } catch (error: any) {
          remoteErrors.push(`${entry.meta.label}: ${String(error?.message || error || 'Failed to load balances')}`);
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
                ? `Return route: ${returnTargets[0].routeLabel}`
                : 'No return route configured.',
              restEndpoint: entry.meta.restEndpoint,
              rpcEndpoint: entry.meta.rpcEndpoint,
              feeDenom: entry.meta.feeDenom,
              error: String(error?.message || error || 'Failed to load balances')
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
  } catch (error: any) {
    if (requestId !== assetRefreshRequestId) {
      return;
    }
    if (!hadRows) {
      assetRows.value = [];
    }
    assetsError.value = String(error?.message || error || 'Failed to load assets.');
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
    showToast('No IBC route available for this asset.', 'warning');
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
    showToast('Transfer in progress. Please wait...', 'info');
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
    showToast('No asset transfer context available.', 'error');
    return;
  }

  const recipient = String(assetTransferForm.value.recipient || '').trim();
  const amountRaw = String(assetTransferForm.value.amount || '').trim();
  const amountMicro = decimalToMicroUnits(amountRaw);
  const availableMicro = BigInt(context.microAmount || '0');

  if (!recipient) {
    showToast('Please enter a destination address.', 'error');
    return;
  }
  if (amountMicro == null || amountMicro <= 0n) {
    showToast('Please enter a valid amount.', 'error');
    return;
  }
  if (amountMicro > availableMicro) {
    showToast('Insufficient balance for this transfer.', 'error');
    return;
  }

  const recipientPrefix = getAddressPrefix(recipient);
  if (target.addressPrefix && recipientPrefix && recipientPrefix !== target.addressPrefix) {
    showToast(`Recipient must use the ${target.addressPrefix} address format.`, 'error');
    return;
  }

  const activeId = activeProfileId.value;
  if (!activeId) {
    showToast('No active profile selected.', 'error');
    return;
  }

  const walletApi = useInternalLumen()?.wallet;
  if (!walletApi || typeof walletApi.ibcTransfer !== 'function') {
    showToast('Wallet IBC bridge not available.', 'error');
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
      setTimeout(() => reject(new Error('Transaction timeout after 2 minutes')), 120000)
    );
    const res = await Promise.race([sendPromise, timeoutPromise]);

    if (!res || res.ok === false) {
      const err = String(res?.error || 'unknown error');
      if (err === 'password_required' || err === 'invalid_password') {
        try { await useInternalLumen()?.security?.lockSession?.(); } catch {}
        showToast('Wallet locked. Unlock to continue.', 'warning');
        return;
      }
      if (err === 'indexing_disabled') {
        showToast(
          res?.message || 'Transfer may have been broadcast but node indexing is disabled. Check balances shortly.',
          'warning'
        );
        closeAssetTransferModal();
        schedulePostTransactionRefresh();
        return;
      }
      showToast(`Asset transfer failed: ${err}`, 'error');
      return;
    }

    showToast(`Asset transfer submitted. TxHash: ${res.txhash || 'N/A'}`, 'success');
    closeAssetTransferModal();
    schedulePostTransactionRefresh();
  } catch (error: any) {
    showToast(error?.message || 'Unexpected error while transferring asset', 'error');
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
  try {
    await navigator.clipboard.writeText(address.value);
    showToast('Address copied to clipboard!', 'success');
  } catch (err) {
    console.error('Failed to copy:', err);
    showToast('Failed to copy', 'error');
  }
}

// Address Book Functions
async function loadContacts() {
  contactsLoading.value = true;
  try {
    const result = await useInternalLumen().addressBook.list();
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
      const result = await useInternalLumen().addressBook.update(
        editingContact.value.id,
        plainContact
      );
      if (result.ok) {
        showToast('Contact updated!', 'success');
        await loadContacts();
        closeContactModal();
      } else {
        showToast(result.error || 'Failed to update contact', 'error');
      }
    } else {
      // Add new contact
      const result = await useInternalLumen().addressBook.add(plainContact);
      if (result.ok) {
        showToast('Contact added!', 'success');
        await loadContacts();
        closeContactModal();
      } else {
        showToast(result.error || 'Failed to add contact', 'error');
      }
    }
  } catch (err: any) {
    showToast(err?.message || 'Failed to save contact', 'error');
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
    const result = await useInternalLumen().addressBook.delete(contactToDelete.value.id);
    if (result.ok) {
      showToast('Contact deleted', 'success');
      await loadContacts();
    } else {
      showToast(result.error || 'Failed to delete contact', 'error');
    }
  } catch (err: any) {
    showToast(err?.message || 'Failed to delete contact', 'error');
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
  const headers = ['Date', 'Time', 'Type', 'From', 'To', 'Amount (LMN)', 'Status', 'Hash'];
  
  // CSV rows
  const rows = enhancedActivities.value.map(tx => {
    const date = new Date(tx.timestamp);
    const dateStr = date.toLocaleDateString('en-US');
    const timeStr = date.toLocaleTimeString('en-US');
    const isSpecial =
      isDnsUpdateTx(tx) ||
      isDnsTransferTx(tx) ||
      isDnsRegisterTx(tx) ||
      isWithdrawRewardsTx(tx) ||
      isPublishReleaseTx(tx);
    const type = isSpecial && tx.dnsName ? `${getActivityLabel(tx)} (${tx.dnsName})` : getActivityLabel(tx);
    const from = tx.from || address.value || '-';
    const to = tx.to || '-';
    const amount = tx.amounts && tx.amounts.length 
      ? (Number(tx.amounts[0].amount || '0') / 1_000_000).toFixed(6)
      : '0';
    const status = (tx.code === undefined || tx.code === 0) ? 'Success' : 'Failed';
    const hash = tx.txhash;
    
    return [dateStr, timeStr, type, from, to, amount, status, hash];
  });

  // Combine
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  // Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `lumen-transactions-${address.value.slice(0, 8)}-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  
  showToast('Transactions exported!', 'success');
}
</script>
