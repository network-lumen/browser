<template>
  <div class="internal-page flex">
    <!-- Show Block Detail if URL contains /block/ -->
    <BlockDetailPage v-if="isBlockDetailView" />
    
    <!-- Show Transaction Detail if URL contains /tx/ -->
    <TransactionDetailPage v-else-if="isTransactionDetailView" />
    
    <!-- Show Address Detail if URL contains /address/ -->
    <AddressDetailPage v-else-if="isAddressDetailView" />
    
    <!-- Show normal explorer view otherwise -->
    <template v-else>
    <!-- Sidebar -->
    <InternalSidebar title="Explorer" :icon="LayoutGrid" activeKey="explorer">
      <nav class="flex flex-column gap-12px">
        <UiSidebarNavSection title="Browse">
          <UiSidebarNavItem reveal :active="currentView === 'overview'" @click="currentView = 'overview'">
            <svg class="reveal-target flex-shrink-0 opacity-85" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="3" y1="9" x2="21" y2="9"/>
              <line x1="9" y1="21" x2="9" y2="9"/>
            </svg>
            <span>Overview</span>
          </UiSidebarNavItem>
          <UiSidebarNavItem reveal :active="currentView === 'blocks'" @click="currentView = 'blocks'">
            <svg class="reveal-target flex-shrink-0 opacity-85" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
            </svg>
            <span>Blocks</span>
          </UiSidebarNavItem>
          <UiSidebarNavItem reveal :active="currentView === 'transactions'" @click="currentView = 'transactions'">
            <svg class="reveal-target flex-shrink-0 opacity-85" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
            </svg>
            <span>Transactions</span>
          </UiSidebarNavItem>
          <UiSidebarNavItem reveal :active="currentView === 'validators'" @click="currentView = 'validators'">
            <svg class="reveal-target flex-shrink-0 opacity-85" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <span>Validators</span>
          </UiSidebarNavItem>
        </UiSidebarNavSection>
      </nav>
    </InternalSidebar>

    <!-- Main Content -->
    <main class="flex-1 p-24px overflow-y-auto bg-secondary">
      <!-- Search Bar -->
      <div class="mb-32px">
        <div class="flex-align-center gap-8px border-radius-12px bg-card border-2 py-12px px-16px transition-all-02 max-w-800px focus-within-border-accent focus-within-ring">
          <Search :size="20" class="color-text-tertiary" />
          <input 
            type="text" 
            class="flex-1 outline-none color-text-primary border-none text-15px bg-transparent placeholder-tertiary"
            v-model="searchQuery"
            @keyup.enter="performSearch"
            placeholder="Search by Block Height, Tx Hash, or Address..."
          />
          <UiButton variant="primary" @click="performSearch" :disabled="!searchQuery" class="disabled-fade-50">
            Search
          </UiButton>
        </div>
      </div>

      <!-- Stats Bar -->
      <div class="gap-16px mb-32px grid grid-cols-auto-fit-200">
        <UiStatTile label="Latest Block" :value="formatNumber(latestBlock)" />
        <UiStatTile :label="`Txs (last ${txHistoryWindow} blocks)`" :value="formatNumber(txHistoryTotal)" />
        <UiStatTile label="Validators" :value="String(validatorCount)" />
        <UiStatTile label="Avg Block Time" :value="avgBlockTimeLabel" />
      </div>

      <!-- Loading State -->
      <UiLoadingBlock v-if="isLoading" message="Loading blockchain data..." />

      <template v-else>
        <!-- Overview View -->
        <div v-if="currentView === 'overview'" class="border-radius-12px bg-transparent overflow-visible">
          <!-- Section Header -->
          <div class="mb-24px text-center">
            <h1 class="text-28px txt-weight-medium color-text-primary mb-4px">Network Overview</h1>
            <p class="text-15px color-text-secondary">Real-time blockchain statistics</p>
          </div>

          <!-- Charts Section -->
          <div class="mb-0px gap-12px grid grid-cols-2">
            <UiChartCard :title="txHistoryTitle">
              <template #header>
                <div class="flex-align-center gap-8px">
                  <span class="text-12px color-text-tertiary mr-4px">Total: {{ formatNumber(txHistoryTotal) }}</span>
                  <UiFilterButton :active="txHistoryWindow === 5" @click="txHistoryWindow = 5">5B</UiFilterButton>
                  <UiFilterButton :active="txHistoryWindow === 10" @click="txHistoryWindow = 10">10B</UiFilterButton>
                  <UiFilterButton :active="txHistoryWindow === 15" @click="txHistoryWindow = 15">15B</UiFilterButton>
                  <UiFilterButton :active="txHistoryWindow === 20" @click="txHistoryWindow = 20">20B</UiFilterButton>
                </div>
              </template>
              <canvas ref="txHistoryChart" class="w-full h-120px"></canvas>
            </UiChartCard>

            <UiChartCard title="Bonded / Supply">
              <div class="relative m-0px mx-auto mb-12px w-140px h-140px">
                <canvas ref="bondedSupplyChart" width="140" height="140" class="chart-canvas-fixed-140px"></canvas>
                <div class="text-center absolute cursor-events-none top-half left-half translate-center">
                  <div class="txt-weight-medium color-text-primary text-20px">{{ bondedRatioLabel }}</div>
                  <div class="color-text-tertiary text-11px mt-0px">Bonded</div>
                </div>
              </div>
              <div class="flex flex-column gap-6px">
                <UiLegendItem dot-class="bg-gradient-legend-bonded" label="Bonded" :value="`${formatNumber(bondedTokens)} LMN`" />
                <UiLegendItem dot-class="bg-legend-unbonded" label="Unbonded" :value="`${formatNumber(unbondedTokens)} LMN`" />
                <UiLegendItem label="Total Supply" :value="`${formatNumber(totalSupply)} LMN`" />
              </div>
            </UiChartCard>

            <UiChartCard title="Voting Power">
              <div class="relative m-0px mx-auto mb-12px w-140px h-140px">
                <canvas ref="votingPowerChart" width="140" height="140" class="chart-canvas-fixed-140px"></canvas>
                <div class="text-center absolute cursor-events-none top-half left-half translate-center">
                  <div class="txt-weight-medium color-text-primary text-20px">{{ topValidatorsPower.length }}</div>
                  <div class="color-text-tertiary text-11px mt-0px">Active</div>
                </div>
              </div>
              <div class="flex flex-column gap-6px">
                <UiLegendItem
                  v-for="(vp, idx) in topValidatorsPower.slice(0, 5)"
                  :key="idx"
                  :dot-color="getVotingPowerColor(idx)"
                  :label="vp.moniker"
                  :value="`${vp.percentage}%`"
                />
                <UiLegendItem dot-class="bg-legend-others" label="Others" :value="`${othersPercentage}%`" />
              </div>
            </UiChartCard>

            <UiChartCard title="Block Production">
              <template #header>
                <div class="flex-align-center gap-8px border-radius-20px color-success txt-weight-light bg-fill-success text-13px py-8px px-12px">
                  <span class="animate-pulse-ring border-radius-circle w-8px h-8px bg-success"></span>
                  <span>Live</span>
                </div>
              </template>
              <div class="flex-align-justify-center flex-column gap-6px p-12px min-h-160px">
                <div class="flex-align-justify-center size-64px border-radius-circle txt-weight-medium bg-gradient-primary color-white text-10px overflow-hidden text-24px flex-shrink-0 border-2-primary-a30 min-w-24px">
                  <img class="w-full h-full object-fit-cover border-radius-full" v-if="latestProposer.avatar" :src="latestProposer.avatar" :alt="latestProposer.moniker" />
                  <span v-else>{{ latestProposer.moniker.charAt(0).toUpperCase() }}</span>
                </div>
                <div class="mt-0px text-12px txt-weight-medium color-text-primary text-center text-13px text-16px">{{ latestProposer.moniker }}</div>
                <div class="letter-spacing-0025em color-text-tertiary text-center text-11px">Latest Block Proposer</div>
                <div class="w-full mt-8px">
                  <div class="gap-8px w-full grid grid-cols-1fr-1fr">
                    <div class="flex flex-column text-center gap-2px">
                      <span class="color-text-tertiary text-uppercase color-text-secondary fw-500 text-13px text-11px">Block</span>
                      <span class="bg-gradient-accent-text txt-weight-medium color-text-primary text-24px text-15px gradient-text-clip">#{{ formatNumber(latestProposer.blockHeight) }}</span>
                    </div>
                    <div class="flex flex-column text-center gap-2px">
                      <span class="color-text-tertiary text-uppercase color-text-secondary fw-500 text-13px text-11px">Block Time</span>
                      <span class="bg-gradient-accent-text txt-weight-medium color-text-primary text-24px text-15px gradient-text-clip">{{ avgBlockTimeLabelShort }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </UiChartCard>
          </div>

          <!-- Recent Activity -->
          <div class="mb-0px gap-12px grid mt-12px grid-cols-2">
            <UiCard padding="none" :shadow="false" class="p-20px shadow-sm backdrop-blur">
              <div class="flex-align-center-justify-space-between mb-12px">
                <h3 class="text-16px txt-weight-light color-text-primary">Latest Blocks</h3>
                <UiButton variant="primary" @click="currentView = 'blocks'">View All →</UiButton>
              </div>
              <div class="flex flex-column gap-12px">
                <div v-for="block in blocks.slice(0, 5)" :key="block.height" class="hover-bg-primary-a10 cursor-pointer flex-align-center gap-12px p-12px bg-secondary border-radius-8px transition-bg-02" @click="navigateToBlock(block.height)">
                  <div class="flex-align-justify-center size-32px color-primary border-radius-8px flex-shrink-0 bg-primary-a10">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="3" width="7" height="7" rx="1"/>
                      <rect x="14" y="3" width="7" height="7" rx="1"/>
                      <rect x="14" y="14" width="7" height="7" rx="1"/>
                      <rect x="3" y="14" width="7" height="7" rx="1"/>
                    </svg>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="txt-weight-light color-text-primary text-14px mb-4px">#{{ formatNumber(block.height) }}</div>
                    <div class="flex-align-center text-12px color-text-tertiary gap-8px">
                      <img v-if="block.proposerAvatar" :src="block.proposerAvatar" class="border-radius-circle object-fit-cover w-16px h-16px" :alt="block.proposer" />
                      <span>{{ block.proposer }}</span>
                    </div>
                  </div>
                  <div class="flex-align-end flex-column gap-4px">
                    <div class="txt-weight-light color-text-primary text-14px">{{ block.txCount }} txs</div>
                    <div class="text-12px color-text-tertiary">{{ formatTimeAgo(block.time) }}</div>
                  </div>
                </div>
              </div>
            </UiCard>

            <UiCard padding="none" :shadow="false" class="p-20px shadow-sm backdrop-blur">
              <div class="flex-align-center-justify-space-between mb-12px">
                <h3 class="text-16px txt-weight-light color-text-primary">Latest Transactions</h3>
                <UiButton variant="primary" @click="currentView = 'transactions'">View All →</UiButton>
              </div>
              <div class="flex flex-column gap-12px">
                <div v-for="tx in transactions.slice(0, 5)" :key="tx.hash" class="hover-bg-primary-a10 cursor-pointer flex-align-center gap-12px p-12px bg-secondary border-radius-8px transition-bg-02" @click="navigateToTransaction(tx.hash)">
                  <div class="flex-align-justify-center size-32px color-primary border-radius-8px flex-shrink-0 bg-primary-a10">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
                      <path d="M21 3v5h-5"/>
                    </svg>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="txt-weight-light color-text-primary text-14px mb-4px">{{ shortenHash(tx.hash) }}</div>
                    <div class="flex-align-center text-12px color-text-tertiary gap-8px">
                      <span class="color-primary txt-weight-light text-uppercase border-radius-4px text-10px py-0px px-8px bg-primary-a10">{{ tx.type }}</span>
                    </div>
                  </div>
                  <div class="flex-align-end flex-column gap-4px">
                    <div class="text-12px txt-weight-light border-radius-12px py-0px px-8px" :class="tx.success ? 'success bg-fill-success' : 'failed bg-fill-error'">
                      {{ tx.success ? 'Success' : 'Failed' }}
                    </div>
                    <div class="text-12px color-text-tertiary">{{ formatTimeAgo(tx.time) }}</div>
                  </div>
                </div>
              </div>
            </UiCard>
          </div>
        </div>

        <!-- Blocks View -->
        <div v-else-if="currentView === 'blocks'" class="text-12px border-radius-12px bg-transparent bg-card overflow-visible">
          <div class="flex-align-start flex-wrap-wrap gap-16px relative bg-card border-bottom-1 flex-justify-space-between p-0px pt-16px pr-24px pb-12px pl-24px">
            <div class="flex-1 min-w-200px">
              <h2 class="text-20px txt-weight-medium color-text-primary m-0px mb-4px">Blocks</h2>
              <p class="text-12px color-text-tertiary m-0px">View all blocks on the lumen-mainnet</p>
            </div>
            <div class="flex flex-inline-align-center gap-12px flex-wrap-wrap">
              <div class="flex-align-center flex-wrap-wrap gap-8px">
                <select v-model="blockFilter" class="hover-border-accent cursor-pointer py-8px px-12px border-1 border-radius-8px bg-card color-text-primary text-13px transition-all-02 min-w-120px focus-outline-none focus-border-primary focus-ring focus-shadow">
                  <option value="all">All Blocks</option>
                  <option value="recent">Recent (Last 100)</option>
                  <option value="with-txs">With Transactions</option>
                  <option value="empty">Empty Blocks</option>
                </select>
                <input
                  v-model="blockHeightFilter"
                  type="number"
                  placeholder="Filter by height..."
                  class="hover-border-accent py-8px px-12px border-1 border-radius-8px bg-card color-text-primary text-13px transition-all-02 focus-outline-none focus-border-primary focus-ring focus-shadow min-w-150px placeholder-tertiary"
                />
              </div>
              <span class="tone-green flex-align-center gap-8px color-text-tertiary fw-500 text-13px inline-flex flex-inline-align-center gap-6px border-radius-4px text-11px txt-weight-light color-success bg-success-a08 border-1-success-a30 py-4px px-6px" :class="{ active: autoRefresh }">
                <span class="animate-pulse-live border-radius-circle w-8px h-8px bg-current"></span>
                Live
              </span>
            </div>
          </div>

          <div class="w-full">
            <div class="explorer-table-recipe explorer-table-header-recipe grid-cols-90-320-22fr-130-140">
              <div class="">HEIGHT</div>
              <div class="">PROPOSER</div>
              <div class="">HASH</div>
              <div class="">TRANSACTIONS</div>
              <div class="">TIME</div>
            </div>
            
            <div class="max-h-none flex flex-column overflow-y-auto">
              <div v-for="block in filteredBlocks" :key="block.height" class="explorer-table-recipe explorer-table-row-recipe grid-cols-90-320-22fr-130-140 active-scale-998 reveal-on-hover hover-bg-secondary hover-cursor-default last-border-bottom-none cursor-pointer flex-inline-align-center bg-black-a04-active" @click="navigateToBlock(block.height)">
                <div class="flex-align-center text-13px text-14px">
                  <div class="flex-align-center color-primary cursor-pointer transition-all-02 hover-underline hover-color-accent-secondary gap-4px" @click="navigateToBlock(block.height)">
                    <svg class="flex-shrink-0 opacity-70 w-12px h-12px" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                    </svg>
                    <span class="txt-weight-light text-12px">{{ formatNumber(block.height) }}</span>
                  </div>
                </div>
                <div class="flex-align-center text-13px text-14px">
                  <div class="flex-align-center gap-6px">
                    <div class="flex-align-justify-center size-24px border-radius-circle txt-weight-medium bg-gradient-primary color-white text-10px overflow-hidden flex-shrink-0 border-2-primary-a30 min-w-24px text-10px">
                      <img class="w-full h-full object-fit-cover border-radius-full" v-if="block.proposerAvatar" :src="block.proposerAvatar" :alt="block.proposer" />
                      <span v-else>{{ block.proposer.charAt(0) }}</span>
                    </div>
                    <span class="mt-0px text-12px txt-weight-medium color-text-primary text-center text-13px text-16px">{{ block.proposer }}</span>
                  </div>
                </div>
                <div class="reveal-on-hover flex-align-center gap-8px text-13px text-14px">
                  <div class="hover-color-accent reveal-on-hover flex-inline-align-center gap-8px cursor-pointer transition-all-02 pr-8px" @click.stop="navigateToBlock(block.height)" title="View block details">
                    <code class="reveal-hash-code-target color-text-secondary bg-secondary border-radius-4px mono py-4px px-6px text-10px">{{ block.hash }}</code>
                    <svg class="opacity-40 reveal-opacity-color-accent-target color-text-tertiary flex-shrink-0 transition-opacity-02" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                    </svg>
                  </div>
                  <UiButton variant="icon" @click.stop="copyToClipboard(block.hash, 'Block hash')" title="Copy hash" class="size-24px">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </UiButton>
                </div>
                <div class="flex-align-center text-13px text-14px">
                  <span class="txt-weight-light color-text-tertiary bg-secondary border-radius-4px py-4px px-6px text-12px" :class="{ 'has-txs': block.txCount > 0, 'bg-fill-success': block.txCount > 0 }">
                    {{ block.txCount }}
                  </span>
                </div>
                <div class="flex-align-center text-13px text-14px">
                  <span class="text-12px color-text-secondary">{{ formatTimeAgo(block.time) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Transactions View -->
        <div v-else-if="currentView === 'transactions'" class="border-radius-12px bg-transparent bg-card overflow-visible">
          <div class="flex-align-start flex-wrap-wrap gap-16px border-bottom-1 flex-justify-space-between pt-24px pr-24px pb-16px pl-24px">
            <div class="flex-1 min-w-200px">
              <h2 class="text-24px txt-weight-medium color-text-primary m-0px mb-4px">Transactions</h2>
              <p class="color-text-tertiary m-0px text-14px">Latest transactions on the lumen-mainnet</p>
            </div>
            <div class="flex-align-center flex-wrap-wrap gap-8px">
              <select v-model="txTypeFilter" class="hover-border-accent cursor-pointer py-8px px-12px border-1 border-radius-8px bg-card color-text-primary text-13px transition-all-02 min-w-120px focus-outline-none focus-border-primary focus-ring focus-shadow">
                <option value="all">All Types</option>
                <option value="send">Send</option>
                <option value="delegate">Delegate</option>
                <option value="vote">Vote</option>
                <option value="other">Other</option>
              </select>
              <select v-model="txStatusFilter" class="hover-border-accent cursor-pointer py-8px px-12px border-1 border-radius-8px bg-card color-text-primary text-13px transition-all-02 min-w-120px focus-outline-none focus-border-primary focus-ring focus-shadow">
                <option value="all">All Status</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
              </select>
              <input
                v-model="txHashFilter"
                type="text"
                placeholder="Filter by hash..."
                class="hover-border-accent py-8px px-12px border-1 border-radius-8px bg-card color-text-primary text-13px transition-all-02 focus-outline-none focus-border-primary focus-ring focus-shadow min-w-150px placeholder-tertiary"
              />
            </div>
          </div>

          <div v-if="transactions.length === 0" class="flex-align-justify-center flex-column color-text-tertiary border-radius-12px bg-card border-1 py-64px px-32px">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="mb-16px opacity-55">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
            </svg>
            <p>No recent transactions</p>
          </div>

          <div v-else class="w-full">
            <div class="explorer-table-recipe explorer-table-header-recipe grid-cols-15fr-08fr-08fr-08fr-09fr-1fr">
              <div class="">Transaction Hash</div>
              <div class="">Type</div>
              <div class="">Result</div>
              <div class="">Height</div>
              <div class="">Fee</div>
              <div class="">Time</div>
            </div>
            
            <div class="max-h-600px flex flex-column overflow-y-auto">
              <div v-for="tx in filteredTransactions" :key="tx.hash" class="explorer-table-recipe explorer-table-row-recipe grid-cols-15fr-08fr-08fr-08fr-09fr-1fr active-scale-998 reveal-on-hover hover-bg-secondary hover-cursor-default last-border-bottom-none flex-inline-align-center bg-black-a04-active">
                <div class="reveal-on-hover flex-align-center gap-8px text-13px text-14px">
                  <div class="hover-color-accent reveal-on-hover flex-inline-align-center gap-8px cursor-pointer transition-all-02 pr-8px" @click="navigateToTransaction(tx.hash)" title="View transaction details">
                    <svg class="animate-icon-bounce color-text-tertiary flex-shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                    </svg>
                    <code class="reveal-hash-code-target color-text-secondary bg-secondary border-radius-4px mono py-4px px-6px text-10px">{{ shortenHash(tx.hash) }}</code>
                    <svg class="opacity-40 reveal-opacity-color-accent-target color-text-tertiary flex-shrink-0 transition-opacity-02" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                    </svg>
                  </div>
                  <UiButton variant="icon" @click.stop="copyToClipboard(tx.hash, 'Transaction hash')" title="Copy hash" class="size-24px">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </UiButton>
                </div>
                <div class="flex-align-center text-13px text-14px">
                  <span class="text-12px txt-weight-light border-radius-4px py-4px px-12px bg-fill-blue color-accent-secondary">{{ tx.type }}</span>
                </div>
                <div class="flex-align-center text-13px text-14px">
                  <span class="flex-inline-align-center text-12px txt-weight-light gap-6px border-radius-4px py-4px px-12px" :class="tx.success ? 'success bg-fill-success' : 'failed bg-fill-error'">
                    <svg class="w-14px h-14px" v-if="tx.success" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    {{ tx.success ? 'Success' : 'Failed' }}
                  </span>
                </div>
                <div class="flex-align-center text-13px text-14px">
                  <span class="transition-color-02 hover-underline color-primary txt-weight-light cursor-pointer text-13px hover-color-accent-secondary" @click="navigateToBlock(tx.height)">{{ formatNumber(tx.height) }}</span>
                </div>
                <div class="flex-align-center text-13px text-14px">
                  <span class="text-12px color-text-primary fw-500 mono">{{ tx.fee || '—' }}</span>
                </div>
                <div class="flex-align-center text-13px text-14px">
                  <span class="text-12px color-text-secondary">{{ formatTimeAgo(tx.time) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Validators View -->
        <div v-else-if="currentView === 'validators'" class="border-radius-12px p-32px bg-transparent overflow-visible">
          <div class="mb-32px">
            <h2 class="text-28px txt-weight-medium color-text-primary mb-8px">Active Validators</h2>
            <p class="color-text-tertiary text-14px">{{ validators.length }} validators securing the network</p>
          </div>

          <UiCard padding="none" :shadow="false" class="overflow-hidden shadow-sm backdrop-blur">
            <div class="explorer-table-recipe explorer-table-header-recipe grid-cols-50-220-200-120-160-100-110-120">
              <div class="">#</div>
              <div class="">VALIDATOR</div>
              <div class="">VOTING POWER %</div>
              <div class="">24H CHANGES</div>
              <div class="">CUMULATIVE SHARE %</div>
              <div class="">COMM. %</div>
              <div class="">UPTIME %</div>
              <div class="">ACTIONS</div>
            </div>
            
            <div class="max-h-600px flex flex-column overflow-y-auto">
              <div v-for="(validator, index) in validators" :key="validator.address" class="explorer-table-recipe explorer-table-row-recipe grid-cols-50-220-200-120-160-100-110-120 active-scale-998 hover-bg-secondary hover-cursor-default last-border-bottom-none flex-inline-align-center bg-black-a04-active">
                <div class="flex-align-center text-13px text-14px">
                  <span class="txt-weight-light color-text-secondary text-15px">{{ index + 1 }}</span>
                </div>
                <div class="flex-align-center text-13px text-14px">
                  <div class="flex-align-center gap-12px">
                    <div class="bg-gradient-indigo-purple flex-align-justify-center size-36px border-radius-circle txt-weight-medium color-white text-24px overflow-hidden text-13px flex-shrink-0 border-2">
                      <img class="w-full h-full object-fit-cover" v-if="validator.avatar" :src="validator.avatar" :alt="validator.moniker" />
                      <span v-else>{{ validator.moniker.substring(0, 2).toUpperCase() }}</span>
                    </div>
                    <div class="flex flex-column gap-4px">
                      <span class="txt-weight-light color-text-primary text-18px text-14px">{{ validator.moniker }}</span>
                      <span class="transition-color-02 color-text-tertiary cursor-pointer mt-8px pt-12px text-11px border-top-1 mono hover-color-primary" @click.stop="copyToClipboard(validator.address, 'Validator address')" title="Click to copy address">{{ shortenAddress(validator.address) }}</span>
                    </div>
                  </div>
                </div>
                <div class="flex-align-center text-13px text-14px">
                  <div class="flex flex-column gap-4px w-full">
                    <div class="txt-weight-medium color-text-primary text-15px mb-4px">{{ getVotingPowerPercentage(validator.tokens) }}%</div>
                    <div class="h-5px w-full bg-border border-radius-4px overflow-hidden mb-4px">
                      <div class="bg-gradient-voting-power h-full border-radius-4px transition-width-03" :style="{ width: getVotingPowerPercentage(validator.tokens) + '%' }"></div>
                    </div>
                    <div class="color-text-tertiary fw-500 text-11px">{{ formatVotingPower(validator.tokens) }} LMN</div>
                  </div>
                </div>
                <div class="flex-align-center text-13px text-14px">
                  <span class="txt-weight-light text-14px">—</span>
                </div>
                <div class="flex-align-center text-13px text-14px">
                  <div class="flex-align-justify-center relative size-64px">
                    <svg class="block filter-none" width="66" height="66" viewBox="0 0 66 66">
                      <circle cx="33" cy="33" r="27" fill="none" stroke="var(--border-color)" stroke-width="4"></circle>
                      <circle
                        cx="33" cy="33" r="27"
                        fill="none"
                        stroke="var(--color-primary)"
                        stroke-width="4"
                        :stroke-dasharray="getCumulativeDashArray(index)"
                        transform="rotate(-90 33 33)"
                        stroke-linecap="round"
                      ></circle>
                    </svg>
                    <span class="flex-align-justify-center txt-weight-medium color-text-primary absolute inset-0 text-11px line-height-1 cursor-events-none">{{ getCumulativeProgress(index).toFixed(2) }}%</span>
                  </div>
                </div>
                <div class="flex-align-center text-13px text-14px">
                  <span class="txt-weight-light color-text-secondary text-14px">{{ (parseFloat(validator.commission) * 100).toFixed(2) }}%</span>
                </div>
                <div class="flex-align-center text-13px text-14px">
                  <span class="txt-weight-light color-text-secondary text-14px">{{ getUptimeLabel(validator.address) }}</span>
                </div>
                <div class="flex-align-center flex-align-justify-center text-13px text-14px">
                  <UiButton
                    variant="primary"
                    size="sm"
                    :disabled="!hasActiveProfile"
                    @click="openStakeModal(validator, 'Delegate')"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="8" x2="12" y2="16"/>
                      <line x1="8" y1="12" x2="16" y2="12"/>
                    </svg>
                    Manage
                  </UiButton>
                </div>
              </div>
            </div>
          </UiCard>
        </div>
      </template>
    </main>
    
    <!-- Copy Notification -->
    <div v-if="showCopyNotification" class="right-2rem animate-slide-in-up flex-align-center gap-8px txt-weight-light fixed py-12px px-20px color-white border-radius-8px text-14px bg-success z-9999 bottom-32px shadow-success">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <span>{{ copiedText }} copied!</span>
    </div>

    <!-- Stake Management Modal -->
    <UiModal :model-value="showStakeModal" :title="`Manage Stake with ${selectedValidator?.moniker}`" panel-class="shadow-lg animate-modal-slide-in w-90pct max-w-420px" @update:model-value="closeStakeModal">
          <div class="flex gap-16px mb-24px p-16px bg-secondary border-radius-8px">
            <div class="flex flex-column flex-1 gap-4px">
              <span class="text-12px color-text-secondary fw-500">Staked:</span>
              <span class="color-text-primary txt-weight-medium text-14px">{{ stakedBalance }} LMN</span>
            </div>
            <div class="flex flex-column flex-1 gap-4px">
              <span class="text-12px color-text-secondary fw-500">Balance:</span>
              <span class="color-text-primary txt-weight-medium text-14px">{{ availableBalance }} LMN</span>
            </div>
          </div>

          <div class="flex gap-8px mb-24px p-4px bg-secondary border-radius-8px">
            <button 
              v-for="action in stakeActions" 
              :key="action"
              class="color-text-primary-hover-not-disabled-not-active flex-1 txt-weight-light color-text-secondary cursor-pointer py-8px px-12px bg-transparent border-none border-radius-6px text-13px transition-all-02"
              :class="{ 'active bg-accent color-white': currentStakeAction === action }"
              @click="currentStakeAction = action as 'Delegate' | 'Undelegate' | 'Redelegate' | 'Withdraw'"
            >
              {{ action }}
            </button>
          </div>

          <div class="flex flex-column gap-20px">
            <!-- Withdraw Rewards - No amount needed -->
            <div v-if="currentStakeAction === 'Withdraw'" class="p-0px pt-8px pb-8px">
              <div class="flex-align-start gap-12px p-16px border-radius-10px bg-primary-a10 border-1-primary-a15">
                <svg class="flex-shrink-0 color-primary mt-4px" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 16v-4"/>
                  <path d="M12 8h.01"/>
                </svg>
                <div class="flex flex-column gap-4px">
                  <strong class="text-15px txt-weight-light color-text-primary">Withdraw Staking Rewards</strong>
                  <p class="m-0px text-13px color-text-secondary line-height-14">This will claim all pending rewards from this validator to your wallet.</p>
                </div>
              </div>
            </div>

            <!-- Amount Input - Not for Withdraw -->
            <div v-else class="flex flex-column gap-8px">
              <label class="text-14px txt-weight-light color-text-primary">Amount to {{ currentStakeAction.toLowerCase() }}</label>
              <div class="flex-align-center relative">
                <UiInput bg-class="bg-secondary" font-size-class="txt-weight-light" padding-class="pt-12px pr-64px pb-12px pl-16px" :focus-ring="false" type="number" 
                  v-model="stakeAmount" 
                  :placeholder="`0.0`"
                 
                  step="0.000001"
                  min="0" class="text-15px focus-outline-none focus-ring focus-shadow" />
                <span class="txt-weight-light color-text-secondary absolute text-14px right-16px">LMN</span>
              </div>
              <div class="flex flex-column gap-8px p-0px pt-8px pb-8px">
                <input 
                  type="range" 
                  v-model="stakePercentage" 
                  min="0" 
                  max="100" 
                  class="slider-thumb-accent w-full outline-none border-radius-4px bg-border h-6px appearance-none"
                />
                <div class="flex-justify-space-between color-text-tertiary text-11px">
                  <span>0%</span>
                  <span>50%</span>
                  <span>Max</span>
                </div>
              </div>
              <div class="grid-cols-4-1fr gap-8px grid">
                <UiButton variant="secondary" @click="setStakePercentage(25)" class="hover-bg-primary-a10">25%</UiButton>
                <UiButton variant="secondary" @click="setStakePercentage(50)" class="hover-bg-primary-a10">50%</UiButton>
                <UiButton variant="secondary" @click="setStakePercentage(75)" class="hover-bg-primary-a10">75%</UiButton>
                <UiButton variant="secondary" @click="setStakePercentage(100)" class="hover-bg-primary-a10">Max</UiButton>
              </div>
            </div>

            <div v-if="currentStakeAction === 'Redelegate'" class="flex flex-column gap-8px">
              <label class="text-14px txt-weight-light color-text-primary">Select New Validator</label>
              <select v-model="targetValidator" class="w-full color-text-primary cursor-pointer py-12px px-16px bg-secondary border-1 border-radius-8px text-14px transition-all-02 focus-outline-none focus-border-primary focus-ring focus-shadow">
                <option value="">Choose validator...</option>
                <option v-for="val in validators.filter(v => v.address !== selectedValidator?.address)" :key="val.address" :value="val.address">
                  {{ val.moniker }}
                </option>
              </select>
            </div>

            <div class="" v-if="showAdvancedOptions">
              <UiButton variant="secondary" @click="showAdvancedOptions = !showAdvancedOptions" class="hover-border-accent hover-color-accent">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 1v6m0 6v6"/>
                </svg>
                Advanced Options
              </UiButton>
            </div>

            <!-- Transaction Status Popup -->
            <div v-if="txStatus !== 'idle'" class="z-10001 animate-popup-fade-in p-32px fixed bg-primary border-radius-16px top-half left-half translate-center shadow-lg min-w-400px max-w-90vw" :style="txStatusPopupStyle(txStatus)">
              <div class="flex-align-center flex-column gap-24px text-center">
                <!-- Processing -->
                <div v-if="txStatus === 'processing'" class="flex flex-column flex-inline-align-center gap-16px w-full">
                  <UiSpinner size="lg" />
                  <div class="flex flex-column gap-8px">
                    <strong class="text-18px color-text-primary txt-weight-medium">Processing Transaction</strong>
                    <p class="word-wrap-break text-14px color-text-secondary m-0px max-w-320px">{{ txMessage }}</p>
                  </div>
                </div>

                <!-- Success -->
                <div v-else-if="txStatus === 'success'" class="flex flex-column flex-inline-align-center gap-16px w-full">
                  <svg class="animate-icon-bounce color-text-tertiary flex-shrink-0" width="48" height="48" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="rgba(var(--color-success-rgb), 0.7)" stroke-width="2"/>
                    <path d="M8 12l3 3 5-5" stroke="rgba(var(--color-success-rgb), 0.7)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <div class="flex flex-column gap-8px">
                    <strong class="text-18px color-text-primary txt-weight-medium">Transaction Successful!</strong>
                    <p class="word-wrap-break text-14px color-text-secondary m-0px max-w-320px">{{ txMessage }}</p>
                    <div v-if="txHash" class="w-full mt-12px p-12px bg-secondary border-radius-8px border-1">
                      <small class="block text-11px color-text-tertiary mb-4px text-uppercase letter-spacing-005em">Transaction Hash:</small>
                      <UiButton variant="none" @click="viewTransaction(txHash)" class="reveal-on-hover hover-translate-x-2px flex-align-center gap-8px cursor-pointer w-full">
                        <code class="flex-1 mono text-12px color-primary break-all txt-weight-light">{{ txHash }}</code>
                        <svg class="reveal-target flex-shrink-0 color-primary opacity-70 transition-opacity-02" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                          <polyline points="15 3 21 3 21 9"/>
                          <line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                      </UiButton>
                    </div>
                  </div>
                  <button class="mt-16px txt-weight-light cursor-pointer bg-accent color-white border-none border-radius-6px text-14px transition-all-02 hover-lift-1 py-10px px-32px hover-shadow-primary" @click="closeStakeModal">Close</button>
                </div>

                <!-- Error -->
                <div v-else-if="txStatus === 'error'" class="flex flex-column flex-inline-align-center gap-16px w-full">
                  <svg class="animate-icon-bounce color-text-tertiary flex-shrink-0" width="48" height="48" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="var(--color-error)" stroke-width="2"/>
                    <path d="M12 8v4m0 4h.01" stroke="var(--color-error)" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                  <div class="flex flex-column gap-8px">
                    <strong class="text-18px color-text-primary txt-weight-medium">Transaction Failed</strong>
                    <p class="word-wrap-break text-14px color-text-secondary m-0px max-w-320px">{{ txMessage }}</p>
                  </div>
                  <UiButton variant="primary" class="mt-8px" @click="txStatus = 'idle'">Try Again</UiButton>
                </div>
              </div>
            </div>

            <UiButton
              variant="primary"
              block
              @click="() => confirmStakeAction()"
              :disabled="!canConfirm || isProcessingTx"
            >
              <span v-if="!isProcessingTx">Confirm {{ currentStakeAction }}</span>
              <span v-else>Processing...</span>
            </UiButton>
          </div>
    </UiModal>

    </template>
  </div>
</template>

<script setup lang="ts">
import UiInput from '../../ui/UiInput.vue';
import UiModal from '../../ui/UiModal.vue';
import UiCard from '../../ui/UiCard.vue';
import UiButton from '../../ui/UiButton.vue';
import UiSpinner from '../../ui/UiSpinner.vue';
import UiLoadingBlock from '../../ui/UiLoadingBlock.vue';
import UiSidebarNavSection from '../../ui/UiSidebarNavSection.vue';
import UiSidebarNavItem from '../../ui/UiSidebarNavItem.vue';
import UiStatTile from '../../ui/UiStatTile.vue';
import UiChartCard from '../../ui/UiChartCard.vue';
import UiLegendItem from '../../ui/UiLegendItem.vue';
import UiFilterButton from '../../ui/UiFilterButton.vue';
import { ref, computed, onMounted, onUnmounted, watch, inject } from 'vue';
import { useTabLoadingSync } from '../useTabLoading';
import BlockDetailPage from './BlockDetailPage.vue';
import TransactionDetailPage from './TransactionDetailPage.vue';
import AddressDetailPage from './AddressDetailPage.vue';
import { profilesState, activeProfileId } from '../profilesStore';
import InternalSidebar from '../../components/InternalSidebar.vue';
import { LayoutGrid, Search } from 'lucide-vue-next';
import { useToast } from '../../composables/useToast';
import { fromBase64, toBech32 } from '@cosmjs/encoding';
import { useInternalLumen } from '../../composables/useInternalLumen';
import { copyToClipboard as copyToClipboardShared } from '../../composables/useClipboard';

const toast = useToast();
const lumen = useInternalLumen();
const openInNewTab = inject<((url: string) => void) | null>('openInNewTab', null);
const currentTabUrl = inject<any>('currentTabUrl', null);
const currentTabRefresh = inject<any>('currentTabRefresh', null);

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

useTabLoadingSync(isLoading);

// Filter states
const blockFilter = ref<'all' | 'recent' | 'with-txs' | 'empty'>('all');
const blockHeightFilter = ref('');
const txTypeFilter = ref<'all' | 'send' | 'delegate' | 'vote' | 'other'>('all');
const txStatusFilter = ref<'all' | 'success' | 'failed'>('all');
const txHashFilter = ref('');



const latestBlock = ref(0);
const validatorCount = ref(0);
const avgBlockTime = ref<number | null>(null);

const avgBlockTimeLabel = computed(() => {
  const v = avgBlockTime.value;
  if (v == null || !Number.isFinite(v) || v <= 0) return '—';
  return `${v.toFixed(2)}s`;
});

const avgBlockTimeLabelShort = computed(() => {
  const v = avgBlockTime.value;
  if (v == null || !Number.isFinite(v) || v <= 0) return '—';
  return `~${v.toFixed(1)}s`;
});

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
  consensusPubkeyB64?: string;
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

function txStatusPopupStyle(status: string): Record<string, string> {
  if (status === 'success') return { border: '2px solid rgba(var(--color-success-rgb), 0.5)' };
  if (status === 'error') return { border: '2px solid var(--color-error)' };
  return { border: '2px solid var(--color-primary)' };
}
const txHash = ref('');

const bondedTokens = ref<number | null>(null);
const unbondedTokens = ref<number | null>(null);
const totalSupply = ref<number | null>(null);

const bondedRatioPct = computed<number | null>(() => {
  const bonded = bondedTokens.value;
  const supply = totalSupply.value;
  if (bonded == null || supply == null) return null;
  if (!Number.isFinite(bonded) || !Number.isFinite(supply) || supply <= 0) return null;
  const pct = (bonded / supply) * 100;
  if (!Number.isFinite(pct) || pct < 0) return null;
  return Math.min(100, pct);
});

const bondedRatioLabel = computed(() => {
  const pct = bondedRatioPct.value;
  if (pct == null) return '—';
  return `${pct.toFixed(1)}%`;
});

type TxHistoryWindow = 5 | 10 | 15 | 20;
const txHistoryWindow = ref<TxHistoryWindow>(10);

const txHistoryPoints = computed(() => {
  const windowSize = txHistoryWindow.value;
  const slice = blocks.value.slice(0, windowSize);
  // Oldest -> newest for a nicer left-to-right chart.
  return slice.map((b) => Number(b?.txCount || 0) || 0).reverse();
});

const txHistoryTotal = computed(() => txHistoryPoints.value.reduce((sum, n) => sum + n, 0));

const txHistoryTitle = computed(() => `Txs per block (last ${txHistoryWindow.value} blocks)`);
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

const othersPercentage = computed(() => {
  const top5Total = topValidatorsPower.value.slice(0, 5).reduce((sum, vp) => sum + parseFloat(vp.percentage), 0);
  return (100 - top5Total).toFixed(2);
});
const latestProposer = ref({ moniker: 'Unknown', avatar: '', blockHeight: 0 });
const txHistoryChart = ref<HTMLCanvasElement | null>(null);
const bondedSupplyChart = ref<HTMLCanvasElement | null>(null);
const votingPowerChart = ref<HTMLCanvasElement | null>(null);
const copiedText = ref('');
const showCopyNotification = ref(false);

const CUMULATIVE_RADIUS = 27;
const CUMULATIVE_CIRCUMFERENCE = 2 * Math.PI * CUMULATIVE_RADIUS;

function getCumulativeDashArray(index: number): string {
  const pct = getCumulativeProgress(index);
  const clamped = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  const filled = (clamped / 100) * CUMULATIVE_CIRCUMFERENCE;
  return `${filled} ${CUMULATIVE_CIRCUMFERENCE}`;
}

const validatorUptimePctByValoper = ref<Record<string, string>>({});
const uptimeLoading = ref(false);
let lastUptimeFetchAt = 0;
const UPTIME_REFRESH_MS = 60_000;
const UPTIME_RETRY_MS = 15_000;

async function valconsAddressFromPubkeyBase64(pubKeyB64: string): Promise<string | null> {
  const key = String(pubKeyB64 || '').trim();
  if (!key) return null;
  try {
    const pub = fromBase64(key);
    const digest = await crypto.subtle.digest('SHA-256', pub);
    const hash = new Uint8Array(digest).slice(0, 20);
    return toBech32('lmnvalcons', hash);
  } catch {
    return null;
  }
}

function getUptimeLabel(valoper: string): string {
  const key = String(valoper || '').trim();
  if (!key) return '—';
  const label = validatorUptimePctByValoper.value?.[key];
  if (label) return label;
  return uptimeLoading.value ? '…' : '—';
}

async function fetchValidatorUptime({ force = false } = {}) {
  if (uptimeLoading.value) return;
  if (!lumen?.net?.restGet) return;
  if (!validators.value.length) return;

  const now = Date.now();
  const hasCached = Object.keys(validatorUptimePctByValoper.value || {}).length > 0;
  const throttleMs = hasCached ? UPTIME_REFRESH_MS : UPTIME_RETRY_MS;
  if (!force && lastUptimeFetchAt && now - lastUptimeFetchAt < throttleMs) return;
  lastUptimeFetchAt = now;

  uptimeLoading.value = true;
  try {
    const paramsRes = await lumen.net.restGet('/cosmos/slashing/v1beta1/params', { timeout: 15000 });
    const windowRaw =
      paramsRes?.json?.params?.signed_blocks_window ??
      paramsRes?.json?.params?.signedBlocksWindow ??
      null;
    const window = safeBigInt(windowRaw);
    if (!paramsRes?.ok || window <= 0n) return;

    const valoperToCons = new Map<string, string>();
    const needed = new Set<string>();

    await Promise.all(
      validators.value.map(async (v) => {
        const pubKeyB64 = String(v.consensusPubkeyB64 || '').trim();
        if (!pubKeyB64) return;
        const cons = await valconsAddressFromPubkeyBase64(pubKeyB64);
        if (!cons) return;
        valoperToCons.set(v.address, cons);
        needed.add(cons);
      })
    );

    if (!needed.size) return;

    const missedByCons = new Map<string, bigint>();
    let nextKey: string | null = null;

    for (let page = 0; page < 10 && needed.size; page++) {
      let path = '/cosmos/slashing/v1beta1/signing_infos?pagination.limit=2000';
      if (nextKey) path += `&pagination.key=${encodeURIComponent(nextKey)}`;

      const infosRes = await lumen.net.restGet(path, { timeout: 15000 });
      if (!infosRes?.ok) break;

      const infos = Array.isArray(infosRes.json?.info)
        ? infosRes.json.info
        : Array.isArray(infosRes.json?.signing_infos)
          ? infosRes.json.signing_infos
          : Array.isArray(infosRes.json?.signingInfos)
            ? infosRes.json.signingInfos
            : [];

      for (const info of infos) {
        const addr = String(info?.address || '').trim();
        if (!addr || !needed.has(addr)) continue;
        const missedRaw = info?.missed_blocks_counter ?? info?.missedBlocksCounter ?? '0';
        missedByCons.set(addr, safeBigInt(missedRaw));
        needed.delete(addr);
      }

      const nk = infosRes.json?.pagination?.next_key ?? infosRes.json?.pagination?.nextKey ?? null;
      nextKey = typeof nk === 'string' && nk ? nk : null;
      if (!nextKey) break;
    }

    const out: Record<string, string> = {};
    for (const [valoper, cons] of valoperToCons.entries()) {
      const missed = missedByCons.get(cons);
      if (missed == null) continue;
      const m = missed > window ? window : missed;
      const signed = window - m;
      const bp = (signed * 10000n) / window;
      out[valoper] = `${(Number(bp) / 100).toFixed(2)}%`;
    }
    validatorUptimePctByValoper.value = out;
  } finally {
    uptimeLoading.value = false;
  }
}

function recomputeAvgBlockTimeFromBlocks() {
  const list = blocks.value;
  if (!Array.isArray(list) || list.length < 2) {
    avgBlockTime.value = null;
    return;
  }

  const diffs: number[] = [];
  for (let i = 0; i < list.length - 1; i++) {
    const t0 = Date.parse(String(list[i]?.time || ''));
    const t1 = Date.parse(String(list[i + 1]?.time || ''));
    if (!Number.isFinite(t0) || !Number.isFinite(t1)) continue;
    const diffSec = (t0 - t1) / 1000;
    // Ignore bogus gaps.
    if (diffSec > 0 && diffSec < 600) diffs.push(diffSec);
  }

  if (!diffs.length) {
    avgBlockTime.value = null;
    return;
  }

  avgBlockTime.value = diffs.reduce((a, b) => a + b, 0) / diffs.length;
}

function maybeDecodeBase64(input: any): string {
  const raw = String(input || '');
  if (!raw) return '';
  // Tendermint RPC often base64-encodes event attributes. Keep a conservative heuristic to avoid mangling.
  if (!/^[A-Za-z0-9+/=]+$/.test(raw) || raw.length < 4 || raw.length % 4 !== 0) return raw;
  try {
    const decoded = atob(raw);
    if (!decoded) return raw;
    // If decoded contains lots of control characters, treat as not base64.
    let printable = 0;
    for (let i = 0; i < decoded.length; i++) {
      const c = decoded.charCodeAt(i);
      if (c === 9 || c === 10 || c === 13 || (c >= 32 && c < 127)) printable += 1;
    }
    if (printable / decoded.length < 0.85) return raw;
    return decoded;
  } catch {
    return raw;
  }
}

function inferTxType(txResult: any): string {
  try {
    const events = Array.isArray(txResult?.events) ? txResult.events : [];
    for (const ev of events) {
      const attrs = Array.isArray(ev?.attributes) ? ev.attributes : [];
      for (const a of attrs) {
        const key = maybeDecodeBase64(a?.key).toLowerCase();
        if (key !== 'action') continue;
        const valRaw = String(maybeDecodeBase64(a?.value) || '').trim();
        if (!valRaw) continue;
        const s1 = valRaw.split('/').filter(Boolean).pop() || valRaw;
        const s2 = s1.split('.').filter(Boolean).pop() || s1;
        return s2 || 'Tx';
      }
    }
  } catch {
    // ignore
  }
  return 'Tx';
}

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
          lumen.net.rpcGet(`/block?height=${height}`)
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
    recomputeAvgBlockTimeFromBlocks();
    
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
      const blockRes = await lumen.net.rpcGet(`/block?height=${block.height}`);
      
      if (blockRes.ok && blockRes.json?.result?.block?.data?.txs) {
        const txs = blockRes.json.result.block.data.txs;
        const blockResultsRes = await lumen.net.rpcGet(`/block_results?height=${block.height}`);
        
        for (let i = 0; i < txs.length; i++) {
          const txData = txs[i];
          const txHash = await getTxHash(txData);
          const txResults = blockResultsRes.json?.result?.txs_results;
          const txResult = txResults?.[i];
          
          txList.push({
            hash: txHash,
            type: inferTxType(txResult),
            height: block.height,
            success: !txResult || txResult.code === 0,
            time: block.time,
          });
        }
      }
      
      if (txList.length >= 20) break;
    }
    
    transactions.value = txList.slice(0, 20);
    
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
    const valSetRes = await lumen.net.rpcGet('/validators');
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
    
    const res = await lumen.net.restGet(
      `/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=100`
    );
    
    if (res.ok && res.json?.validators) {
      const validatorsList = res.json.validators;
      
      const valSet2Res = await lumen.net.rpcGet('/validators');
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
            keybaseId: keybaseId,
            consensusPubkeyB64: String(v.consensus_pubkey?.key || '')
          };
        });
      
      validatorCount.value = validators.value.length;
      
      const totalVotingPower = validators.value.reduce((sum, v) => sum + BigInt(v.tokens), BigInt(0));
      topValidatorsPower.value = validators.value.slice(0, 5).map(v => ({
        moniker: v.moniker,
        percentage: ((Number(BigInt(v.tokens) * BigInt(10000) / totalVotingPower) / 100).toFixed(2))
      }));
      
      fetchKeybaseAvatars();
      if (currentView.value === 'validators') {
        void fetchValidatorUptime({ force: true });
      }
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

const ULMN_PER_LMN = 1_000_000n;
const SUPPLY_REFRESH_MS = 60_000;
const SUPPLY_RETRY_MS = 15_000;
let lastSupplyFetchAt = 0;

function ulmnStringToLmnNumber(input: any): number | null {
  const raw = String(input ?? '').trim();
  if (!raw) return null;
  try {
    const ulmn = BigInt(raw);
    const whole = ulmn / ULMN_PER_LMN;
    const frac = ulmn % ULMN_PER_LMN;
    return Number(whole) + Number(frac) / 1_000_000;
  } catch {
    return null;
  }
}

async function fetchSupplyStats({ force = false } = {}) {
  if (!lumen?.net?.restGet) return;

  const now = Date.now();
  const hasAnyCached = bondedTokens.value != null || totalSupply.value != null;
  const throttleMs = hasAnyCached ? SUPPLY_REFRESH_MS : SUPPLY_RETRY_MS;
  if (!force && lastSupplyFetchAt && now - lastSupplyFetchAt < throttleMs) return;
  lastSupplyFetchAt = now;

  let bondedLmn: number | null = null;
  try {
    const poolRes = await lumen.net.restGet('/cosmos/staking/v1beta1/pool', { timeout: 15000 });
    const pool = poolRes?.json?.pool || poolRes?.json?.Pool || null;
    const bondedRaw = pool?.bonded_tokens ?? pool?.bondedTokens ?? null;
    bondedLmn = ulmnStringToLmnNumber(bondedRaw);
    if (bondedLmn != null && Number.isFinite(bondedLmn)) bondedTokens.value = bondedLmn;
  } catch {
    // ignore
  }

  let supplyLmn: number | null = null;
  const supplyPaths = [
    '/cosmos/bank/v1beta1/supply/by_denom?denom=ulmn',
    '/cosmos/bank/v1beta1/supply/by_denom/ulmn',
  ];

  for (const p of supplyPaths) {
    try {
      const supplyRes = await lumen.net.restGet(p, { timeout: 15000 });
      if (!supplyRes?.ok) continue;
      const amount = supplyRes?.json?.amount || supplyRes?.json?.supply || null;
      const supplyRaw = amount?.amount ?? amount?.Amount ?? null;
      supplyLmn = ulmnStringToLmnNumber(supplyRaw);
      if (supplyLmn != null && Number.isFinite(supplyLmn)) {
        totalSupply.value = supplyLmn;
        break;
      }
    } catch {
      // ignore
    }
  }

  const bonded = bondedTokens.value;
  const supply = totalSupply.value;
  if (bonded != null && supply != null && Number.isFinite(bonded) && Number.isFinite(supply)) {
    unbondedTokens.value = Math.max(0, supply - bonded);
  } else {
    unbondedTokens.value = null;
  }
}

async function fetchAllData() {
  isLoading.value = true;
  
  try {
    await fetchValidators();
    await fetchBlocks();
    await fetchSupplyStats({ force: true });
    if (currentView.value === 'transactions' || currentView.value === 'overview') {
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
    toast.info(`Navigating to block ${height}...`);
  }
  else if (/^[A-Fa-f0-9]{64}$/.test(query)) {
    navigateToTransaction(query.toUpperCase());
    toast.info('Navigating to transaction...');
  }
  else if (/^lmn1[a-z0-9]{38,}$/.test(query)) {
    navigateToAddress(query);
    toast.info('Navigating to address...');
  }
  else {
    toast.error('Invalid search query. Use block height, tx hash (64 hex), or address (lmn1...)');
  }
}

function formatNumber(num: number | null | undefined): string {
  if (num == null) return '—';
  const n = Number(num);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat().format(n);
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

function safeBigInt(input: any): bigint {
  const raw = String(input ?? '').trim();
  if (!raw) return 0n;
  try {
    return BigInt(raw);
  } catch {
    return 0n;
  }
}

const totalVotingPowerUlmn = computed(() => validators.value.reduce((sum, v) => sum + safeBigInt(v.tokens), 0n));

function getVotingPowerPercentage(tokens: string): string {
  const total = totalVotingPowerUlmn.value;
  if (total <= 0n) return '0.00';
  const t = safeBigInt(tokens);
  const bp = (t * 10000n) / total; // basis points
  return (Number(bp) / 100).toFixed(2);
}

function getCumulativeProgress(index: number): number {
  const total = totalVotingPowerUlmn.value;
  if (total <= 0n) return 0;
  let cum = 0n;
  for (let i = 0; i <= index && i < validators.value.length; i++) {
    cum += safeBigInt(validators.value[i]?.tokens);
  }
  const bp = (cum * 10000n) / total;
  return Number(bp) / 100;
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
    const walletApi = useInternalLumen()?.wallet;
    
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
  // Withdraw doesn't require amount
  if (currentStakeAction.value === 'Withdraw') {
    return hasActiveProfile.value;
  }
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
    const walletApi = useInternalLumen()?.wallet;
    
    if (!walletApi) {
      throw new Error('Wallet API not available');
    }
    
    let result;
    
    console.log(`Executing ${currentStakeAction.value}...`);
    console.log('Profile ID:', profileId);
    console.log('Address:', profileAddress);
    console.log('Validator:', selectedValidator.value.address);
    console.log('Amount (ulmn):', amountInUlmn);
    
    const baseParams = {
      profileId: profileId,
      address: profileAddress,
      validatorAddress: selectedValidator.value.address,
      amount: { amount: amountInUlmn, denom: 'ulmn' },
    };
    
    switch (currentStakeAction.value) {
      case 'Delegate':
        if (typeof walletApi.delegate === 'function') {
          result = await walletApi.delegate(baseParams);
        } else {
          throw new Error('Delegate function not available');
        }
        break;
        
      case 'Undelegate':
        if (typeof walletApi.undelegate === 'function') {
          result = await walletApi.undelegate(baseParams);
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
            amount: { amount: amountInUlmn, denom: 'ulmn' },
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
            validatorAddress: selectedValidator.value.address,
          });
        } else {
          throw new Error('WithdrawRewards function not available');
        }
        break;
    }
    
    console.log('Transaction result:', result);
    
    // Handle password_required error
    if (result?.ok === false && (result?.error === 'password_required' || result?.error === 'invalid_password')) {
      try { await useInternalLumen()?.security?.lockSession?.(); } catch {}
      txStatus.value = 'idle';
      txMessage.value = '';
      return;
    }
    
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

async function copyToClipboard(text: string, label: string = 'Text') {
  const ok = await copyToClipboardShared(text);
  if (ok) {
    toast.success(`${label} copied to clipboard`);
  } else {
    toast.error('Failed to copy to clipboard');
  }
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

        const points = txHistoryPoints.value;
        if (points.length >= 2) {
          const maxPoint = Math.max(...points, 1);
          ctx.beginPath();
          points.forEach((point, i) => {
            const x = (i / (points.length - 1)) * txHistoryChart.value!.width;
            const y = 120 - (point / maxPoint) * 100;
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
    }

    if (bondedSupplyChart.value) {
      const canvas = bondedSupplyChart.value;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = 140;
        canvas.height = 140;

        const centerX = 70;
        const centerY = 70;
        const radius = 58;
        const innerRadius = 41;

        const pct = bondedRatioPct.value;
        const startAngle = -Math.PI / 2;

        ctx.clearRect(0, 0, 140, 140);

        if (pct == null) {
          // Unknown ratio: render a neutral ring (avoid implying 0% bonded).
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
          ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI, true);
          ctx.closePath();
          ctx.fillStyle = 'rgba(148, 163, 184, 0.18)';
          ctx.fill();
        } else {
          const bondedPercentage = pct / 100;
          const bondedAngle = bondedPercentage * 2 * Math.PI;

          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, startAngle, startAngle + bondedAngle, false);
          ctx.lineTo(
            centerX + Math.cos(startAngle + bondedAngle) * innerRadius,
            centerY + Math.sin(startAngle + bondedAngle) * innerRadius
          );
          ctx.arc(centerX, centerY, innerRadius, startAngle + bondedAngle, startAngle, true);
          ctx.closePath();

          const gradient = ctx.createLinearGradient(0, 0, 140, 140);
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
    }

    if (votingPowerChart.value) {
      const canvas = votingPowerChart.value;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = 140;
        canvas.height = 140;

        const centerX = 70;
        const centerY = 70;
        const radius = 58;
        const innerRadius = 41;

        ctx.clearRect(0, 0, 140, 140);
        
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
        void fetchSupplyStats();
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

watch(currentView, (v) => {
  if (v === 'validators') {
    void fetchValidatorUptime({ force: true });
  }
});

watch(txHistoryWindow, () => {
  if (currentView.value === 'overview') {
    initializeCharts();
  }
});

// Watch for refresh signal from navbar
watch(
  () => currentTabRefresh?.value,
  () => {
    fetchAllData();
    if (currentView.value === 'overview') {
      initializeCharts();
    }
  }
);
</script>
