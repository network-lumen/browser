<template>
  <!-- ####### lumen://network NETWORK (explorer + live network data, merged) ####### -->
  <div class="internal-page flex">
    <!-- Show Block Detail if URL contains /block/ -->
    <BlockDetailPage v-if="isBlockDetailView" />

    <!-- Show Transaction Detail if URL contains /tx/ -->
    <TransactionDetailPage v-else-if="isTransactionDetailView" />

    <!-- Show Address Detail if URL contains /address/ -->
    <AddressDetailPage v-else-if="isAddressDetailView" />

    <!-- Show normal explorer/network view otherwise -->
    <template v-else>
    <!-- ####### lumen://network SIDEBAR ####### -->
    <InternalSidebar title="Network" :icon="Network" activeKey="network">
      <nav class="flex flex-column gap-12px">
        <UiSidebarNavSection title="Explorer">
          <UiSidebarNavItem reveal :active="currentView === 'overview'" @click="goToView('overview')">
            <PanelsTopLeft class="reveal-target flex-shrink-0 opacity-85" :size="18" />
            <span>Overview</span>
          </UiSidebarNavItem>
          <UiSidebarNavItem reveal :active="currentView === 'blocks'" @click="goToView('blocks')">
            <LayoutGrid class="reveal-target flex-shrink-0 opacity-85" :size="18" />
            <span>Blocks</span>
          </UiSidebarNavItem>
          <UiSidebarNavItem reveal :active="currentView === 'transactions'" @click="goToView('transactions')">
            <RotateCw class="reveal-target flex-shrink-0 opacity-85" :size="18" />
            <span>Transactions</span>
          </UiSidebarNavItem>
          <UiSidebarNavItem reveal :active="currentView === 'validators'" @click="goToView('validators')">
            <Users class="reveal-target flex-shrink-0 opacity-85" :size="18" />
            <span>Validators</span>
          </UiSidebarNavItem>
          <UiSidebarNavItem :active="currentView === 'params'" @click="goToView('params')">
            <SlidersHorizontal :size="18" />
            <span>Params</span>
          </UiSidebarNavItem>
          <UiSidebarNavItem reveal :active="currentView === 'governance'" @click="goToView('governance')">
            <Vote class="reveal-target flex-shrink-0 opacity-85" :size="18" />
            <span>Governance</span>
          </UiSidebarNavItem>
        </UiSidebarNavSection>
      </nav>
    </InternalSidebar>

    <!-- ####### lumen://network MAIN CONTENT ####### -->
    <main class="flex-1 p-24px overflow-y-auto bg-secondary">
      <template v-if="isExplorerBrowseView">
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
        <!-- ####### EXPLORER: OVERVIEW VIEW ####### -->
        <div v-if="currentView === 'overview'" class="border-radius-12px bg-transparent overflow-visible">
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
                <div class="mt-0px txt-weight-medium color-text-primary text-center text-16px">{{ latestProposer.moniker }}</div>
                <div class="letter-spacing-0025em color-text-tertiary text-center text-11px">Latest Block Proposer</div>
                <div class="w-full mt-8px">
                  <div class="gap-8px w-full grid grid-cols-1fr-1fr">
                    <div class="flex flex-column text-center gap-2px">
                      <span class="color-text-tertiary text-uppercase fw-500 text-13px">Block</span>
                      <span class="bg-gradient-accent-text txt-weight-medium color-text-primary text-24px gradient-text-clip">#{{ formatNumber(latestProposer.blockHeight) }}</span>
                    </div>
                    <div class="flex flex-column text-center gap-2px">
                      <span class="color-text-tertiary text-uppercase fw-500 text-13px">Block Time</span>
                      <span class="bg-gradient-accent-text txt-weight-medium color-text-primary text-24px gradient-text-clip">{{ avgBlockTimeLabelShort }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </UiChartCard>
          </div>

          <!-- Network Health & node stats (merged from the old standalone Network Status view) -->
          <!-- No "Validators" stat card here - already covered by the Voting
               Power chart above and the Validator Participation meter below,
               and the dedicated Validators tab covers the full list. -->
          <div class="mb-0px gap-12px grid mt-12px grid-cols-auto-fit-200">
            <UiStatCard label="Throughput" :detail="`Peak: ${networkMaxTps.toFixed(1)} tx/s`">
              {{ networkTps.toFixed(1) }} <span class="color-text-secondary txt-weight-normal text-18px ml-4px">tx/s</span>
            </UiStatCard>

            <UiStatCard label="Blocks/Hour" detail="Estimated from recent block time">
              {{ networkBlocksPerHour }}
            </UiStatCard>

            <UiStatCard label="24h Volume" detail="Estimated transaction count">
              {{ formatNumber(networkTxVolume24h) }}
            </UiStatCard>
          </div>

          <section class="bg-card border-1 border-radius-14px py-20px px-24px mt-12px">
            <h2 class="color-text-primary txt-weight-light text-18px m-0px mb-16px">Network Health</h2>
            <div class="gap-12px grid grid-cols-2">
              <UiMeterCard label="Chain Status" value="Synced">
                <template #fill>
                  <div class="h-full w-full border-radius-4px transition-width-03" :style="networkIndicatorFillStyle('excellent')"></div>
                </template>
              </UiMeterCard>

              <UiMeterCard label="Validator Participation" :value="`${networkValidatorPercent.toFixed(0)}%`">
                <template #fill>
                  <div class="h-full border-radius-4px transition-width-03" :style="{ width: networkValidatorPercent + '%', ...networkIndicatorFillStyle(networkValidatorPercent > 80 ? 'excellent' : networkValidatorPercent > 60 ? 'good' : 'normal') }"></div>
                </template>
              </UiMeterCard>

              <UiMeterCard label="Block Production" :value="networkBlockTimeStatus">
                <template #fill>
                  <div class="h-full border-radius-4px transition-width-03 w-85pct" :style="networkIndicatorFillStyle(networkBlockTimeStatus === 'fast' ? 'excellent' : networkBlockTimeStatus === 'normal' ? 'good' : 'normal')"></div>
                </template>
              </UiMeterCard>

              <UiMeterCard label="Peer Connections" :value="String(networkPeers)">
                <template #fill>
                  <div class="h-full border-radius-4px transition-width-03 w-70pct" :style="networkIndicatorFillStyle('good')"></div>
                </template>
              </UiMeterCard>
            </div>
          </section>

          <!-- Recent Activity -->
          <div class="mb-0px gap-12px grid mt-12px grid-cols-2">
            <UiCard padding="none" :shadow="false" class="p-20px shadow-sm backdrop-blur">
              <div class="flex-align-center-justify-space-between mb-12px">
                <h3 class="text-16px txt-weight-light color-text-primary">Latest Blocks</h3>
                <UiButton variant="primary" @click="goToView('blocks')">View All →</UiButton>
              </div>
              <div class="flex flex-column gap-12px">
                <div v-for="block in blocks.slice(0, 5)" :key="block.height" class="hover-bg-primary-a10 cursor-pointer flex-align-center gap-12px p-12px bg-secondary border-radius-8px transition-bg-02" @click="navigateToBlock(block.height)">
                  <div class="flex-align-justify-center size-32px color-primary border-radius-8px flex-shrink-0 bg-primary-a10">
                    <LayoutGrid :size="16" />
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
                <UiButton variant="primary" @click="goToView('transactions')">View All →</UiButton>
              </div>
              <div class="flex flex-column gap-12px">
                <div v-for="tx in transactions.slice(0, 5)" :key="tx.hash" class="hover-bg-primary-a10 cursor-pointer flex-align-center gap-12px p-12px bg-secondary border-radius-8px transition-bg-02" @click="navigateToTransaction(tx.hash)">
                  <div class="flex-align-justify-center size-32px color-primary border-radius-8px flex-shrink-0 bg-primary-a10">
                    <RotateCw :size="16" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="txt-weight-light color-text-primary text-14px mb-4px">{{ shortenHash(tx.hash) }}</div>
                    <div class="flex-align-center text-12px color-text-tertiary gap-8px">
                      <span class="color-primary txt-weight-light text-uppercase border-radius-4px text-10px py-0px px-8px bg-primary-a10">{{ tx.type }}</span>
                    </div>
                  </div>
                  <div class="flex-align-end flex-column gap-4px">
                    <TxStatusPill :success="tx.success" />
                    <div class="text-12px color-text-tertiary">{{ formatTimeAgo(tx.time) }}</div>
                  </div>
                </div>
              </div>
            </UiCard>
          </div>
        </div>

        <!-- ####### EXPLORER: BLOCKS VIEW ####### -->
        <div v-else-if="currentView === 'blocks'" class="border-radius-12px bg-transparent overflow-visible">
          <div class="flex-align-start flex-wrap-wrap gap-16px mb-16px flex-justify-space-between">
            <h2 class="text-20px txt-weight-medium color-text-primary m-0px">Blocks</h2>
            <div class="flex-align-center flex-wrap-wrap gap-8px">
              <select v-model="blockFilter" class="hover-border-accent cursor-pointer py-8px px-12px border-1 border-radius-8px bg-card color-text-primary text-13px transition-all-02 min-w-120px focus-outline-none focus-border-primary focus-ring focus-shadow">
                <option value="all">All Blocks</option>
                <option value="recent">Recent (Last 20)</option>
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
          </div>

          <div class="grid gap-12px grid-cols-auto-fit-280">
            <UiCard
              v-for="block in filteredBlocks"
              :key="block.height"
              padding="none"
              :shadow="false"
              border-class="border-1"
              radius="8px"
              padding-class="p-12px"
              hoverable
              hover-class="hover-bg-primary-a10 transition-bg-02"
              class="cursor-pointer flex-align-center gap-12px"
              @click="navigateToBlock(block.height)"
            >
              <div class="flex-align-justify-center size-32px color-primary border-radius-8px flex-shrink-0 bg-primary-a10">
                <LayoutGrid :size="16" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="txt-weight-light color-text-primary text-14px mb-4px">#{{ formatNumber(block.height) }}</div>
                <div class="flex-align-center text-12px color-text-tertiary gap-8px">
                  <img v-if="block.proposerAvatar" :src="block.proposerAvatar" class="border-radius-circle object-fit-cover w-16px h-16px" :alt="block.proposer" />
                  <span class="truncate">{{ block.proposer }}</span>
                </div>
              </div>
              <div class="flex-align-end flex-column gap-4px flex-shrink-0">
                <div class="txt-weight-light color-text-primary text-14px">{{ block.txCount }} txs</div>
                <div class="text-12px color-text-tertiary">{{ formatTimeAgo(block.time) }}</div>
              </div>
            </UiCard>
          </div>
        </div>

        <!-- ####### EXPLORER: TRANSACTIONS VIEW ####### -->
        <div v-else-if="currentView === 'transactions'" class="border-radius-12px bg-transparent bg-card overflow-visible">
          <div class="flex-align-start flex-wrap-wrap gap-16px border-bottom-1 flex-justify-space-between pt-24px pr-24px pb-16px pl-24px">
            <h2 class="text-24px txt-weight-medium color-text-primary m-0px flex-1 min-w-200px">Transactions</h2>
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
            <RotateCw :size="64" stroke-width="1.5" class="mb-16px opacity-55" />
            <p>No recent transactions</p>
          </div>

          <div v-else class="w-full">
            <div class="explorer-table-recipe explorer-table-header-recipe grid-cols-15fr-08fr-08fr-08fr-09fr-1fr">
              <div>Transaction Hash</div>
              <div>Type</div>
              <div>Result</div>
              <div>Height</div>
              <div>Fee</div>
              <div>Time</div>
            </div>
            
            <div class="max-h-600px flex flex-column overflow-y-auto">
              <div v-for="tx in filteredTransactions" :key="tx.hash" class="explorer-table-recipe explorer-table-row-recipe grid-cols-15fr-08fr-08fr-08fr-09fr-1fr active-scale-998 reveal-on-hover hover-bg-secondary hover-cursor-default last-border-bottom-none flex-inline-align-center bg-black-a04-active">
                <div class="reveal-on-hover flex-align-center gap-8px text-14px">
                  <div class="hover-color-accent reveal-on-hover flex-inline-align-center gap-8px cursor-pointer transition-all-02 pr-8px" @click="navigateToTransaction(tx.hash)" title="View transaction details">
                    <Activity class="animate-icon-bounce color-text-tertiary flex-shrink-0" :size="14" />
                    <code class="reveal-hash-code-target color-text-secondary bg-secondary border-radius-4px mono py-4px px-6px text-10px">{{ shortenHash(tx.hash) }}</code>
                    <Link class="opacity-40 reveal-opacity-color-accent-target color-text-tertiary flex-shrink-0 transition-opacity-02" :size="14" />
                  </div>
                  <UiButton variant="icon" @click.stop="copyToClipboard(tx.hash, 'Transaction hash')" title="Copy hash" class="size-24px">
                    <Copy :size="14" />
                  </UiButton>
                </div>
                <div class="flex-align-center text-14px">
                  <span class="text-12px txt-weight-light border-radius-4px py-4px px-12px bg-fill-blue color-accent-secondary">{{ tx.type }}</span>
                </div>
                <div class="flex-align-center text-14px">
                  <TxStatusPill :success="tx.success" />
                </div>
                <div class="flex-align-center text-14px">
                  <span class="transition-color-02 hover-underline color-primary txt-weight-light cursor-pointer text-13px hover-color-accent-secondary" @click="navigateToBlock(tx.height)">{{ formatNumber(tx.height) }}</span>
                </div>
                <div class="flex-align-center text-14px">
                  <span class="text-12px color-text-primary fw-500 mono">{{ tx.fee || '—' }}</span>
                </div>
                <div class="flex-align-center text-14px">
                  <span class="text-12px color-text-secondary">{{ formatTimeAgo(tx.time) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ####### EXPLORER: VALIDATORS VIEW ####### -->
        <div v-else-if="currentView === 'validators'" class="border-radius-12px p-32px bg-transparent overflow-visible">
          <UiCard padding="none" :shadow="false" class="overflow-hidden shadow-sm backdrop-blur">
            <div class="explorer-table-recipe explorer-table-header-recipe grid-cols-50-220-200-120-160-100-110-120">
              <div>#</div>
              <div>VALIDATOR</div>
              <div>VOTING POWER %</div>
              <div>24H CHANGES</div>
              <div>CUMULATIVE SHARE %</div>
              <div>COMM. %</div>
              <div>UPTIME %</div>
              <div>ACTIONS</div>
            </div>
            
            <div class="max-h-600px flex flex-column overflow-y-auto">
              <div v-for="(validator, index) in validators" :key="validator.address" class="explorer-table-recipe explorer-table-row-recipe grid-cols-50-220-200-120-160-100-110-120 active-scale-998 hover-bg-secondary hover-cursor-default last-border-bottom-none flex-inline-align-center bg-black-a04-active">
                <div class="flex-align-center text-14px">
                  <span class="txt-weight-light color-text-secondary text-15px">{{ index + 1 }}</span>
                </div>
                <div class="flex-align-center text-14px">
                  <div class="flex-align-center gap-12px">
                    <div class="bg-gradient-indigo-purple flex-align-justify-center size-36px border-radius-circle txt-weight-medium color-white text-24px overflow-hidden flex-shrink-0 border-2">
                      <img class="w-full h-full object-fit-cover" v-if="validator.avatar" :src="validator.avatar" :alt="validator.moniker" />
                      <span v-else>{{ validator.moniker.substring(0, 2).toUpperCase() }}</span>
                    </div>
                    <div class="flex flex-column gap-4px">
                      <span class="txt-weight-light color-text-primary text-18px">{{ validator.moniker }}</span>
                      <span class="transition-color-02 color-text-tertiary cursor-pointer mt-8px pt-12px text-11px border-top-1 mono hover-color-primary" @click.stop="copyToClipboard(validator.address, 'Validator address')" title="Click to copy address">{{ shortenAddress(validator.address) }}</span>
                    </div>
                  </div>
                </div>
                <div class="flex-align-center text-14px">
                  <div class="flex flex-column gap-4px w-full">
                    <div class="txt-weight-medium color-text-primary text-15px mb-4px">{{ getVotingPowerPercentage(validator.tokens) }}%</div>
                    <div class="h-5px w-full bg-border border-radius-4px overflow-hidden mb-4px">
                      <div class="bg-gradient-voting-power h-full border-radius-4px transition-width-03" :style="{ width: getVotingPowerPercentage(validator.tokens) + '%' }"></div>
                    </div>
                    <div class="color-text-tertiary fw-500 text-11px">{{ formatVotingPower(validator.tokens) }} LMN</div>
                  </div>
                </div>
                <div class="flex-align-center text-14px">
                  <span class="txt-weight-light text-14px">—</span>
                </div>
                <div class="flex-align-center text-14px">
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
                <div class="flex-align-center text-14px">
                  <span class="txt-weight-light color-text-secondary text-14px">{{ (parseFloat(validator.commission) * 100).toFixed(2) }}%</span>
                </div>
                <div class="flex-align-center text-14px">
                  <span class="txt-weight-light color-text-secondary text-14px">{{ getUptimeLabel(validator.address) }}</span>
                </div>
                <div class="flex-align-center flex-align-justify-center text-14px">
                  <UiButton
                    variant="primary"
                    size="sm"
                    :disabled="!hasActiveProfile"
                    @click="openStakeModal(validator, 'Delegate')"
                  >
                    <CirclePlus :size="14" />
                    Manage
                  </UiButton>
                </div>
              </div>
            </div>
          </UiCard>
        </div>
      </template>
      </template>

      <NetworkParamsPanel v-else-if="currentView === 'params'" />

      <!-- ####### GOVERNANCE VIEW (real proposals/voting, ported from the working reference app - see git history for the old fake DaoPage) ####### -->
      <div v-else-if="currentView === 'governance'" class="border-radius-12px bg-transparent overflow-visible">
        <div class="flex-align-start flex-wrap-wrap gap-16px mb-16px flex-justify-space-between">
          <h2 class="text-20px txt-weight-medium color-text-primary m-0px">Governance</h2>
          <UiButton variant="primary" @click="openCreateProposalModal">
            <Plus :size="16" />
            Create Proposal
          </UiButton>
        </div>

        <UiLoadingBlock v-if="governanceLoading && !governanceProposals.length" message="Loading proposals..." />

        <template v-else>
          <template v-if="governanceVotingProposals.length">
            <h3 class="text-16px txt-weight-light color-text-primary mb-12px">Active Votes</h3>
            <div class="flex flex-column gap-12px mb-24px">
              <UiCard v-for="proposal in governanceVotingProposals" :key="proposal.id" padding="lg" border-class="border-1-primary-a30" radius="12px" :shadow="false">
                <div class="flex-align-center flex-justify-space-between mb-12px">
                  <span class="color-text-secondary text-13px">#{{ proposal.id }}</span>
                  <span class="border-radius-20px fw-500 text-12px py-4px px-12px" :class="governanceStatusClass(proposal.status)">
                    {{ governanceStatusLabel(proposal.status) }}
                  </span>
                </div>
                <h3 class="color-text-primary text-16px txt-weight-light m-0px mb-4px">{{ proposal.title }}</h3>
                <p v-if="proposal.summary" class="color-text-secondary text-13px m-0px mb-16px">{{ proposal.summary.substring(0, 150) }}{{ proposal.summary.length > 150 ? '…' : '' }}</p>
                <div class="flex-align-center flex-wrap-wrap gap-16px mb-16px text-12px">
                  <span class="color-success">Yes {{ governanceTallyPercent(proposal.tally, 'yes').toFixed(1) }}%</span>
                  <span class="color-error">No {{ governanceTallyPercent(proposal.tally, 'no').toFixed(1) }}%</span>
                  <span class="color-warning">Veto {{ governanceTallyPercent(proposal.tally, 'noWithVeto').toFixed(1) }}%</span>
                  <span class="color-text-tertiary">Abstain {{ governanceTallyPercent(proposal.tally, 'abstain').toFixed(1) }}%</span>
                </div>
                <UiButton variant="primary" @click="openVoteModal(proposal)">
                  <Vote :size="16" />
                  Vote
                </UiButton>
              </UiCard>
            </div>
          </template>

          <h3 class="text-16px txt-weight-light color-text-primary mb-12px">All Proposals</h3>
          <UiEmptyState v-if="!governanceProposals.length" description="No proposals found">
            <FileText :size="48" />
          </UiEmptyState>
          <div v-else class="flex flex-column gap-12px">
            <UiCard v-for="proposal in governanceProposals" :key="proposal.id" padding="lg" border-class="border-1" radius="12px" :shadow="false">
              <div class="flex-align-center flex-justify-space-between mb-8px">
                <span class="color-text-secondary text-13px">#{{ proposal.id }}</span>
                <span class="border-radius-20px fw-500 text-12px py-4px px-12px" :class="governanceStatusClass(proposal.status)">
                  {{ governanceStatusLabel(proposal.status) }}
                </span>
              </div>
              <h3 class="color-text-primary text-16px txt-weight-light m-0px mb-4px">{{ proposal.title }}</h3>
              <p v-if="proposal.summary" class="color-text-secondary text-13px m-0px">{{ proposal.summary.substring(0, 150) }}{{ proposal.summary.length > 150 ? '…' : '' }}</p>
            </UiCard>
          </div>
        </template>
      </div>
    </main>

    <!-- Copy Notification -->
    <div v-if="showCopyNotification" class="right-2rem animate-slide-in-up flex-align-center gap-8px txt-weight-light fixed py-12px px-20px color-white border-radius-8px text-14px bg-success z-9999 bottom-32px shadow-success">
      <Check :size="16" />
      <span>{{ copiedText }} copied!</span>
    </div>

    <!-- ####### EXPLORER: STAKE MANAGEMENT MODAL ####### -->
    <ManageStakeDialog :model-value="showStakeModal" v-model:action="currentStakeAction" v-model:amount="stakeAmount" v-model:percentage="stakePercentage" v-model:target="targetValidator" :selected-validator="selectedValidator" :staked-balance="stakedBalance" :available-balance="availableBalance" :popup-style-for="txStatusPopupStyle" :validators="validators" :stake-actions="stakeActions" :can-confirm="canConfirm" :is-processing-tx="isProcessingTx" :tx-status="txStatus" :tx-message="txMessage" :tx-hash="txHash" @update:model-value="closeStakeModal" @confirm="confirmStakeAction" @reset="txStatus = 'idle'" @set-percentage="setStakePercentage" @view-transaction="viewTransaction(txHash)" />

    <!-- ####### GOVERNANCE: CREATE PROPOSAL MODAL ####### -->
    <CreateProposalDialog :model-value="showCreateProposalModal" :form="proposalForm" :action-drafts="actionDrafts" :templates="GOVERNANCE_ACTION_TEMPLATES" :template-for-draft="templateForDraft" :can-submit="canSubmitProposal()" :governance-min-deposit-lmn="governanceMinDepositLmn" :reset-action-draft-values="resetActionDraftValues" :is-submitting="isSubmittingProposal" :submission-enabled="GOVERNANCE_PROPOSAL_SUBMISSION_ENABLED" @update:model-value="closeCreateProposalModal" @submit="submitProposal" @add-action="addActionDraft" @remove-action="removeActionDraft" />

    <!-- ####### GOVERNANCE: VOTE MODAL ####### -->
    <CastVoteDialog :model-value="showVoteModal" v-model:option="voteOption" :is-voting="isVoting" :selected-proposal="selectedProposal" @update:model-value="closeVoteModal" @submit="castVote" />

    </template>
  </div>
</template>

<script setup lang="ts">
import UiCard from '../../ui/UiCard.vue';
import UiButton from '../../ui/UiButton.vue';
import UiLoadingBlock from '../../ui/UiLoadingBlock.vue';
import UiSidebarNavSection from '../../ui/UiSidebarNavSection.vue';
import UiSidebarNavItem from '../../ui/UiSidebarNavItem.vue';
import UiStatTile from '../../ui/UiStatTile.vue';
import UiStatCard from '../../ui/UiStatCard.vue';
import UiMeterCard from '../../ui/UiMeterCard.vue';
import UiChartCard from '../../ui/UiChartCard.vue';
import UiLegendItem from '../../ui/UiLegendItem.vue';
import UiFilterButton from '../../ui/UiFilterButton.vue';
import UiEmptyState from '../../ui/UiEmptyState.vue';
import { ref, computed, onMounted, onBeforeUnmount, onUnmounted, watch } from 'vue';
import { useTabLoadingSync } from '../useTabLoading';
import BlockDetailPage from './BlockDetailPage.vue';
import TransactionDetailPage from './TransactionDetailPage.vue';
import AddressDetailPage from './AddressDetailPage.vue';
import { profilesState, activeProfileId } from '../profilesStore';
import { formatNumber, truncateMiddle } from '../services/format';
import { clampPercent, errorMessage } from '../services/coerce';
import { fetchKeybaseAvatarUrl } from '../services/keybase';
import CastVoteDialog from '../../dialogs/CastVoteDialog.vue';
import CreateProposalDialog from '../../dialogs/CreateProposalDialog.vue';
import ManageStakeDialog from '../../dialogs/ManageStakeDialog.vue';
import { explorerAddressUrl, explorerBlockUrl, explorerTransactionUrl, openExplorerUrl } from '../services/explorerLinks';
import InternalSidebar from '../../components/InternalSidebar.vue';
import NetworkParamsPanel from '../components/NetworkParamsPanel.vue';
import { LayoutGrid, Search, PanelsTopLeft, RotateCw, Users, Link, Copy, Check, CirclePlus,  Activity, Network, SlidersHorizontal, FileText } from 'lucide-vue-next';
import { GOVERNANCE_ACTION_TEMPLATES, findGovernanceActionTemplate } from './governanceActionTemplates';
import type { GovernanceActionDraft } from '../../types/networkGovernance';
import { useToast } from '../../composables/useToast';
import { fromBase64, toBech32 } from '@cosmjs/encoding';
import { useInternalLumen } from '../../composables/useInternalLumen';
import { copyToClipboardWithToast } from '../../composables/useClipboard';
import { computeTxHash } from '../chainRpc';
import type { Block, Transaction, Validator, TxHistoryWindow } from '../../types/explorerPage';
import type { Block as NetworkBlock, ProposalForm, ProposerInfo, StakeAction } from '../../types/networkPage';
import type { GovernanceProposal, GovernanceVoteOption } from '../../types/networkGovernance';

import { useTabNavigation, useTabState } from '../../composables/useTabNavigation';
import TxStatusPill from '../../entities/TxStatusPill.vue';
const toast = useToast();
const lumen = useInternalLumen();
const { navigate, openInNewTab } = useTabNavigation();
const { currentTabUrl, currentTabRefresh } = useTabState();

const activeProfile = computed(() => {
  if (!activeProfileId.value) return null;
  return profilesState.value.find((p) => p.id === activeProfileId.value) || null;
});
const hasActiveProfile = computed(() => !!activeProfile.value && activeProfile.value.role !== 'guest');

const isBlockDetailView = computed(() => {
  const url = currentTabUrl?.value || window.location.href;
  const hasBlock = /\/network\/block\/\d+/.test(url);
  return hasBlock;
});

const isTransactionDetailView = computed(() => {
  const url = currentTabUrl?.value || window.location.href;
  const hasTx = /\/network\/tx\/[A-F0-9]+/i.test(url);
  return hasTx;
});

const isAddressDetailView = computed(() => {
  const url = currentTabUrl?.value || window.location.href;
  const hasAddress = /\/network\/address\/[a-z0-9]+/i.test(url);
  return hasAddress;
});

function navigateToBlock(height: number) {
  openExplorerUrl(explorerBlockUrl(height), openInNewTab);
}

function navigateToTransaction(hash: string) {
  openExplorerUrl(explorerTransactionUrl(hash), openInNewTab);
}

function navigateToAddress(address: string) {
  openExplorerUrl(explorerAddressUrl(address), openInNewTab);
}

// Each sidebar item is its own sub-page (lumen://network/blocks, /transactions,
// /validators, /params - bare lumen://network is "overview"), same pattern as
// isBlockDetailView/isTransactionDetailView/isAddressDetailView below: derive
// the active view from the tab's real URL rather than local-only component
// state, so back/forward, refresh, and bookmarking all work as expected.
const currentView = computed<'overview' | 'blocks' | 'transactions' | 'validators' | 'params' | 'governance'>(() => {
  const url = currentTabUrl?.value || window.location.href;
  if (/\/network\/blocks(?:[/?#]|$)/i.test(url)) return 'blocks';
  if (/\/network\/transactions(?:[/?#]|$)/i.test(url)) return 'transactions';
  if (/\/network\/validators(?:[/?#]|$)/i.test(url)) return 'validators';
  if (/\/network\/params(?:[/?#]|$)/i.test(url)) return 'params';
  if (/\/network\/governance(?:[/?#]|$)/i.test(url)) return 'governance';
  return 'overview';
});

function goToView(view: 'overview' | 'blocks' | 'transactions' | 'validators' | 'params' | 'governance') {
  const url = view === 'overview' ? 'lumen://network' : `lumen://network/${view}`;
  if (navigate) {
    navigate(url, { push: true });
    return;
  }
  openInNewTab?.(url);
}
const isExplorerBrowseView = computed(() =>
  currentView.value === 'overview' ||
  currentView.value === 'blocks' ||
  currentView.value === 'transactions' ||
  currentView.value === 'validators',
);
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

const blocks = ref<Block[]>([]);
const transactions = ref<Transaction[]>([]);
const validators = ref<Validator[]>([]);
const avatarCache = ref<Record<string, string>>({});
const proposerMap = ref<Record<string, ProposerInfo>>({});

// Stake modal state
const showStakeModal = ref(false);
const selectedValidator = ref<Validator | null>(null);
const currentStakeAction = ref<StakeAction>('Delegate');
const stakeActions: StakeAction[] = ['Delegate', 'Undelegate', 'Redelegate', 'Withdraw'];
const stakeAmount = ref('0.0');
const stakePercentage = ref(0);
const targetValidator = ref('');
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
  const clamped = clampPercent(pct);
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
    // Copied into an ArrayBuffer-backed view: fromBase64 hands back a
    // Uint8Array over ArrayBufferLike, which could be a SharedArrayBuffer and
    // so is not a BufferSource. It is a 32-byte key, the copy costs nothing.
    const pub = new Uint8Array(fromBase64(key));
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
          const txHash = await computeTxHash(txData);
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
    
    const avatarUrl = await fetchKeybaseAvatarUrl(validator.keybaseId);
    if (!avatarUrl) continue;

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

function formatTimeAgo(timestamp: string): string {
  const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (diff < 0) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function shortenHash(hash: string): string {
  return truncateMiddle(hash, { start: 20, end: 10 });
}

function shortenAddress(address: string): string {
  return truncateMiddle(address, { start: 12, end: 8 });
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
  showStakeModal.value = true;
  
  // Fetch actual balance from profile
  fetchStakeBalances(validator.address);
}

async function fetchStakeBalances(validatorAddress: string) {
  if (!activeProfile.value) {
    return;
  }

  const profileAddress = activeProfile.value.address || activeProfile.value.walletAddress;

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

        if (res && res.ok !== false) {
          const amt = Number(res.balance?.amount ?? '0') || 0;
          availableBalance.value = (amt / 1_000_000).toFixed(6);
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

        if (delegations && delegations.ok !== false && Array.isArray(delegations.delegations)) {
          const delegation = delegations.delegations.find((d: any) =>
            d.delegation?.validator_address === validatorAddress
          );

          if (delegation?.balance?.amount) {
            const amt = Number(delegation.balance.amount) || 0;
            stakedBalance.value = (amt / 1_000_000).toFixed(6);
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
  } catch (error) {
    console.error(`${currentStakeAction.value} failed:`, error);
    txStatus.value = 'error';
    const errorMsg = errorMessage(error, 'Unknown error');
    txMessage.value = errorMsg;
  } finally {
    isProcessingTx.value = false;
  }
}

watch(stakePercentage, (newVal) => {
  setStakePercentage(newVal);
});

async function copyToClipboard(text: string, label: string = 'Text') {
  await copyToClipboardWithToast(text, `${label} copied to clipboard`);
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

// ---------------------------------------------------------------------------
// Network monitoring data (merged from the old standalone NetworkPage.vue).
// Names are prefixed `network*` throughout to avoid colliding with the
// explorer state above (e.g. explorer's own `validators`/`avatarCache`/
// `proposerMap`/`fetchValidators`/`fetchKeybaseAvatars` fetch a differently
// shaped validator list for staking/voting-power display, not the same data).
// ---------------------------------------------------------------------------
const networkBlockHeight = ref(0);
const networkBlockTime = ref(0);
const networkValidatorCounts = ref({ total: 0, active: 0, jailed: 0 });
const networkTps = ref(0);
const networkPeers = ref(0);
const networkRefreshing = ref(false);

const networkBlockTimeHistory = ref<number[]>([]);
const networkTxHistory = ref<number[]>([]);
const networkMaxTps = ref(0);

const networkRecentBlocks = ref<NetworkBlock[]>([]);
const networkAvatarCache = ref<Record<string, string>>({});
const networkProposerMap = ref<Record<string, ProposerInfo>>({});

function networkIndicatorFillStyle(state: string): Record<string, string> {
  if (state === "excellent") return { background: "var(--color-success)" };
  if (state === "good") return { background: "var(--color-primary)" };
  return { background: "var(--color-warning)" };
}

const networkValidatorPercent = computed(() => {
  if (!networkValidatorCounts.value.total) return 0;
  return (networkValidatorCounts.value.active / networkValidatorCounts.value.total) * 100;
});

const networkAvgBlockTime = computed(() => {
  const times = networkBlockTimeHistory.value.filter(v => v > 0);
  if (!times.length) return 5.0;
  return times.reduce((a, b) => a + b, 0) / times.length;
});

const networkBlockTimeStatus = computed(() => {
  const avg = networkAvgBlockTime.value;
  if (avg < 5) return 'fast';
  if (avg <= 6) return 'normal';
  return 'slow';
});

const networkBlocksPerHour = computed(() => {
  if (networkBlockTime.value <= 0) return 0;
  return Math.floor(3600 / networkBlockTime.value);
});

const networkTxVolume24h = computed(() => {
  const blocksIn24h = Math.floor(86400 / (networkBlockTime.value || 6));
  const avgTxPerBlock = networkTxHistory.value.length
    ? networkTxHistory.value.reduce((a, b) => a + b, 0) / networkTxHistory.value.length
    : 5;
  return Math.floor(blocksIn24h * avgTxPerBlock);
});

// Watch for refresh signal from navbar (shared with explorer's own watch above)
watch(
  () => currentTabRefresh?.value,
  () => {
    refreshNetworkData();
  }
);

async function refreshNetworkData() {
  networkRefreshing.value = true;
  try {
    // Fetch network status first
    await fetchNetworkStatus();

    // Fetch validators to populate networkProposerMap with monikers and avatars
    await fetchNetworkValidatorCounts();

    // Then fetch blocks and stats (blocks need networkProposerMap to be ready)
    await Promise.all([
      fetchNetworkRecentBlocks(),
      fetchNetworkStats()
    ]);
  } finally {
    networkRefreshing.value = false;
  }
}

// Fetch network status and height
async function fetchNetworkStatus() {
  try {
    if (lumen?.rpc?.getHeight) {
      const result = await lumen.rpc.getHeight();
      if (result?.ok && result.height) {
        networkBlockHeight.value = result.height;
      }
    }
  } catch (e) {
    console.error('Failed to fetch network status:', e);
  }
}

// Fetch Keybase avatars
async function fetchNetworkKeybaseAvatars() {
  const validatorsWithKeybase = Object.values(networkProposerMap.value)
    .filter(v => v.keybaseId && !networkAvatarCache.value[v.keybaseId]);

  if (validatorsWithKeybase.length === 0) return;

  for (const validator of validatorsWithKeybase) {
    if (!validator.keybaseId) continue;

    try {
      const response = await fetch(
        `https://keybase.io/_/api/1.0/user/lookup.json?key_suffix=${validator.keybaseId}`
      );
      const data = await response.json();

      if (data?.them?.[0]?.pictures?.primary?.url) {
        const avatarUrl = data.them[0].pictures.primary.url;
        networkAvatarCache.value[validator.keybaseId] = avatarUrl;

        // Update networkProposerMap with avatar
        for (const key in networkProposerMap.value) {
          if (networkProposerMap.value[key].keybaseId === validator.keybaseId) {
            networkProposerMap.value[key].avatar = avatarUrl;
          }
        }
      }
    } catch {
      console.warn(`Failed to fetch avatar for ${validator.moniker}`);
    }
  }
}

// Fetch validator counts (active/total/jailed) for the Metrics/Status panels
async function fetchNetworkValidatorCounts() {
  try {
    if (!lumen?.http?.get) return;

    // Fetch validator set from RPC
    const valSetRes = await lumen.net.rpcGet('/validators');
    if (valSetRes.ok && valSetRes.json?.result?.validators) {
      const valSet = valSetRes.json.result.validators;

      for (const val of valSet) {
        networkProposerMap.value[val.address] = {
          moniker: val.address.substring(0, 8),
          keybaseId: undefined,
          avatar: undefined
        };
      }
    }

    // Fetch validators from REST API
    const res = await lumen.net.restGet(
      `/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=200`
    );

    if (res.ok && res.json?.validators) {
      const validatorsList = res.json.validators;
      const active = validatorsList.filter((v: any) => !v.jailed).length;
      const jailed = validatorsList.filter((v: any) => v.jailed).length;

      networkValidatorCounts.value = {
        total: validatorsList.length,
        active: active,
        jailed: jailed
      };

      // Build proposer map with validator info
      const valSet2Res = await lumen.net.rpcGet('/validators');
      const validatorSet = valSet2Res.ok && valSet2Res.json?.result?.validators
        ? valSet2Res.json.result.validators
        : [];

      for (const v of validatorsList) {
        const keybaseId = v.description?.identity || null;
        const matchingVal = validatorSet.find((vs: any) => {
          return vs.pub_key?.value && v.consensus_pubkey?.key === vs.pub_key.value;
        });

        if (matchingVal) {
          networkProposerMap.value[matchingVal.address] = {
            moniker: v.description?.moniker || 'Unknown',
            keybaseId: keybaseId,
            avatar: networkAvatarCache.value[keybaseId] || undefined
          };
        }
      }

      // Fetch Keybase avatars
      await fetchNetworkKeybaseAvatars();
    }
  } catch (e) {
    console.error('Failed to fetch validators:', e);
  }
}

// Fetch recent blocks (for the Status view's "Recent Blocks" panel)
async function fetchNetworkRecentBlocks() {
  try {
    if (!lumen?.http?.get || networkBlockHeight.value === 0) return;

    const blocksList: NetworkBlock[] = [];
    const promises = [];

    // Fetch last 6 blocks
    for (let i = 0; i < 6; i++) {
      const height = networkBlockHeight.value - i;
      if (height > 0) {
        promises.push(
          lumen.net.rpcGet(`/block?height=${height}`)
        );
      }
    }

    const results = await Promise.all(promises);

    for (const res of results) {
      if (res.ok && res.json?.result?.block) {
        const block = res.json.result.block;
        const header = block.header;
        const proposerAddr = header.proposer_address || '';
        const proposerInfo = networkProposerMap.value[proposerAddr];

        blocksList.push({
          height: parseInt(header.height),
          time: header.time,
          txs: block.data.txs?.length || 0,
          validator: proposerInfo?.moniker || proposerAddr.substring(0, 8),
          validatorAvatar: proposerInfo?.avatar
        });
      }
    }

    networkRecentBlocks.value = blocksList.sort((a, b) => b.height - a.height);
  } catch (e) {
    console.error('Failed to fetch recent blocks:', e);
  }
}

// Fetch network stats (block time, TPS, peers)
async function fetchNetworkStats() {
  try {
    if (!lumen?.http?.get) return;

    // Fetch net_info for peer count
    const netInfoRes = await lumen.net.rpcGet('/net_info');
    if (netInfoRes.ok && netInfoRes.json?.result?.n_peers) {
      networkPeers.value = parseInt(netInfoRes.json.result.n_peers);
    }

    // Calculate block time and TPS from recent blocks
    if (networkRecentBlocks.value.length >= 2) {
      const times: number[] = [];
      const txCounts: number[] = [];

      for (let i = 0; i < networkRecentBlocks.value.length - 1; i++) {
        const curr = new Date(networkRecentBlocks.value[i].time).getTime();
        const prev = new Date(networkRecentBlocks.value[i + 1].time).getTime();
        const diffSec = (curr - prev) / 1000;

        if (diffSec > 0) {
          times.push(diffSec);
          txCounts.push(networkRecentBlocks.value[i].txs);
        }
      }

      if (times.length > 0) {
        networkBlockTime.value = times.reduce((a, b) => a + b, 0) / times.length;
        networkBlockTimeHistory.value = times.slice(0, 10);

        const totalTxs = txCounts.reduce((a, b) => a + b, 0);
        const totalTime = times.reduce((a, b) => a + b, 0);
        networkTps.value = totalTime > 0 ? totalTxs / totalTime : 0;

        networkTxHistory.value = txCounts.slice(0, 10);
        networkMaxTps.value = Math.max(...txCounts.map((tx, i) => times[i] > 0 ? tx / times[i] : 0), networkTps.value);
      }
    }
  } catch (e) {
    console.error('Failed to fetch network stats:', e);
  }
}

onMounted(() => {
  refreshNetworkData();
  const networkInterval = setInterval(refreshNetworkData, 10000);
  onBeforeUnmount(() => clearInterval(networkInterval));
});

// ---------------------------------------------------------------------------
// Governance (real proposals/voting - was previously a separate, fake DaoPage.vue
// whose "Voting" tab didn't do anything and whose vote/create-proposal forms
// only had 3 of the 4 real Cosmos SDK gov vote options). The actual signing
// backend (`wallet:govVote` / `wallet:govSubmitProposal` in
// electron/ipc/wallet.cjs) was already real and working - it builds and signs
// genuine `/cosmos.gov.v1.MsgVote` / `/cosmos.gov.v1.MsgSubmitProposal`
// messages the same way delegate/undelegate/sendTokens do. What was fake was
// only this page: it read proposals from the legacy `/cosmos/gov/v1beta1/...`
// REST path (mismatched with the v1 messages actually being signed), had no
// "no with veto" option, and mixed in a Members tab (redundant with the
// Validators tab above) and a Treasury tab (not relevant here).
// ---------------------------------------------------------------------------
const activeGovernanceAddress = computed(() => activeProfile.value?.address || (activeProfile.value as any)?.walletAddress || '');

const governanceProposals = ref<GovernanceProposal[]>([]);
const governanceLoading = ref(false);
const governanceMinDepositLmn = ref('10');

const governanceVotingProposals = computed(() =>
  governanceProposals.value.filter((p) => p.status === 'PROPOSAL_STATUS_VOTING_PERIOD'),
);

function governanceStatusLabel(status: string): string {
  switch (status) {
    case 'PROPOSAL_STATUS_DEPOSIT_PERIOD': return 'Deposit';
    case 'PROPOSAL_STATUS_VOTING_PERIOD': return 'Voting';
    case 'PROPOSAL_STATUS_PASSED': return 'Passed';
    case 'PROPOSAL_STATUS_REJECTED': return 'Rejected';
    case 'PROPOSAL_STATUS_FAILED': return 'Failed';
    default: return 'Unknown';
  }
}

function governanceStatusClass(status: string): string {
  switch (status) {
    case 'PROPOSAL_STATUS_VOTING_PERIOD': return 'color-accent-secondary bg-fill-blue';
    case 'PROPOSAL_STATUS_PASSED': return 'color-success bg-fill-success';
    case 'PROPOSAL_STATUS_REJECTED':
    case 'PROPOSAL_STATUS_FAILED': return 'color-error bg-fill-error';
    case 'PROPOSAL_STATUS_DEPOSIT_PERIOD': return 'color-warning bg-warning-a15';
    default: return 'color-text-tertiary bg-transparent';
  }
}

function governanceTallyPercent(tally: { yes: string; no: string; noWithVeto: string; abstain: string }, key: 'yes' | 'no' | 'noWithVeto' | 'abstain'): number {
  const yes = Number(tally.yes) || 0;
  const no = Number(tally.no) || 0;
  const veto = Number(tally.noWithVeto) || 0;
  const abstain = Number(tally.abstain) || 0;
  const total = yes + no + veto + abstain;
  if (!total) return 0;
  return ((Number(tally[key]) || 0) / total) * 100;
}

function mapGovernanceTally(raw: any): { yes: string; no: string; noWithVeto: string; abstain: string } {
  return {
    yes: raw?.yes_count ?? raw?.yes ?? '0',
    no: raw?.no_count ?? raw?.no ?? '0',
    noWithVeto: raw?.no_with_veto_count ?? raw?.no_with_veto ?? '0',
    abstain: raw?.abstain_count ?? raw?.abstain ?? '0',
  };
}

async function fetchGovernanceLiveTally(proposal: GovernanceProposal) {
  if (!lumen?.net?.restGet) return;
  try {
    const res = await lumen.net.restGet(`/cosmos/gov/v1/proposals/${proposal.id}/tally`);
    if (res.ok && res.json?.tally) {
      proposal.tally = mapGovernanceTally(res.json.tally);
    }
  } catch (e) {
    console.error('Failed to fetch live tally:', e);
  }
}

async function fetchGovernanceProposals() {
  if (!lumen?.net?.restGet) return;
  governanceLoading.value = true;
  try {
    const res = await lumen.net.restGet('/cosmos/gov/v1/proposals?pagination.limit=200&pagination.reverse=true');
    if (res.ok && Array.isArray(res.json?.proposals)) {
      governanceProposals.value = res.json.proposals.map((p: any): GovernanceProposal => ({
        id: Number(p.id ?? p.proposal_id ?? 0),
        status: p.status || 'PROPOSAL_STATUS_UNSPECIFIED',
        title: p.title || `Proposal #${p.id ?? p.proposal_id ?? ''}`,
        summary: p.summary || '',
        submitTime: p.submit_time || '',
        votingStart: p.voting_start_time || '',
        votingEnd: p.voting_end_time || '',
        depositEnd: p.deposit_end_time || '',
        totalDeposit: p.total_deposit?.[0]?.amount || '0',
        proposer: p.proposer || '',
        tally: mapGovernanceTally(p.final_tally_result),
      }));
      // final_tally_result is zeroed while a proposal is still being voted on -
      // fetch the live, in-progress tally for those specifically.
      await Promise.all(governanceVotingProposals.value.map((p) => fetchGovernanceLiveTally(p)));
    }
  } catch (e) {
    console.error('Failed to fetch proposals:', e);
  } finally {
    governanceLoading.value = false;
  }
}

async function fetchGovernanceMinDeposit() {
  if (!lumen?.net?.restGet) return;
  try {
    const res = await lumen.net.restGet('/cosmos/gov/v1/params/deposit');
    const minDeposit = res.ok && res.json?.deposit_params?.min_deposit?.[0];
    if (minDeposit?.denom === 'ulmn' && minDeposit?.amount) {
      const lmn = Number(minDeposit.amount) / 1e6;
      if (Number.isFinite(lmn)) governanceMinDepositLmn.value = String(lmn);
    }
  } catch (e) {
    console.error('Failed to fetch gov params:', e);
  }
}

async function handleGovernanceSigningError(result: { ok?: boolean; error?: string }): Promise<boolean> {
  if (result?.ok === false && (result.error === 'password_required' || result.error === 'invalid_password')) {
    try {
      await lumen?.security?.lockSession?.();
    } catch {
      // ignore - the security gate will re-prompt regardless
    }
    return true;
  }
  return false;
}

// Create-proposal modal
// Flip to true once the 16 action builders in electron/ipc/wallet.cjs have
// been exercised against a running testnet - keeps the UI/form fully
// browsable (and reviewable) in the meantime without letting anyone actually
// broadcast an unverified governance message.
const GOVERNANCE_PROPOSAL_SUBMISSION_ENABLED = false;
const showCreateProposalModal = ref(false);
const isSubmittingProposal = ref(false);
const proposalForm = ref<ProposalForm>({ title: '', summary: '', depositLmn: '10' });
const actionDrafts = ref<GovernanceActionDraft[]>([]);

function templateForDraft(draft: GovernanceActionDraft) {
  return findGovernanceActionTemplate(draft.templateId);
}

function resetActionDraftValues(draft: GovernanceActionDraft) {
  draft.values = {};
}

function addActionDraft() {
  const first = GOVERNANCE_ACTION_TEMPLATES[0];
  actionDrafts.value.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    templateId: first.id,
    values: {}
  });
}

function removeActionDraft(id: string) {
  actionDrafts.value = actionDrafts.value.filter((d) => d.id !== id);
}

function openCreateProposalModal() {
  proposalForm.value = { title: '', summary: '', depositLmn: governanceMinDepositLmn.value };
  actionDrafts.value = [];
  showCreateProposalModal.value = true;
}

function closeCreateProposalModal() {
  showCreateProposalModal.value = false;
}

function canSubmitProposal(): boolean {
  return (
    proposalForm.value.title.trim().length > 0 &&
    proposalForm.value.summary.trim().length > 0 &&
    !Number.isNaN(Number(proposalForm.value.depositLmn)) &&
    Number(proposalForm.value.depositLmn) >= 0
  );
}

async function submitProposal() {
  if (!canSubmitProposal() || isSubmittingProposal.value) return;

  const profileId = activeProfileId.value;
  const address = activeGovernanceAddress.value;
  if (!profileId || !address) {
    toast.error('Select a profile first.');
    return;
  }

  const walletApi = lumen?.wallet;
  if (!walletApi?.govSubmitProposal) {
    toast.error('Governance submission is not available.');
    return;
  }

  isSubmittingProposal.value = true;
  try {
    const result = await walletApi.govSubmitProposal({
      profileId,
      address,
      title: proposalForm.value.title.trim(),
      summary: proposalForm.value.summary.trim(),
      depositLmn: proposalForm.value.depositLmn || '0',
      actions: actionDrafts.value.map((d) => ({ templateId: d.templateId, values: d.values })),
    });

    if (await handleGovernanceSigningError(result)) return;
    if (!toast.fromResult(result, 'Proposal submitted on-chain.')) return;

    closeCreateProposalModal();
    await fetchGovernanceProposals();
  } catch (err) {
    toast.error(errorMessage(err, 'Failed to submit proposal.'));
  } finally {
    isSubmittingProposal.value = false;
  }
}

// Vote modal
const showVoteModal = ref(false);
const selectedProposal = ref<GovernanceProposal | null>(null);
const voteOption = ref<GovernanceVoteOption | ''>('');
const isVoting = ref(false);

function openVoteModal(proposal: GovernanceProposal) {
  selectedProposal.value = proposal;
  voteOption.value = '';
  showVoteModal.value = true;
}

function closeVoteModal() {
  showVoteModal.value = false;
  selectedProposal.value = null;
  voteOption.value = '';
}

async function castVote() {
  if (!voteOption.value || !selectedProposal.value || isVoting.value) return;

  const profileId = activeProfileId.value;
  const address = activeGovernanceAddress.value;
  if (!profileId || !address) {
    toast.error('Select a profile first.');
    return;
  }

  const walletApi = lumen?.wallet;
  if (!walletApi?.govVote) {
    toast.error('Governance voting is not available.');
    return;
  }

  isVoting.value = true;
  try {
    const result = await walletApi.govVote({
      profileId,
      address,
      proposalId: selectedProposal.value.id,
      option: voteOption.value,
    });

    if (await handleGovernanceSigningError(result)) return;
    if (!toast.fromResult(result, 'Vote broadcasted.')) return;

    closeVoteModal();
    await fetchGovernanceProposals();
  } catch (err) {
    toast.error(errorMessage(err, 'Failed to cast vote.'));
  } finally {
    isVoting.value = false;
  }
}

onMounted(() => {
  fetchGovernanceProposals();
  void fetchGovernanceMinDeposit();
  const governanceInterval = setInterval(fetchGovernanceProposals, 30000);
  onBeforeUnmount(() => clearInterval(governanceInterval));
});

watch(
  () => currentTabRefresh?.value,
  () => {
    fetchGovernanceProposals();
  },
);
</script>