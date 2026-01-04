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
                        stroke="#3b82f6" 
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
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, inject } from 'vue';
import BlockDetailPage from './BlockDetailPage.vue';
import TransactionDetailPage from './TransactionDetailPage.vue';
import AddressDetailPage from './AddressDetailPage.vue';

const lumen = (window as any).lumen;
const openInNewTab = inject<((url: string) => void) | null>('openInNewTab', null);
const currentTabUrl = inject<any>('currentTabUrl', null);

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
    'linear-gradient(135deg, #ec4899, #f472b6)',
    'linear-gradient(135deg, #8b5cf6, #a78bfa)',
    'linear-gradient(135deg, #3b82f6, #60a5fa)',
    'linear-gradient(135deg, #06b6d4, #22d3ee)',
    'linear-gradient(135deg, #10b981, #34d399)'
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
        const colors = ['#ec4899', '#8b5cf6', '#3b82f6', '#06b6d4', '#10b981'];
        
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
  background: var(--bg-primary);
  overflow: hidden;
}

/* Sidebar */
.sidebar {
  width: 260px;
  min-width: 260px;
  background: var(--sidebar-bg);
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  border-right: 2px solid var(--border-color);
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
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
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
  padding: 0.75rem;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.9375rem;
  font-weight: 500;
}

.nav-item:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.nav-item.active {
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  color: white;
}

.nav-item svg {
  flex-shrink: 0;
}

/* Main Content */
.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
}

.main-content::-webkit-scrollbar {
  width: 8px;
}

.main-content::-webkit-scrollbar-track {
  background: transparent;
}

.main-content::-webkit-scrollbar-thumb {
  background: rgba(52, 152, 219, 0.3);
  border-radius: 4px;
}

.main-content::-webkit-scrollbar-thumb:hover {
  background: rgba(52, 152, 219, 0.5);
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
  border-color: #3498db;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
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
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.search-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
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
  background: linear-gradient(135deg, #3498db, var(--text-primary));
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
  color: var(--text-secondary, #64748b);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-color);
  border-top-color: #3498db;
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
  color: #25bb8d;
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
  color: #3498db;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s;
}

.height-link:hover {
  color: #2980b9;
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
  background: linear-gradient(135deg, #3498db, #2980b9);
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
  background: #dcfce7;
  color: #16a34a;
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
  background: rgba(52, 152, 219, 0.1);
  color: #3498db;
  text-decoration: underline;
}

.hash-container:hover .hash-code {
  background: rgba(52, 152, 219, 0.1);
  color: #3498db;
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
  color: #3498db;
}

.clickable {
  cursor: pointer;
}

.clickable:hover {
  color: #3498db;
}

.block-link.clickable:hover {
  text-decoration: underline;
}

.validator-address.clickable:hover code {
  color: #3498db;
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
  background: #dbeafe;
  color: #2563eb;
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
  background: #dcfce7;
  color: #16a34a;
}

.tx-status.failed {
  background: #fee2e2;
  color: #dc2626;
}

.block-link {
  color: #3498db;
  font-weight: 600;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: color 0.2s;
}

.block-link:hover {
  color: #2980b9;
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
  color: #9ca3af;
  cursor: pointer;
  transition: all 0.2s ease;
  opacity: 0;
  flex-shrink: 0;
}

.table-row:hover .copy-icon-btn {
  opacity: 1;
}

.copy-icon-btn:hover {
  background: #f3f4f6;
  color: #3b82f6;
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
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 0.5rem;
  background: var(--card-bg, #ffffff);
  color: var(--text-primary, #0f172a);
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
  border-color: var(--primary, #3498db);
}

.filter-select:focus,
.height-filter-input:focus,
.hash-filter-input:focus {
  outline: none;
  border-color: var(--primary, #3498db);
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.height-filter-input::placeholder,
.hash-filter-input::placeholder {
  color: var(--text-tertiary, #94a3b8);
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
  color: #34d399;
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
  padding: 1.5rem;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  transition: all 0.2s;
}

.validator-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  border-color: #3498db;
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
  background: linear-gradient(135deg, #3498db, #2980b9);
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
  background: #dcfce7;
  color: #16a34a;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  text-align: center;
}

.validator-status.jailed {
  background: #fee2e2;
  color: #dc2626;
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
  border: 2px solid var(--border-color);
  border-radius: 16px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: all 0.3s;
}

.stat-card:hover {
  border-color: #3498db;
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(52, 152, 219, 0.15);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #3498db, #2980b9);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
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
  border: 2px solid var(--border-color);
  border-radius: 16px;
  padding: 0.875rem;
  min-height: 220px;
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
  border-color: #3498db;
  color: var(--text-primary);
}

.time-filter-btn.active {
  background: #3498db;
  border-color: #3498db;
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
  background: linear-gradient(135deg, #3498db, #2980b9);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.5rem;
  font-weight: 700;
  flex-shrink: 0;
  border: 2px solid rgba(52, 152, 219, 0.3);
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
  color: var(--text-tertiary, #94a3b8);
}

.proposer-stat .stat-value {
  font-size: 0.9375rem;
  font-weight: 700;
  color: #10b981;
}

.live-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  background: rgba(16, 185, 129, 0.15);
  border-radius: 20px;
  color: #10b981;
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
  background: #10b981;
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
  border: 2px solid var(--border-color);
  border-radius: 16px;
  padding: 1rem;
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
  color: #3498db;
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
  background: rgba(52, 152, 219, 0.05);
}

.activity-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(52, 152, 219, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #3498db;
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
  color: #3b82f6;
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
  color: #10b981;
}

.activity-status.failed {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
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
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.table-header {
  display: grid;
  grid-template-columns: 40px 260px 200px 110px 150px 100px 100px 120px 100px;
  gap: 1.25rem;
  padding: 1.25rem 1.75rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.table-body {
  display: flex;
  flex-direction: column;
}

.table-row {
  display: grid;
  grid-template-columns: 40px 260px 200px 110px 150px 100px 100px 120px 100px;
  gap: 1.25rem;
  padding: 1.25rem 1.75rem;
  border-bottom: 1px solid var(--border-color);
  transition: all 0.2s ease;
  align-items: center;
}

.table-row:hover {
  background: var(--bg-secondary);
  cursor: default;
}

.table-row:last-child {
  border-bottom: none;
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
  color: #6366f1;
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
  background: linear-gradient(90deg, #22c55e, #4ade80);
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
  color: #22c55e;
}

.changes-value.negative {
  color: #ef4444;
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
  background: #22c55e;
  color: white;
}

.score-badge.score-medium {
  background: #eab308;
  color: white;
}

.score-badge.score-low {
  background: #a78bfa;
  color: white;
}

.delegators-value,
.uptime-value {
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 0.875rem;
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
  color: #3b82f6;
}

.copy-notification {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: #22c55e;
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
