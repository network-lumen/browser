<template>
  <div class="explorer-page">
    <!-- Show Block Detail if URL contains /block/ -->
    <BlockDetailPage v-if="isBlockDetailView" />
    
    <!-- Show Transaction Detail if URL contains /tx/ -->
    <TransactionDetailPage v-else-if="isTransactionDetailView" />
    
    <!-- Show Address Detail if URL contains /address/ -->
    <AddressDetailPage v-else-if="isAddressDetailView" />
    
    <!-- Show normal explorer view otherwise -->
    <template v-else>
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
          </svg>
        </div>
        <span class="logo-text">Explorer</span>
      </div>
      
      <nav class="sidebar-nav">
        <div class="nav-section">
          <span class="nav-label">Browse</span>
          <button 
            class="nav-item"
            :class="{ active: currentView === 'overview' }"
            @click="currentView = 'overview'"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="3" y1="9" x2="21" y2="9"/>
              <line x1="9" y1="21" x2="9" y2="9"/>
            </svg>
            <span>Overview</span>
          </button>
          <button 
            class="nav-item"
            :class="{ active: currentView === 'blocks' }"
            @click="currentView = 'blocks'"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
            </svg>
            <span>Blocks</span>
          </button>
          <button 
            class="nav-item"
            :class="{ active: currentView === 'transactions' }"
            @click="currentView = 'transactions'"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
            </svg>
            <span>Transactions</span>
          </button>
          <button 
            class="nav-item"
            :class="{ active: currentView === 'validators' }"
            @click="currentView = 'validators'"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <span>Validators</span>
          </button>
        </div>
      </nav>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <!-- Search Bar -->
      <div class="search-section">
        <div class="search-container">
          <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <input 
            type="text" 
            class="search-input" 
            v-model="searchQuery"
            @keyup.enter="performSearch"
            placeholder="Search by Block Height, Tx Hash, or Address..."
          />
          <button class="search-btn" @click="performSearch" :disabled="!searchQuery">
            Search
          </button>
        </div>
      </div>

      <!-- Stats Bar -->
      <div class="stats-bar">
        <div class="stat-item">
          <span class="stat-label">Latest Block</span>
          <span class="stat-value">{{ formatNumber(latestBlock) }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Total Transactions</span>
          <span class="stat-value">{{ formatNumber(totalTxs) }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Validators</span>
          <span class="stat-value">{{ validatorCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Avg Block Time</span>
          <span class="stat-value">{{ avgBlockTime.toFixed(2) }}s</span>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading blockchain data...</p>
      </div>

      <template v-else>
        <!-- Overview View -->
        <div v-if="currentView === 'overview'" class="content-area">
          <!-- Section Header -->
          <div class="overview-header">
            <h1>Network Overview</h1>
            <p>Real-time blockchain statistics</p>
          </div>

          <!-- Charts Section -->
          <div class="charts-section">
            <div class="chart-card">
              <div class="chart-header">
                <h3>{{ txHistoryTitle }}</h3>
                <div class="time-filters">
                  <span class="filter-label">Total: 6</span>
                  <button 
                    class="time-filter-btn" 
                    :class="{ active: txTimeFilter === '1D' }"
                    @click="txTimeFilter = '1D'"
                  >1D</button>
                  <button 
                    class="time-filter-btn" 
                    :class="{ active: txTimeFilter === '7D' }"
                    @click="txTimeFilter = '7D'"
                  >7D</button>
                  <button 
                    class="time-filter-btn" 
                    :class="{ active: txTimeFilter === '30D' }"
                    @click="txTimeFilter = '30D'"
                  >30D</button>
                  <button 
                    class="time-filter-btn" 
                    :class="{ active: txTimeFilter === '1Y' }"
                    @click="txTimeFilter = '1Y'"
                  >1Y</button>
                </div>
              </div>
              <div class="chart-container">
                <canvas ref="txHistoryChart"></canvas>
              </div>
            </div>

            <div class="chart-card">
              <div class="chart-header">
                <h3>Bonded / Supply</h3>
              </div>
              <div class="chart-container">
                <div class="chart-donut-wrapper">
                  <canvas ref="bondedSupplyChart" width="120" height="120"></canvas>
                  <div class="chart-center-label">
                    <div class="center-value">{{ bondedRatio }}%</div>
                    <div class="center-label">Bonded</div>
                  </div>
                </div>
                <div class="chart-legend">
                  <div class="legend-item">
                    <span class="legend-dot" style="background: linear-gradient(135deg, #ec4899, #8b5cf6)"></span>
                    <span class="legend-label">Bonded</span>
                    <span class="legend-value">{{ formatNumber(bondedTokens) }} LMN</span>
                  </div>
                  <div class="legend-item">
                    <span class="legend-dot" style="background: rgba(139, 92, 246, 0.2)"></span>
                    <span class="legend-label">Unbonded</span>
                    <span class="legend-value">{{ formatNumber(unbondedTokens) }} LMN</span>
                  </div>
                  <div class="legend-item">
                    <span class="legend-label">Total Supply</span>
                    <span class="legend-value">{{ formatNumber(totalSupply) }} LMN</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="chart-card">
              <div class="chart-header">
                <h3>Voting Power</h3>
              </div>
              <div class="chart-container">
                <div class="chart-donut-wrapper">
                  <canvas ref="votingPowerChart" width="120" height="120"></canvas>
                  <div class="chart-center-label">
                    <div class="center-value">{{ topValidatorsPower.length }}</div>
                    <div class="center-label">Active</div>
                  </div>
                </div>
                <div class="chart-legend">
                  <div v-for="(vp, idx) in topValidatorsPower.slice(0, 5)" :key="idx" class="legend-item">
                    <span class="legend-dot" :style="{ background: getVotingPowerColor(idx) }"></span>
                    <span class="legend-label">{{ vp.moniker }}</span>
                    <span class="legend-value">{{ vp.percentage }}%</span>
                  </div>
                  <div class="legend-item">
                    <span class="legend-dot" style="background: rgba(148, 163, 184, 0.3)"></span>
                    <span class="legend-label">Others</span>
                    <span class="legend-value">{{ othersPercentage }}%</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="chart-card block-production-card">
              <div class="chart-header">
                <h3>Block Production</h3>
                <div class="live-indicator">
                  <span class="live-dot"></span>
                  <span>Live</span>
                </div>
              </div>
              <div class="chart-container">
                <div class="block-proposer-info">
                  <div class="proposer-avatar">
                    <img v-if="latestProposer.avatar" :src="latestProposer.avatar" :alt="latestProposer.moniker" />
                    <span v-else>{{ latestProposer.moniker.charAt(0).toUpperCase() }}</span>
                  </div>
                  <div class="proposer-name">{{ latestProposer.moniker }}</div>
                  <div class="proposer-label">Latest Block Proposer</div>
                  <div class="proposer-stats">
                    <div class="proposer-stat-group">
                      <div class="proposer-stat">
                        <span class="stat-label">Block</span>
                        <span class="stat-value">#{{ formatNumber(latestProposer.blockHeight) }}</span>
                      </div>
                      <div class="proposer-stat">
                        <span class="stat-label">Block Time</span>
                        <span class="stat-value">~{{ avgBlockTime.toFixed(1) }}s</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Recent Activity -->
          <div class="recent-activity">
            <div class="activity-column">
              <div class="activity-header">
                <h3>Latest Blocks</h3>
                <button class="view-all-btn" @click="currentView = 'blocks'">View All →</button>
              </div>
              <div class="activity-list">
                <div v-for="block in blocks.slice(0, 5)" :key="block.height" class="activity-item" @click="navigateToBlock(block.height)" style="cursor: pointer;">
                  <div class="activity-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="3" width="7" height="7" rx="1"/>
                      <rect x="14" y="3" width="7" height="7" rx="1"/>
                      <rect x="14" y="14" width="7" height="7" rx="1"/>
                      <rect x="3" y="14" width="7" height="7" rx="1"/>
                    </svg>
                  </div>
                  <div class="activity-content">
                    <div class="activity-title">#{{ formatNumber(block.height) }}</div>
                    <div class="activity-meta">
                      <img v-if="block.proposerAvatar" :src="block.proposerAvatar" class="proposer-mini-avatar" :alt="block.proposer" />
                      <span>{{ block.proposer }}</span>
                    </div>
                  </div>
                  <div class="activity-side">
                    <div class="activity-value">{{ block.txCount }} txs</div>
                    <div class="activity-time">{{ formatTimeAgo(block.time) }}</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="activity-column">
              <div class="activity-header">
                <h3>Latest Transactions</h3>
                <button class="view-all-btn" @click="currentView = 'transactions'">View All →</button>
              </div>
              <div class="activity-list">
                <div v-for="tx in transactions.slice(0, 5)" :key="tx.hash" class="activity-item" @click="navigateToTransaction(tx.hash)" style="cursor: pointer;">
                  <div class="activity-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
                      <path d="M21 3v5h-5"/>
                    </svg>
                  </div>
                  <div class="activity-content">
                    <div class="activity-title">{{ shortenHash(tx.hash) }}</div>
                    <div class="activity-meta">
                      <span class="tx-type-mini">{{ tx.type }}</span>
                    </div>
                  </div>
                  <div class="activity-side">
                    <div class="activity-status" :class="tx.success ? 'success' : 'failed'">
                      {{ tx.success ? 'Success' : 'Failed' }}
                    </div>
                    <div class="activity-time">{{ formatTimeAgo(tx.time) }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Blocks View -->
        <div v-else-if="currentView === 'blocks'" class="content-area blocks-view">
          <div class="blocks-header">
            <div class="header-content">
              <h2>Blocks</h2>
              <p class="blocks-subtitle">View all blocks on the lumen-mainnet</p>
            </div>
            <div class="header-actions">
              <div class="filter-controls">
                <select v-model="blockFilter" class="filter-select">
                  <option value="all">All Blocks</option>
                  <option value="recent">Recent (Last 100)</option>
                  <option value="with-txs">With Transactions</option>
                  <option value="empty">Empty Blocks</option>
                </select>
                <input
                  v-model="blockHeightFilter"
                  type="number"
                  placeholder="Filter by height..."
                  class="height-filter-input"
                />
              </div>
              <span class="refresh-indicator" :class="{ active: autoRefresh }">
                <span class="pulse-dot"></span>
                Live
              </span>
            </div>
          </div>

          <div class="blocks-table">
            <div class="table-header">
              <div class="th th-height">HEIGHT</div>
              <div class="th th-proposer">PROPOSER</div>
              <div class="th th-hash">HASH</div>
              <div class="th th-txs">TRANSACTIONS</div>
              <div class="th th-time">TIME</div>
            </div>
            
            <div class="table-body">
              <div v-for="block in filteredBlocks" :key="block.height" class="table-row" @click="navigateToBlock(block.height)" style="cursor: pointer;">
                <div class="td td-height">
                  <div class="height-link" @click="navigateToBlock(block.height)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                    </svg>
                    <span class="height-number">{{ formatNumber(block.height) }}</span>
                  </div>
                </div>
                <div class="td td-proposer">
                  <div class="proposer-info">
                    <div class="proposer-avatar">
                      <img v-if="block.proposerAvatar" :src="block.proposerAvatar" :alt="block.proposer" />
                      <span v-else>{{ block.proposer.charAt(0) }}</span>
                    </div>
                    <span class="proposer-name">{{ block.proposer }}</span>
                  </div>
                </div>
                <div class="td td-hash">
                  <div class="hash-container clickable" @click.stop="navigateToBlock(block.height)" title="View block details">
                    <code class="hash-code">{{ block.hash }}</code>
                    <svg class="link-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                    </svg>
                  </div>
                  <button class="copy-icon-btn" @click.stop="copyToClipboard(block.hash, 'Block hash')" title="Copy hash">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                </div>
                <div class="td td-txs">
                  <span class="tx-count" :class="{ 'has-txs': block.txCount > 0 }">
                    {{ block.txCount }}
                  </span>
                </div>
                <div class="td td-time">
                  <span class="time-text">{{ formatTimeAgo(block.time) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Transactions View -->
        <div v-else-if="currentView === 'transactions'" class="content-area transactions-view">
          <div class="transactions-header">
            <div class="header-content">
              <h2>Transactions</h2>
              <p class="transactions-subtitle">Latest transactions on the lumen-mainnet</p>
            </div>
            <div class="filter-controls">
              <select v-model="txTypeFilter" class="filter-select">
                <option value="all">All Types</option>
                <option value="send">Send</option>
                <option value="delegate">Delegate</option>
                <option value="vote">Vote</option>
                <option value="other">Other</option>
              </select>
              <select v-model="txStatusFilter" class="filter-select">
                <option value="all">All Status</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
              </select>
              <input
                v-model="txHashFilter"
                type="text"
                placeholder="Filter by hash..."
                class="hash-filter-input"
              />
            </div>
          </div>

          <div v-if="transactions.length === 0" class="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
            </svg>
            <p>No recent transactions</p>
          </div>

          <div v-else class="transactions-table">
            <div class="table-header">
              <div class="th th-hash">Transaction Hash</div>
              <div class="th th-type">Type</div>
              <div class="th th-result">Result</div>
              <div class="th th-height">Height</div>
              <div class="th th-fee">Fee</div>
              <div class="th th-time">Time</div>
            </div>
            
            <div class="table-body">
              <div v-for="tx in filteredTransactions" :key="tx.hash" class="table-row">
                <div class="td td-hash">
                  <div class="hash-container clickable" @click="navigateToTransaction(tx.hash)" title="View transaction details">
                    <svg class="tx-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                    </svg>
                    <code class="hash-code">{{ shortenHash(tx.hash) }}</code>
                    <svg class="link-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                    </svg>
                  </div>
                  <button class="copy-icon-btn" @click.stop="copyToClipboard(tx.hash, 'Transaction hash')" title="Copy hash">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                </div>
                <div class="td td-type">
                  <span class="tx-type-badge">{{ tx.type }}</span>
                </div>
                <div class="td td-result">
                  <span class="tx-status" :class="tx.success ? 'success' : 'failed'">
                    <svg v-if="tx.success" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    {{ tx.success ? 'Success' : 'Failed' }}
                  </span>
                </div>
                <div class="td td-height">
                  <span class="block-link clickable" @click="navigateToBlock(tx.height)">{{ formatNumber(tx.height) }}</span>
                </div>
                <div class="td td-fee">
                  <span class="fee-amount">{{ tx.fee || '0.000000 LMN' }}</span>
                </div>
                <div class="td td-time">
                  <span class="time-text">{{ formatTimeAgo(tx.time) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Validators View -->
        <div v-else-if="currentView === 'validators'" class="content-area validators-view">
          <div class="validators-header">
            <h2>Active Validators</h2>
            <p class="validators-subtitle">{{ validators.length }} validators securing the network</p>
          </div>

          <div class="validators-table">
            <div class="table-header">
              <div class="th th-rank">#</div>
              <div class="th th-validator">VALIDATOR</div>
              <div class="th th-voting-power">VOTING POWER %</div>
              <div class="th th-changes">24H CHANGES</div>
              <div class="th th-cumulative">CUMULATIVE SHARE %</div>
              <div class="th th-commission">COMM. %</div>
              <div class="th th-score">SCORE</div>
              <div class="th th-delegators">DELEGATORS %</div>
              <div class="th th-uptime">UPTIME %</div>
              <div class="th th-actions">ACTIONS</div>
            </div>
            
            <div class="table-body">
              <div v-for="(validator, index) in validators" :key="validator.address" class="table-row validator-row">
                <div class="td td-rank">
                  <span class="rank-number">{{ index + 1 }}</span>
                </div>
                <div class="td td-validator">
                  <div class="validator-info">
                    <div class="validator-avatar">
                      <img v-if="validator.avatar" :src="validator.avatar" :alt="validator.moniker" />
                      <span v-else>{{ validator.moniker.substring(0, 2).toUpperCase() }}</span>
                    </div>
                    <div class="validator-name-wrapper">
                      <span class="validator-name">{{ validator.moniker }}</span>
                      <span class="validator-address" @click.stop="copyToClipboard(validator.address, 'Validator address')" title="Click to copy address">{{ shortenAddress(validator.address) }}</span>
                    </div>
                  </div>
                </div>
                <div class="td td-voting-power">
                  <div class="voting-power-container">
                    <div class="voting-power-text">{{ getVotingPowerPercentage(validator.tokens) }}%</div>
                    <div class="voting-power-bar">
                      <div class="voting-power-fill" :style="{ width: getVotingPowerPercentage(validator.tokens) + '%' }"></div>
                    </div>
                    <div class="voting-power-amount">{{ formatVotingPower(validator.tokens) }} LMN</div>
                  </div>
                </div>
                <div class="td td-changes">
                  <span class="changes-value positive">+{{ Math.floor(Math.random() * 2000) }}</span>
                </div>
                <div class="td td-cumulative">
                  <div class="cumulative-container">
                    <svg class="circular-progress" width="50" height="50" viewBox="0 0 50 50">
                      <circle cx="25" cy="25" r="20" fill="none" stroke="#e5e7eb" stroke-width="4"></circle>
                      <circle 
                        cx="25" cy="25" r="20" 
                        fill="none" 
                        stroke="var(--accent-primary)" 
                        stroke-width="4"
                        :stroke-dasharray="`${getCumulativeProgress(index)} 100`"
                        transform="rotate(-90 25 25)"
                        stroke-linecap="round"
                      ></circle>
                    </svg>
                    <span class="cumulative-text">{{ getCumulativeProgress(index).toFixed(2) }}%</span>
                  </div>
                </div>
                <div class="td td-commission">
                  <span class="commission-value">{{ (parseFloat(validator.commission) * 100).toFixed(2) }}%</span>
                </div>
                <div class="td td-score">
                  <span class="score-badge" :class="getScoreClass(index)">{{ getScore(index) }}</span>
                </div>
                <div class="td td-delegators">
                  <span class="delegators-value">-</span>
                </div>
                <div class="td td-uptime">
                  <span class="uptime-value">100.00%</span>
                </div>
                <div class="td td-actions">
                  <button 
                    class="action-btn" 
                    :disabled="!hasActiveProfile"
                    @click="openStakeModal(validator, 'Delegate')"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="8" x2="12" y2="16"/>
                      <line x1="8" y1="12" x2="16" y2="12"/>
                    </svg>
                    Manage
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </main>
    
    <!-- Copy Notification -->
    <div v-if="showCopyNotification" class="copy-notification">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <span>{{ copiedText }} copied!</span>
    </div>

    <!-- Stake Management Modal -->
    <div v-if="showStakeModal" class="modal-overlay" @click="closeStakeModal">
      <div class="stake-modal" @click.stop>
        <div class="modal-header">
          <h3>Manage Stake with {{ selectedValidator?.moniker }}</h3>
          <button class="close-btn" @click="closeStakeModal">×</button>
        </div>

        <div class="modal-body">
          <div class="balance-info">
            <div class="balance-item">
              <span class="balance-label">Staked:</span>
              <span class="balance-value">{{ stakedBalance }} LMN</span>
            </div>
            <div class="balance-item">
              <span class="balance-label">Balance:</span>
              <span class="balance-value">{{ availableBalance }} LMN</span>
            </div>
          </div>

          <div class="action-tabs">
            <button 
              v-for="action in stakeActions" 
              :key="action"
              class="tab-btn"
              :class="{ active: currentStakeAction === action }"
              @click="currentStakeAction = action as 'Delegate' | 'Undelegate' | 'Redelegate' | 'Withdraw'"
            >
              {{ action }}
            </button>
          </div>

          <div class="stake-form">
            <div class="form-group">
              <label>Amount to {{ currentStakeAction.toLowerCase() }}</label>
              <div class="input-wrapper">
                <input 
                  type="number" 
                  v-model="stakeAmount" 
                  :placeholder="`0.0`"
                  class="stake-input"
                  step="0.000001"
                  min="0"
                />
                <span class="input-suffix">LMN</span>
              </div>
              <div class="amount-slider">
                <input 
                  type="range" 
                  v-model="stakePercentage" 
                  min="0" 
                  max="100" 
                  class="slider"
                />
                <div class="slider-labels">
                  <span>0%</span>
                  <span>50%</span>
                  <span>Max</span>
                </div>
              </div>
              <div class="quick-amounts">
                <button @click="setStakePercentage(25)" class="quick-btn">25%</button>
                <button @click="setStakePercentage(50)" class="quick-btn">50%</button>
                <button @click="setStakePercentage(75)" class="quick-btn">75%</button>
                <button @click="setStakePercentage(100)" class="quick-btn">Max</button>
              </div>
            </div>

            <div v-if="currentStakeAction === 'Redelegate'" class="form-group">
              <label>Select New Validator</label>
              <select v-model="targetValidator" class="validator-select">
                <option value="">Choose validator...</option>
                <option v-for="val in validators.filter(v => v.address !== selectedValidator?.address)" :key="val.address" :value="val.address">
                  {{ val.moniker }}
                </option>
              </select>
            </div>

            <div class="advanced-options" v-if="showAdvancedOptions">
              <button class="advanced-toggle" @click="showAdvancedOptions = !showAdvancedOptions">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 1v6m0 6v6"/>
                </svg>
                Advanced Options
              </button>
            </div>

            <!-- Transaction Status Popup -->
            <div v-if="txStatus !== 'idle'" class="tx-status-popup" :class="txStatus">
              <div class="tx-status-content">
                <!-- Processing -->
                <div v-if="txStatus === 'processing'" class="tx-processing">
                  <div class="tx-spinner"></div>
                  <div class="tx-status-text">
                    <strong>Processing Transaction</strong>
                    <p>{{ txMessage }}</p>
                  </div>
                </div>

                <!-- Success -->
                <div v-else-if="txStatus === 'success'" class="tx-success">
                  <svg class="tx-icon" width="48" height="48" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="rgba(48, 209, 88, 0.7)" stroke-width="2"/>
                    <path d="M8 12l3 3 5-5" stroke="rgba(48, 209, 88, 0.7)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <div class="tx-status-text">
                    <strong>Transaction Successful!</strong>
                    <p>{{ txMessage }}</p>
                    <div v-if="txHash" class="tx-hash-display">
                      <small>Transaction Hash:</small>
                      <button class="tx-hash-link" @click="viewTransaction(txHash)">
                        <code>{{ txHash }}</code>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                          <polyline points="15 3 21 3 21 9"/>
                          <line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <button class="tx-close-btn" @click="closeStakeModal">Close</button>
                </div>

                <!-- Error -->
                <div v-else-if="txStatus === 'error'" class="tx-error">
                  <svg class="tx-icon" width="48" height="48" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="#ef4444" stroke-width="2"/>
                    <path d="M12 8v4m0 4h.01" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                  <div class="tx-status-text">
                    <strong>Transaction Failed</strong>
                    <p>{{ txMessage }}</p>
                  </div>
                  <button class="tx-retry-btn" @click="txStatus = 'idle'">Try Again</button>
                </div>
              </div>
            </div>

            <button 
              class="confirm-btn" 
              @click="confirmStakeAction" 
              :disabled="!canConfirm || isProcessingTx"
            >
              <span v-if="!isProcessingTx">Confirm {{ currentStakeAction }}</span>
              <span v-else>Processing...</span>
            </button>
          </div>
        </div>
      </div>
    </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, inject } from 'vue';
import BlockDetailPage from './BlockDetailPage.vue';
import TransactionDetailPage from './TransactionDetailPage.vue';
import AddressDetailPage from './AddressDetailPage.vue';
import { profilesState, activeProfileId } from '../profilesStore';

const lumen = (window as any).lumen;
const openInNewTab = inject<((url: string) => void) | null>('openInNewTab', null);
const currentTabUrl = inject<any>('currentTabUrl', null);

const activeProfile = computed(() => {
  if (!activeProfileId.value) return null;
  return profilesState.value.find((p) => p.id === activeProfileId.value) || null;
});
const hasActiveProfile = computed(() => !!activeProfile.value && activeProfile.value.role !== 'guest');

const isBlockDetailView = computed(() => {
  const url = currentTabUrl?.value || window.location.href;
  const hasBlock = /\/explorer\/block\/\d+/.test(url);
  return hasBlock;
});

const isTransactionDetailView = computed(() => {
  const url = currentTabUrl?.value || window.location.href;
  const hasTx = /\/explorer\/tx\/[A-F0-9]+/i.test(url);
  return hasTx;
});

const isAddressDetailView = computed(() => {
  const url = currentTabUrl?.value || window.location.href;
  const hasAddress = /\/explorer\/address\/[a-z0-9]+/i.test(url);
  return hasAddress;
});

function navigateToBlock(height: number) {
  const url = `lumen://explorer/block/${height}`;
  if (openInNewTab) {
    openInNewTab(url);
  } else {
    window.location.href = url;
  }
}

function navigateToTransaction(hash: string) {
  const url = `lumen://explorer/tx/${hash}`;
  if (openInNewTab) {
    openInNewTab(url);
  } else {
    window.location.href = url;
  }
}

function navigateToAddress(address: string) {
  const url = `lumen://explorer/address/${address}`;
  if (openInNewTab) {
    openInNewTab(url);
  } else {
    window.location.href = url;
  }
}

const currentView = ref<'overview' | 'blocks' | 'transactions' | 'validators'>('overview');
const searchQuery = ref('');
const isLoading = ref(true);
const autoRefresh = ref(true);

// Filter states
const blockFilter = ref<'all' | 'recent' | 'with-txs' | 'empty'>('all');
const blockHeightFilter = ref('');
const txTypeFilter = ref<'all' | 'send' | 'delegate' | 'vote' | 'other'>('all');
const txStatusFilter = ref<'all' | 'success' | 'failed'>('all');
const txHashFilter = ref('');

const rpcBase = ref('http://142.132.201.187:26657');
const restBase = ref('http://142.132.201.187:1317');

const latestBlock = ref(0);
const totalTxs = ref(0);
const validatorCount = ref(0);
const avgBlockTime = ref(6.5);

interface Block {
  height: number;
  hash: string;
  proposer: string;
  proposerAvatar?: string;
  txCount: number;
  time: string;
}

interface Transaction {
  hash: string;
  type: string;
  height: number;
  success: boolean;
  time: string;
  fee?: string;
}

interface Validator {
  address: string;
  moniker: string;
  tokens: string;
  commission: string;
  jailed: boolean;
  avatar?: string;
  keybaseId?: string;
}

const blocks = ref<Block[]>([]);
const transactions = ref<Transaction[]>([]);
const validators = ref<Validator[]>([]);
const avatarCache = ref<Record<string, string>>({});
const proposerMap = ref<Record<string, { moniker: string; avatar?: string; keybaseId?: string }>>({});

// Stake modal state
const showStakeModal = ref(false);
const selectedValidator = ref<Validator | null>(null);
const currentStakeAction = ref<'Delegate' | 'Undelegate' | 'Redelegate' | 'Withdraw'>('Delegate');
const stakeActions = ['Delegate', 'Undelegate', 'Redelegate', 'Withdraw'];
const stakeAmount = ref('0.0');
const stakePercentage = ref(0);
const targetValidator = ref('');
const showAdvancedOptions = ref(false);
const stakedBalance = ref('0.000 LMN');
const availableBalance = ref('0.000 LMN');
const isProcessingTx = ref(false);
const txMessage = ref('');
const txStatus = ref<'idle' | 'processing' | 'success' | 'error'>('idle');
const txHash = ref('');

const bondedTokens = ref(114760000);
const unbondedTokens = ref(385240000);
const totalSupply = ref(500000000);
const bondedRatio = computed(() => ((bondedTokens.value / totalSupply.value) * 100).toFixed(1));
const topValidatorsPower = ref<Array<{ moniker: string; percentage: string }>>([]);

// Filtered data computed properties
const filteredBlocks = computed(() => {
  let result = [...blocks.value];
  
  // Apply block filter
  if (blockFilter.value === 'recent') {
    result = result.slice(0, 100);
  } else if (blockFilter.value === 'with-txs') {
    result = result.filter(b => b.txCount > 0);
  } else if (blockFilter.value === 'empty') {
    result = result.filter(b => b.txCount === 0);
  }
  
  // Apply height filter
  if (blockHeightFilter.value) {
    const height = parseInt(blockHeightFilter.value);
    if (!isNaN(height)) {
      result = result.filter(b => b.height === height);
    }
  }
  
  return result;
});

const filteredTransactions = computed(() => {
  let result = [...transactions.value];
  
  // Apply type filter
  if (txTypeFilter.value !== 'all') {
    result = result.filter(tx => {
      const type = tx.type.toLowerCase();
      if (txTypeFilter.value === 'send') return type.includes('send') || type.includes('transfer');
      if (txTypeFilter.value === 'delegate') return type.includes('delegate');
      if (txTypeFilter.value === 'vote') return type.includes('vote');
      return !type.includes('send') && !type.includes('transfer') && !type.includes('delegate') && !type.includes('vote');
    });
  }
  
  // Apply status filter
  if (txStatusFilter.value !== 'all') {
    result = result.filter(tx => {
      if (txStatusFilter.value === 'success') return tx.success;
      if (txStatusFilter.value === 'failed') return !tx.success;
      return true;
    });
  }
  
  // Apply hash filter
  if (txHashFilter.value.trim()) {
    const query = txHashFilter.value.toLowerCase().trim();
    result = result.filter(tx => tx.hash.toLowerCase().includes(query));
  }
  
  return result;
});

const txHistoryTitle = computed(() => {
  const titles = {
    '1D': 'Transaction History (1 Day)',
    '7D': 'Transaction History (1 Week)',
    '30D': 'Transaction History (1 Month)',
    '1Y': 'Transaction History (1 Year)'
  };
  return titles[txTimeFilter.value];
});
const othersPercentage = computed(() => {
  const top5Total = topValidatorsPower.value.slice(0, 5).reduce((sum, vp) => sum + parseFloat(vp.percentage), 0);
  return (100 - top5Total).toFixed(2);
});
const latestProposer = ref({ moniker: 'Unknown', avatar: '', blockHeight: 0 });
const txHistoryChart = ref<HTMLCanvasElement | null>(null);
const bondedSupplyChart = ref<HTMLCanvasElement | null>(null);
const votingPowerChart = ref<HTMLCanvasElement | null>(null);
const txTimeFilter = ref<'1D' | '7D' | '30D' | '1Y'>('1D');
const copiedText = ref('');
const showCopyNotification = ref(false);

async function fetchBlocks() {
  if (!lumen?.http?.get) return;
  
  try {
    const heightRes = await lumen.rpc.getHeight();
    if (heightRes?.ok && heightRes.height) {
      latestBlock.value = heightRes.height;
    }

    const blockPromises = [];
    const startHeight = latestBlock.value;
    for (let i = 0; i < 20; i++) {
      const height = startHeight - i;
      if (height > 0) {
        blockPromises.push(
          lumen.http.get(`${rpcBase.value}/block?height=${height}`)
        );
      }
    }

    const blockResults = await Promise.all(blockPromises);
    
    const newBlocks: Block[] = [];
    for (const res of blockResults) {
      if (res.ok && res.json?.result?.block) {
        const block = res.json.result.block;
        const blockId = res.json.result.block_id;
        const proposerAddr = block.header.proposer_address;
        const proposerInfo = proposerMap.value[proposerAddr];
        
        newBlocks.push({
          height: parseInt(block.header.height),
          hash: blockId.hash,
          proposer: proposerInfo?.moniker || proposerAddr.substring(0, 8),
          proposerAvatar: proposerInfo?.avatar,
          txCount: block.data.txs?.length || 0,
          time: block.header.time
        });
      }
    }

    blocks.value = newBlocks.sort((a, b) => b.height - a.height);
    
    if (newBlocks.length > 0) {
      const latestBlockData = newBlocks[0];
      latestProposer.value = {
        moniker: latestBlockData.proposer,
        avatar: latestBlockData.proposerAvatar || '',
        blockHeight: latestBlockData.height
      };
    }
    
  } catch (e) {
    console.error('Failed to fetch blocks:', e);
  }
}

async function fetchTransactions() {
  if (!lumen?.http?.get) return;
  
  try {
    const txList: Transaction[] = [];
    
    for (const block of blocks.value.slice(0, 10)) {
      const blockRes = await lumen.http.get(`${rpcBase.value}/block?height=${block.height}`);
      
      if (blockRes.ok && blockRes.json?.result?.block?.data?.txs) {
        const txs = blockRes.json.result.block.data.txs;
        const blockResultsRes = await lumen.http.get(`${rpcBase.value}/block_results?height=${block.height}`);
        
        for (let i = 0; i < txs.length; i++) {
          const txData = txs[i];
          const txHash = await getTxHash(txData);
          const txResults = blockResultsRes.json?.result?.txs_results;
          const txResult = txResults?.[i];
          
          txList.push({
            hash: txHash,
            type: 'Transfer',
            height: block.height,
            success: !txResult || txResult.code === 0,
            time: block.time,
            fee: '0.000000 LMN'
          });
        }
      }
      
      if (txList.length >= 20) break;
    }
    
    transactions.value = txList.slice(0, 20);
    totalTxs.value = latestBlock.value * 5; // Estimate
    
  } catch (e) {
    console.error('Failed to fetch transactions:', e);
  }
}

async function getTxHash(txDataBase64: string): Promise<string> {
  try {
    const binaryString = atob(txDataBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    return hashHex;
  } catch (e) {
    console.error('Failed to hash tx:', e);
    return '0000000000000000000000000000000000000000000000000000000000000000';
  }
}

async function fetchValidators() {
  if (!lumen?.http?.get) return;
  
  try {
    const valSetRes = await lumen.http.get(`${rpcBase.value}/validators`);
    if (valSetRes.ok && valSetRes.json?.result?.validators) {
      const valSet = valSetRes.json.result.validators;
      
      for (const val of valSet) {
        proposerMap.value[val.address] = {
          moniker: val.address.substring(0, 8),
          keybaseId: undefined,
          avatar: undefined
        };
      }
    }
    
    const res = await lumen.http.get(
      `${restBase.value}/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=100`
    );
    
    if (res.ok && res.json?.validators) {
      const validatorsList = res.json.validators;
      
      const valSet2Res = await lumen.http.get(`${rpcBase.value}/validators`);
      const validatorSet = valSet2Res.ok && valSet2Res.json?.result?.validators 
        ? valSet2Res.json.result.validators 
        : [];
      
      validators.value = validatorsList
        .sort((a: any, b: any) => {
          const tokensA = BigInt(a.tokens || '0');
          const tokensB = BigInt(b.tokens || '0');
          return tokensB > tokensA ? 1 : tokensB < tokensA ? -1 : 0;
        })
        .map((v: any) => {
          const keybaseId = v.description?.identity || null;
        const matchingVal = validatorSet.find((vs: any) => {
          return vs.pub_key?.value && v.consensus_pubkey?.key === vs.pub_key.value;
        });
        
        if (matchingVal) {
            proposerMap.value[matchingVal.address] = {
              moniker: v.description?.moniker || 'Unknown',
              keybaseId: keybaseId,
              avatar: avatarCache.value[keybaseId] || undefined
            };
          }
          
          return {
            address: v.operator_address,
            moniker: v.description?.moniker || 'Unknown',
            tokens: v.tokens || '0',
            commission: v.commission?.commission_rates?.rate || '0',
            jailed: v.jailed || false,
            avatar: avatarCache.value[keybaseId] || undefined,
            keybaseId: keybaseId
          };
        });
      
      validatorCount.value = validators.value.length;
      
      const totalVotingPower = validators.value.reduce((sum, v) => sum + BigInt(v.tokens), BigInt(0));
      topValidatorsPower.value = validators.value.slice(0, 5).map(v => ({
        moniker: v.moniker,
        percentage: ((Number(BigInt(v.tokens) * BigInt(10000) / totalVotingPower) / 100).toFixed(2))
      }));
      
      fetchKeybaseAvatars();
    }
  } catch (e) {
    console.error('Failed to fetch validators:', e);
  }
}

async function fetchKeybaseAvatars() {
  const validatorsWithKeybase = validators.value.filter(v => v.keybaseId && !avatarCache.value[v.keybaseId]);
  
  if (validatorsWithKeybase.length === 0) return;
  
  let hasUpdates = false;
  
  for (const validator of validatorsWithKeybase) {
    if (!validator.keybaseId) continue;
    
    try {
      const response = await fetch(
        `https://keybase.io/_/api/1.0/user/lookup.json?key_suffix=${validator.keybaseId}`
      );
      const data = await response.json();
      
      if (data?.them?.[0]?.pictures?.primary?.url) {
        const avatarUrl = data.them[0].pictures.primary.url;
        avatarCache.value[validator.keybaseId] = avatarUrl;
        hasUpdates = true;
        
        const valIndex = validators.value.findIndex(v => v.keybaseId === validator.keybaseId);
        if (valIndex !== -1) {
          validators.value[valIndex].avatar = avatarUrl;
        }
        
        for (const key in proposerMap.value) {
          if (proposerMap.value[key].keybaseId === validator.keybaseId) {
            proposerMap.value[key].avatar = avatarUrl;
          }
        }
      }
    } catch (e) {
      console.log(`Failed to fetch avatar for ${validator.moniker}`);
    }
  }
  
  if (hasUpdates) {
    await fetchBlocks();
  }
}

async function fetchAllData() {
  isLoading.value = true;
  
  try {
    await fetchValidators();
    await fetchBlocks();
    if (currentView.value === 'transactions') {
      await fetchTransactions();
    }
  } finally {
    isLoading.value = false;
  }
}

function performSearch() {
  const query = searchQuery.value.trim();
  if (!query) return;
  
  if (/^\d+$/.test(query)) {
    const height = parseInt(query);
    navigateToBlock(height);
  }
  else if (/^[A-Fa-f0-9]{64}$/.test(query)) {
    navigateToTransaction(query.toUpperCase());
  }
  else if (/^lmn1[a-z0-9]{38,}$/.test(query)) {
    navigateToAddress(query);
  }
  else {
    alert('Invalid search query. Please enter:\n- Block height (number)\n- Transaction hash (64 hex chars)\n- Address (lmn1...)');
  }
}

function formatNumber(num: number): string {
  if (!num) return '0';
  return new Intl.NumberFormat().format(num);
}

function formatTimeAgo(timestamp: string): string {
  const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (diff < 0) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function shortenHash(hash: string): string {
  if (!hash) return '';
  if (hash.length <= 24) return hash;
  return `${hash.substring(0, 20)}...${hash.substring(hash.length - 10)}`;
}

function shortenAddress(address: string): string {
  if (!address) return '';
  if (address.length <= 20) return address;
  return `${address.substring(0, 12)}...${address.substring(address.length - 8)}`;
}

function formatVotingPower(tokens: string): string {
  if (!tokens) return '0';
  const num = parseInt(tokens) / 1e6;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toFixed(0);
}

function getVotingPowerColor(index: number): string {
  const colors = [
    'linear-gradient(135deg, rgba(236, 72, 153, 0.7), rgba(244, 114, 182, 0.6))',
    'linear-gradient(135deg, rgba(139, 92, 246, 0.7), rgba(167, 139, 250, 0.6))',
    'var(--gradient-brand)',
    'linear-gradient(135deg, rgba(6, 182, 212, 0.7), rgba(34, 211, 238, 0.6))',
    'linear-gradient(135deg, rgba(48, 209, 88, 0.7), rgba(52, 199, 89, 0.6))'
  ];
  return colors[index % colors.length];
}

function getVotingPowerPercentage(tokens: string): string {
  const totalVotingPower = validators.value.reduce((sum, v) => sum + parseFloat(v.tokens), 0);
  const percentage = (parseFloat(tokens) / totalVotingPower) * 100;
  return percentage.toFixed(2);
}

function getCumulativeProgress(index: number): number {
  let cumulative = 0;
  for (let i = 0; i <= index; i++) {
    const totalVotingPower = validators.value.reduce((sum, v) => sum + parseFloat(v.tokens), 0);
    cumulative += (parseFloat(validators.value[i].tokens) / totalVotingPower) * 100;
  }
  return cumulative;
}

function getScore(index: number): number {
  if (index < 5) return 95;
  if (index < 15) return 85;
  return 75;
}

function getScoreClass(index: number): string {
  if (index < 5) return 'score-high';
  if (index < 15) return 'score-medium';
  return 'score-low';
}

function manageValidator(validator: Validator) {
  console.log('Manage validator:', validator);
}

// Stake modal functions
function openStakeModal(validator: Validator, action: 'Delegate' | 'Undelegate' | 'Redelegate' | 'Withdraw' = 'Delegate') {
  if (!hasActiveProfile.value) {
    alert('Please create or select a wallet profile first');
    return;
  }

  selectedValidator.value = validator;
  currentStakeAction.value = action;
  stakeAmount.value = '0.0';
  stakePercentage.value = 0;
  targetValidator.value = '';
  showAdvancedOptions.value = false;
  showStakeModal.value = true;
  
  // Fetch actual balance from profile
  fetchStakeBalances(validator.address);
}

async function fetchStakeBalances(validatorAddress: string) {
  if (!activeProfile.value) {
    console.log('No active profile');
    return;
  }

  const profileAddress = activeProfile.value.address || activeProfile.value.walletAddress;
  console.log('Fetching balances for profile:', activeProfile.value);
  console.log('Profile address:', profileAddress);

  try {
    const anyWindow = window as any;
    const walletApi = anyWindow?.lumen?.wallet;
    
    if (!walletApi) {
      console.error('Wallet API not available');
      availableBalance.value = '0.000000';
      stakedBalance.value = '0.000000';
      return;
    }

    // Fetch available balance using same method as WalletPage
    if (typeof walletApi.getBalance === 'function' && profileAddress) {
      try {
        const res = await walletApi.getBalance(profileAddress, { denom: 'ulmn' });
        console.log('Balance response:', res);
        
        if (res && res.ok !== false) {
          const amt = Number(res.balance?.amount ?? '0') || 0;
          availableBalance.value = (amt / 1_000_000).toFixed(6);
          console.log('Available balance (LMN):', availableBalance.value);
        } else {
          console.error('Balance error:', res?.error);
          availableBalance.value = '0.000000';
        }
      } catch (error) {
        console.error('Error fetching balance:', error);
        availableBalance.value = '0.000000';
      }
    } else {
      availableBalance.value = '0.000000';
    }

    // Fetch delegations
    if (typeof walletApi.getDelegations === 'function' && profileAddress) {
      try {
        const delegations = await walletApi.getDelegations(profileAddress);
        console.log('Delegations response:', delegations);
        
        if (delegations && delegations.ok !== false && Array.isArray(delegations.delegations)) {
          const delegation = delegations.delegations.find((d: any) => 
            d.delegation?.validator_address === validatorAddress
          );
          
          if (delegation?.balance?.amount) {
            const amt = Number(delegation.balance.amount) || 0;
            stakedBalance.value = (amt / 1_000_000).toFixed(6);
            console.log('Staked balance (LMN):', stakedBalance.value);
          } else {
            stakedBalance.value = '0.000000';
          }
        } else {
          stakedBalance.value = '0.000000';
        }
      } catch (error) {
        console.error('Error fetching delegations:', error);
        stakedBalance.value = '0.000000';
      }
    } else {
      stakedBalance.value = '0.000000';
    }
    
  } catch (error) {
    console.error('Failed to fetch balances:', error);
    availableBalance.value = '0.000000';
    stakedBalance.value = '0.000000';
  }
}

function closeStakeModal() {
  showStakeModal.value = false;
  selectedValidator.value = null;
  txStatus.value = 'idle';
  txMessage.value = '';
  txHash.value = '';
  isProcessingTx.value = false;
}

function viewTransaction(hash: string) {
  if (!hash) return;
  closeStakeModal();
  navigateToTransaction(hash);
}

function setStakePercentage(percentage: number) {
  stakePercentage.value = percentage;
  const maxAmount = currentStakeAction.value === 'Delegate' ? parseFloat(availableBalance.value) : parseFloat(stakedBalance.value);
  const amount = (maxAmount * percentage / 100).toFixed(6);
  stakeAmount.value = amount;
}

const canConfirm = computed(() => {
  if (!stakeAmount.value || parseFloat(stakeAmount.value) <= 0) return false;
  if (currentStakeAction.value === 'Redelegate' && !targetValidator.value) return false;
  if (!hasActiveProfile.value) return false;
  return true;
});

async function confirmStakeAction() {
  if (!canConfirm.value || !activeProfile.value || !selectedValidator.value) return;
  
  const profileAddress = activeProfile.value.address || activeProfile.value.walletAddress;
  const profileId = activeProfile.value.id;
  
  if (!profileAddress) {
    txStatus.value = 'error';
    txMessage.value = 'No wallet address found';
    return;
  }
  
  if (!profileId) {
    txStatus.value = 'error';
    txMessage.value = 'No profile ID found';
    return;
  }
  
  const amountInUlmn = Math.floor(parseFloat(stakeAmount.value) * 1_000_000).toString();
  
  // Start processing
  isProcessingTx.value = true;
  txStatus.value = 'processing';
  txMessage.value = `Processing ${currentStakeAction.value.toLowerCase()}...`;
  txHash.value = '';
  
  try {
    const anyWindow = window as any;
    const walletApi = anyWindow?.lumen?.wallet;
    
    if (!walletApi) {
      throw new Error('Wallet API not available');
    }
    
    let result;
    
    console.log(`Executing ${currentStakeAction.value}...`);
    console.log('Profile ID:', profileId);
    console.log('Address:', profileAddress);
    console.log('Validator:', selectedValidator.value.address);
    console.log('Amount (ulmn):', amountInUlmn);
    
    switch (currentStakeAction.value) {
      case 'Delegate':
        if (typeof walletApi.delegate === 'function') {
          result = await walletApi.delegate({
            profileId: profileId,
            address: profileAddress,
            validatorAddress: selectedValidator.value.address,
            amount: { amount: amountInUlmn, denom: 'ulmn' }
          });
        } else {
          throw new Error('Delegate function not available');
        }
        break;
        
      case 'Undelegate':
        if (typeof walletApi.undelegate === 'function') {
          result = await walletApi.undelegate({
            profileId: profileId,
            address: profileAddress,
            validatorAddress: selectedValidator.value.address,
            amount: { amount: amountInUlmn, denom: 'ulmn' }
          });
        } else {
          throw new Error('Undelegate function not available');
        }
        break;
        
      case 'Redelegate':
        if (typeof walletApi.redelegate === 'function' && targetValidator.value) {
          result = await walletApi.redelegate({
            profileId: profileId,
            address: profileAddress,
            validatorSrcAddress: selectedValidator.value.address,
            validatorDstAddress: targetValidator.value,
            amount: { amount: amountInUlmn, denom: 'ulmn' }
          });
        } else {
          throw new Error('Redelegate function not available');
        }
        break;
        
      case 'Withdraw':
        if (typeof walletApi.withdrawRewards === 'function') {
          result = await walletApi.withdrawRewards({
            profileId: profileId,
            address: profileAddress,
            validatorAddress: selectedValidator.value.address
          });
        } else {
          throw new Error('WithdrawRewards function not available');
        }
        break;
    }
    
    console.log('Transaction result:', result);
    
    if (result && result.ok !== false) {
      txStatus.value = 'success';
      txHash.value = result.txhash || result.txHash || '';
      txMessage.value = `${currentStakeAction.value} successful!`;
      
      // Refresh validators in background
      fetchValidators();
    } else {
      throw new Error(result?.error || 'Transaction failed');
    }
  } catch (error: any) {
    console.error(`${currentStakeAction.value} failed:`, error);
    txStatus.value = 'error';
    const errorMsg = error?.message || error?.toString() || 'Unknown error';
    txMessage.value = errorMsg;
  } finally {
    isProcessingTx.value = false;
  }
}

watch(stakePercentage, (newVal) => {
  setStakePercentage(newVal);
});

function copyToClipboard(text: string, label: string = 'Text') {
  navigator.clipboard.writeText(text).then(() => {
    copiedText.value = label;
    showCopyNotification.value = true;
    setTimeout(() => {
      showCopyNotification.value = false;
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy:', err);
  });
}

function initializeCharts() {
  if (currentView.value !== 'overview') return;
  
  setTimeout(() => {
    if (txHistoryChart.value) {
      const ctx = txHistoryChart.value.getContext('2d');
      if (ctx) {
        const gradient = ctx.createLinearGradient(0, 0, 0, 120);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
        
        ctx.clearRect(0, 0, txHistoryChart.value.width, txHistoryChart.value.height);
        ctx.fillStyle = gradient;
        ctx.strokeStyle = 'rgba(59, 130, 246, 1)';
        ctx.lineWidth = 2;
        
        const dataByFilter = {
          '1D': [2, 3, 5, 4, 6, 8, 5, 7, 9, 8],
          '7D': [3, 4, 3, 5, 6, 5, 7, 6, 8, 7],
          '30D': [4, 5, 6, 5, 7, 8, 7, 9, 8, 9],
          '1Y': [5, 6, 7, 6, 8, 9, 8, 10, 9, 10]
        };
        const points = dataByFilter[txTimeFilter.value];
        ctx.beginPath();
        points.forEach((point, i) => {
          const x = (i / (points.length - 1)) * txHistoryChart.value!.width;
          const y = 120 - (point / 10) * 100;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
        
        ctx.lineTo(txHistoryChart.value.width, 120);
        ctx.lineTo(0, 120);
        ctx.closePath();
        ctx.fill();
      }
    }

    if (bondedSupplyChart.value) {
      const canvas = bondedSupplyChart.value;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = 120;
        canvas.height = 120;
        
        const centerX = 60;
        const centerY = 60;
        const radius = 50;
        const innerRadius = 35;
        
        const bondedPercentage = parseFloat(bondedRatio.value) / 100;
        const startAngle = -Math.PI / 2;
        const bondedAngle = bondedPercentage * 2 * Math.PI;
        
        ctx.clearRect(0, 0, 120, 120);
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + bondedAngle, false);
        ctx.lineTo(
          centerX + Math.cos(startAngle + bondedAngle) * innerRadius,
          centerY + Math.sin(startAngle + bondedAngle) * innerRadius
        );
        ctx.arc(centerX, centerY, innerRadius, startAngle + bondedAngle, startAngle, true);
        ctx.closePath();
        
        const gradient = ctx.createLinearGradient(0, 0, 120, 120);
        gradient.addColorStop(0, '#ec4899');
        gradient.addColorStop(1, '#8b5cf6');
        ctx.fillStyle = gradient;
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle + bondedAngle, startAngle + 2 * Math.PI, false);
        ctx.lineTo(
          centerX + Math.cos(startAngle) * innerRadius,
          centerY + Math.sin(startAngle) * innerRadius
        );
        ctx.arc(centerX, centerY, innerRadius, startAngle + 2 * Math.PI, startAngle + bondedAngle, true);
        ctx.closePath();
        ctx.fillStyle = 'rgba(139, 92, 246, 0.2)';
        ctx.fill();
      }
    }

    if (votingPowerChart.value) {
      const canvas = votingPowerChart.value;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = 120;
        canvas.height = 120;
        
        const centerX = 60;
        const centerY = 60;
        const radius = 50;
        const innerRadius = 35;
        
        ctx.clearRect(0, 0, 120, 120);
        
        let currentAngle = -Math.PI / 2;
        const colors = [
          'rgba(236, 72, 153, 0.8)', 
          'rgba(139, 92, 246, 0.8)', 
          'rgba(10, 132, 255, 0.8)', 
          'rgba(6, 182, 212, 0.8)', 
          'rgba(48, 209, 88, 0.8)'
        ];
        
        topValidatorsPower.value.slice(0, 5).forEach((vp, idx) => {
          const percentage = parseFloat(vp.percentage);
          const sweepAngle = (percentage / 100) * 2 * Math.PI;
          const endAngle = currentAngle + sweepAngle;
          
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, currentAngle, endAngle, false);
          ctx.lineTo(
            centerX + Math.cos(endAngle) * innerRadius,
            centerY + Math.sin(endAngle) * innerRadius
          );
          ctx.arc(centerX, centerY, innerRadius, endAngle, currentAngle, true);
          ctx.closePath();
          ctx.fillStyle = colors[idx];
          ctx.fill();
          
          currentAngle = endAngle;
        });
        
        const top5Total = topValidatorsPower.value.slice(0, 5).reduce((sum, vp) => sum + parseFloat(vp.percentage), 0);
        const othersPercent = 100 - top5Total;
        if (othersPercent > 0) {
          const sweepAngle = (othersPercent / 100) * 2 * Math.PI;
          const endAngle = currentAngle + sweepAngle;
          
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, currentAngle, endAngle, false);
          ctx.lineTo(
            centerX + Math.cos(endAngle) * innerRadius,
            centerY + Math.sin(endAngle) * innerRadius
          );
          ctx.arc(centerX, centerY, innerRadius, endAngle, currentAngle, true);
          ctx.closePath();
          ctx.fillStyle = 'rgba(148, 163, 184, 0.3)';
          ctx.fill();
        }
      }
    }
  }, 100);
}

let refreshInterval: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  fetchAllData();
  initializeCharts();
  
  refreshInterval = setInterval(() => {
    if (autoRefresh.value) {
      if (currentView.value === 'blocks' || currentView.value === 'overview') {
        fetchBlocks();
      }
      if (currentView.value === 'transactions' || currentView.value === 'overview') {
        fetchTransactions();
      }
      if (currentView.value === 'overview') {
        initializeCharts();
      }
    }
  }, 6000);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});

watch(txTimeFilter, () => {
  if (currentView.value === 'overview') {
    initializeCharts();
  }
});
</script>

<style scoped>
.explorer-page {
  display: flex;
  height: 100vh;
  background: var(--bg-tertiary);
  overflow: hidden;
}

/* Sidebar */
.sidebar {
  width: 260px;
  min-width: 260px;
  max-width: 260px;
  background: var(--sidebar-bg);
  backdrop-filter: var(--backdrop-blur);
  -webkit-backdrop-filter: var(--backdrop-blur);
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  color: var(--text-primary);
  border-right: var(--border-width) solid var(--border-color);
  flex-shrink: 0;
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

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.nav-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nav-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.5rem 0.75rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.875rem;
  background: transparent;
  border: none;
  border-radius: var(--border-radius-sm);
  color: var(--text-primary);
  font-size: var(--fs-base);
  font-weight: 400;
  cursor: pointer;
  transition: all var(--transition-fast);
  width: 100%;
  text-align: left;
  letter-spacing: -0.022em;
}

.nav-item:hover {
  background: rgba(0, 0, 0, 0.04);
}

.nav-item.active {
  background: var(--ios-blue);
  color: white;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0, 122, 255, 0.25);
}

.nav-item:active {
  transform: scale(0.98);
}

.nav-item svg {
  flex-shrink: 0;
}

/* Main Content */
.main-content {
  flex: 1;
  overflow-y: auto;
  background: var(--bg-secondary);
  padding: 1.5rem;
}

.main-content::-webkit-scrollbar {
  width: 6px;
}

.main-content::-webkit-scrollbar-track {
  background: transparent;
}

.main-content::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 3px;
}

.main-content::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.25);
}

/* Search Section */
.search-section {
  margin-bottom: 2rem;
}

.search-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  max-width: 800px;
  background: var(--card-bg);
  border: 2px solid var(--border-color);
  border-radius: 12px;
  padding: 0.75rem 1rem;
  transition: all 0.2s;
}

.search-container:focus-within {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--primary-a10);
}

.search-icon {
  color: var(--text-tertiary);
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 0.9375rem;
  color: var(--text-primary);
  background: transparent;
}

.search-input::placeholder {
  color: var(--text-tertiary);
}

.search-btn {
  padding: 0.5rem 1.25rem;
  background: var(--gradient-primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.search-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px var(--primary-a30);
}

.search-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Stats Bar */
.stats-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 1.25rem;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
}

.stat-label {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  background: linear-gradient(135deg, var(--accent-primary), var(--text-primary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: var(--text-secondary);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-color);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: var(--text-tertiary);
  background: var(--card-bg);
  border-radius: 12px;
  border: 1px solid var(--border-color);
}

.empty-state svg {
  margin-bottom: 1rem;
  opacity: 0.5;
}

/* Content Area */
.content-area {
  background: transparent;
  border-radius: 12px;
  overflow: visible;
}

.overview-header {
  margin-bottom: 1.5rem;
  text-align: center;
}

.overview-header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.overview-header p {
  font-size: 0.9375rem;
  color: var(--text-secondary);
}

.content-area > .stats-grid,
.content-area > .charts-section,
.content-area > .recent-activity {
  margin-bottom: 0;
}

.content-area > .stats-grid:first-child {
  margin-top: 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.section-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
}

.refresh-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--text-tertiary);
  font-weight: 500;
}

.refresh-indicator.active {
  color: var(--ios-green);
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background: currentColor;
  border-radius: 50%;
  animation: pulse-live 2s ease-in-out infinite;
}

@keyframes pulse-live {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

.count-badge {
  padding: 0.375rem 0.75rem;
  background: var(--bg-secondary);
  border-radius: 20px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-secondary);
}

/* Tables */
.blocks-table,
.transactions-table {
  width: 100%;
}

.table-header {
  display: grid;
  padding: 0.625rem 1rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.blocks-table .table-header {
  grid-template-columns: 90px 180px 1fr 110px 150px;
  gap: 1rem;
}

.transactions-table .table-header {
  grid-template-columns: 1.5fr 0.8fr 0.8fr 0.8fr 0.9fr 1fr;
}

.table-body {
  max-height: 600px;
  overflow-y: auto;
}

.table-body::-webkit-scrollbar {
  width: 6px;
}

.table-body::-webkit-scrollbar-track {
  background: var(--bg-secondary);
}

.table-body::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

.table-row {
  display: grid;
  padding: 0.625rem 1rem;
  border-bottom: 1px solid var(--border-color);
  transition: background 0.2s;
}

.table-row:hover {
  background: var(--bg-secondary);
}

.blocks-table .table-row {
  grid-template-columns: 90px 180px 1fr 110px 150px;
  gap: 1rem;
}

.transactions-table .table-row {
  grid-template-columns: 180px 120px 100px 100px 120px;
}

.td {
  display: flex;
  align-items: center;
  font-size: 0.8125rem;
  color: var(--text-primary);
}

.height-link {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--accent-primary);
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s;
}

.height-link:hover {
  color: var(--accent-secondary);
  text-decoration: underline;
}

.height-link svg {
  flex-shrink: 0;
  opacity: 0.7;
  width: 14px;
  height: 14px;
}

.height-number {
  font-weight: 600;
  font-size: 0.875rem;
}

.proposer-info {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.proposer-avatar {
  width: 24px;
  height: 24px;
  min-width: 24px;
  border-radius: 50%;
  background: var(--gradient-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 0.625rem;
  overflow: hidden;
}

.proposer-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.proposer-name {
  font-weight: 500;
  font-size: 0.8125rem;
}

.tx-count {
  padding: 0.2rem 0.4rem;
  background: var(--bg-secondary);
  border-radius: 3px;
  font-weight: 600;
  color: var(--text-tertiary);
  font-size: 0.6875rem;
}

.tx-count.has-txs {
  background: var(--fill-success);
  color: var(--ios-green);
}

.time-text {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.hash-code {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.6875rem;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  padding: 0.3rem 0.5rem;
  border-radius: 4px;
}

.hash-container {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
  padding-right: 0.5rem;
}

.hash-container.clickable:hover .hash-code {
  background: var(--primary-a10);
  color: var(--accent-primary);
  text-decoration: underline;
}

.hash-container:hover .hash-code {
  background: var(--primary-a10);
  color: var(--accent-primary);
}

.copy-icon,
.link-icon {
  opacity: 0.4;
  transition: opacity 0.2s;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.hash-container:hover .copy-icon,
.hash-container:hover .link-icon {
  opacity: 1;
  color: var(--accent-primary);
}

.clickable {
  cursor: pointer;
}

.clickable:hover {
  color: var(--accent-primary);
}

.block-link.clickable:hover {
  text-decoration: underline;
}

.validator-address.clickable:hover code {
  color: var(--accent-primary);
  text-decoration: underline;
}

/* Transactions View */
.transactions-view {
  background: var(--card-bg);
}

.transactions-header {
  padding: 1.5rem 1.5rem 1rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 1rem;
}

.transactions-header .header-content {
  flex: 1;
  min-width: 200px;
}

.transactions-header h2 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 0.25rem 0;
}

.transactions-subtitle {
  font-size: 0.875rem;
  color: var(--text-tertiary);
  margin: 0;
}

.transactions-table .table-header {
  grid-template-columns: 1.5fr 0.8fr 0.8fr 0.8fr 0.9fr 1fr;
}

.transactions-table .table-row {
  grid-template-columns: 1.5fr 0.8fr 0.8fr 0.8fr 0.9fr 1fr;
}

.tx-icon {
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.tx-type-badge {
  padding: 0.25rem 0.75rem;
  background: var(--fill-blue);
  color: var(--accent-secondary);
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.tx-status {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.tx-status svg {
  width: 14px;
  height: 14px;
}

.tx-status.success {
  background: var(--fill-success);
  color: var(--ios-green);
}

.tx-status.failed {
  background: var(--fill-error);
  color: var(--ios-red);
}

.block-link {
  color: var(--accent-primary);
  font-weight: 600;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: color 0.2s;
}

.block-link:hover {
  color: var(--accent-secondary);
  text-decoration: underline;
}

.fee-amount {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.75rem;
  color: var(--text-primary);
  font-weight: 500;
}

.td-hash {
  display: flex !important;
  align-items: center;
  gap: 0.5rem;
}

.copy-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.2s ease;
  opacity: 0;
  flex-shrink: 0;
}

.table-row:hover .copy-icon-btn {
  opacity: 1;
}

.copy-icon-btn:hover {
  background: var(--bg-tertiary);
  color: var(--accent-primary);
}

/* Blocks View - Compact Layout */
.blocks-view {
  background: var(--card-bg);
}

.blocks-header {
  position: relative;
  padding: 1rem 1.5rem 0.75rem;
  background: var(--card-bg);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 1rem;
}

.blocks-header .header-content {
  flex: 1;
  min-width: 200px;
}

.blocks-header h2 {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 0.125rem 0;
}

.blocks-subtitle {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin: 0;
}

.blocks-header .header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.filter-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filter-select,
.height-filter-input,
.hash-filter-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  background: var(--card-bg);
  color: var(--text-primary);
  font-size: 0.8125rem;
  transition: all 0.2s;
}

.filter-select {
  cursor: pointer;
  min-width: 120px;
}

.height-filter-input,
.hash-filter-input {
  min-width: 150px;
}

.filter-select:hover,
.height-filter-input:hover,
.hash-filter-input:hover {
  border-color: var(--primary, var(--accent-primary));
}

.filter-select:focus,
.height-filter-input:focus,
.hash-filter-input:focus {
  outline: none;
  border-color: var(--primary, var(--accent-primary));
  box-shadow: 0 0 0 3px var(--primary-a10);
}

.height-filter-input::placeholder,
.hash-filter-input::placeholder {
  color: var(--text-tertiary);
}

.blocks-header .refresh-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  background: rgba(52, 211, 153, 0.1);
  border: 1px solid rgba(52, 211, 153, 0.3);
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--ios-green);
}

.blocks-view .blocks-table {
  width: 100%;
}

.blocks-view .table-header {
  display: grid;
  grid-template-columns: 90px 320px 2.2fr 130px 140px;
  gap: 0.75rem;
  padding: 0.625rem 1.5rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.blocks-view .table-body {
  max-height: none;
}

.blocks-view .table-row {
  display: grid;
  grid-template-columns: 90px 320px 2.2fr 130px 140px;
  gap: 0.75rem;
  padding: 0.625rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
  transition: background 0.2s;
}

.blocks-view .table-row:hover {
  background: var(--bg-secondary);
}

.blocks-view .height-link {
  gap: 0.25rem;
}

.blocks-view .height-link svg {
  width: 12px;
  height: 12px;
}

.blocks-view .height-number {
  font-size: 0.75rem;
}

.blocks-view .proposer-avatar {
  width: 24px;
  height: 24px;
  min-width: 24px;
  font-size: 0.625rem;
}

.blocks-view .proposer-info {
  gap: 0.375rem;
}

.blocks-view .proposer-name {
  font-size: 0.75rem;
}

.blocks-view .hash-code {
  font-size: 0.625rem;
  padding: 0.1875rem 0.375rem;
}

.blocks-view .tx-count {
  font-size: 0.75rem;
  padding: 0.1875rem 0.375rem;
}

.blocks-view .time-text {
  font-size: 0.75rem;
}

/* Validators Grid */
.validators-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
  padding: 1.5rem;
}

.validator-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  background: var(--card-bg);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border: 0.5px solid var(--border-color);
  border-radius: var(--border-radius-lg);
  transition: all var(--transition-smooth);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02);
}

.validator-card:hover {
  transform: translateY(-2px) scale(1.005);
  box-shadow: 0 8px 20px rgba(0, 122, 255, 0.12), 0 4px 8px rgba(0, 0, 0, 0.06);
  border-color: rgba(0, 122, 255, 0.15);
}

.validator-card:active {
  transform: translateY(0) scale(0.998);
}

.validator-rank {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 28px;
  height: 28px;
  background: var(--bg-secondary);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.validator-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--gradient-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 1.5rem;
  overflow: hidden;
}

.validator-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.validator-details {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.validator-name {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary);
}

.validator-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.validator-stat {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.validator-stat .stat-label {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  font-weight: 500;
}

.validator-stat .stat-value {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.validator-address {
  margin-top: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-color);
}

.validator-address code {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.validator-status {
  padding: 0.375rem 0.75rem;
  background: var(--fill-success);
  color: var(--ios-green);
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  text-align: center;
}

.validator-status.jailed {
  background: var(--fill-error);
  color: var(--ios-red);
}

/* Responsive */
@media (max-width: 900px) {
  .sidebar {
    width: 200px;
    min-width: 200px;
  }
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  background: var(--card-bg);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border: 0.5px solid var(--border-color);
  border-radius: var(--border-radius-lg);
  padding: 1.25rem 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: all var(--transition-smooth);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02);
}

.stat-card:hover {
  transform: translateY(-2px) scale(1.01);
  box-shadow: 0 10px 25px rgba(0, 122, 255, 0.12), 0 4px 10px rgba(0, 0, 0, 0.06);
  border-color: rgba(0, 122, 255, 0.1);
}

.stat-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--ios-blue) 0%, var(--ios-indigo) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 4px 12px rgba(0, 122, 255, 0.25);
}

.stat-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stat-info .stat-label {
  font-size: 0.875rem;
  color: var(--text-tertiary);
  font-weight: 500;
}

.stat-info .stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.charts-section {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.chart-card {
  background: var(--card-bg);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border: 0.5px solid var(--border-color);
  border-radius: var(--border-radius-lg);
  padding: 1.25rem;
  min-height: 220px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.chart-header h3 {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
}

.time-filters {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-label {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin-right: 0.25rem;
}

.time-filter-btn {
  padding: 0.375rem 0.75rem;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.time-filter-btn:hover {
  background: var(--hover-bg);
  border-color: var(--accent-primary);
  color: var(--text-primary);
}

.time-filter-btn.active {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: white;
}

.chart-container canvas {
  width: 100%;
  height: 120px;
}

.chart-donut-wrapper {
  position: relative;
  width: 100px;
  height: 100px;
  margin: 0 auto 0.75rem;
}

.chart-donut-wrapper canvas {
  width: 100px !important;
  height: 100px !important;
}

.chart-center-label {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  pointer-events: none;
}

.center-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
}

.center-label {
  font-size: 0.6875rem;
  color: var(--text-tertiary);
  margin-top: 0.125rem;
}

.chart-legend {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-label {
  flex: 1;
  color: var(--text-secondary);
}

.legend-value {
  font-weight: 600;
  color: var(--text-primary);
}

.block-proposer-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.75rem;
  min-height: 160px;
}

.proposer-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--gradient-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.5rem;
  font-weight: 700;
  flex-shrink: 0;
  border: 2px solid var(--primary-a30);
}

.proposer-avatar img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.proposer-label {
  font-size: 0.6875rem;
  color: var(--text-tertiary);
  letter-spacing: 0.02em;
  text-align: center;
}

.proposer-name {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  text-align: center;
  margin-top: 0;
}

.proposer-stats {
  width: 100%;
  margin-top: 0.375rem;
}

.proposer-stat-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  width: 100%;
}

.proposer-stat {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  text-align: center;
}

.proposer-stat .stat-label {
  font-size: 0.6875rem;
  color: var(--text-tertiary);
}

.proposer-stat .stat-value {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--ios-green);
}

.live-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  background: rgba(16, 185, 129, 0.15);
  border-radius: 20px;
  color: var(--ios-green);
  font-size: 0.8125rem;
  font-weight: 600;
}

.block-production-card .chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.block-production-card {
  background: var(--card-bg);
}

.live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ios-green);
  animation: pulse 2s infinite;
}

.recent-activity {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.activity-column {
  background: var(--card-bg);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border: 0.5px solid var(--border-color);
  border-radius: var(--border-radius-lg);
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02);
}

.activity-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.activity-header h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.view-all-btn {
  background: transparent;
  border: none;
  color: var(--accent-primary);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.view-all-btn:hover {
  opacity: 0.7;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--bg-secondary);
  border-radius: 8px;
  transition: background 0.2s;
}

.activity-item:hover {
  background: var(--primary-a08);
}

.activity-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--primary-a10);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-primary);
  flex-shrink: 0;
}

.activity-content {
  flex: 1;
  min-width: 0;
}

.activity-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.activity-meta {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.proposer-mini-avatar {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  object-fit: cover;
}

.tx-type-mini {
  padding: 0.125rem 0.5rem;
  background: rgba(59, 130, 246, 0.1);
  color: var(--accent-primary);
  border-radius: 4px;
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
}

.activity-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
}

.activity-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
}

.activity-time {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.activity-status {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.125rem 0.5rem;
  border-radius: 12px;
}

.activity-status.success {
  background: rgba(16, 185, 129, 0.1);
  color: var(--ios-green);
}

.activity-status.failed {
  background: rgba(239, 68, 68, 0.1);
  color: var(--ios-red);
}

/* Responsive */
@media (max-width: 900px) {
  .sidebar {
    width: 200px;
    min-width: 200px;
  }
}

/* Validators Table Styles */
.validators-view {
  padding: 2rem;
}

.validators-header {
  margin-bottom: 2rem;
}

.validators-header h2 {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.validators-subtitle {
  font-size: 0.875rem;
  color: var(--text-tertiary);
}

.validators-table {
  background: var(--card-bg);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border: 0.5px solid var(--border-color);
  border-radius: var(--border-radius-lg);
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02);
}

.table-header {
  display: grid;
  grid-template-columns: 50px 220px 200px 120px 160px 100px 90px 110px 110px 120px;
  gap: 1rem;
  padding: 1.25rem 1.75rem;
  background: rgba(0, 0, 0, 0.02);
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.08);
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-tertiary);
  letter-spacing: 0.02em;
  text-transform: uppercase;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.table-body {
  display: flex;
  flex-direction: column;
}

.table-row {
  display: grid;
  grid-template-columns: 50px 220px 200px 120px 160px 100px 90px 110px 110px 120px;
  gap: 1rem;
  padding: 1.25rem 1.75rem;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.06);
  transition: all var(--transition-fast);
  align-items: center;
}

.table-row:hover {
  background: rgba(0, 0, 0, 0.02);
  cursor: default;
}

.table-row:last-child {
  border-bottom: none;
}

.table-row:active {
  background: rgba(0, 0, 0, 0.04);
  transform: scale(0.998);
}

.td {
  display: flex;
  align-items: center;
  font-size: 0.875rem;
}

.rank-number {
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 0.9375rem;
}

.validator-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.validator-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 0.8125rem;
  flex-shrink: 0;
  overflow: hidden;
  border: 2px solid var(--border-color);
}

.validator-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.validator-name-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.validator-name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.875rem;
}

.validator-address {
  font-size: 0.6875rem;
  color: var(--text-tertiary);
  font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
  cursor: pointer;
  transition: color 0.2s ease;
}

.validator-address:hover {
  color: var(--ios-blue);
}

.voting-power-container {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  width: 100%;
}

.voting-power-text {
  font-weight: 700;
  color: var(--text-primary);
  font-size: 0.9375rem;
  margin-bottom: 0.375rem;
}

.voting-power-bar {
  width: 100%;
  height: 5px;
  background: var(--border-color);
  border-radius: 2.5px;
  overflow: hidden;
  margin-bottom: 0.375rem;
}

.voting-power-fill {
  height: 100%;
  background: linear-gradient(90deg, rgba(48, 209, 88, 0.8), rgba(52, 199, 89, 0.6));
  border-radius: 2.5px;
  transition: width 0.3s ease;
}

.voting-power-amount {
  font-size: 0.6875rem;
  color: var(--text-tertiary);
  font-weight: 500;
}

.changes-value {
  font-weight: 600;
  font-size: 0.875rem;
}

.changes-value.positive {
  color: var(--ios-green);
}

.changes-value.negative {
  color: var(--ios-red);
}

.cumulative-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 50px;
}

.circular-progress {
  filter: none;
}

.cumulative-text {
  position: absolute;
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--text-primary);
}

.commission-value {
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.score-badge {
  padding: 0.375rem 0.875rem;
  border-radius: 18px;
  font-weight: 700;
  font-size: 0.8125rem;
  display: inline-block;
  min-width: 42px;
  text-align: center;
}

.score-badge.score-high {
  background: var(--ios-green);
  color: white;
}

.score-badge.score-medium {
  background: var(--ios-yellow);
  color: white;
}

.score-badge.score-low {
  background: var(--ios-purple);
  color: white;
}

.delegators-value,
.uptime-value {
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.td-actions {
  display: flex;
  justify-content: center;
  align-items: center;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  background: var(--ios-blue);
  color: white;
  border: none;
  border-radius: var(--border-radius-xs);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
  letter-spacing: -0.022em;
  box-shadow: 0 1px 3px rgba(0, 122, 255, 0.2);
}

.action-btn:hover:not(:disabled) {
  transform: scale(1.02);
  box-shadow: 0 3px 10px rgba(0, 122, 255, 0.3);
}

.action-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  background: var(--ios-gray-4);
}

.action-btn svg {
  flex-shrink: 0;
}

.copy-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-left: 0.5rem;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.2s ease;
  opacity: 0;
}

.td-hash:hover .copy-icon-btn {
  opacity: 1;
}

.copy-icon-btn:hover {
  background: var(--hover-bg);
  color: var(--accent-primary);
}

.copy-notification {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: var(--ios-green);
  color: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
  font-weight: 600;
  font-size: 0.875rem;
  z-index: 9999;
  animation: slideInUp 0.3s ease;
}

@keyframes slideInUp {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Stake Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
}

.stake-modal {
  background: var(--bg-primary);
  border-radius: var(--border-radius-2xl);
  width: 90%;
  max-width: 420px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25), 0 0 0 0.5px rgba(0, 0, 0, 0.05);
  animation: modalSlideIn 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  font-size: 1.5rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.modal-body {
  padding: 1.5rem;
}

.balance-info {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.balance-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.balance-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.balance-value {
  font-size: 0.875rem;
  color: var(--text-primary);
  font-weight: 700;
}

.action-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  padding: 0.25rem;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.tab-btn {
  flex: 1;
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: none;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn.active {
  background: var(--accent-primary);
  color: white;
}

.tab-btn:hover:not(.active) {
  color: var(--text-primary);
}

.stake-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.stake-input {
  width: 100%;
  padding: 0.75rem 4rem 0.75rem 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 0.9375rem;
  font-weight: 600;
  transition: all 0.2s ease;
}

.stake-input:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--primary-a08);
}

.input-suffix {
  position: absolute;
  right: 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.amount-slider {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0;
}

.slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: var(--border-color);
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent-primary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent-primary);
  cursor: pointer;
  border: none;
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.6875rem;
  color: var(--text-tertiary);
}

.quick-amounts {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}

.quick-btn {
  padding: 0.5rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.quick-btn:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
  background: var(--primary-a08);
}

.validator-select {
  width: 100%;
  padding: 0.75rem 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.validator-select:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--primary-a08);
}

.advanced-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.advanced-toggle:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.confirm-btn {
  width: 100%;
  padding: 0.875rem;
  background: var(--ios-blue);
  border: none;
  border-radius: var(--border-radius-sm);
  color: white;
  font-size: var(--fs-base);
  font-weight: 600;
  letter-spacing: -0.022em;
  cursor: pointer;
  transition: all var(--transition-base);
  box-shadow: 0 2px 8px rgba(0, 122, 255, 0.25);
}

.confirm-btn:hover:not(:disabled) {
  transform: scale(1.01);
  box-shadow: 0 4px 16px rgba(0, 122, 255, 0.35);
}

.confirm-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.confirm-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Transaction Status Popup */
.tx-status-popup {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--bg-primary);
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  z-index: 10001;
  min-width: 400px;
  max-width: 90vw;
  animation: popupFadeIn 0.3s ease;
}

@keyframes popupFadeIn {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

.tx-status-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  text-align: center;
}

.tx-processing,
.tx-success,
.tx-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  width: 100%;
}

.tx-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid var(--border-color);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: txSpin 0.8s linear infinite;
}

@keyframes txSpin {
  to {
    transform: rotate(360deg);
  }
}

.tx-icon {
  flex-shrink: 0;
  animation: iconBounce 0.5s ease;
}

@keyframes iconBounce {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

.tx-status-text {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tx-status-text strong {
  font-size: 1.125rem;
  color: var(--text-primary);
  font-weight: 700;
}

.tx-status-text p {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0;
  max-width: 320px;
  word-wrap: break-word;
}

.tx-hash-display {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--border-color);
  width: 100%;
}

.tx-hash-display small {
  display: block;
  font-size: 0.6875rem;
  color: var(--text-tertiary);
  margin-bottom: 0.375rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.tx-hash-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.625rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.tx-hash-link:hover {
  background: var(--primary-a08);
  border-color: var(--accent-primary);
  transform: translateX(2px);
}

.tx-hash-link code {
  flex: 1;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.75rem;
  color: var(--accent-primary);
  word-break: break-all;
  font-weight: 600;
}

.tx-hash-link svg {
  flex-shrink: 0;
  color: var(--accent-primary);
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.tx-hash-link:hover svg {
  opacity: 1;
}

.tx-close-btn {
  margin-top: 1rem;
  padding: 0.625rem 2rem;
  background: var(--accent-primary);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tx-close-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.tx-retry-btn {
  margin-top: 0.5rem;
  padding: 0.625rem 1.5rem;
  background: var(--accent-primary);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tx-retry-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.tx-status-popup.processing {
  border: 2px solid var(--accent-primary);
}

.tx-status-popup.success {
  border: 2px solid rgba(48, 209, 88, 0.5);
}

.tx-status-popup.error {
  border: 2px solid #ef4444;
}

@media (max-width: 768px) {
  .explorer-page {
    flex-direction: column;
  }
  
  .sidebar {
    width: 100%;
    flex-direction: row;
    padding: 1rem;
    border-right: none;
    border-bottom: 2px solid var(--border-color);
  }
  
  .sidebar-nav {
    flex-direction: row;
    flex: 1;
    overflow-x: auto;
  }
  
  .main-content {
    padding: 1rem;
  }
  
  .validators-grid {
    grid-template-columns: 1fr;
  }
  
  .charts-section {
    grid-template-columns: 1fr;
  }
  
  .recent-activity {
    grid-template-columns: 1fr;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
