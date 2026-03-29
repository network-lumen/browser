<template>
  <div class="wallet-page internal-page">
    <!-- Sidebar -->
    <InternalSidebar title="Wallet" :icon="Wallet" activeKey="wallet">
      <nav class="lsb-nav">
        <div class="lsb-section">
          <span class="lsb-label">Activity</span>
          <button
            type="button"
            class="lsb-item"
            :class="{ active: currentView === 'overview' }"
            @click="currentView = 'overview'"
          >
            <Wallet :size="18" />
            <span>Wallet</span>
          </button>
          <button
            type="button"
            class="lsb-item"
            :class="{ active: currentView === 'assets' }"
            @click="currentView = 'assets'"
          >
            <Coins :size="18" />
            <span>Assets</span>
          </button>
          <button
            type="button"
            class="lsb-item"
            :class="{ active: currentView === 'dex' }"
            @click="currentView = 'dex'"
          >
            <LayoutDashboard :size="18" />
            <span>DEX</span>
          </button>
          <button
            type="button"
            class="lsb-item"
            :class="{ active: currentView === 'transactions' }"
            @click="currentView = 'transactions'"
          >
            <ArrowLeftRight :size="18" />
            <span>Transactions</span>
          </button>
          <button
            type="button"
            class="lsb-item"
            :class="{ active: currentView === 'recurring' }"
            @click="currentView = 'recurring'"
          >
            <Calendar :size="18" />
            <span>Recurring</span>
          </button>
          <button
            type="button"
            class="lsb-item"
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
    <main class="main-content">
      <!-- Header -->
      <header class="content-header">
        <div>
          <h1>{{ getViewTitle() }}</h1>
          <p>{{ getViewDescription() }}</p>
        </div>

        <div v-if="currentView !== 'dex'" class="header-actions">
          <button class="action-btn primary" @click="connectWallet" v-if="!isConnected">
            <Link :size="16" />
            <span>Connect Wallet</span>
          </button>
          <button class="action-btn primary" @click="sendTransaction" v-else>
            <Send :size="16" />
            <span>Send</span>
          </button>
        </div>
      </header>

      <!-- Overview View -->
      <div v-if="currentView === 'overview'" class="overview-section">
        <!-- Balance Card -->
        <div class="balance-card">
          <div class="balance-header">
            <span class="balance-label">Total Balance</span>
            <button class="eye-btn" @click="showBalance = !showBalance">
              <Eye v-if="showBalance" :size="18" :style="{ color: effectiveTheme === 'dark' ? 'white' : '#222' }" />
              <EyeOff v-else :size="18" :style="{ color: effectiveTheme === 'dark' ? 'white' : '#222' }" />
            </button>
          </div>
          <div class="balance-amount">
            <span class="currency">LMN</span>
            <span class="amount">
              {{ showBalance ? balanceLabel : '••••••' }}
            </span>
          </div>
          <div class="balance-change">
            <TrendingUp :size="14" />
            <span v-if="isConnected && !balanceError">On-chain balance</span>
            <span v-else-if="balanceError">Error loading balance</span>
            <span v-else>Connect a wallet to view balance</span>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="quick-actions">
          <button class="quick-btn" @click="sendTransaction">
            <div class="quick-icon send">
              <ArrowUpRight :size="20" />
            </div>
            <span>Send</span>
          </button>
          <button class="quick-btn" @click="openReceiveModal">
            <div class="quick-icon receive">
              <ArrowDownLeft :size="20" />
            </div>
            <span>Receive</span>
          </button>
          <button class="quick-btn" disabled>
            <div class="quick-icon swap disabled">
              <ArrowLeftRight :size="20" />
            </div>
            <span>Swap (soon)</span>
          </button>
          <button class="quick-btn" disabled>
            <div class="quick-icon buy disabled">
              <CreditCard :size="20" />
            </div>
            <span>Buy (soon)</span>
          </button>
        </div>

        <!-- Address + summary -->
        <div class="info-section">
          <div class="info-card">
            <div class="info-label">Address</div>
            <div class="info-value mono" :title="address || '-'">
              {{ address || '-' }}
            </div>
          </div>
        </div>
      </div>

      <!-- Assets View -->
      <div v-else-if="currentView === 'assets'" class="content-section">
        <div class="section-header">
          <h3>Cross-chain Assets</h3>
        </div>
        <div class="empty-state" v-if="!isConnected">
          <div class="empty-icon">
            <Coins :size="32" />
          </div>
          <h3>Connect Your Wallet</h3>
          <p>Connect a wallet to view your assets across linked IBC chains.</p>
          <button class="connect-btn" @click="connectWallet">
            <Link :size="16" />
            <span>Connect Wallet</span>
          </button>
        </div>
        <div v-else-if="assetsLoading && !assetRows.length" class="empty-state">
          <div class="empty-icon">
            <Coins :size="32" />
          </div>
          <h3>Loading assets…</h3>
          <p>Fetching balances on Lumen and linked IBC chains.</p>
        </div>
        <div v-else-if="assetsError && !assetRows.length" class="empty-state">
          <div class="empty-icon">
            <AlertCircle :size="32" />
          </div>
          <h3>Unable to load assets</h3>
          <p>{{ assetsError }}</p>
        </div>
        <div v-else>
          <div v-if="assetsError && assetRows.length" class="info-banner warning" style="margin-bottom: 1rem;">
            <span>{{ assetsError }}</span>
          </div>
          <div v-if="assetRows.length" class="assets-list rich-assets-list">
            <div
              v-for="asset in assetRows"
              :key="asset.id"
              class="asset-item asset-item-rich"
            >
              <div class="asset-main">
                <div class="asset-icon" :class="asset.iconClass">
                  <img
                    v-if="asset.iconUrl"
                    :src="asset.iconUrl"
                    :alt="`${asset.displayName} icon`"
                    class="asset-icon-image"
                    @error="handleAssetIconError(asset)"
                  />
                  <span v-else>{{ asset.iconText }}</span>
                </div>
                <div class="asset-info">
                  <div class="asset-title-row">
                    <span class="asset-name">{{ asset.displayName }}</span>
                    <span class="asset-chain-pill">{{ asset.chainLabel }}</span>
                  </div>
                  <span class="asset-symbol">{{ asset.displaySymbol }}</span>
                  <span class="asset-meta">{{ asset.addressLabel }}</span>
                  <span v-if="asset.traceLabel" class="asset-meta">{{ asset.traceLabel }}</span>
                  <span v-if="asset.routeLabel" class="asset-meta">{{ asset.routeLabel }}</span>
                  <span v-if="asset.error" class="asset-meta error">{{ asset.error }}</span>
                </div>
              </div>
              <div class="asset-side">
                <div class="asset-balance balance-column">
                  <span class="asset-amount">{{ asset.displayAmount }}</span>
                  <span class="asset-balance-symbol">{{ asset.displaySymbol }}</span>
                </div>
                <div class="asset-actions">
                  <button
                    class="action-icon asset-refresh-btn"
                    @click="refreshAssetRow(asset)"
                    :disabled="assetRowRefreshingId === asset.id"
                    title="Refresh this asset"
                    aria-label="Refresh this asset"
                  >
                    <RefreshCw :size="14" :class="{ 'spin-icon': assetRowRefreshingId === asset.id }" />
                  </button>
                  <button
                    class="action-icon copy-btn"
                    @click="copyToClipboard(asset.ownerAddress, 'Address copied!')"
                    title="Copy chain address"
                    aria-label="Copy chain address"
                  >
                    <Copy :size="14" />
                  </button>
                  <button
                    class="action-btn secondary asset-transfer-btn"
                    @click="openAssetTransferModal(asset)"
                    :disabled="!asset.transferTargets.length || !asset.transferEnabled"
                  >
                    <Send :size="16" />
                    <span>{{ asset.transferButtonLabel }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="empty-state">
            <div class="empty-icon">
              <Coins :size="32" />
            </div>
            <h3>No assets yet</h3>
            <p>No balances were found on Lumen or the linked IBC chains.</p>
          </div>
        </div>
      </div>

      <!-- DEX View -->
      <div v-else-if="currentView === 'dex'" class="content-section">
        <div v-if="dexError" class="info-banner warning" style="margin-bottom: 1rem;">
          <span>{{ dexError }}</span>
        </div>

        <div class="dex-list">
          <div
            v-for="dex in dexRows"
            :key="dex.key"
            class="dex-item"
            :class="`dex-item-${dex.status}`"
          >
            <div class="dex-top">
              <button
                type="button"
                class="dex-summary-btn"
                @click="toggleDexExpanded(dex.key)"
              >
                <div class="dex-logo" :class="{ 'dex-logo-dark': dex.logoTheme === 'dark' }">
                  <img
                    v-if="dex.logoUrl"
                    :src="dex.logoUrl"
                    :alt="`${dex.name} logo`"
                    class="dex-logo-image"
                    @error="handleDexLogoError(dex)"
                  />
                  <span v-else>{{ dex.iconText }}</span>
                </div>

                <div class="dex-main">
                  <div class="dex-title-row">
                    <span class="dex-name">{{ dex.name }}</span>
                    <span class="asset-chain-pill">{{ dex.chainLabel }}</span>
                    <span class="dex-status-badge" :class="`status-${dex.status}`">
                      {{ getDexStatusLabel(dex.status) }}
                    </span>
                  </div>

                  <span v-if="dex.error" class="dex-meta error">{{ dex.error }}</span>
                </div>
              </button>

              <div class="dex-side">
                <div class="dex-actions">
                  <button
                    type="button"
                    class="action-btn secondary dex-detail-toggle"
                    @click="toggleDexExpanded(dex.key)"
                  >
                    <ChevronDown
                      :size="16"
                      class="dex-chevron"
                      :class="{ open: isDexExpanded(dex.key) }"
                    />
                    <span>{{ isDexExpanded(dex.key) ? 'Hide details' : 'Details' }}</span>
                  </button>
                  <button
                    type="button"
                    class="action-btn primary dex-open-btn"
                    @click="openDexTab(dex.openUrl || dex.baseUrl)"
                  >
                    <ExternalLink :size="16" />
                    <span>Open DEX</span>
                  </button>
                </div>
              </div>
            </div>

            <div v-if="isDexExpanded(dex.key)" class="dex-details">
              <div class="dex-detail-grid">
                <div class="dex-detail-card compact">
                  <span class="dex-detail-label">Trading pairs</span>
                  <span class="dex-detail-value">{{ formatDexCount(dex.tradingPairsCount) }}</span>
                </div>

                <div class="dex-detail-card compact">
                  <span class="dex-detail-label">Liquidity pools</span>
                  <span class="dex-detail-value">{{ formatDexCount(dex.liquidityPoolsCount) }}</span>
                </div>

                <div class="dex-detail-card">
                  <span class="dex-detail-label">24h price</span>
                  <span class="dex-detail-value">{{ getDexPriceLabel(dex) }}</span>
                </div>

                <div class="dex-detail-card">
                  <span class="dex-detail-label">24h volume</span>
                  <span class="dex-detail-value">{{ getDexVolumeLabel(dex) }}</span>
                </div>
              </div>

              <div v-if="dex.quickLinks.length" class="dex-links">
                <button
                  v-for="link in dex.quickLinks"
                  :key="`${dex.key}:${link.label}:${link.url}`"
                  type="button"
                  class="dex-link-chip"
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
        <div v-else-if="currentView === 'transactions'" class="content-section">

        <div class="section-header" v-if="activities.length > 0">
          <h3>Recent Transactions</h3>
          <div class="header-actions-group">
            <div class="filter-group">
              <select v-model="txFilterType" class="filter-select">
                <option value="all">All Types</option>
                <option value="send">Send</option>
                <option value="receive">Receive</option>
              </select>
              <select v-model="txFilterStatus" class="filter-select">
                <option value="all">All Status</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
              </select>
              <input
                v-model="txSearchQuery"
                type="text"
                placeholder="Search by hash..."
                class="search-input"
              />
            </div>
            <button class="action-btn secondary" @click="exportTransactions">
              <Download :size="16" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div class="empty-state" v-if="!isConnected || !address">
          <div class="empty-icon">
            <ArrowLeftRight :size="32" />
          </div>
          <h3>No wallet connected</h3>
          <p>Connect a wallet to see your recent transactions.</p>
        </div>

        <div v-else-if="activitiesLoading" class="empty-state">
          <div class="empty-icon">
            <ArrowLeftRight :size="32" />
          </div>
          <h3>Loading transactions…</h3>
          <p>Please wait while we fetch your recent activity from the indexer.</p>
        </div>

        <div v-else-if="activitiesError" class="empty-state">
          <div class="empty-icon">
            <ArrowLeftRight :size="32" />
          </div>
          <h3>Unable to load transactions</h3>
          <p>{{ activitiesError }}</p>
          <div class="info-banner warning" style="margin-top: 1rem; max-width: 500px;">
            <span>
              💡 If transaction indexing is disabled on the node, transactions cannot be queried via API. 
              Your balance is still accurate and transactions are recorded on-chain.
            </span>
          </div>
        </div>

        <div v-else-if="!activities.length" class="empty-state">
          <div class="empty-icon">
            <ArrowLeftRight :size="32" />
          </div>
          <h3>No recent transactions</h3>
          <p>Transaction history is not available because indexing is disabled on all RPC nodes.</p>
          <div class="info-banner warning" style="margin-top: 1rem; max-width: 600px;">
            <div style="margin-bottom: 0.75rem;">
              <strong>💡 Why can't I see my transactions?</strong>
            </div>
            <div style="margin-bottom: 0.5rem;">
              All Lumen Network RPC nodes currently have transaction indexing disabled. This means:
            </div>
            <ul style="margin: 0.5rem 0 0.75rem 1.5rem; text-align: left;">
              <li>Your balance is still accurate and updated</li>
              <li>All transactions are recorded on-chain</li>
              <li>Transaction history cannot be queried via API</li>
            </ul>
            <div style="margin-top: 0.75rem;">
              <strong>Alternative:</strong> Use a block explorer to view your transaction history:
              <br>
              <a 
                :href="`https://explorer.lumen.network/account/${address}`" 
                target="_blank" 
                style="color: var(--accent-primary); text-decoration: underline; margin-top: 0.25rem; display: inline-block;"
              >
                View on Lumen Explorer →
              </a>
            </div>
          </div>
        </div>

        <div v-else class="activities-list">
          <div class="table-header">
            <div class="col-type">Type</div>
            <div class="col-amount">Amount</div>
            <div class="col-from">From</div>
            <div class="col-to">To</div>
            <div class="col-hash">Hash</div>
            <div class="col-status">Status</div>
            <div class="col-time">Time</div>
          </div>

          <div
            v-for="tx in enhancedActivities"
            :key="tx.id"
            class="activity-row"
          >
            <div class="col-type">
              <div class="type-badge" :class="getActivityBadgeClass(tx)">
                <Edit v-if="isDnsUpdateTx(tx)" :size="14" />
                <Users v-else-if="isDnsTransferTx(tx)" :size="14" />
                <Plus v-else-if="isDnsRegisterTx(tx)" :size="14" />
                <TrendingUp v-else-if="isWithdrawRewardsTx(tx)" :size="14" />
                <Upload v-else-if="isPublishReleaseTx(tx)" :size="14" />
                <ArrowUpRight v-else-if="tx.type === 'send'" :size="14" />
                <ArrowDownLeft v-else-if="tx.type === 'receive'" :size="14" />
                <ArrowLeftRight v-else :size="14" />
                <div class="type-text">
                  <span class="type-main">{{ getActivityLabel(tx) }}</span>
                  <span
                    v-if="(isDnsUpdateTx(tx) || isDnsTransferTx(tx) || isDnsRegisterTx(tx) || isWithdrawRewardsTx(tx) || isPublishReleaseTx(tx)) && tx.dnsName"
                    class="type-sub"
                    :title="tx.dnsName"
                  >{{ tx.dnsName }}</span>
                </div>
              </div>
            </div>

            <div class="col-amount">
              <span class="amount-value" :class="tx.type">
                <template v-if="tx.amounts && tx.amounts.length && tx.amounts[0].amount">
                  {{ tx.type === 'send' ? '-' : '+' }}{{ (Number(tx.amounts[0].amount) / 1_000_000).toFixed(6).replace(/\.?0+$/, '') }} {{ formatDenom(tx.amounts[0].denom) }}
                </template>
                <template v-else>
                  <span class="text-muted">N/A</span>
                </template>
              </span>
            </div>

            <div class="col-from">
              <span class="address-value" :title="tx.from || '-'">
                <template v-if="tx.from && tx.from.length > 10">
                  {{ tx.from.slice(0, 10) }}…{{ tx.from.slice(-8) }}
                </template>
                <template v-else-if="tx.from">
                  {{ tx.from }}
                </template>
                <template v-else>
                  <span class="text-muted">-</span>
                </template>
              </span>
              <button
                v-if="tx.from"
                class="action-icon copy-btn"
                @click.stop="copyToClipboard(tx.from, 'Address copied!')"
                title="Copy address"
                aria-label="Copy from address"
              >
                <Copy :size="14" />
              </button>
            </div>

            <div class="col-to">
              <span class="address-value" :title="tx.to || '-'">
                <template v-if="tx.to && tx.to.length > 10">
                  {{ tx.to.slice(0, 10) }}…{{ tx.to.slice(-8) }}
                </template>
                <template v-else-if="tx.to">
                  {{ tx.to }}
                </template>
                <template v-else>
                  <span class="text-muted">-</span>
                </template>
              </span>
              <button
                v-if="tx.to"
                class="action-icon copy-btn"
                @click.stop="copyToClipboard(tx.to, 'Address copied!')"
                title="Copy address"
                aria-label="Copy to address"
              >
                <Copy :size="14" />
              </button>
            </div>

            <div class="col-hash">
              <span class="hash-value" :title="tx.txhash">
                {{ tx.txhash.slice(0, 8) }}…{{ tx.txhash.slice(-6) }}
              </span>
              <button
                class="action-icon explorer-btn"
                @click.stop="openTransactionTab(tx.txhash)"
                title="Open in explorer"
                aria-label="Open transaction in new tab"
              >
                <ExternalLink :size="14" />
              </button>
              <button class="action-icon copy-btn" @click.stop="copyToClipboard(tx.txhash, 'Hash copied!')" title="Copy hash">
                <Copy :size="14" />
              </button>
            </div>

            <div class="col-status">
              <span class="status-badge" :class="(tx.code === undefined || tx.code === 0) ? 'success' : 'failed'">
                {{ (tx.code === undefined || tx.code === 0) ? 'Success' : 'Failed' }}
              </span>
            </div>

            <div class="col-time">
              <span class="time-value">
                {{ new Date(tx.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }}
                <span class="time-hour">{{ new Date(tx.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Address Book View -->
      <div v-else-if="currentView === 'addressbook'" class="content-section">
        <div class="section-header">
          <h3>Saved Addresses</h3>
          <button class="action-btn primary" @click="openAddContactModal">
            <Plus :size="16" />
            <span>Add Contact</span>
          </button>
        </div>

        <div class="empty-state" v-if="!contacts.length && !contactsLoading">
          <div class="empty-icon">
            <Users :size="32" />
          </div>
          <h3>No Contacts Yet</h3>
          <p>Add addresses you frequently send to for quick access.</p>
          <button class="connect-btn" @click="openAddContactModal">
            <Plus :size="16" />
            <span>Add First Contact</span>
          </button>
        </div>

        <div v-else-if="contactsLoading" class="empty-state">
          <div class="empty-icon">
            <Users :size="32" />
          </div>
          <h3>Loading contacts…</h3>
        </div>

        <div v-else class="contacts-grid">
          <div v-for="contact in contacts" :key="contact.id" class="contact-card">
            <div class="contact-header">
              <div class="contact-avatar">
                {{ contact.name.charAt(0).toUpperCase() }}
              </div>
              <div class="contact-info">
                <h4>{{ contact.name }}</h4>
                <p class="contact-address" :title="contact.address">
                  {{ contact.address.slice(0, 12) }}...{{ contact.address.slice(-8) }}
                </p>
              </div>
            </div>
            <p class="contact-note" v-if="contact.note">{{ contact.note }}</p>
            <div class="contact-actions">
              <button class="contact-btn send" @click="sendToContact(contact)">
                <Send :size="16" />
                <span>Send</span>
              </button>
              <button class="contact-btn copy" @click="copyToClipboard(contact.address, 'Address copied!')">
                <Copy :size="16" />
                <span>Copy</span>
              </button>
              <button class="contact-btn edit" @click="editContact(contact)">
                <Edit :size="16" />
                <span>Edit</span>
              </button>
              <button class="contact-btn delete" @click="deleteContact(contact)">
                <Trash2 :size="16" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Recurring Payments View -->
      <div v-else-if="currentView === 'recurring'" class="content-section recurring-section">
        <SubscriptionsView 
          ref="subscriptionsRef"
          @execute-payment="executeRecurringPayment"
          @toast="showToast"
        />
      </div>

    </main>

    <!-- Asset Transfer Modal -->
    <Transition name="fade">
      <div v-if="showAssetTransferModal" class="modal-overlay" @click="closeAssetTransferModal">
        <div class="modal-content send-modal asset-transfer-modal" @click.stop>
          <div class="modal-header">
            <div class="modal-title-wrapper">
              <div class="modal-icon">
                <ArrowLeftRight :size="20" />
              </div>
              <h3>Asset Transfer</h3>
            </div>
            <button class="modal-close" @click="closeAssetTransferModal">
              <X :size="18" />
            </button>
          </div>
          <div class="modal-body" v-if="assetTransferContext">
            <div class="info-banner">
              <span>
                Move this asset across linked IBC chains. The recipient field is prefilled with your wallet on the destination chain.
              </span>
            </div>

            <div class="form-group">
              <label>Asset</label>
              <div class="input-wrapper readonly">
                <input
                  class="form-input"
                  type="text"
                  :value="`${assetTransferContext.displayName} (${assetTransferContext.displaySymbol})`"
                  readonly
                />
              </div>
            </div>

            <div class="asset-modal-grid">
              <div class="form-group">
                <label>From chain</label>
                <div class="input-wrapper readonly">
                  <input class="form-input" type="text" :value="assetTransferContext.chainLabel" readonly />
                </div>
              </div>
              <div class="form-group">
                <label>To chain</label>
                <div class="input-wrapper">
                  <select class="form-input form-select" v-model="assetTransferForm.destinationKey">
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

            <div class="form-group">
              <label>From address</label>
              <div class="input-wrapper readonly">
                <input class="form-input" type="text" :value="assetTransferContext.ownerAddress" readonly />
              </div>
            </div>

            <div class="form-group">
              <label>Recipient <span class="required">*</span></label>
              <div class="input-wrapper">
                <input
                  class="form-input"
                  type="text"
                  v-model="assetTransferForm.recipient"
                  :placeholder="selectedAssetTransferTarget?.defaultRecipient || 'Destination address'"
                />
              </div>
              <div v-if="selectedAssetTransferTarget" class="field-hint">
                Default wallet on destination: {{ selectedAssetTransferTarget.defaultRecipient }}
              </div>
            </div>

            <div class="form-group">
              <label>Amount <span class="required">*</span></label>
              <div class="input-wrapper amount-input">
                <input
                  class="form-input"
                  type="text"
                  inputmode="decimal"
                  v-model="assetTransferForm.amount"
                  placeholder="0.000000"
                  @input="validateAssetTransferAmountInput"
                />
                <span class="input-suffix">{{ assetTransferContext.displaySymbol }}</span>
              </div>
              <div class="balance-hint">
                Available: {{ assetTransferContext.displayAmount }} {{ assetTransferContext.displaySymbol }}
              </div>
            </div>

            <div class="tx-summary">
              <div class="summary-header">
                <span>Transfer Summary</span>
              </div>
              <div class="summary-row">
                <span>Route</span>
                <span class="summary-value">{{ selectedAssetTransferTarget?.routeLabel || 'Select destination' }}</span>
              </div>
              <div class="summary-row">
                <span>Source chain</span>
                <span class="summary-value">{{ assetTransferContext.chainLabel }}</span>
              </div>
              <div class="summary-row total">
                <span>Destination chain</span>
                <span class="summary-value">{{ selectedAssetTransferTarget?.chainLabel || 'Unknown' }}</span>
              </div>
            </div>

            <button
              class="btn-modal-primary"
              @click="confirmAssetTransfer"
              :disabled="!canSubmitAssetTransfer || assetTransferSending"
            >
              <ArrowLeftRight :size="18" v-if="!assetTransferSending" />
              <span class="spinner" v-else></span>
              <span>{{ assetTransferSending ? 'Transferring...' : 'Transfer Asset' }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Send Modal -->
    <Transition name="fade">
      <div v-if="showSendModal" class="modal-overlay" @click="closeSendModal">
        <div class="modal-content send-modal" @click.stop>
          <div class="modal-header">
            <div class="modal-title-wrapper">
              <div class="modal-icon">
                <Send :size="20" />
              </div>
              <h3>{{ sendModalTitle }}</h3>
            </div>
            <button class="modal-close" @click="closeSendModal">
              <X :size="18" />
            </button>
          </div>
          <div class="modal-body">
            <div class="info-banner">
              <span>
                💡 Your first transaction may take up to 60 seconds. <br>
                After that, transactions are confirmed within ~6 seconds.</span>
            </div>

            <div class="form-group">
              <label>From</label>
              <div class="input-wrapper readonly">
                <input class="form-input" type="text" :value="address" readonly />
              </div>
            </div>

            <div class="form-group">
              <label>Send to</label>
              <div class="input-wrapper">
                <select class="form-input form-select" v-model="sendTargetMode">
                  <option value="lumen">To a Lumen wallet</option>
                  <option value="ibc">To an IBC wallet (another chain)</option>
                </select>
              </div>
            </div>

            <div v-if="isIbcSend" class="form-group">
              <label>IBC route <span class="required">*</span></label>
              <div class="input-wrapper">
                <select
                  class="form-input form-select"
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
              <div v-if="selectedIbcChannel" class="field-hint">
                Route: {{ selectedIbcChannel.portId }}/{{ selectedIbcChannel.channelId }}
                <span v-if="selectedIbcChannel.chainId"> · Destination chain: {{ selectedIbcChannel.chainId }}</span>
              </div>
              <div v-else-if="ibcChannelsError" class="field-hint error">
                {{ ibcChannelsError }}
              </div>
            </div>

            <div class="form-group">
              <label>{{ isIbcSend ? 'Destination address' : 'To' }} <span class="required">*</span></label>
              <div class="input-wrapper-relative">
                <div class="input-wrapper">
                  <input 
                    class="form-input" 
                    type="text" 
                    v-model="sendForm.recipient" 
                    :placeholder="sendRecipientPlaceholder"
                  />
                  <button 
                    class="input-action-btn" 
                    @click="openQrScanner"
                    type="button"
                    title="Scan QR Code"
                  >
                    <QrCode :size="16" />
                  </button>
                  <button 
                    v-if="contacts.length > 0" 
                    class="input-action-btn" 
                    @click="showContactPicker = !showContactPicker"
                    type="button"
                    title="Select from contacts"
                  >
                    <Users :size="16" />
                  </button>
                </div>
                <div v-if="showContactPicker" class="contact-picker">
                  <div class="picker-header">
                    <span>Select Contact</span>
                    <button class="picker-close" @click="showContactPicker = false">
                      <X :size="14" />
                    </button>
                  </div>
                  <div class="picker-list">
                    <button 
                      v-for="contact in contacts" 
                      :key="contact.id"
                      class="picker-item"
                      @click="selectContactForSend(contact)"
                    >
                      <div class="picker-avatar">{{ contact.name.charAt(0).toUpperCase() }}</div>
                      <div class="picker-info">
                        <span class="picker-name">{{ contact.name }}</span>
                        <span class="picker-address">{{ contact.address.slice(0, 12) }}...{{ contact.address.slice(-8) }}</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="form-group">
              <label>Amount (LMN) <span class="required">*</span></label>
              <div class="input-wrapper amount-input">
                <input 
                  class="form-input" 
                  type="text" 
                  inputmode="decimal"
                  v-model="sendForm.amount"
                  placeholder="0.000000"
                  @input="validateAmountInput"
                />
                <span class="input-suffix">LMN</span>
              </div>
              <div class="balance-hint" v-if="balanceLmn !== null">
                Available: {{ balanceLmnDisplay }} LMN
              </div>
            </div>

            <div class="tx-summary">
              <div class="summary-header">
                <span>{{ isIbcSend ? 'Transfer Summary' : 'Transaction Summary' }}</span>
              </div>
              <div class="summary-row">
                <span>{{ isIbcSend ? 'Transfer amount' : 'Amount debited' }}</span>
                <span class="summary-value">{{ sendSummary.amount }} LMN</span>
              </div>
              <div v-if="!isIbcSend" class="summary-row">
                <span>Tax</span>
                <span class="summary-value tax">{{ sendSummary.taxLabel }}</span>
              </div>
              <div v-if="!isIbcSend" class="summary-row total">
                <span>Receiver net</span>
                <span class="summary-value">{{ sendSummary.receiver }} LMN</span>
              </div>
              <div v-if="isIbcSend" class="summary-row">
                <span>Route</span>
                <span class="summary-value">{{ sendSummary.routeLabel }}</span>
              </div>
              <div v-if="isIbcSend" class="summary-row total">
                <span>Destination chain</span>
                <span class="summary-value">{{ sendSummary.destinationChain }}</span>
              </div>
            </div>

            <button class="btn-modal-primary" @click="confirmSendPreview" :disabled="!canSend || sendingTransaction">
              <Send :size="18" v-if="!sendingTransaction" />
              <span class="spinner" v-else></span>
              <span>{{ sendPrimaryActionLabel }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Receive Modal -->
    <Transition name="fade">
      <div v-if="showReceiveModal" class="modal-overlay" @click="closeReceiveModal">
        <div class="modal-content receive-modal" @click.stop>
          <div class="modal-header">
            <div class="modal-title-wrapper">
              <div class="modal-icon receive">
                <ArrowDownLeft :size="20" />
              </div>
              <h3>Receive LMN</h3>
            </div>
            <button class="modal-close" @click="closeReceiveModal">
              <X :size="18" />
            </button>
          </div>
          <div class="modal-body">
            <div class="info-banner">
              <span>📱 Share your wallet address or QR code to receive LMN from another wallet.</span>
            </div>

            <div class="qr-section">
              <div class="qr-wrapper">
                <img 
                  v-if="qrCodeDataUrl" 
                  :src="qrCodeDataUrl"
                  alt="QR Code"
                  class="qr-image"
                />
                <div v-else class="qr-placeholder">
                  <div class="qr-loading">Generating QR Code...</div>
                </div>
              </div>
            </div>

            <div class="address-box">
              <div class="address-label">Your Wallet Address</div>
              <div class="address-value">{{ address || '-' }}</div>
              <button class="btn-copy-address" type="button" @click="copyAddressWithToast" :disabled="!address">
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
      <div v-if="showContactModal" class="modal-overlay" @click="closeContactModal">
        <div class="modal-content contact-modal" @click.stop>
          <div class="modal-header">
            <div class="modal-title-wrapper">
              <div class="modal-icon">
                <Users :size="20" />
              </div>
              <h3>{{ editingContact ? 'Edit Contact' : 'Add Contact' }}</h3>
            </div>
            <button class="modal-close" @click="closeContactModal">
              <X :size="18" />
            </button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Name <span class="required">*</span></label>
              <div class="input-wrapper">
                <input 
                  class="form-input" 
                  type="text" 
                  v-model="contactForm.name" 
                  placeholder="Enter contact name" 
                />
              </div>
            </div>

            <div class="form-group">
              <label>Address <span class="required">*</span></label>
              <div class="input-wrapper">
                <input 
                  class="form-input" 
                  type="text" 
                  v-model="contactForm.address" 
                  placeholder="lmn1..." 
                  :readonly="!!editingContact"
                />
              </div>
            </div>

            <div class="form-group">
              <label>Note (optional)</label>
              <div class="input-wrapper">
                <textarea 
                  class="form-input form-textarea" 
                  v-model="contactForm.note" 
                  placeholder="Add a note about this contact"
                  rows="3"
                ></textarea>
              </div>
            </div>

            <button 
              class="btn-modal-primary" 
              @click="saveContact" 
              :disabled="!contactForm.name || !contactForm.address || savingContact"
            >
              <Check :size="18" v-if="!savingContact" />
              <span class="spinner" v-else></span>
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
      <div v-if="showDeleteConfirmModal" class="modal-overlay" @click="cancelDeleteContact">
        <div class="modal-content delete-confirm-modal" @click.stop>
          <div class="modal-header">
            <div class="modal-title-wrapper">
              <div class="modal-icon delete">
                <Trash2 :size="20" />
              </div>
              <h3>Delete Contact</h3>
            </div>
            <button class="modal-close" @click="cancelDeleteContact">
              <X :size="18" />
            </button>
          </div>
          <div class="modal-body">
            <p class="confirm-message">
              Are you sure you want to delete <strong>{{ contactToDelete?.name }}</strong>?
            </p>
            <p class="confirm-submessage">
              This action cannot be undone.
            </p>
            <div class="modal-actions">
              <button class="btn-modal-secondary" @click="cancelDeleteContact">
                Cancel
              </button>
              <button class="btn-modal-danger" @click="confirmDeleteContact">
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
const selectedIbcChannel = computed(() =>
  ibcChannels.value.find(
    (channel) =>
      channel.channelId === ibcForm.value.sourceChannel &&
      channel.portId === ibcForm.value.sourcePort
  ) || null
);
const sendModalTitle = computed(() => (isIbcSend.value ? 'Transfer' : 'Send'));
const sendRecipientPlaceholder = computed(() =>
  isIbcSend.value
    ? 'Enter recipient address on the other chain'
    : `Enter recipient address (${senderPrefix.value}1...)`
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

  const net = (window as any)?.lumen?.net;
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
    const net = (window as any)?.lumen?.net;
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
    const anyWindow = window as any;
    const walletApi = anyWindow?.lumen?.wallet;
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
  showContactPicker.value = false;
  showSendModal.value = true;
}

function closeSendModal() {
  if (sendingTransaction.value) {
    showToast('Transaction in progress. Please wait...', 'info');
    return;
  }
  showSendModal.value = false;
  showContactPicker.value = false;
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

  const anyWindow = window as any;
  const walletApi = anyWindow?.lumen?.wallet;
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
        try { await anyWindow?.lumen?.security?.lockSession?.(); } catch {}
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
  if (!address.value) return false;
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
    iconText: prefix ? prefix.slice(0, 3).toUpperCase() : 'IBC'
  };
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
  const anyWindow = window as any;
  const httpGet = anyWindow?.lumen?.http?.get || anyWindow?.lumen?.httpGet;
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
  const anyWindow = window as any;
  const httpGet = anyWindow?.lumen?.http?.get || anyWindow?.lumen?.httpGet;
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
  const net = (window as any)?.lumen?.net;
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
      const net = (window as any)?.lumen?.net;
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
  const net = (window as any)?.lumen?.net;
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
  const transferEnabled = input.transferTargets.length > 0 && BigInt(rawAmount || '0') > 0n;

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
    transferTargets: input.transferTargets,
    transferEnabled,
    transferButtonLabel: input.transferTargets.length ? 'Transfer' : 'No route',
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
  
  if (!address.value) {
    showToast('No sender address available', 'error');
    return;
  }
  const from = address.value;
  const to = String(sendForm.value.recipient || '').trim();
  const recipientPrefix = getAddressPrefix(to);
  const amountNum = Number(sendForm.value.amount || '0');
  
  if (!to) {
    showToast('Please enter recipient address', 'error');
    return;
  }
  
  if (!(amountNum > 0)) {
    showToast('Please enter a valid amount', 'error');
    return;
  }

  if (balanceLmn.value !== null && amountNum > balanceLmn.value) {
    showToast('Insufficient balance', 'error');
    return;
  }

  const anyWindow = window as any;
  const walletApi = anyWindow?.lumen?.wallet;
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
      if (recipientPrefix && recipientPrefix === senderPrefix.value) {
        showToast('This address looks like a Lumen wallet. Use the Lumen send mode instead.', 'warning');
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
        denom: 'ulmn',
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
      if (recipientPrefix && recipientPrefix !== senderPrefix.value) {
        showToast('This address looks like another chain. Switch to IBC transfer.', 'warning');
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
        denom: 'ulmn',
        memo: ''
      };
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
        try { await (anyWindow as any)?.lumen?.security?.lockSession?.(); } catch {}
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

  const anyWindow = window as any;
  const walletApi = anyWindow?.lumen?.wallet;
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
      params.rpcEndpoint = context.rpcEndpoint;
      params.restEndpoint = context.restEndpoint;
      params.chainId = context.chainId;
      params.feeDenom = context.feeDenom;
      params.feeAmount = '1000';
      params.feeGas = '350000';
    }

    const sendPromise = walletApi.ibcTransfer(params);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Transaction timeout after 2 minutes')), 120000)
    );
    const res = await Promise.race([sendPromise, timeoutPromise]);

    if (!res || res.ok === false) {
      const err = String(res?.error || 'unknown error');
      if (err === 'password_required' || err === 'invalid_password') {
        try { await anyWindow?.lumen?.security?.lockSession?.(); } catch {}
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
    const result = await (window as any).lumen.addressBook.list();
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
      const result = await (window as any).lumen.addressBook.update(
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
      const result = await (window as any).lumen.addressBook.add(plainContact);
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
    const result = await (window as any).lumen.addressBook.delete(contactToDelete.value.id);
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
  sendForm.value.recipient = contact.address;
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

<style scoped>
.text-muted {
  color: var(--text-tertiary);
  font-style: italic;
}

.sidebar {
  width: 260px;
  min-width: 260px;
  max-width: 260px;
  height: 100%;
  background: var(--sidebar-bg);
  backdrop-filter: var(--backdrop-blur);
  -webkit-backdrop-filter: var(--backdrop-blur);
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  color: var(--text-primary);
  border-right: var(--border-width) solid var(--border-color);
  position: relative;
  overflow: hidden;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  margin-bottom: 2rem;
}

.logo-icon {
  width: 40px;
  height: 40px;
  background: var(--gradient-primary);
  border-radius: var(--border-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: var(--shadow-primary);
}

.logo-text {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
}

.profile-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--fill-tertiary);
  border-radius: var(--border-radius-lg);
  margin-bottom: 1rem;
  border: var(--border-width) solid var(--border-light);
}

.avatar {
  width: 36px;
  height: 36px;
  background: var(--gradient-primary);
  border-radius: var(--border-radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 2px 8px var(--primary-a20);
}

.profile-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.profile-label {
  font-size: 0.65rem;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.profile-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.nav-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 1.5rem;
}

.nav-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.5rem 1rem;
  margin-bottom: 0.25rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.875rem;
  border: none;
  background: transparent;
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  font-size: var(--fs-base);
  font-weight: 400;
  color: var(--text-primary);
  transition: all var(--transition-fast);
  letter-spacing: -0.022em;
}

.nav-item:hover {
  background: var(--hover-bg);
}

.nav-item.active {
  background: var(--ios-blue);
  color: white;
  font-weight: 600;
  box-shadow: var(--shadow-primary);
}

.nav-item:active {
  transform: scale(0.98);
}

.wallet-status {
  padding: 0.875rem 1rem;
  border-radius: 10px;
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid rgba(248, 113, 113, 0.2);
  display: flex;
  align-items: center;
  gap: 0.625rem;
  font-size: 0.8125rem;
  color: var(--ios-red);
  cursor: pointer;
  transition: all 0.2s ease;
  font-weight: 500;
  margin-bottom: 1.5rem;
}

.wallet-status:hover {
  background: rgba(248, 113, 113, 0.15);
  border-color: rgba(248, 113, 113, 0.3);
}

.wallet-status.connected {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.2);
  color: var(--ios-green);
}

.wallet-status.connected:hover {
  background: rgba(34, 197, 94, 0.15);
  border-color: rgba(34, 197, 94, 0.3);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ios-red);
  box-shadow: 0 0 8px rgba(220, 38, 38, 0.4);
}

.wallet-status.connected .status-dot {
  background: var(--ios-green);
  box-shadow: 0 0 8px rgba(22, 163, 74, 0.4);
}

.main-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 2rem 2.5rem;
  background: var(--bg-secondary);
  margin: 0;
  border-radius: 0;
}

.content-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.content-header h1 {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 600;
  color: var(--text-primary);
}

.content-header p {
  margin: 0.25rem 0 0;
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.header-actions {
  display: flex;
  gap: 0.75rem;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.625rem;
  border-radius: 10px;
  padding: 0.625rem 1.125rem;
  font-size: 0.875rem;
  font-weight: 500;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn.secondary {
  background: var(--card-bg);
  color: var(--text-secondary);
  border-color: var(--border-color);
}

.action-btn.secondary:hover {
  background: var(--bg-secondary);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.action-btn.primary {
  background: var(--gradient-primary);
  color: #fff;
  box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
}

.action-btn.primary:hover {
  box-shadow: 0 8px 25px rgba(59, 130, 246, 0.5);
  transform: translateY(-2px);
}

.overview-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.balance-card {
  background: var(--gradient-primary);
  border-radius: 20px;
  padding: 2rem;
  color: white;
  box-shadow: 0 20px 40px rgba(59, 130, 246, 0.3), 0 5px 15px rgba(59, 130, 246, 0.2);
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.balance-card::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -20%;
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.2) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

.balance-card::after {
  content: '';
  position: absolute;
  bottom: -30%;
  left: -10%;
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}

.balance-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.balance-label {
  font-size: 0.8125rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 600;
}

.eye-btn {
  border: none;
  background: var(--bg-tertiary);
  backdrop-filter: blur(10px);
  border-radius: 8px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.eye-btn:hover {
  background: var(--card-bg);
  transform: scale(1.05);
}

.balance-amount {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.currency {
  font-size: 1.125rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.amount {
  font-size: 3rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.balance-change {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 500;
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1rem;
}

.quick-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem 1rem;
  border-radius: 16px;
  border: 2px solid var(--border-color);
  background: var(--card-bg);
  backdrop-filter: blur(10px);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  position: relative;
  overflow: hidden;
}

.quick-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.1) 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.quick-btn:not(:disabled):hover::before {
  opacity: 1;
}

.quick-btn:not(:disabled):hover {
  transform: translateY(-6px);
  box-shadow: 0 20px 40px rgba(59, 130, 246, 0.25);
  border-color: rgba(59, 130, 246, 0.5);
}

.quick-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.quick-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
  transition: all 0.3s ease;
}

.quick-icon.send {
  background: var(--gradient-primary);
  color: white;
}

.quick-icon.receive {
  background: var(--gradient-primary);
  color: white;
}

.quick-icon.swap {
  background: var(--gradient-primary);
  color: white;
}

.quick-icon.buy {
  background: var(--gradient-primary);
  color: white;
}

.quick-icon.disabled {
  background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%);
  color: white;
  opacity: 0.6;
}

.info-section {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.info-card {
  flex: 1;
  min-width: 260px;
  background: var(--card-bg);
  border-radius: 1rem;
  padding: 1rem 1.25rem;
  border: 1px solid var(--border-color);
}

.info-label {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-tertiary);
  margin-bottom: 0.25rem;
}

.info-value {
  font-size: 0.9rem;
  color: var(--text-primary);
}

.info-value.mono {
  font-family: 'SF Mono', ui-monospace, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  word-break: break-all;
}

.content-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.recurring-section {
  padding: 0;
  gap: 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}

.section-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.header-actions-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  background: var(--card-bg);
  color: var(--text-primary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-select:hover {
  border-color: var(--primary, var(--accent-primary));
}

.filter-select:focus {
  outline: none;
  border-color: var(--primary, var(--accent-primary));
  box-shadow: 0 0 0 3px var(--primary-a10);
}

.search-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  background: var(--card-bg);
  color: var(--text-primary);
  font-size: 0.875rem;
  min-width: 200px;
  transition: all 0.2s;
}

.search-input:hover {
  border-color: var(--primary, var(--accent-primary));
}

.search-input:focus {
  outline: none;
  border-color: var(--primary, var(--accent-primary));
  box-shadow: 0 0 0 3px var(--primary-a10);
}

.search-input::placeholder {
  color: var(--text-tertiary);
}

.empty-state {
  margin-top: 2rem;
  padding: 2rem;
  border-radius: 1rem;
  background: var(--bg-secondary);
  border: 1px dashed var(--border-color);
  text-align: center;
}

.empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin: 0 auto 1rem;
  border-radius: 999px;
  background: var(--bg-secondary);
  color: var(--accent-secondary);
}

.empty-state h3 {
  margin: 0 0 0.5rem;
  font-size: 1.05rem;
}

.empty-state p {
  margin: 0 0 1rem;
  font-size: 0.9rem;
  color: var(--text-tertiary);
}

.connect-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 1rem;
  border-radius: 999px;
  border: none;
  background: var(--accent-secondary);
  color: white;
  font-size: 0.85rem;
  cursor: pointer;
}

.assets-list {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.rich-assets-list {
  gap: 1rem;
}

.asset-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1rem;
  border-radius: 0.9rem;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
}

.asset-item-rich {
  align-items: stretch;
  gap: 1rem;
}

.asset-icon {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  font-weight: 600;
  color: white;
  overflow: hidden;
  flex-shrink: 0;
}

.asset-icon.lmn {
  background: var(--accent-secondary);
}

.asset-icon.remote {
  background: linear-gradient(135deg, var(--accent-primary), var(--ios-blue));
}

.asset-icon-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  background: white;
}

.asset-main {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  flex: 1;
  min-width: 0;
}

.asset-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.asset-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.asset-name {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-primary);
}

.asset-chain-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  font-size: 0.72rem;
  color: var(--text-secondary);
}

.asset-symbol {
  font-size: 0.8rem;
  color: var(--text-tertiary);
}

.asset-meta {
  font-size: 0.78rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.asset-meta.error {
  color: var(--ios-red);
}

.asset-balance {
  text-align: right;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-primary);
}

.balance-column {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.15rem;
}

.asset-balance-symbol {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  font-weight: 600;
}

.asset-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.75rem;
}

.asset-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.asset-transfer-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.asset-modal-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.spin-icon {
  animation: spin 0.9s linear infinite;
}

.dex-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.dex-item {
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background: var(--card-bg);
  overflow: hidden;
}

.dex-item-online {
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04);
}

.dex-item-degraded {
  border-color: rgba(245, 158, 11, 0.35);
}

.dex-item-error {
  border-color: rgba(239, 68, 68, 0.28);
}

.dex-top {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
}

.dex-summary-btn {
  display: flex;
  align-items: flex-start;
  gap: 0.9rem;
  flex: 1;
  min-width: 0;
  padding: 0;
  border: none;
  background: transparent;
  text-align: left;
  color: inherit;
  cursor: pointer;
}

.dex-logo {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--accent-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  font-size: 0.95rem;
  font-weight: 700;
}

.dex-logo-dark {
  background: #111827;
  border-color: rgba(17, 24, 39, 0.65);
}

.dex-logo-image {
  width: 74%;
  height: 74%;
  object-fit: contain;
  object-position: center;
  display: block;
  margin: auto;
  background: transparent;
}

.dex-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
}

.dex-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.dex-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.dex-status-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.22rem 0.55rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  border: 1px solid transparent;
}

.dex-status-badge.status-idle,
.dex-status-badge.status-loading {
  background: rgba(59, 130, 246, 0.1);
  color: var(--ios-blue);
  border-color: rgba(59, 130, 246, 0.16);
}

.dex-status-badge.status-online {
  background: rgba(34, 197, 94, 0.12);
  color: var(--ios-green);
  border-color: rgba(34, 197, 94, 0.16);
}

.dex-status-badge.status-degraded {
  background: rgba(245, 158, 11, 0.12);
  color: var(--ios-orange);
  border-color: rgba(245, 158, 11, 0.18);
}

.dex-status-badge.status-error {
  background: rgba(239, 68, 68, 0.12);
  color: var(--ios-red);
  border-color: rgba(239, 68, 68, 0.18);
}

.dex-meta {
  font-size: 0.8rem;
  color: var(--text-tertiary);
}

.dex-meta.error {
  color: var(--ios-red);
}

.dex-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.8rem;
}

.dex-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.dex-detail-toggle,
.dex-open-btn {
  justify-content: center;
}

.dex-chevron {
  transition: transform 0.2s ease;
}

.dex-chevron.open {
  transform: rotate(180deg);
}

.dex-details {
  border-top: 1px solid var(--border-light);
  background: var(--bg-secondary);
  padding: 1rem 1.25rem 1.25rem;
}

.dex-detail-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
}

.dex-detail-card {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.9rem 1rem;
  border-radius: 0.9rem;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
}

.dex-detail-card.compact {
  padding: 0.65rem 0.8rem;
  gap: 0.2rem;
}

.dex-detail-label {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.dex-detail-value {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dex-detail-card.compact .dex-detail-label {
  font-size: 0.64rem;
}

.dex-detail-card.compact .dex-detail-value {
  font-size: 0.82rem;
}

.dex-detail-sub {
  font-size: 0.8rem;
  color: var(--text-secondary);
  line-height: 1.35;
}

.dex-links {
  margin-top: 0.9rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.dex-link-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.55rem 0.8rem;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-secondary);
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.dex-link-chip:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
  background: var(--primary-a10);
}

/* Transaction List */
.activities-list {
  display: flex;
  flex-direction: column;
  background: var(--card-bg, white);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
  width: 100%;
}

.table-header {
  display: grid;
  grid-template-columns: 170px 1fr 1.2fr 1.2fr 1.5fr 100px 120px;
  gap: 1rem;
  padding: 0.875rem 1.25rem;
  background: var(--bg-secondary);
  border-bottom: 2px solid var(--border-color);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  width: 100%;
  box-sizing: border-box;
}

.table-header > div,
.activity-row > div {
  min-width: 0;
}

.activity-row {
  display: grid;
  grid-template-columns: 170px 1fr 1.2fr 1.2fr 1.5fr 100px 120px;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-light);
  align-items: center;
  transition: all 0.2s ease;
}

.activity-row:hover {
  background: var(--hover-bg);
  border-left: 3px solid var(--accent-primary);
  padding-left: calc(1.25rem - 3px);
}

.activity-row:last-child {
  border-bottom: none;
}

.type-badge {
  display: inline-flex;
  align-items: flex-start;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.type-badge.dns-update {
  background: rgba(124, 58, 237, 0.1);
  color: var(--ios-purple);
}

.type-badge.dns-transfer {
  background: rgba(59, 130, 246, 0.1);
  color: var(--ios-blue);
}

.type-badge.dns-register {
  background: rgba(245, 158, 11, 0.1);
  color: var(--ios-orange);
}

.type-badge.withdraw-rewards {
  background: rgba(255, 204, 0, 0.1);
  color: var(--ios-yellow);
}

.type-badge.publish-release {
  background: rgba(var(--ios-indigo-rgb), 0.12);
  color: var(--ios-indigo);
}

.type-badge.send {
  background: rgba(239, 68, 68, 0.1);
  color: var(--ios-red);
}

.type-badge.receive {
  background: rgba(34, 197, 94, 0.1);
  color: var(--ios-green);
}

.type-text {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
  line-height: 1.1;
}

.type-sub {
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 140px;
}

.amount-value {
  font-size: 0.875rem;
  font-weight: 700;
  font-family: 'SF Mono', ui-monospace, Menlo, Monaco, Consolas, monospace;
}

.amount-value.send {
  color: var(--ios-red);
}

.amount-value.receive {
  color: var(--ios-green);
}

.address-value,
.hash-value {
  font-family: 'SF Mono', ui-monospace, Menlo, Monaco, Consolas, monospace;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.col-from,
.col-to {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.col-from .address-value,
.col-to .address-value {
  flex: 0 1 auto;
  min-width: 0;
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hash-value {
  font-family: 'SF Mono', ui-monospace, Menlo, Monaco, Consolas, monospace;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.col-hash {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.time-value {
  font-size: 0.8125rem;
  color: var(--text-primary);
  font-weight: 500;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.time-hour {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  font-weight: 400;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.375rem 0.625rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.status-badge.success {
  background: var(--fill-success);
  color: var(--ios-green);
}

.status-badge.failed {
  background: var(--fill-error);
  color: var(--ios-red);
}

.action-icon {
  padding: 0.375rem;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.action-icon:hover {
  background: var(--hover-bg);
  transform: scale(1.05);
}

.action-icon:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.action-icon:disabled:hover {
  background: var(--card-bg);
  transform: none;
}

.action-icon.asset-refresh-btn:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.action-icon.copy-btn:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.action-icon.explorer-btn:hover {
  border-color: var(--ios-purple);
  color: var(--ios-purple);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: var(--bg-primary);
  border-radius: 16px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.4), 0 0 0 1px rgba(15, 23, 42, 0.05);
}

.modal-header {
  padding: 1.5rem 1.5rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-title-wrapper {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.modal-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--gradient-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-title-wrapper {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.modal-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--gradient-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-close {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.modal-close:hover {
  background: var(--hover-bg);
  border-color: var(--border-color);
  color: var(--text-secondary);
}

.modal-body {
  padding: 1.5rem;
}

.info-banner {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 0.875rem 1rem;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
  color: var(--text-primary, var(--accent-primary));
  line-height: 1.5;
}

.info-banner.warning {
  background: rgba(251, 191, 36, 0.1);
  border-color: rgba(251, 191, 36, 0.3);
  color: var(--text-primary);
}

.info-banner ul {
  list-style-type: disc;
  padding-left: 1.5rem;
}

.info-banner li {
  margin: 0.25rem 0;
}

.modal-desc {
  font-size: 0.9rem;
  color: var(--text-tertiary);
  margin-bottom: 1rem;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.required {
  color: var(--ios-red);
}

.input-wrapper-relative {
  position: relative;
}

.input-wrapper {
  position: relative;
}

.input-wrapper.readonly {
  opacity: 0.7;
}

.form-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  border: 2px solid var(--border-color);
  font-size: 0.9375rem;
  color: var(--text-primary);
  background: var(--card-bg);
  transition: all 0.2s ease;
  font-family: 'SF Mono', ui-monospace, Menlo, Monaco, Consolas, monospace;
}

.form-select {
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
  font-family: inherit;
}

.form-input:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--primary-a10);
}

.form-input::placeholder {
  color: var(--text-tertiary);
}

.form-input:read-only {
  background: var(--bg-secondary);
  cursor: not-allowed;
}

.amount-input .form-input {
  padding-right: 4rem;
}

.input-suffix {
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
  pointer-events: none;
}

.balance-hint {
  margin-top: 0.5rem;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.field-hint {
  margin-top: 0.5rem;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.field-hint.error {
  color: var(--ios-red);
}

.tx-summary {
  margin-top: 1.5rem;
  margin-bottom: 1.5rem;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  padding: 0;
  background: var(--bg-secondary);
  overflow: hidden;
}

.summary-header {
  padding: 0.875rem 1rem;
  background: var(--hover-bg);
  border-bottom: 1px solid var(--border-color);
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.9375rem;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.summary-row:last-child {
  border-bottom: none;
}

.summary-row.total {
  background: var(--bg-secondary);
  border-top: 2px solid var(--border-color);
  font-weight: 700;
  color: var(--text-primary);
}

.summary-value {
  font-weight: 600;
  font-family: 'SF Mono', ui-monospace, Menlo, Monaco, Consolas, monospace;
  color: var(--text-primary);
}

.summary-value.tax {
  color: var(--ios-orange);
}

.btn-modal-primary {
  width: 100%;
  border: none;
  border-radius: 12px;
  padding: 0.875rem 1.25rem;
  background: var(--gradient-primary);
  color: white;
  font-size: 1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px var(--primary-a25);
}

.btn-modal-primary:hover:not(:disabled) {
  background: var(--gradient-primary-hover);
  box-shadow: 0 6px 16px var(--primary-a30);
  transform: translateY(-1px);
}

.btn-modal-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.qr-section {
  display: flex;
  justify-content: center;
  margin: 1.5rem 0;
}

.qr-wrapper {
  padding: 1.25rem;
  background: var(--card-bg);
  border: 2px solid var(--border-color);
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.qr-image {
  width: 240px;
  height: 240px;
  display: block;
  border-radius: 8px;
}

.qr-placeholder {
  width: 240px;
  height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border-radius: 8px;
  color: var(--text-tertiary);
  font-size: 0.875rem;
}

.qr-loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-secondary);
}

.qr-loading::before {
  content: '';
  width: 16px;
  height: 16px;
  border: 2px solid var(--text-tertiary);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.address-box {
  border-radius: 12px;
  border: 2px solid var(--border-color);
  padding: 1.25rem;
  background: var(--bg-secondary);
  margin-bottom: 0;
}

.address-label {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--text-secondary);
  margin-bottom: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.address-box .address-value {
  font-family: 'SF Mono', ui-monospace, Menlo, Monaco, Consolas, monospace;
  font-size: 0.9375rem;
  word-break: break-all;
  margin-bottom: 1rem;
  padding: 0.875rem;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  line-height: 1.6;
}

.btn-copy-address {
  width: 100%;
  border-radius: 10px;
  border: 2px solid var(--accent-primary);
  background: var(--card-bg);
  padding: 0.75rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--accent-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-copy-address:hover:not(:disabled) {
  background: var(--hover-bg);
  border-color: var(--accent-secondary);
  color: var(--accent-secondary);
}

.btn-copy-address:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Toast Notification */
.toast-notification {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1.25rem;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15), 0 4px 12px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  font-size: 0.9rem;
  font-weight: 500;
  min-width: 280px;
}

.toast-notification.success {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.95) 0%, rgba(5, 150, 105, 0.95) 100%);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.toast-notification.error {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.95) 0%, rgba(220, 38, 38, 0.95) 100%);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.toast-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.toast-message {
  flex: 1;
  line-height: 1.4;
}

.toast-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.toast-leave-active {
  transition: all 0.2s ease;
}

.toast-enter-from {
  transform: translateY(100px) scale(0.8);
  opacity: 0;
}

.toast-leave-to {
  transform: translateX(50px);
  opacity: 0;
}

/* Address Book Styles */
.contacts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
  margin-top: 1.5rem;
}

.contact-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.25rem;
  transition: all 0.2s ease;
}

.contact-card:hover {
  border-color: var(--accent-primary);
  box-shadow: 0 4px 12px var(--primary-a15);
}

.contact-header {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  margin-bottom: 0.75rem;
}

.contact-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--gradient-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 700;
  flex-shrink: 0;
}

.contact-info {
  flex: 1;
  min-width: 0;
}

.contact-info h4 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.25rem 0;
}

.contact-address {
  font-size: 0.8125rem;
  color: var(--text-tertiary);
  font-family: 'SF Mono', ui-monospace, Menlo, Monaco, Consolas, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.contact-note {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 0.875rem;
  line-height: 1.5;
}

.contact-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.contact-btn {
  flex: 1;
  min-width: 70px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 0.8125rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.contact-btn:hover {
  background: var(--hover-bg);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.contact-btn.send {
  background: var(--gradient-primary);
  color: white;
  border-color: transparent;
}

.contact-btn.send:hover {
  background: var(--gradient-primary-hover);
  color: white;
}

.contact-btn.delete:hover {
  background: var(--fill-error);
  border-color: var(--ios-red);
  color: var(--ios-red);
}

.contact-modal {
  max-width: 480px;
}

.delete-confirm-modal {
  max-width: 420px;
}

.modal-icon.delete {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
}

.confirm-message {
  font-size: 0.9375rem;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
  line-height: 1.5;
}

.confirm-submessage {
  font-size: 0.875rem;
  color: var(--text-tertiary);
  margin-bottom: 1.5rem;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.btn-modal-secondary {
  flex: 1;
  padding: 0.75rem 1.25rem;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-modal-secondary:hover {
  background: var(--hover-bg);
  border-color: var(--accent-primary);
}

.btn-modal-danger {
  flex: 1;
  padding: 0.75rem 1.25rem;
  border-radius: 10px;
  border: none;
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);
}

.btn-modal-danger:hover {
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4);
  transform: translateY(-1px);
}

.form-textarea {
  resize: vertical;
  font-family: inherit;
  min-height: 80px;
}

.input-action-btn {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  padding: 0.5rem;
  border: none;
  background: var(--hover-bg);
  color: var(--text-secondary);
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.input-action-btn + .input-action-btn {
  right: 3.5rem;
}

.input-action-btn:hover {
  background: var(--accent-primary);
  color: white;
}

.contact-picker {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 0.5rem;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  z-index: 100;
  overflow: hidden;
}

.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
}

.picker-close {
  padding: 0.25rem;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  display: flex;
  align-items: center;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.picker-close:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.picker-list {
  max-height: 300px;
  overflow-y: auto;
}

.picker-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: none;
  background: transparent;
  width: 100%;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 1px solid var(--border-color);
}

.picker-item:last-child {
  border-bottom: none;
}

.picker-item:hover {
  background: var(--hover-bg);
}

.picker-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--gradient-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  font-weight: 700;
  flex-shrink: 0;
}

.picker-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.picker-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
}

.picker-address {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  font-family: 'SF Mono', ui-monospace, Menlo, Monaco, Consolas, monospace;
}

@media (max-width: 900px) {
  .content-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .header-actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .asset-item-rich {
    flex-direction: column;
  }

  .asset-side {
    width: 100%;
    align-items: stretch;
  }

  .balance-column {
    align-items: flex-start;
  }

  .asset-actions {
    justify-content: flex-start;
  }

  .asset-modal-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .dex-top {
    flex-direction: column;
  }

  .dex-side {
    width: 100%;
    align-items: stretch;
  }

  .dex-actions {
    justify-content: flex-start;
  }

  .dex-detail-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .dex-summary-btn {
    flex-direction: column;
  }

  .dex-actions {
    width: 100%;
  }

  .dex-detail-toggle,
  .dex-open-btn {
    flex: 1;
  }

  .dex-detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
