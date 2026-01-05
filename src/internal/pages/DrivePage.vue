<template>
  <div class="drive-page">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo-icon">
          <HardDrive :size="22" />
        </div>
        <span class="logo-text">Drive</span>
      </div>

      <!-- Hosting -->
      <div class="hosting-panel">
        <div class="stats-header">
          <Database :size="14" />
          <span>Storage</span>
        </div>

        <div class="hosting-row" :class="{ active: hosting.kind === 'local' }">
          <button class="hosting-main" type="button" @click="selectHosting('local')">
            <span class="hosting-dot" :class="ipfsConnected ? 'ok' : 'off'"></span>
            <span class="hosting-title">Local</span>
            <span class="hosting-meta">{{ ipfsConnected ? 'Online' : 'Offline' }}</span>
          </button>
          <button class="hosting-details" type="button" @click.stop="openLocalDetails" title="Local details">
            <TableProperties :size="16" />
          </button>
        </div>

        <div class="hosting-divider"></div>

        <div class="hosting-subheader">
          <span class="hosting-subheader-title">Subscriptions</span>
          <button class="hosting-subheader-action" type="button" @click="openPlansModal">
            Cloud
          </button>
        </div>

        <div v-if="!subscriptionRows.length" class="hosting-empty">
          No active subscriptions yet.
        </div>

        <div
          v-for="sub in subscriptionRows"
          :key="sub.gatewayId"
          class="hosting-row"
          :class="{ active: hosting.kind === 'gateway' && hosting.gatewayId === sub.gatewayId }"
        >
          <button class="hosting-main" type="button" @click="selectGateway(sub.gatewayId)">
            <span class="hosting-dot" :class="sub.statusDot"></span>
            <span class="hosting-title" :title="sub.hoverTitle">{{ sub.label }}</span>
            <span class="hosting-meta" v-if="false">
              <template v-if="sub.region">{{ sub.region }}</template>
              <template v-else>—</template>
            </span>
            <span class="hosting-meta">{{ sub.region || '-' }}</span>
            <span class="hosting-tags" v-if="sub.planTags.length">
              <span v-for="p in sub.planTags" :key="p" class="hosting-tag">{{ p }}</span>
            </span>
          </button>
          <button class="hosting-details" type="button" @click.stop="openGatewayDetails(sub.gatewayId)" title="Subscription details">
            <TableProperties :size="16" />
          </button>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <!-- Header -->
      <header class="content-header">
        <div>
          <h1 class="txt-lg txt-weight-strong">
            {{ headerTitle }}
          </h1>
          <p class="txt-xs color-gray-blue margin-top-10">
            {{ headerSubtitle }}
          </p>
        </div>
        
          <div class="header-actions">
            <!-- View Switcher -->
            <div class="view-switcher">
              <button 
                class="view-btn" 
                :class="{ active: viewMode === 'grid' }"
                @click="viewMode = 'grid'"
                title="Grid View"
              >
                <LayoutGrid :size="18" />
              </button>
              <button 
                class="view-btn" 
                :class="{ active: viewMode === 'list' }"
                @click="viewMode = 'list'"
                title="List View"
              >
                <List :size="18" />
              </button>
              <button 
                class="view-btn" 
                :class="{ active: viewMode === 'details' }"
                @click="viewMode = 'details'"
                title="Details View"
              >
                <TableProperties :size="18" />
              </button>
            </div>

            <button class="plans-btn" type="button" @click="openPlansModal">
              <Database :size="16" />
              <span>Cloud</span>
            </button>

            <div class="upload-menu" @click.stop>
              <button class="upload-btn" type="button" @click="toggleUploadMenu">
                <Plus :size="18" />
                <span>Upload</span>
              </button>
              <div v-if="showUploadMenu" class="upload-dropdown" @click.stop>
                <label class="upload-dropdown-item">
                  Upload files
                  <input type="file" multiple @change="handleFileUpload" />
                </label>
                <label class="upload-dropdown-item">
                  Upload folder
                  <input type="file" multiple webkitdirectory directory @change="handleFolderUpload" />
                </label>
              </div>
            </div>
        </div>
      </header>

      <!-- Breadcrumb (folders) -->
      <div v-if="isBrowsing" class="browse-bar">
        <button class="btn-ghost" type="button" @click="exitBrowse">
          Back
        </button>
        <div class="browse-crumbs">
          <button class="crumb" type="button" @click="openBrowseAt('')">
            {{ browseRootName }}
          </button>
          <template v-for="c in browseCrumbs" :key="c.path">
            <span class="sep">/</span>
            <button class="crumb" type="button" @click="openBrowseAt(c.path)">
              {{ c.label }}
            </button>
          </template>
        </div>
      </div>

      <div v-if="browseLoading" class="upload-progress">
        <div class="progress-content">
          <UiSpinner size="sm" />
          <div class="progress-info">
            <span class="txt-sm txt-weight-strong">Loading folder</span>
            <span class="txt-xs color-gray-blue">Fetching directory entries...</span>
          </div>
        </div>
      </div>

      <div v-else-if="browseError" class="fetch-error txt-xs margin-top-25">
        {{ browseError }}
      </div>

      <!-- Upload Progress -->
      <div v-if="uploading" class="upload-progress">
        <div class="progress-content">
          <UiSpinner size="sm" />
          <div class="progress-info">
            <span class="txt-sm txt-weight-strong">Uploading {{ uploadingFile }}</span>
            <span class="txt-xs color-gray-blue">Adding to IPFS network...</span>
          </div>
        </div>
      </div>

      <!-- Files Grid View -->
      <div v-if="displayFiles.length > 0 && viewMode === 'grid'" class="files-grid">
        <div 
          v-for="file in displayFiles" 
          :key="file.cid" 
          class="file-card"
          @click="selectFile(file)"
          :class="{ selected: selectedFile?.cid === file.cid }"
        >
          <div class="file-preview" :class="getFileTypeClass(file.name)">
            <!-- Show actual image preview -->
              <img 
                v-if="isImageFile(file.name)" 
                :src="getImageSrc(file)" 
                :alt="file.name"
                class="preview-image"
                @error="() => onImageError(file)"
              />
            <!-- Show video preview -->
              <video 
                v-else-if="isVideoFile(file.name)" 
                :src="getGatewayUrl(contentTargetFor(file))"
                class="preview-video"
                muted
                @mouseenter="(e) => (e.target as HTMLVideoElement).play()"
                @mouseleave="(e) => { (e.target as HTMLVideoElement).pause(); (e.target as HTMLVideoElement).currentTime = 0; }"
              ></video>
            <!-- Show icon for other files -->
            <component v-else :is="getFileIcon(file.name)" :size="32" stroke-width="1.5" />
          </div>
          <div class="file-info">
            <p class="file-name">{{ file.name }}</p>
            <p class="file-meta">{{ formatSize(file.size) }}</p>
          </div>
          <div class="file-actions">
            <button class="action-btn" title="Download" @click.stop="downloadFile(file)">
              <Download :size="16" />
            </button>
            <button class="action-btn" title="Share" @click.stop="copyLumenLinkFor(file)">
              <Share2 :size="16" />
            </button>
            <button class="action-btn" title="Open" @click.stop="openInIpfs(file)">
              <ExternalLink :size="16" />
            </button>
            <button class="action-btn danger" title="Remove" @click.stop="removeFile(file)">
              <Trash2 :size="16" />
            </button>
          </div>
        </div>
      </div>

      <!-- Files List View -->
      <div v-else-if="displayFiles.length > 0 && viewMode === 'list'" class="files-list">
        <!-- List Header -->
        <div class="list-header">
          <div class="list-icon-header"></div>
          <span class="list-name-header">Name</span>
          <span class="list-size-header">Size</span>
          <span class="list-date-header">Date Added</span>
          <div class="list-actions-header"></div>
        </div>
        <!-- List Items -->
        <div 
          v-for="file in displayFiles" 
          :key="file.cid" 
          class="list-item"
          @click="selectFile(file)"
          :class="{ selected: selectedFile?.cid === file.cid }"
        >
          <div class="list-icon" :class="getFileTypeClass(file.name)">
            <!-- Show small thumbnail for images -->
            <img 
              v-if="isImageFile(file.name)" 
              :src="getImageSrc(file)" 
              :alt="file.name"
              class="list-thumbnail"
              @error="() => onImageError(file)"
            />
            <component v-else :is="getFileIcon(file.name)" :size="20" stroke-width="1.5" />
          </div>
          <span class="list-name">{{ file.name }}</span>
          <span class="list-size">{{ formatSize(file.size) }}</span>
          <span class="list-date">{{ file.uploadedAt ? formatDate(file.uploadedAt) : '—' }}</span>
          <div class="list-actions">
            <button class="action-btn" title="Download" @click.stop="downloadFile(file)">
              <Download :size="14" />
            </button>
            <button class="action-btn" title="Share" @click.stop="copyLumenLinkFor(file)">
              <Share2 :size="14" />
            </button>
            <button class="action-btn danger" title="Remove" @click.stop="removeFile(file)">
              <Trash2 :size="14" />
            </button>
          </div>
        </div>
      </div>

      <!-- Files Details View (Table) -->
      <div v-else-if="displayFiles.length > 0 && viewMode === 'details'" class="files-table-wrapper">
        <table class="files-table">
          <thead>
            <tr>
              <th class="th-name">Name</th>
              <th class="th-size">Size</th>
              <th class="th-date">Date Added</th>
              <th class="th-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="file in displayFiles" 
              :key="file.cid"
              @click="selectFile(file)"
              :class="{ selected: selectedFile?.cid === file.cid }"
            >
              <td class="td-name">
                <div class="table-icon" :class="getFileTypeClass(file.name)">
                  <img 
                    v-if="isImageFile(file.name)" 
                    :src="getImageSrc(file)" 
                    :alt="file.name"
                    class="table-thumbnail"
                    @error="() => onImageError(file)"
                  />
                  <component v-else :is="getFileIcon(file.name)" :size="16" stroke-width="1.5" />
                </div>
                <span>{{ file.name }}</span>
              </td>
              <td class="td-size">{{ formatSize(file.size) }}</td>
              <td class="td-date">{{ file.uploadedAt ? formatDate(file.uploadedAt) : '-' }}</td>
              <td class="td-actions">
                <button class="action-btn" title="Download" @click.stop="downloadFile(file)">
                  <Download :size="14" />
                </button>
                <button class="action-btn" title="Open" @click.stop="openInIpfs(file)">
                  <ExternalLink :size="14" />
                </button>
                <button class="action-btn danger" title="Remove" @click.stop="removeFile(file)">
                  <Trash2 :size="14" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-state">
        <div class="empty-icon">
          <HardDrive :size="64" stroke-width="1" />
        </div>
        <h3 class="txt-md txt-weight-strong margin-top-50">
          {{ isBrowsing ? 'Empty folder' : 'No saved content' }}
        </h3>
        <p class="txt-sm color-gray-blue margin-top-25">
          {{ isBrowsing ? 'This folder has no entries.' : 'Drag and drop files or click Upload to add files' }}
        </p>
        <label class="upload-btn-large margin-top-50">
          <Upload :size="20" />
          <span>Choose files to upload</span>
          <input type="file" multiple @change="handleFileUpload" />
        </label>
      </div>
    </main>

    <!-- File Detail Panel -->
    <aside v-if="selectedFile" class="detail-panel">
      <div class="detail-header">
        <h3 class="txt-sm txt-weight-strong">File Details</h3>
        <button class="close-btn" @click="selectedFile = null">
          <X :size="18" />
        </button>
      </div>
      
      <div class="detail-preview" :class="getFileTypeClass(selectedFile.name)">
        <!-- Show actual image preview in detail panel -->
        <img 
          v-if="isImageFile(selectedFile.name)" 
          :src="getImageSrc(selectedFile)" 
          :alt="selectedFile.name"
          class="detail-preview-image"
          @error="() => onImageError(selectedFile)"
        />
        <!-- Show video preview in detail panel -->
        <video 
          v-else-if="isVideoFile(selectedFile.name)" 
          :src="getGatewayUrl(contentTargetFor(selectedFile))"
          class="detail-preview-video"
          controls
          muted
        ></video>
        <!-- Show icon for other files -->
        <component v-else :is="getFileIcon(selectedFile.name)" :size="48" stroke-width="1.5" />
      </div>

      <div class="detail-info">
        <div class="info-row">
          <span class="info-label">Name</span>
          <input
            class="info-value name-input"
            v-model.trim="renameDraft"
            type="text"
            placeholder="Unknown"
            @keyup.enter="saveSelectedName"
            @blur="saveSelectedName"
          />
        </div>
        <div class="info-row">
          <span class="info-label">Size</span>
          <span class="info-value">{{ formatSize(selectedFile.size) }}</span>
        </div>
        <div class="info-row" v-if="selectedFile.uploadedAt">
          <span class="info-label">Added</span>
          <span class="info-value">{{ formatDate(selectedFile.uploadedAt) }}</span>
        </div>
      </div>

      <div class="detail-actions">
        <button class="detail-btn primary" @click="downloadFile(selectedFile)">
          <Download :size="16" />
          Download
        </button>
        <button class="detail-btn" @click="copyLumenLinkFor(selectedFile)">
          <Share2 :size="16" />
          Share
        </button>
        <button class="detail-btn" @click="openInIpfs(selectedFile)">
          <ExternalLink :size="16" />
          Open
        </button>
      </div>
    </aside>

    <!-- Toast -->
    <Transition name="toast">
      <div v-if="toast" class="toast" :class="toastType">
        <component :is="toastIcon" :size="16" />
        {{ toast }}
      </div>
    </Transition>

    <!-- Drop Overlay -->
    <div v-if="isDragging" class="drop-overlay">
      <div class="drop-content">
        <Upload :size="48" />
        <p class="txt-md txt-weight-strong margin-top-25">Drop files to upload</p>
      </div>
    </div>

      <!-- Local Details Modal -->
      <Transition name="modal">
        <div v-if="showLocalDetails" class="modal-overlay" @click="closeLocalDetails">
          <div class="modal-content" @click.stop>
            <div class="modal-header">
              <h3>Local node</h3>
              <button class="modal-close" @click="closeLocalDetails">
                <X :size="20" />
              </button>
            </div>
            <div class="modal-body">
              <p class="modal-desc">Your local IPFS node status and saved content.</p>

              <div class="details-grid">
                <div class="details-row">
                  <span class="details-label">Status</span>
                  <span class="details-value" :class="ipfsConnected ? 'ok' : 'off'">
                    {{ ipfsConnected ? 'Online' : 'Offline' }}
                  </span>
                </div>
                <div class="details-row" v-if="stats">
                  <span class="details-label">Used</span>
                  <span class="details-value">{{ formatSize(stats.repoSize) }}</span>
                </div>
                <div class="details-row">
                  <span class="details-label">Saved</span>
                  <span class="details-value">{{ localSavedCount }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Subscription Details Modal -->
      <Transition name="modal">
        <div v-if="showGatewayDetails" class="modal-overlay" @click="closeGatewayDetails">
          <div class="modal-content" @click.stop>
            <div class="modal-header">
              <h3>Subscription details</h3>
              <button class="modal-close" @click="closeGatewayDetails">
                <X :size="20" />
              </button>
            </div>
            <div class="modal-body">
              <p class="modal-desc">Usage summary for the selected gateway.</p>

              <div class="details-grid">
                <div class="details-row">
                  <span class="details-label">Gateway</span>
                  <span class="details-value">{{ activeGatewayLabel }}</span>
                </div>
                <div class="details-row" v-if="false">
                  <span class="details-label">Base URL</span>
                  <span class="details-value mono">{{ gatewayBase || '—' }}</span>
                </div>
                <div class="details-row">
                  <span class="details-label">Status</span>
                  <span class="details-value" :class="activeSubscriptionStatusClass">
                    {{ activeSubscriptionStatusLabel }}
                  </span>
                </div>
                <div class="details-row">
                  <span class="details-label">Saved</span>
                  <span class="details-value">{{ gatewayPinned.length }}</span>
                </div>
              </div>

              <div class="details-section">
                <div class="details-section-header">
                  <h4>Usage</h4>
                  <button class="btn-ghost" type="button" @click="refreshActiveGatewayData" :disabled="gatewayUsageLoading">
                    Refresh
                  </button>
                </div>
                <div v-if="gatewayUsageLoading" class="plans-empty-muted">Loading…</div>
                <div v-else-if="gatewayUsageError" class="plans-error">{{ gatewayUsageError }}</div>
                <div v-else-if="gatewayUsage" class="details-grid">
                  <div class="details-row">
                    <span class="details-label">Quota</span>
                    <span class="details-value">
                      {{
                        gatewayUsage.plan?.quota_bytes_total != null || gatewayUsage.plan?.quotaBytesTotal != null
                          ? formatSize((gatewayUsage.plan.quota_bytes_total ?? gatewayUsage.plan.quotaBytesTotal) as number)
                          : '—'
                      }}
                    </span>
                  </div>
                  <div class="details-row">
                    <span class="details-label">Used</span>
                    <span class="details-value">
                      {{
                        gatewayUsage.plan?.quota_bytes_used != null || gatewayUsage.plan?.quotaBytesUsed != null
                          ? formatSize((gatewayUsage.plan.quota_bytes_used ?? gatewayUsage.plan.quotaBytesUsed) as number)
                          : '-'
                      }}
                    </span>
                  </div>
                  <div class="details-row">
                    <span class="details-label">Bandwidth</span>
                    <span class="details-value">{{ gatewayBandwidthUsed }}</span>
                  </div>
                  <div class="details-row">
                    <span class="details-label">Roots</span>
                    <span class="details-value">{{ gatewayUsage.usage?.roots_total ?? gatewayUsage.usage?.rootsTotal ?? '-' }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Plans Modal -->
      <Transition name="modal">
        <div v-if="showPlansModal" class="modal-overlay" @click="closePlansModal">
          <div class="modal-content" @click.stop>
            <div class="modal-header">
              <h3>Cloud plans</h3>
              <button class="modal-close" @click="closePlansModal">
                <X :size="20" />
              </button>
            </div>
            <div class="modal-body">
              <p class="modal-desc">
                View on-chain storage plans published by gateways.
              </p>

        <div v-if="plansLoading" class="permalink-loading">
          <UiSpinner size="md" />
          <p>Loading plans...</p>
        </div>

              <div v-else-if="plansError" class="permalink-success">
                <p>{{ plansError }}</p>
              </div>

              <div v-else-if="!plans.length" class="permalink-success">
                <p>No plans available at the moment.</p>
              </div>

              <div v-else class="plans-list">
                <div v-if="false">
                <div
                  v-for="plan in plans"
                  :key="plan.id"
                  class="plan-row"
                >
                  <div class="plan-main">
                    <div class="plan-title-row">
                      <span class="plan-name">{{ planDisplayName(plan) }}</span>
                      <span
                        class="plan-status-badge"
                        :class="{
                          active: planStatus(plan) === 'active',
                          pending: planStatus(plan) === 'pending'
                        }"
                      >
                        {{ planStatusLabel(plan) }}
                      </span>
                    </div>
                    <div class="plan-gw">
                      {{ plan.gatewayName }}
                      <template v-if="plan.gatewayEndpoint">
                        · {{ plan.gatewayEndpoint }}
                      </template>
                    </div>
                  </div>
                  <div class="plan-meta">
                    <div class="plan-meta-line">
                      <span class="label">Storage</span>
                      <span class="value">
                        {{
                          plan.storageGbPerMonth
                            ? `${plan.storageGbPerMonth} GB / month`
                            : 'Not specified'
                        }}
                      </span>
                    </div>
                    <div class="plan-meta-line">
                      <span class="label">Egress</span>
                      <span class="value">
                        {{
                          plan.networkGbPerMonth
                            ? `${plan.networkGbPerMonth} GB / month`
                            : 'Fair usage'
                        }}
                      </span>
                    </div>
                    <div class="plan-meta-line">
                      <span class="label">Price</span>
                      <span class="value">
                        {{ formatPlanPrice(plan.priceUlmn) }}
                      </span>
                    </div>
                  </div>
                </div>
                </div>

                <!-- Filters -->
                <div class="plans-controls">
                  <div class="plans-search-group">
                    <div class="plans-search-input">
                      <input
                        v-model.trim="planFilter"
                        type="search"
                        placeholder="Search gateways or plans"
                        class="plans-filter-input"
                        @keydown.stop
                        aria-label="Search gateways"
                      />
                    </div>
                  </div>
                </div>

                <div v-if="!planGroups.length" class="plans-empty">
                  <h4>No gateways match your filters</h4>
                  <p class="plans-empty-muted">
                    Try clearing filters or search.
                  </p>
                  <div class="plans-empty-actions">
                    <button
                      v-if="planFilter"
                      type="button"
                      class="btn-ghost"
                      @click="planFilter = ''"
                    >
                      Clear search
                    </button>
                  </div>
                </div>

                <!-- Grouped by gateway -->
                <div v-if="planGroups.length" class="plans-grid">
                  <article
                    v-for="group in planGroups"
                    :key="group.gateway.id"
                    class="gateway-card"
                    :class="{ offline: !group.gateway.active }"
                  >
                    <header class="gateway-card-header">
                      <div class="gateway-title">
                        <span
                          class="gateway-status-dot"
                          :class="group.gateway.active ? 'ok' : 'off'"
                        ></span>
                        <span
                          class="gateway-name"
                          :title="planGatewayLabel(group.gateway)"
                        >
                          {{ planGatewayLabel(group.gateway) }}
                        </span>
                      </div>
                      <div class="gateway-meta">
                        <span v-if="group.gateway.regions.length" class="gateway-meta-item">
                          {{ group.gateway.regions.join(', ') }}
                        </span>
                        <span class="gateway-plan-chips">
                          <span
                            v-for="plan in group.plans"
                            :key="plan.id + '-chip'"
                            class="plan-chip"
                          >
                            <span class="plan-chip-price">
                              {{ formatPlanPriceShort(plan.priceUlmn) }}
                            </span>
                          </span>
                        </span>
                        <button
                          type="button"
                          class="gateway-expand-btn"
                          @click.stop="toggleGatewayExpanded(group.gateway.id)"
                        >
                          {{ isGatewayExpanded(group.gateway.id) ? 'Hide details' : 'Show details' }}
                        </button>
                      </div>
                    </header>

                    <div class="gateway-plans">
                      <div
                        v-if="isGatewayExpanded(group.gateway.id)"
                        class="gateway-plan-details"
                      >
                        <div
                          v-for="plan in group.plans"
                          :key="plan.id"
                          class="plan-row"
                        >
                        <div class="plan-main">
                          <div class="plan-title-row">
                            <span class="plan-name">{{ planDisplayName(plan) }}</span>
                          </div>
                          <div class="plan-gw">
                            {{ plan.gatewayName }}
                            <template v-if="plan.gatewayEndpoint">
                              · {{ plan.gatewayEndpoint }}
                            </template>
                          </div>
                        </div>
                        <div class="plan-meta">
                          <div class="plan-meta-line">
                            <span class="label">Storage</span>
                            <span class="value">
                              {{
                                plan.storageGbPerMonth
                                  ? `${plan.storageGbPerMonth} GB / month`
                                  : 'Not specified'
                              }}
                            </span>
                          </div>
                          <div class="plan-meta-line">
                            <span class="label">Egress</span>
                            <span class="value">
                              {{
                                plan.networkGbPerMonth
                                  ? `${plan.networkGbPerMonth} GB / month`
                                  : 'Fair usage'
                              }}
                            </span>
                          </div>
                          <div class="plan-meta-line">
                            <span class="label">Price</span>
                            <span class="value">
                              {{ formatPlanPrice(plan.priceUlmn) }}
                            </span>
                          </div>
                        </div>
                        <div class="plan-footer">
                          <button
                            v-if="planStatus(plan) === 'none'"
                            type="button"
                            class="plan-status-badge"
                            @click.stop="openSubscribeModal(plan)"
                          >
                            {{ planStatusLabel(plan) }}
                          </button>
                          <span
                            v-else
                            class="plan-status-badge"
                            :class="{
                              active: planStatus(plan) === 'active',
                              pending: planStatus(plan) === 'pending'
                            }"
                          >
                            {{ planStatusLabel(plan) }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  </article>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Subscribe Plan Modal -->
      <Transition name="modal">
        <div v-if="showSubscribeModal && subscribePlan" class="modal-overlay" @click="closeSubscribeModal">
          <div class="modal-content" @click.stop>
            <div class="modal-header">
              <h3>Confirm subscription "{{ planDisplayName(subscribePlan) }}"</h3>
              <button class="modal-close" @click="closeSubscribeModal">
                <X :size="20" />
              </button>
            </div>
            <div class="modal-body">
              <p class="modal-desc">
                Review the plan details and confirm your subscription.
              </p>

              <div class="permalink-result-box" v-if="subscribePlan">
                <div class="plan-meta-line">
                  <span class="label">Gateway</span>
                  <span class="value">
                    {{ subscribePlan.gatewayName }}
                    <template v-if="subscribePlan.gatewayEndpoint">
                      · {{ subscribePlan.gatewayEndpoint }}
                    </template>
                  </span>
                </div>
                <div class="plan-meta-line">
                  <span class="label">Price / month</span>
                  <span class="value">
                    {{ formatPlanPrice(subscribePlan.priceUlmn) }}
                  </span>
                </div>
                <div class="plan-meta-line">
                  <span class="label">Storage</span>
                  <span class="value">
                    {{
                      subscribePlan.storageGbPerMonth
                        ? `${subscribePlan.storageGbPerMonth} GB / month`
                        : 'Not specified'
                    }}
                  </span>
                </div>
                <div class="plan-meta-line">
                  <span class="label">Egress</span>
                  <span class="value">
                    {{
                      subscribePlan.networkGbPerMonth
                        ? `${subscribePlan.networkGbPerMonth} GB / month`
                        : 'Fair usage'
                    }}
                  </span>
                </div>
                <div class="plan-meta-line">
                  <span class="label">Duration</span>
                  <span class="value">
                    {{ subscribeMonths }} month{{ subscribeMonths > 1 ? 's' : '' }}
                  </span>
                </div>
                <div class="plan-meta-line">
                  <span class="label">Total</span>
                  <span class="value">
                    {{ subscribeTotalPrice.toFixed(subscribeTotalPrice >= 10 ? 0 : 2) }} LMN
                  </span>
                </div>
                <div class="plan-meta-line">
                  <span class="label">Balance</span>
                  <span class="value">
                    <template v-if="subscribeBalance !== null">
                      {{ subscribeBalance.toFixed(subscribeBalance >= 10 ? 0 : 2) }} LMN
                    </template>
                    <template v-else-if="subscribeBalanceLoading">
                      Loading...
                    </template>
                    <template v-else>
                      —
                    </template>
                  </span>
                </div>
                <p v-if="hasInsufficientFunds" class="txt-xs color-red-base" style="margin-top: 0.5rem;">
                  You can't subscribe because your wallet balance is too low.
                </p>
              </div>

              <div v-if="subscribeError" class="fetch-error txt-xs margin-top-25">
                {{ subscribeError }}
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn-modal-secondary" type="button" @click="closeSubscribeModal" :disabled="subscribeBusy">
                Cancel
              </button>
              <button
                class="btn-modal-primary"
                type="button"
                @click="confirmSubscribe"
                :disabled="subscribeBusy || hasInsufficientFunds || !subscribePlan"
              >
                <UiSpinner v-if="subscribeBusy" size="sm" />
                <span v-else>Confirm</span>
              </button>
            </div>
          </div>
        </div>
      </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, inject } from 'vue';
import { 
  HardDrive, Download, Database, Plus, Upload,
  ExternalLink, Trash2, X, Share2,
  FileText, FileImage, FileVideo, FileAudio, FileArchive, File,
  CheckCircle, AlertCircle, LayoutGrid, List, TableProperties
} from 'lucide-vue-next';
import UiSpinner from '../../ui/UiSpinner.vue';
import { LOCAL_IPFS_GATEWAY_BASE, loadWhitelistedGatewayBases } from '../services/contentResolver';

interface DriveFile {
  cid: string;
  name: string;
  size: number;
  uploadedAt?: number;
  type?: 'file' | 'dir';
  rootCid?: string;
  relPath?: string;
}

interface IpfsStats {
  repoSize: number;
  storageMax: number;
  numObjects: number;
}

type HostingKind = 'local' | 'gateway';
type HostingState = { kind: HostingKind; gatewayId: string };

const viewMode = ref<'grid' | 'list' | 'details'>('details');
const files = ref<DriveFile[]>([]);
const pinnedFiles = ref<string[]>([]);
const selectedFile = ref<DriveFile | null>(null);
const ipfsConnected = ref(false);
const stats = ref<IpfsStats | null>(null);
const hosting = ref<HostingState>({ kind: 'local', gatewayId: '' });

const uploading = ref(false);
const uploadingFile = ref('');
const isDragging = ref(false);
const showUploadMenu = ref(false);

const toast = ref('');
const toastType = ref<'success' | 'error'>('success');

const openInNewTab = inject<((url: string) => void) | null>('openInNewTab', null);

  const STORAGE_KEY = 'lumen_drive_files';
  const LOCAL_NAMES_KEY = 'lumen_drive_saved_names';
  const localNames = ref<Record<string, string>>({});
  const renameDraft = ref('');
  const imagePreviewUrls = ref<Record<string, string>>({});
  const imagePreviewTried = ref<Record<string, boolean>>({});
  const imagePreviewInFlight = new Set<string>();
  
  // Gateway / PQC usage (DrivePanel-style)
  const gatewayUsage = ref<any | null>(null);
  const gatewayUsageError = ref('');
  const gatewayUsageLoading = ref(false);
  const gatewayPinned = ref<string[]>([]);
  const gatewayPinnedError = ref('');
  const gatewayPinnedLoading = ref(false);
  const gatewayBase = ref<string | null>(null);

  // Gateway plans (DrivePanel-style "Plans" entry)
  type PlanView = {
    id: string;
    planId: string;
    gatewayId: string;
    gatewayName: string;
    gatewayEndpoint?: string;
    priceUlmn: number;
    storageGbPerMonth?: number;
    networkGbPerMonth?: number;
    monthsTotal: number;
    description?: string;
  };

  type SubscriptionView = {
    id: string;
    gatewayId: string;
    status: string;
    metadata?: Record<string, any>;
  };

  type GatewayView = {
    id: string;
    endpoint: string;
    operator: string;
    regions: string[];
    active: boolean;
    score?: number;
  };

  const showPlansModal = ref(false);
  const plans = ref<PlanView[]>([]);
  const planSubscriptionsRaw = ref<SubscriptionView[]>([]);
  const gateways = ref<GatewayView[]>([]);
  const plansLoading = ref(false);
  const plansError = ref('');
  const planFilter = ref('');
  const planRegion = ref('');
  const planOnlineOnly = ref(false);
  const planSortBy = ref<'score-desc' | 'name-asc' | 'name-desc'>('score-desc');

  // Local details
  const showLocalDetails = ref(false);

  // Subscription details
  const showGatewayDetails = ref(false);

  const planRegions = computed(() => {
    const set = new Set<string>();
    for (const gw of gateways.value) {
      (gw.regions || []).forEach((r) => set.add(r));
    }
    return Array.from(set).sort();
  });

  const hasPlanFilters = computed(() => {
    return (
      !!planRegion.value ||
      !!planOnlineOnly.value ||
      !!planFilter.value.trim()
    );
  });

  function resetPlanFilters() {
    planFilter.value = '';
    planRegion.value = '';
    planOnlineOnly.value = false;
    planSortBy.value = 'score-desc';
  }

  function planGatewayDisplay(gw: GatewayView): string {
    if (gw.endpoint) return gw.endpoint;
    if (gw.operator) return `Gateway · ${gw.operator}`;
    return `Gateway ${gw.id}`;
  }

  function planGatewayLabel(gw: GatewayView): string {
    return planGatewayDisplay(gw);
  }

  const expandedGatewayIds = ref<Set<string>>(new Set());

  function toggleGatewayExpanded(id: string) {
    const key = String(id || '').trim();
    if (!key) return;
    const next = new Set(expandedGatewayIds.value);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    expandedGatewayIds.value = next;
  }

  function isGatewayExpanded(id: string): boolean {
    const key = String(id || '').trim();
    return expandedGatewayIds.value.has(key);
  }

  const planGroups = computed(() => {
    const query = planFilter.value.trim().toLowerCase();
    const region = planRegion.value;
    const onlyOnline = planOnlineOnly.value;

    let gwList = gateways.value.slice();

    gwList = gwList.filter((gw) => {
      if (onlyOnline && !gw.active) return false;
      if (region && !(gw.regions || []).includes(region)) return false;

      if (!query) return true;

      const haystack = `${planGatewayLabel(gw)} ${gw.operator}`.toLowerCase();
      if (haystack.includes(query)) return true;

      const plansForGw = plans.value.filter((p) => p.gatewayId === gw.id);
      return plansForGw.some((p) => {
        const name = planDisplayName(p).toLowerCase();
        const ep = String(p.gatewayEndpoint || '').toLowerCase();
        return name.includes(query) || ep.includes(query);
      });
    });

    if (planSortBy.value === 'score-desc') {
      gwList.sort(
        (a, b) =>
          (b.score ?? 0) - (a.score ?? 0) ||
          planGatewayLabel(a).localeCompare(planGatewayLabel(b)),
      );
    } else if (planSortBy.value === 'name-asc') {
      gwList.sort((a, b) =>
        planGatewayLabel(a).localeCompare(planGatewayLabel(b)),
      );
    } else if (planSortBy.value === 'name-desc') {
      gwList.sort((a, b) =>
        planGatewayLabel(b).localeCompare(planGatewayLabel(a)),
      );
    }

    const groups = gwList
      .map((gw) => {
        const gwPlans = plans.value.filter((p) => p.gatewayId === gw.id);
        if (!gwPlans.length) return null;
        return { gateway: gw, plans: gwPlans };
      })
      .filter(Boolean) as { gateway: GatewayView; plans: PlanView[] }[];

    return groups;
  });

const activeSavedCids = computed(() => {
  return hosting.value.kind === 'gateway' ? gatewayPinned.value : pinnedFiles.value;
});

const localSavedCount = computed(() => pinnedFiles.value.length);

const entryTypeCache = ref<Record<string, 'file' | 'dir'>>({});

const browseRootCid = ref('');
const browseRelPath = ref('');
const browseEntries = ref<DriveFile[]>([]);
const browseLoading = ref(false);
const browseError = ref('');

const isBrowsing = computed(() => !!browseRootCid.value);

function encodeIpfsTarget(target: string): string {
  const cleaned = String(target || '').replace(/^\/+/, '').replace(/\/+$/, '');
  if (!cleaned) return '';
  const parts = cleaned.split('/').filter(Boolean);
  const cid = parts[0] || '';
  const rest = parts.slice(1).map((s) => encodeURIComponent(s)).join('/');
  return rest ? `${cid}/${rest}` : cid;
}

function contentTargetFor(file: DriveFile): string {
  const root = String(file?.rootCid || '').trim();
  const rel = String(file?.relPath || '').replace(/^\/+/, '').replace(/\/+$/, '');
  if (root) return rel ? `${root}/${rel}` : root;
  return String(file?.cid || '').trim();
}

const rootSavedEntries = computed<DriveFile[]>(() => {
  return activeSavedCids.value.map((cid) => {
    const existing = files.value.find((f) => f.cid === cid);
    const cachedType = entryTypeCache.value[String(cid)] || undefined;
    return {
      cid,
      name: getSavedName(cid),
      size: existing?.size ?? 0,
      uploadedAt: existing?.uploadedAt,
      type: cachedType,
      rootCid: cid,
      relPath: '',
    };
  });
});

const displayFiles = computed<DriveFile[]>(() => {
  return isBrowsing.value ? browseEntries.value : rootSavedEntries.value;
});

const sidebarFilesCount = computed(() => {
  return activeSavedCids.value.length;
});

const activeGateway = computed(() => {
  const id = String(hosting.value.gatewayId || '').trim();
  if (!id) return null;
  return gateways.value.find((g) => String(g.id) === id) || null;
});

const activeGatewayHint = computed(() => {
  const gw = activeGateway.value;
  if (gw?.endpoint) return String(gw.endpoint).trim();
  const gid = String(hosting.value.gatewayId || '').trim();
  if (!gid) return '';
  const sub = planSubscriptionsRaw.value.find((s) => String(s.gatewayId) === gid);
  const metaEndpoint = sub?.metadata?.endpoint ?? sub?.metadata?.baseUrl ?? sub?.metadata?.url;
  if (typeof metaEndpoint === 'string' && metaEndpoint.trim()) return metaEndpoint.trim();
  const plan = plans.value.find((p) => String(p.gatewayId) === gid);
  const planEndpoint = plan?.gatewayEndpoint;
  return typeof planEndpoint === 'string' ? planEndpoint.trim() : '';
});

const activeGatewayLabel = computed(() => {
  const gw = activeGateway.value;
  if (!gw) return '—';
  return gw.endpoint || `Gateway ${gw.id}`;
});

const hostingLabel = computed(() => {
  if (hosting.value.kind === 'gateway') return activeGatewayLabel.value || 'Gateway';
  return 'Local';
});

const headerTitle = computed(() => {
  return hosting.value.kind === 'gateway' ? hostingLabel.value : 'Local';
});

const browseRootName = computed(() => {
  const cid = String(browseRootCid.value || '').trim();
  if (!cid) return '';
  const name = getSavedName(cid);
  return name && name !== 'Unknown' ? name : cid;
});

const browseCrumbs = computed(() => {
  const p = String(browseRelPath.value || '').replace(/^\/+/, '').replace(/\/+$/, '');
  if (!p) return [] as { label: string; path: string }[];
  const parts = p.split('/').filter(Boolean);
  return parts.map((label, idx) => ({ label, path: parts.slice(0, idx + 1).join('/') }));
});

const headerSubtitle = computed(() => {
  if (isBrowsing.value) {
    const suffix = browseRelPath.value ? `/${browseRelPath.value}` : '/';
    return `Browsing: ${browseRootName.value}${suffix}`;
  }
  return hosting.value.kind === 'gateway'
     ? 'Saved files on your cloud plan'
     : 'Saved files on your local node';
});

function deriveGatewayStatus(subs: SubscriptionView[]): 'active' | 'pending' | 'off' {
  const normalized = subs.map((s) => String(s.status || '').toLowerCase());
  if (normalized.some((s) => s.includes('active'))) return 'active';
  if (normalized.some((s) => s.includes('pending'))) return 'pending';
  return 'off';
}

const subscriptionRows = computed(() => {
  const byGateway = new Map<string, SubscriptionView[]>();
  for (const sub of planSubscriptionsRaw.value) {
    const gid = String(sub.gatewayId || '').trim();
    if (!gid) continue;
    if (!byGateway.has(gid)) byGateway.set(gid, []);
    byGateway.get(gid)!.push(sub);
  }

  const rows = Array.from(byGateway.entries()).map(([gatewayId, subs]) => {
    const gw = gateways.value.find((g) => String(g.id) === gatewayId) || null;
    const status = deriveGatewayStatus(subs);
    const statusDot = status === 'active' ? 'ok' : status === 'pending' ? 'pending' : 'off';
    const endpoint = gw?.endpoint ? String(gw.endpoint).trim() : '';
    const labelBase = endpoint || (gw?.operator ? `Gateway ${gw.operator}` : `Gateway ${gatewayId}`);
    const label = labelBase.replace(/^gtw\./i, '');
    const hoverTitle = endpoint || labelBase;
    const region = gw?.regions?.[0] || '';
    const planTags = Array.from(
      new Set(
        subs
          .map((s) => String(s?.metadata?.planId ?? s?.metadata?.plan_id ?? '').trim())
          .filter(Boolean)
          .map((planId) => {
            const plan =
              plans.value.find((p) => p.gatewayId === gatewayId && p.planId === planId) ||
              plans.value.find((p) => p.gatewayId === gatewayId && p.id === planId) ||
              null;
            return plan ? planDisplayName(plan) : planId;
          })
      )
    ).slice(0, 4);

    return { gatewayId, label, hoverTitle, region, status, statusDot, planTags };
  });

  rows.sort((a, b) => a.label.localeCompare(b.label));
  return rows;
});

const activeSubscriptionRow = computed(() => {
  if (hosting.value.kind !== 'gateway') return null;
  return subscriptionRows.value.find((r) => r.gatewayId === hosting.value.gatewayId) || null;
});

const activeSubscriptionStatusLabel = computed(() => {
  const row = activeSubscriptionRow.value;
  if (!row) return '—';
  if (row.status === 'active') return 'Active';
  if (row.status === 'pending') return 'Pending';
  return 'Off';
});

const activeSubscriptionStatusClass = computed(() => {
  const row = activeSubscriptionRow.value;
  if (!row) return 'off';
  return row.status === 'active' ? 'ok' : row.status === 'pending' ? 'pending' : 'off';
});

const gatewayBandwidthUsed = computed(() => {
  const u = gatewayUsage.value?.usage || {};
  const raw =
    u?.netMonth?.bytes ??
    u?.net_month?.bytes ??
    u?.net_month_bytes ??
    u?.netMonthBytes ??
    u?.bandwidthMonth?.bytes ??
    u?.bandwidth_month?.bytes ??
    u?.bandwidth_month_bytes ??
    null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? formatSize(n) : '-';
});

const toastIcon = computed(() => toastType.value === 'success' ? CheckCircle : AlertCircle);

  onMounted(async () => {
    await checkIpfsStatus();
    loadFiles();
    loadLocalNames();
    loadStats();
    void loadPinnedFiles();

    void refreshGatewayOverview();
    
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);
    document.addEventListener('click', handleDocumentClick);
  });

onUnmounted(() => {
  document.removeEventListener('dragover', handleDragOver);
  document.removeEventListener('dragleave', handleDragLeave);
  document.removeEventListener('drop', handleDrop);
  document.removeEventListener('click', handleDocumentClick);

  for (const url of Object.values(imagePreviewUrls.value)) {
    if (typeof url === 'string' && url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }
  }
  imagePreviewUrls.value = {};
  imagePreviewTried.value = {};
});

function handleDragOver(e: DragEvent) {
  e.preventDefault();
  isDragging.value = true;
}

function handleDragLeave(e: DragEvent) {
  if (e.relatedTarget === null) {
    isDragging.value = false;
  }
}

function handleDocumentClick() {
  showUploadMenu.value = false;
}

function toggleUploadMenu() {
  showUploadMenu.value = !showUploadMenu.value;
}

async function handleDrop(e: DragEvent) {
  e.preventDefault();
  isDragging.value = false;

  if (!ipfsConnected.value) {
    showToast('IPFS not connected', 'error');
    return;
  }

  const dt = e.dataTransfer;
  if (!dt) return;

  const items = Array.from(dt.items || []);
  const supportsEntries = items.some((it: any) => typeof it?.webkitGetAsEntry === 'function');

  if (supportsEntries) {
    const rootFiles: File[] = [];
    const folderGroups = new Map<string, { path: string; file: File }[]>();

    async function readAllDirEntries(dirEntry: any): Promise<any[]> {
      const reader = dirEntry.createReader();
      const out: any[] = [];
      while (true) {
        const batch: any[] = await new Promise((resolve) => reader.readEntries(resolve));
        if (!batch || batch.length === 0) break;
        out.push(...batch);
      }
      return out;
    }

    async function collectEntryFiles(entry: any, basePath: string): Promise<{ path: string; file: File }[]> {
      if (!entry) return [];
      if (entry.isFile) {
        const f: File = await new Promise((resolve, reject) => entry.file(resolve, reject));
        const name = String(f?.name || entry.name || 'file');
        const path = basePath ? `${basePath}/${name}` : name;
        return [{ path, file: f }];
      }
      if (entry.isDirectory) {
        const dirName = String(entry.name || '').trim();
        const nextBase = basePath ? `${basePath}/${dirName}` : dirName;
        const children = await readAllDirEntries(entry);
        const all: { path: string; file: File }[] = [];
        for (const c of children) {
          all.push(...(await collectEntryFiles(c, nextBase)));
        }
        return all;
      }
      return [];
    }

    for (const it of items) {
      const entry = (it as any)?.webkitGetAsEntry?.();
      if (!entry) continue;
      if (entry.isFile) {
        const f = it.getAsFile();
        if (f) rootFiles.push(f);
        continue;
      }
      if (entry.isDirectory) {
        const rootName = String(entry.name || 'folder');
        const all = await collectEntryFiles(entry, rootName);
        const rel = all
          .map(({ path, file }) => {
            const normalized = String(path).replace(/\\/g, '/').replace(/^\/+/, '');
            const prefix = `${rootName}/`;
            const relPath = normalized.startsWith(prefix) ? normalized.slice(prefix.length) : normalized;
            return { path: relPath, file };
          })
          .filter((x) => x.path && x.file);
        folderGroups.set(rootName, rel);
      }
    }

    for (const f of rootFiles) {
      await uploadFile(f);
    }
    for (const [rootName, files] of folderGroups.entries()) {
      await uploadDirectory(rootName, files);
    }
    return;
  }

  const droppedFiles = dt.files;
  if (droppedFiles?.length) {
    for (const file of Array.from(droppedFiles)) {
      await uploadFile(file);
    }
  }
}

  async function checkIpfsStatus() {
    try {
      const result = await (window as any).lumen?.ipfsStatus?.();
      ipfsConnected.value = result?.ok === true;
    } catch {
      ipfsConnected.value = false;
    }
  }

  function selectHosting(kind: HostingKind) {
    if (kind === hosting.value.kind) return;
    if (kind === 'gateway') return;
    hosting.value = { kind, gatewayId: '' };
    gatewayBase.value = null;
    void checkIpfsStatus();
    void loadStats();
    void loadPinnedFiles();
  }

  function selectGateway(gatewayId: string) {
    const gid = String(gatewayId || '').trim();
    if (!gid) return;
    hosting.value = { kind: 'gateway', gatewayId: gid };
    void refreshActiveGatewayData();
  }

  function openLocalDetails() {
    showLocalDetails.value = true;
    void checkIpfsStatus();
    void loadStats();
    void loadPinnedFiles();
  }

  function closeLocalDetails() {
    showLocalDetails.value = false;
  }

  function openGatewayDetails(gatewayId: string) {
    selectGateway(gatewayId);
    showGatewayDetails.value = true;
  }

  function closeGatewayDetails() {
    showGatewayDetails.value = false;
  }

  async function refreshActiveGatewayData() {
    if (hosting.value.kind !== 'gateway') return;
    const hint = activeGatewayHint.value;
    await refreshGatewayBase(hint);
    await refreshGatewayUsage(hint);
    await refreshGatewayPinned(hint);
  }

  async function refreshActiveGatewayPinned() {
    if (hosting.value.kind !== 'gateway') return;
    await refreshGatewayPinned(activeGatewayHint.value);
  }

  async function refreshGatewayOverview() {
    try {
      const api: any = (window as any).lumen;
      const profilesApi = api?.profiles;
      const gwApi = api?.gateway;
      if (!profilesApi || !gwApi || !gwApi.getPlansOverview) return;

      const active = await profilesApi.getActive?.().catch(() => null);
      const profileId = active?.id;
      if (!profileId) return;

      const res = await gwApi.getPlansOverview(profileId).catch(() => null);
      if (!res || res.ok === false) return;

      const list = Array.isArray(res.plans) ? res.plans : [];
      plans.value = list
        .map((p: any) => ({
          id: String(p?.id ?? ''),
          planId: String(p?.planId ?? p?.id ?? ''),
          gatewayId: String(p?.gatewayId ?? ''),
          gatewayName: String(p?.gatewayName ?? p?.gateway ?? `Gateway ${p?.gatewayId ?? ''}`),
          gatewayEndpoint: p?.gatewayEndpoint,
          priceUlmn: Number(p?.priceUlmn ?? 0),
          storageGbPerMonth: p?.storageGbPerMonth != null ? Number(p.storageGbPerMonth) : undefined,
          networkGbPerMonth: p?.networkGbPerMonth != null ? Number(p.networkGbPerMonth) : undefined,
          monthsTotal: Math.max(1, Number(p?.monthsTotal ?? 1)),
          description: p?.description ?? '',
        }))
        .filter((p: PlanView) => p.planId && p.gatewayId);

      const gwRaw = Array.isArray(res.gateways) ? res.gateways : [];
      const gwMap = new Map<string, GatewayView>();
      for (const g of gwRaw) {
        const id = String(g?.id ?? g?.gatewayId ?? '').trim();
        if (!id) continue;
        if (gwMap.has(id)) continue;
        const endpoint = String(g?.endpoint ?? g?.baseUrl ?? g?.url ?? '').trim();
        const regions = Array.isArray(g?.regions)
          ? g.regions.map((r: any) => String(r || '')).filter(Boolean)
          : [];
        const active =
          typeof g?.active === 'boolean'
            ? g.active
            : !!(g?.Active ?? g?.isActive ?? true);
        const score =
          g?.score != null
            ? Number(g.score)
            : g?.metadata && g.metadata.score != null
            ? Number(g.metadata.score)
            : undefined;
        gwMap.set(id, {
          id,
          endpoint,
          operator: String(g?.operator ?? ''),
          regions,
          active,
          score,
        });
      }
      gateways.value = Array.from(gwMap.values());

      const subsRaw = Array.isArray(res.subscriptions) ? res.subscriptions : [];
      planSubscriptionsRaw.value = subsRaw.map((s: any) => ({
        id: String(s?.id ?? ''),
        gatewayId: String(s?.gatewayId ?? s?.gateway_id ?? ''),
        status: String(s?.status ?? '').toLowerCase(),
        metadata: typeof s?.metadata === 'object' ? s.metadata : undefined,
      }));
    } catch {
      // ignore background refresh errors
    }
  }

  async function refreshGatewayBase(baseUrlHint?: string) {
    try {
      const api: any = (window as any).lumen;
      const profilesApi = api?.profiles;
      const gwApi = api?.gateway;
      if (!profilesApi || !gwApi || !gwApi.getBaseUrl) return;

      const active = await profilesApi.getActive?.().catch(() => null);
      const profileId = active?.id;
      if (!profileId) return;

      const res = await gwApi.getBaseUrl(profileId, baseUrlHint).catch(() => null);
      if (!res || res.ok === false) {
        gatewayBase.value = null;
        return;
      }
      gatewayBase.value =
        typeof res.baseUrl === 'string' ? String(res.baseUrl) : null;
      } catch {
        gatewayBase.value = null;
      }
    }

  async function openPlansModal() {
    try {
      const api: any = (window as any).lumen;
      const profilesApi = api?.profiles;
      const gwApi = api?.gateway;
      if (!profilesApi || !gwApi || !gwApi.getPlansOverview) return;

      showPlansModal.value = true;
      plansLoading.value = true;
      plansError.value = '';
      plans.value = [];
      planSubscriptionsRaw.value = [];

      const active = await profilesApi.getActive?.().catch(() => null);
      const profileId = active?.id;
      if (!profileId) {
        plansError.value = 'No active profile';
        plansLoading.value = false;
        return;
      }

      const res = await gwApi.getPlansOverview(profileId).catch(() => null);
      if (!res || res.ok === false) {
        plansError.value = String(res?.error || 'Unable to load plans.');
        plansLoading.value = false;
        return;
      }

      const list = Array.isArray(res.plans) ? res.plans : [];
      plans.value = list
        .map((p: any) => ({
          id: String(p?.id ?? ''),
          planId: String(p?.planId ?? p?.id ?? ''),
          gatewayId: String(p?.gatewayId ?? ''),
          gatewayName: String(
            p?.gatewayName ?? p?.gateway ?? `Gateway ${p?.gatewayId ?? ''}`
          ),
          gatewayEndpoint: p?.gatewayEndpoint,
          priceUlmn: Number(p?.priceUlmn ?? 0),
          storageGbPerMonth:
            p?.storageGbPerMonth != null
              ? Number(p.storageGbPerMonth)
              : undefined,
          networkGbPerMonth:
            p?.networkGbPerMonth != null
              ? Number(p.networkGbPerMonth)
              : undefined,
          monthsTotal: Math.max(1, Number(p?.monthsTotal ?? 1)),
          description: p?.description ?? '',
        }))
        .filter((p: PlanView) => p.planId && p.gatewayId);

      const gwRaw = Array.isArray(res.gateways) ? res.gateways : [];
      const gwMap = new Map<string, GatewayView>();
      for (const g of gwRaw) {
        const id = String(g?.id ?? g?.gatewayId ?? '').trim();
        if (!id) continue;
        const existing = gwMap.get(id);
        if (existing) continue;
        const endpoint = String(g?.endpoint ?? g?.baseUrl ?? g?.url ?? '').trim();
        const regions = Array.isArray(g?.regions)
          ? g.regions.map((r: any) => String(r || '')).filter(Boolean)
          : [];
        const active =
          typeof g?.active === 'boolean'
            ? g.active
            : !!(g?.Active ?? g?.isActive ?? true);
        const score =
          g?.score != null
            ? Number(g.score)
            : g?.metadata && g.metadata.score != null
            ? Number(g.metadata.score)
            : undefined;
        gwMap.set(id, {
          id,
          endpoint,
          operator: String(g?.operator ?? ''),
          regions,
          active,
          score,
        });
      }
      gateways.value = Array.from(gwMap.values());

      const subsRaw = Array.isArray(res.subscriptions)
        ? res.subscriptions
        : [];
      planSubscriptionsRaw.value = subsRaw.map((s: any) => ({
        id: String(s?.id ?? ''),
        gatewayId: String(s?.gatewayId ?? s?.gateway_id ?? ''),
        status: String(s?.status ?? '').toLowerCase(),
        metadata:
          typeof s?.metadata === 'object'
            ? s.metadata
            : undefined,
      }));
    } catch (e: any) {
      plansError.value = String(e?.message || 'Unable to load plans.');
    } finally {
      plansLoading.value = false;
    }
  }

  function closePlansModal() {
    showPlansModal.value = false;
  }

  function planKey(plan: PlanView): string {
    return `${plan.gatewayId}:${plan.planId}`.toLowerCase();
  }

  function buildSubscriptionMap() {
    const map = new Map<string, SubscriptionView[]>();
    for (const sub of planSubscriptionsRaw.value) {
      const metaPlanId = String(sub.metadata?.planId ?? '').toLowerCase();
      const key = metaPlanId
        ? `${sub.gatewayId}:${metaPlanId}`.toLowerCase()
        : `${sub.gatewayId}`.toLowerCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(sub);
    }
    return map;
  }

  const planSubscriptions = computed(() => buildSubscriptionMap());

  function planStatus(plan: PlanView): string {
    const key = planKey(plan);
    const candidates = planSubscriptions.value.get(key);
    if (candidates && candidates.length) {
      const active = candidates.find((s) => s.status === 'active');
      if (active) return 'active';
      const pending = candidates.find((s) => s.status === 'pending');
      if (pending) return 'pending';
      return candidates[0].status || 'unknown';
    }
    const fallback = planSubscriptions.value.get(
      plan.gatewayId.toLowerCase()
    );
    if (fallback && fallback.length) return fallback[0].status || 'unknown';
    return 'none';
  }

  function planStatusLabel(plan: PlanView): string {
    const status = planStatus(plan);
    switch (status) {
      case 'active':
        return 'Subscribed';
      case 'pending':
        return 'Pending';
      case 'cancelled':
      case 'canceled':
        return 'Cancelled';
      case 'completed':
        return 'Completed';
      default:
        return 'Subscribe';
    }
  }

  function planDisplayName(plan: PlanView): string {
    return plan.planId?.split(':').pop() || 'Plan';
  }

  function formatPlanPrice(ulmn: number): string {
    const lmn = ulmn / 1_000_000;
    if (!ulmn) return 'Free';
    return `${lmn.toFixed(lmn >= 10 ? 0 : 2)} LMN / mo`;
  }

  function formatPlanPriceShort(ulmn: number): string {
    const lmn = ulmn / 1_000_000;
    if (!ulmn) return 'Free';
    return lmn >= 10 ? `${lmn.toFixed(0)} LMN` : `${lmn.toFixed(2)} LMN`;
  }

  const showSubscribeModal = ref(false);
  const subscribePlan = ref<PlanView | null>(null);
  const subscribeMonths = ref(1);
  const subscribeBusy = ref(false);
  const subscribeError = ref('');
  const subscribeBalance = ref<number | null>(null);
  const subscribeBalanceLoading = ref(false);

  function normalizeSubscribeError(raw: string): string {
    const msg = String(raw || '').trim();
    if (!msg) return 'Subscription failed';
    if (/insufficient funds/i.test(msg) || /spendable balance/i.test(msg)) {
      return 'Insufficient funds.';
    }
    return msg;
  }

  function openSubscribeModal(plan: PlanView) {
    subscribePlan.value = plan;
    subscribeMonths.value = Math.max(1, plan.monthsTotal || 1);
    subscribeError.value = '';
    showSubscribeModal.value = true;
    void loadSubscribeBalance();
  }

  function closeSubscribeModal() {
    if (subscribeBusy.value) return;
    showSubscribeModal.value = false;
    subscribePlan.value = null;
    subscribeError.value = '';
    subscribeBalance.value = null;
    subscribeBalanceLoading.value = false;
  }

  async function loadSubscribeBalance() {
    subscribeBalanceLoading.value = true;
    try {
      const api: any = (window as any).lumen;
      const profilesApi = api?.profiles;
      const walletApi = api?.wallet;
      if (!profilesApi || !walletApi) return;
      const active = await profilesApi.getActive?.().catch(() => null);
      const address = active?.walletAddress || active?.address;
      if (!address) return;
      const res = await walletApi.getBalance(address).catch(() => null);
      const amount =
        res?.balance?.amount ??
        res?.amount ??
        res?.amount_ulmn ??
        res?.balance ??
        res?.data?.balance?.amount ??
        res?.data?.amount;
      const lmn =
        typeof amount === 'number'
          ? amount / 1_000_000
          : typeof amount === 'string'
          ? Number(amount) / 1_000_000
          : null;
      if (lmn !== null && Number.isFinite(lmn)) {
        subscribeBalance.value = Math.max(0, lmn);
      }
    } catch {
      subscribeBalance.value = null;
    } finally {
      subscribeBalanceLoading.value = false;
    }
  }

  const subscribeTotalPrice = computed(() => {
    const plan = subscribePlan.value;
    if (!plan) return 0;
    return (plan.priceUlmn * subscribeMonths.value) / 1_000_000;
  });

  const hasInsufficientFunds = computed(() => {
    if (subscribeBalance.value === null) return false;
    return subscribeTotalPrice.value > subscribeBalance.value + 1e-8;
  });

  async function confirmSubscribe() {
    const plan = subscribePlan.value;
    if (!plan || subscribeBusy.value || hasInsufficientFunds.value) return;

    try {
      subscribeBusy.value = true;
      subscribeError.value = '';

      const api: any = (window as any).lumen;
      const profilesApi = api?.profiles;
      const gwApi = api?.gateway;
      if (!profilesApi || !gwApi || !gwApi.subscribePlan) {
        subscribeError.value = 'Subscription API unavailable';
        return;
      }

      const active = await profilesApi.getActive?.().catch(() => null);
      const profileId = active?.id;
      if (!profileId) {
        subscribeError.value = 'No active profile';
        return;
      }

      const res = await gwApi
        .subscribePlan({
          profileId,
          planId: plan.planId,
          gatewayId: plan.gatewayId,
          priceUlmn: plan.priceUlmn,
          storageGbPerMonth: plan.storageGbPerMonth,
          networkGbPerMonth: plan.networkGbPerMonth,
          months: subscribeMonths.value,
        })
        .catch((e: any) => ({ ok: false, error: String(e?.message || e) }));

      if (!res || res.ok === false) {
        subscribeError.value = normalizeSubscribeError(res?.error);
        return;
      }

      showSubscribeModal.value = false;
      subscribePlan.value = null;
      subscribeError.value = '';
      subscribeBalance.value = null;
      void openPlansModal();
    } catch (e: any) {
      subscribeError.value = normalizeSubscribeError(e?.message || e);
    } finally {
      subscribeBusy.value = false;
    }
  }

async function loadStats() {
  try {
    const result = await (window as any).lumen?.ipfsStats?.();
    if (result?.ok) {
      stats.value = result;
    }
  } catch {}
}

async function loadPinnedFiles() {
  try {
    const anyWin: any = window;
    if (hosting.value.kind === 'gateway') {
      await refreshGatewayPinned(activeGatewayHint.value);
      return;
    }

    const result = await anyWin.lumen?.ipfsPinList?.();
    if (result?.ok) {
      pinnedFiles.value = result.pins || [];
    }
  } catch {}
}

async function refreshGatewayUsage(baseUrlHint?: string) {
  try {
    const api: any = (window as any).lumen;
    const profilesApi = api?.profiles;
    const gwApi = api?.gateway;
    if (!profilesApi || !gwApi) return;

    const active = await profilesApi.getActive?.().catch(() => null);
    const profileId = active?.id;
    if (!profileId) return;

      gatewayUsageLoading.value = true;
      gatewayUsageError.value = '';

      const res = await gwApi.getWalletUsage(profileId, baseUrlHint).catch(() => null);
    if (!res || res.ok === false) {
      const code = String(res?.error || '').trim();
      // If the gateway doesn't expose a Kyber pubkey, just treat it as "no plan"
      if (code === 'kyber_pubkey_http_unavailable') {
        gatewayUsage.value = null;
        gatewayUsageError.value = '';
        return;
      }
      gatewayUsage.value = null;
      gatewayUsageError.value = code || 'Usage fetch failed';
      return;
    }

    gatewayUsage.value = res.data ?? null;
  } catch (e: any) {
    gatewayUsage.value = null;
    const msg = String(e?.message || 'Usage fetch failed');
    gatewayUsageError.value = msg === 'Error: kyber_pubkey_http_unavailable' ? '' : msg;
  } finally {
    gatewayUsageLoading.value = false;
  }
}

async function refreshGatewayPinned(baseUrlHint?: string) {
  try {
    const api: any = (window as any).lumen;
    const profilesApi = api?.profiles;
    const gwApi = api?.gateway;
    if (!profilesApi || !gwApi) return;

    const active = await profilesApi.getActive?.().catch(() => null);
    const profileId = active?.id;
    if (!profileId) return;

    gatewayPinnedLoading.value = true;
    gatewayPinnedError.value = '';

      const res = await gwApi.getWalletPinnedCids(profileId, baseUrlHint, 1).catch(() => null);
    if (!res || res.ok === false) {
      const code = String(res?.error || '').trim();
      if (code === 'kyber_pubkey_http_unavailable') {
        gatewayPinned.value = [];
        gatewayPinnedError.value = '';
        return;
      }
      gatewayPinned.value = [];
      gatewayPinnedError.value = code || 'Pinned CIDs fetch failed';
      return;
    }

    const data = res.data ?? null;
    const cids = Array.isArray(data?.cids) ? data.cids.map((x: any) => String(x)) : [];
    gatewayPinned.value = cids;
  } catch (e: any) {
    gatewayPinned.value = [];
    const msg = String(e?.message || 'Pinned CIDs fetch failed');
    gatewayPinnedError.value = msg === 'Error: kyber_pubkey_http_unavailable' ? '' : msg;
  } finally {
    gatewayPinnedLoading.value = false;
  }
}

function loadFiles() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      files.value = JSON.parse(stored);
    }
  } catch {
    files.value = [];
  }
}

function saveFiles() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(files.value));
}

function loadLocalNames() {
  try {
    const stored = localStorage.getItem(LOCAL_NAMES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') {
        localNames.value = parsed as Record<string, string>;
      }
    }
  } catch {
    localNames.value = {};
  }
}

function saveLocalNames() {
  try {
    localStorage.setItem(LOCAL_NAMES_KEY, JSON.stringify(localNames.value));
  } catch {
    // ignore
  }
}

function normalizeCidKey(cid: string): string {
  return String(cid || '').trim();
}

function getSavedName(cid: string): string {
  const key = normalizeCidKey(cid);
  if (!key) return 'Unknown';
  const value = localNames.value[key];
  const name = typeof value === 'string' ? value.trim() : '';
  return name || 'Unknown';
}

function setSavedName(cid: string, name: string) {
  const key = normalizeCidKey(cid);
  if (!key) return;
  const nextName = String(name || '').trim();
  const next = { ...localNames.value };
  if (!nextName || nextName.toLowerCase() === 'unknown') {
    delete next[key];
  } else {
    next[key] = nextName;
  }
  localNames.value = next;
  saveLocalNames();
}

async function handleFileUpload(e: Event) {
  showUploadMenu.value = false;
  const input = e.target as HTMLInputElement;
  if (!input.files?.length) return;

  if (!ipfsConnected.value) {
    showToast('IPFS not connected', 'error');
    return;
  }

  for (const file of Array.from(input.files)) {
    await uploadFile(file);
  }
  input.value = '';
}

async function handleFolderUpload(e: Event) {
  showUploadMenu.value = false;
  const input = e.target as HTMLInputElement;
  if (!input.files?.length) return;

  if (!ipfsConnected.value) {
    showToast('IPFS not connected', 'error');
    return;
  }

  const filesList = Array.from(input.files);
  const groups = new Map<string, { path: string; file: File }[]>();

  for (const f of filesList) {
    const rel = String((f as any).webkitRelativePath || '').replace(/\\/g, '/');
    const parts = rel ? rel.split('/').filter(Boolean) : [f.name];
    const rootName = parts[0] || 'folder';
    const relPath = parts.length > 1 ? parts.slice(1).join('/') : f.name;
    if (!groups.has(rootName)) groups.set(rootName, []);
    groups.get(rootName)!.push({ path: relPath, file: f });
  }

  for (const [rootName, list] of groups.entries()) {
    await uploadDirectory(rootName, list);
  }

  input.value = '';
}

function upsertFileMetadata(next: DriveFile) {
  const cid = String(next?.cid || '').trim();
  if (!cid) return;
  const filtered = files.value.filter((f) => String(f?.cid || '').trim() !== cid);
  files.value = [{ ...next, cid }, ...filtered].slice(0, 500);
  saveFiles();
}

async function pinCidToActiveGateway(cid: string) {
  if (hosting.value.kind !== 'gateway') return { ok: true as const };

  const api: any = (window as any).lumen;
  const profilesApi = api?.profiles;
  const gwApi = api?.gateway;
  if (!profilesApi || !gwApi || !gwApi.pinCid) {
    return { ok: false as const, error: 'Gateway upload unavailable' };
  }

  const active = await profilesApi.getActive?.().catch(() => null);
  const profileId = active?.id;
  if (!profileId) {
    return { ok: false as const, error: 'No active profile' };
  }

  const gid = hosting.value.gatewayId;
  const sub =
    planSubscriptionsRaw.value.find(
      (s) => String(s.gatewayId) === String(gid) && String(s.status).includes('active'),
    ) || planSubscriptionsRaw.value.find((s) => String(s.gatewayId) === String(gid));
  const planId = sub?.metadata?.planId ?? sub?.metadata?.plan_id ?? null;

  const res = await gwApi
    .pinCid({
      profileId,
      cid,
      baseUrl: activeGatewayHint.value,
      planId,
    })
    .catch((e: any) => ({ ok: false, error: String(e?.message || e) }));

  if (!res || res.ok === false) {
    return { ok: false as const, error: String(res?.error || 'Gateway pin failed') };
  }

  await refreshActiveGatewayPinned();
  await refreshGatewayBase(activeGatewayHint.value);
  return { ok: true as const };
}

async function uploadDirectory(rootName: string, list: { path: string; file: File }[]) {
  const name = String(rootName || '').trim() || 'folder';
  if (!list.length) return;

  uploading.value = true;
  uploadingFile.value = name;

  try {
    const payloadFiles: { path: string; data: number[] }[] = [];
    let totalBytes = 0;

    for (const it of list) {
      const rel = String(it.path || it.file?.name || 'file').replace(/^\/+/, '').replace(/\\/g, '/');
      const buf = await it.file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      totalBytes += bytes.byteLength;
      payloadFiles.push({ path: rel, data: Array.from(bytes) });
    }

    const result = await (window as any).lumen?.ipfsAddDirectory?.({
      rootName: name,
      files: payloadFiles
    });

    if (!result?.ok || !result?.cid) {
      showToast(`Failed to upload folder: ${name}`, 'error');
      return;
    }

    const cid = String(result.cid);
    entryTypeCache.value = { ...entryTypeCache.value, [cid]: 'dir' };
    setSavedName(cid, name);

    upsertFileMetadata({
      cid,
      name,
      size: totalBytes,
      uploadedAt: Date.now(),
      type: 'dir'
    });

    if (hosting.value.kind === 'gateway') {
      const pinned = await pinCidToActiveGateway(cid);
      if (!pinned.ok) {
        showToast(pinned.error, 'error');
        return;
      }
      showToast(`Uploaded folder to gateway: ${name}`, 'success');
    } else {
      loadStats();
      await loadPinnedFiles();
      showToast(`Uploaded folder: ${name}`, 'success');
    }
  } catch (err) {
    console.error('Folder upload error:', err);
    showToast(`Error uploading folder: ${name}`, 'error');
  } finally {
    uploading.value = false;
    uploadingFile.value = '';
  }
}

async function uploadFile(file: File) {
  uploading.value = true;
  uploadingFile.value = file.name;

  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    const result = await (window as any).lumen?.ipfsAdd?.(Array.from(bytes), file.name);

    if (result?.cid) {
      const cid = String(result.cid);
      setSavedName(cid, file.name);
      entryTypeCache.value = { ...entryTypeCache.value, [cid]: 'file' };
      upsertFileMetadata({
        cid,
        name: file.name,
        size: file.size,
        uploadedAt: Date.now(),
        type: 'file',
      });

      if (hosting.value.kind === 'gateway') {
        const pinned = await pinCidToActiveGateway(cid);
        if (!pinned.ok) {
          showToast(pinned.error, 'error');
          return;
        }
        showToast(`Uploaded to gateway: ${file.name}`, 'success');
      } else {
        loadStats();
        await loadPinnedFiles();
        showToast(`Uploaded: ${file.name}`, 'success');
      }
    } else {
      showToast(`Failed to upload: ${file.name}`, 'error');
    }
  } catch (err) {
    console.error('Upload error:', err);
    showToast(`Error uploading: ${file.name}`, 'error');
  } finally {
    uploading.value = false;
    uploadingFile.value = '';
  }
}

async function downloadFile(file: DriveFile) {
  try {
    const target = contentTargetFor(file);
    const gateways = await loadWhitelistedGatewayBases().catch(() => []);
    const result = await (window as any).lumen?.ipfsGet?.(target, { gateways });
    
    if (result?.ok && result.data) {
      const blob = new Blob([new Uint8Array(result.data)]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Downloaded!', 'success');
    } else {
      showToast('Download failed', 'error');
    }
  } catch {
    showToast('Download error', 'error');
  }
}

function lumenLinkFor(file: DriveFile): string {
  const target = contentTargetFor(file);
  const encoded = encodeIpfsTarget(target);
  const isDir = String((file as any)?.type || '') === 'dir';
  return `lumen://ipfs/${encoded}${isDir ? '/' : ''}`;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // ignore
  }
}

async function copyLumenLinkFor(file: DriveFile) {
  const url = lumenLinkFor(file);
  await copyText(url);
  showToast('Link copied!', 'success');
}

function openInIpfs(file: DriveFile) {
  if (String((file as any)?.type || '') === 'dir') {
    void openDirectory(file);
    return;
  }
  const url = lumenLinkFor(file);
  if (openInNewTab) {
    openInNewTab(url);
    return;
  }
  try {
    window.open(url, '_blank');
  } catch {
    // ignore
  }
}

async function loadBrowseEntries() {
  const cid = String(browseRootCid.value || '').trim();
  if (!cid) return;
  browseLoading.value = true;
  browseError.value = '';
  try {
    const target = browseRelPath.value ? `${cid}/${browseRelPath.value}` : cid;
    const res = await (window as any).lumen?.ipfsLs?.(target).catch(() => null);
    if (!res || res.ok === false) {
      browseEntries.value = [];
      browseError.value = String(res?.error || 'Failed to list folder');
      return;
    }
    const list = Array.isArray(res.entries) ? res.entries : [];
    const mapped = list
      .filter((it: any) => it && it.name && it.cid)
      .map((it: any) => {
        const name = String(it.name);
        const rel = browseRelPath.value ? `${browseRelPath.value}/${name}` : name;
        return {
          cid: String(it.cid),
          name,
          size: typeof it.size === 'number' ? it.size : 0,
          type: String(it.type) === 'dir' ? 'dir' : 'file',
          rootCid: cid,
          relPath: rel,
        } as DriveFile;
      })
      .sort((a: any, b: any) => {
        if (a.type === b.type) return String(a.name).localeCompare(String(b.name));
        return a.type === 'dir' ? -1 : 1;
      });
    browseEntries.value = mapped;
  } catch (e: any) {
    browseEntries.value = [];
    browseError.value = String(e?.message || 'Failed to list folder');
  } finally {
    browseLoading.value = false;
  }
}

function exitBrowse() {
  browseRootCid.value = '';
  browseRelPath.value = '';
  browseEntries.value = [];
  browseError.value = '';
  selectedFile.value = null;
  renameDraft.value = '';
}

async function openBrowseAt(path: string) {
  browseRelPath.value = String(path || '').replace(/^\/+/, '').replace(/\/+$/, '');
  selectedFile.value = null;
  renameDraft.value = '';
  await loadBrowseEntries();
}

async function openDirectory(file: DriveFile) {
  const root = String(file?.rootCid || file?.cid || '').trim();
  if (!root) return;
  browseRootCid.value = root;
  await openBrowseAt(String(file?.relPath || '').replace(/^\/+/, '').replace(/\/+$/, ''));
}

async function handleEntryClick(file: DriveFile) {
  if (browseLoading.value) return;
  if (String((file as any)?.type) === 'dir') {
    await openDirectory(file);
    return;
  }
  if (String((file as any)?.type) === 'file') {
    selectedFile.value = file;
    return;
  }

  // Unknown (root saved entry): best-effort detect if it's a directory.
  const cid = String(file?.cid || '').trim();
  if (!cid) return;
  const res = await (window as any).lumen?.ipfsLs?.(cid).catch(() => null);
  const linksRaw = Array.isArray(res?.entries) ? res.entries : [];
  const links = linksRaw.filter((it: any) => it && String(it.name || '').trim() && String(it.cid || '').trim());
  const isDirDetected = links.length > 0;
  entryTypeCache.value = { ...entryTypeCache.value, [cid]: isDirDetected ? 'dir' : 'file' };

  if (isDirDetected) {
    await openDirectory({ ...file, type: 'dir', rootCid: cid, relPath: '' });
  } else {
    selectedFile.value = { ...file, type: 'file' };
  }
}

function selectFile(file: DriveFile) {
  void handleEntryClick(file);
}

watch(
  selectedFile,
  (f) => {
    if (!f) {
      renameDraft.value = '';
      return;
    }
    renameDraft.value = getSavedName(f.cid);
  },
  { immediate: true }
);

function saveSelectedName() {
  const f = selectedFile.value;
  if (!f) return;
  setSavedName(f.cid, renameDraft.value);
  selectedFile.value = { ...f, name: getSavedName(f.cid) };
}

async function removeFile(file: DriveFile) {
  const cid = String(file?.cid || '').trim();
  if (!cid) return;

  if (hosting.value.kind === 'local') {
    try {
      const res = await (window as any).lumen?.ipfsUnpin?.(cid);
      if (!res || res.ok === false) {
        showToast(String(res?.error || 'Unpin failed'), 'error');
        return;
      }
      setSavedName(cid, '');
      await loadPinnedFiles();
      void loadStats();
      if (selectedFile.value?.cid === cid) {
        selectedFile.value = null;
        renameDraft.value = '';
      }
      showToast('Removed', 'success');
      return;
    } catch (e: any) {
      showToast(String(e?.message || 'Unpin failed'), 'error');
      return;
    }
  }

  showToast('Remove from gateway is not available yet', 'error');
}

function getFileTypeClass(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'type-image';
  if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) return 'type-video';
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) return 'type-audio';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'type-archive';
  if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext)) return 'type-document';
  return 'type-file';
}

function isImageFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
}

function isVideoFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext);
}

function getGatewayUrl(cid: string): string {
  const localBase = LOCAL_IPFS_GATEWAY_BASE;
  const publicBase = 'https://ipfs.io';
  const base =
    hosting.value.kind === 'gateway'
      ? gatewayBase.value || publicBase
      : ipfsConnected.value
        ? localBase
        : publicBase;
  if (!base) return '';
  const encoded = encodeIpfsTarget(cid);
  return `${String(base).replace(/\/+$/, '')}/ipfs/${encoded}`;
}

function imageMimeFromName(name: string): string {
  const ext = String(name || '').split('.').pop()?.toLowerCase() || '';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'svg') return 'image/svg+xml';
  if (ext === 'bmp') return 'image/bmp';
  return 'application/octet-stream';
}

function getImageSrc(file: DriveFile): string {
  const key = contentTargetFor(file);
  const cached = imagePreviewUrls.value[key];
  return cached || getGatewayUrl(key);
}

async function onImageError(file: DriveFile) {
  if (!file || !isImageFile(file.name)) return;
  const key = contentTargetFor(file);
  if (!key) return;
  if (imagePreviewInFlight.has(key)) return;
  if (imagePreviewTried.value[key]) return;

  imagePreviewInFlight.add(key);
  imagePreviewTried.value = { ...imagePreviewTried.value, [key]: true };
  try {
    const gateways = await loadWhitelistedGatewayBases().catch(() => []);
    const got = await (window as any).lumen?.ipfsGet?.(key, { gateways }).catch(() => null);
    if (!got?.ok || !Array.isArray(got.data)) return;
    const bytes = new Uint8Array(got.data);
    if (bytes.byteLength <= 0 || bytes.byteLength > 15_000_000) return;

    const blob = new Blob([bytes], { type: imageMimeFromName(file.name) });
    const url = URL.createObjectURL(blob);

    const prev = imagePreviewUrls.value[key];
    if (typeof prev === 'string' && prev.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(prev);
      } catch {
        // ignore
      }
    }

    imagePreviewUrls.value = { ...imagePreviewUrls.value, [key]: url };
  } finally {
    imagePreviewInFlight.delete(key);
  }
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return FileImage;
  if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) return FileVideo;
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) return FileAudio;
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return FileArchive;
  if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext)) return FileText;
  return File;
}

function formatSize(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function showToast(msg: string, type: 'success' | 'error' = 'success') {
  toast.value = msg;
  toastType.value = type;
  setTimeout(() => {
    toast.value = '';
  }, 2500);
}
</script>

<style scoped>
.drive-page {
  display: flex;
  height: 100vh;
  min-height: 100vh;
  background: var(--bg-tertiary, #f0f2f5);
  overflow: hidden;
}

/* Sidebar */
.sidebar {
  width: 260px;
  min-width: 260px;
  max-width: 260px;
  background: var(--bg-primary, #fff);
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  color: var(--text-primary, #1a1a2e);
  border-right: 2px solid var(--border-color, #e5e7eb);
  flex-shrink: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  margin-bottom: 1.5rem;
}

.logo-icon {
  width: 40px;
  height: 40px;
  background: var(--gradient-primary);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.logo-text {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary, #1e293b);
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.nav-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nav-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-tertiary, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.5rem 1rem;
  margin-bottom: 0.25rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: none;
  background: transparent;
  border-radius: 10px;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--text-secondary, #64748b);
  transition: all 0.2s ease;
}

.nav-item:hover {
  background: var(--hover-bg, #f1f5f9);
  color: var(--text-primary, #1e293b);
}

.nav-item.active {
  background: var(--gradient-primary);
  color: white;
  box-shadow: 0 4px 12px var(--primary-a30);
}

.nav-item .badge {
  margin-left: auto;
  font-size: 0.7rem;
  background: rgba(255,255,255,0.25);
  padding: 0.15rem 0.5rem;
  border-radius: 10px;
  color: inherit;
}

.nav-item:not(.active) .badge {
  background: var(--accent-primary);
  color: white;
}

.storage-stats,
.storage-sources {
  padding: 1rem;
  background: var(--card-bg, #f8fafc);
  border-radius: 12px;
  margin-top: 1rem;
  margin-bottom: 0.75rem;
  border: 1px solid var(--border-color, #e2e8f0);
}

.hosting-panel {
  padding: 1rem;
  background: var(--card-bg, #f8fafc);
  border-radius: 12px;
  margin-top: 1rem;
  margin-bottom: 0.75rem;
  border: 1px solid var(--border-color, #e2e8f0);
}

.hosting-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  border-radius: 10px;
  border: 1px solid transparent;
}

.hosting-row.active {
  background: var(--primary-a08);
  border-color: var(--primary-a25);
}

.hosting-main {
  flex: 1;
  display: grid;
  grid-template-columns: 10px 1fr auto;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.7rem;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 10px;
  color: var(--text-secondary, #64748b);
  text-align: left;
}

.hosting-title {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-primary, #1e293b);
}

.hosting-meta {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-tertiary, #94a3b8);
  justify-self: end;
  white-space: nowrap;
}

.hosting-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  box-shadow: 0 0 0 rgba(239, 68, 68, 0.0);
}

.hosting-dot.ok {
  background: #22c55e;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.35);
}

.hosting-dot.pending {
  background: #f59e0b;
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.35);
}

.hosting-dot.off {
  background: #ef4444;
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.2);
}

.hosting-details {
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-primary, #fff);
  color: var(--text-secondary, #64748b);
  cursor: pointer;
}

.hosting-details:hover {
  background: var(--hover-bg, #f1f5f9);
  color: var(--text-primary, #1e293b);
}

.hosting-divider {
  margin: 0.85rem 0.25rem 0.5rem;
  height: 1px;
  background: var(--border-color, #e2e8f0);
}

.hosting-subheader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.25rem;
}

.hosting-subheader-title {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-tertiary, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.hosting-subheader-action {
  border: none;
  background: transparent;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--accent-secondary);
  cursor: pointer;
  padding: 0.25rem 0.4rem;
  border-radius: 8px;
}

.hosting-subheader-action:hover {
  background: rgba(37, 99, 235, 0.1);
}

.hosting-empty {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-tertiary, #94a3b8);
}

.hosting-tags {
  display: inline-flex;
  gap: 0.35rem;
  margin-left: 0.6rem;
  justify-self: end;
}

.hosting-tag {
  display: inline-flex;
  align-items: center;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  background: var(--primary-a15);
  color: var(--accent-secondary);
  font-size: 0.68rem;
  font-weight: 700;
}

.stats-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  color: var(--text-secondary, #64748b);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stats-bar {
  height: 6px;
  background: var(--border-color, #e2e8f0);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.stats-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
  border-radius: 3px;
  transition: width 0.3s;
}

.stats-value {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
}

.source-card {
  margin-top: 0.5rem;
  padding: 0.75rem 0.85rem;
  border-radius: 10px;
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--card-bg, #ffffff);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.source-card.local {
  background: linear-gradient(135deg, rgba(148, 163, 184, 0.06), rgba(148, 163, 184, 0.02));
}

.source-card.gateway {
  background: linear-gradient(135deg, rgba(45, 95, 79, 0.06), rgba(45, 95, 79, 0.02));
}

.source-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.source-name {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
}

.source-pill {
  font-size: 0.65rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: var(--bg-secondary, #f1f5f9);
  color: var(--text-secondary, #64748b);
}

.source-pill.accent {
  background: var(--primary-a15);
  color: var(--accent-secondary);
}

.source-body {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-top: 0.35rem;
}

.source-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--text-secondary, #64748b);
}

.source-row span:last-child {
  font-weight: 600;
  color: var(--text-primary, #1e293b);
}

.source-row.muted {
  color: var(--text-tertiary, #94a3b8);
}

.source-row.error {
  color: #dc2626;
}

.source-bar {
  height: 5px;
  background: var(--border-color, #e2e8f0);
  border-radius: 999px;
  overflow: hidden;
  margin-top: 0.25rem;
}

.source-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
  border-radius: 999px;
  transition: width 0.3s ease;
}

.ipfs-status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-radius: 10px;
  background: var(--card-bg, #fef2f2);
  border: 1px solid #fecaca;
  color: #dc2626;
  font-size: 0.8rem;
  font-weight: 500;
}

.ipfs-status.connected {
  background: var(--card-bg, #f0fdf4);
  border-color: #bbf7d0;
  color: #16a34a;
}

.ipfs-status.connected .status-dot {
  background: #22c55e;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
}

/* Details modals */
.details-grid {
  display: grid;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: 12px;
  background: var(--bg-secondary, #f1f5f9);
  border: 1px solid var(--border-color, #e2e8f0);
}

.details-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.8rem;
  color: var(--text-secondary, #64748b);
}

.details-label {
  font-weight: 700;
  color: var(--text-tertiary, #94a3b8);
}

.details-value {
  font-weight: 700;
  color: var(--text-primary, #1e293b);
}

.details-value.ok {
  color: #16a34a;
}

.details-value.pending {
  color: #d97706;
}

.details-value.off {
  color: #dc2626;
}

.details-section {
  margin-top: 1rem;
  padding: 0.75rem;
  border-radius: 12px;
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-primary, #fff);
}

.details-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.details-section-header h4 {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 800;
  color: var(--text-primary, #1e293b);
}

.details-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.details-list-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.45rem 0.6rem;
  border-radius: 10px;
  background: var(--bg-secondary, #f1f5f9);
  border: 1px solid var(--border-color, #e2e8f0);
}

.details-muted {
  color: var(--text-tertiary, #94a3b8);
  font-size: 0.72rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 220px;
}

.details-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

/* Main Content */
.main-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 2rem 2.5rem;
  background: var(--bg-primary, #fff);
  margin: 0;
  border-radius: 0;
}

.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.content-header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary, #1e293b);
  margin: 0;
}

.content-header p {
  font-size: 0.875rem;
  color: var(--text-secondary, #64748b);
  margin: 0.25rem 0 0 0;
}

.header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .plans-filter {
    margin-bottom: 1rem;
  }

  .plans-filter-input {
    width: 100%;
    padding: 0.75rem 0.9rem;
    border-radius: 10px;
    border: 1px solid var(--border-color, #e2e8f0);
    font-size: 0.875rem;
    color: var(--text-primary, #1e293b);
    background: var(--bg-secondary, #f8fafc);
  }

  .plans-filter-input:focus {
    outline: none;
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 2px var(--primary-a10);
    background: var(--bg-primary, #ffffff);
  }

  .plans-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  .plan-row {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    border-radius: 12px;
    border: 1px solid var(--border-color, #e2e8f0);
    background: var(--bg-secondary, #f8fafc);
    margin-bottom: 0.5rem;
  }

  .plan-body {
    display: flex;
    flex-direction: row;
    gap: 1rem;
  }

  .plan-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .plan-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .plan-name {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-primary, #1e293b);
  }

  .plan-status-badge {
    padding: 0.15rem 0.6rem;
    border-radius: 999px;
    font-size: 0.7rem;
    font-weight: 600;
    background: var(--bg-primary, #ffffff);
    color: var(--text-secondary, #64748b);
    border: 1px solid var(--border-color, #e2e8f0);
  }

  .plan-status-badge.active {
    background: #dcfce7;
    color: #15803d;
    border-color: #bbf7d0;
  }

  .plan-status-badge.pending {
    background: #fef3c7;
    color: #b45309;
    border-color: #fde68a;
  }

  .plan-gw {
    font-size: 0.8rem;
    color: var(--text-secondary, #64748b);
  }

  .plan-meta {
    min-width: 170px;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .plan-meta-line {
    display: flex;
    justify-content: space-between;
    font-size: 0.78rem;
  }

  .plan-meta-line .label {
    color: var(--text-secondary, #64748b);
  }

  .plan-meta-line .value {
    font-weight: 500;
    color: var(--text-primary, #1e293b);
  }

  .plan-footer {
    display: flex;
    justify-content: flex-end;
    margin-top: 0.25rem;
  }

  /* Gateway plans modal */
  .plans-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 0.75rem;
    margin-bottom: 0.5rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border-color, #e2e8f0);
  }

  .plans-search-group {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .plans-search-input {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-radius: 10px;
    border: 1px solid var(--border-color, #e2e8f0);
    background: var(--bg-secondary, #f8fafc);
    min-width: 220px;
  }

  .plans-filter-input {
    border: none;
    outline: none;
    background: transparent;
    font-size: 0.875rem;
    color: var(--text-primary, #1e293b);
    min-width: 140px;
  }

  .plans-empty {
    text-align: center;
    padding: 1rem 0.5rem 0.5rem;
  }

  .plans-empty h4 {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-primary, #0f172a);
    margin-bottom: 0.25rem;
  }

  .plans-empty-muted {
    font-size: 0.8rem;
    color: var(--text-secondary, #64748b);
  }

  .plans-empty-actions {
    margin-top: 0.5rem;
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .plans-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 0.75rem;
    margin-top: 0.75rem;
  }

  .gateway-card {
    padding: 0.9rem 1rem;
    border-radius: 10px;
    border: 1px solid var(--border-color, #e2e8f0);
    background: var(--bg-primary, #ffffff);
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .gateway-card.offline {
    opacity: 0.7;
  }

  .gateway-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }

  .gateway-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  .gateway-status-dot {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: #22c55e;
  }

  .gateway-status-dot.off {
    background: #ef4444;
  }

  .gateway-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary, #1e293b);
    max-width: 260px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .gateway-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.75rem;
    justify-content: flex-end;
  }

  .gateway-meta-item {
    font-size: 0.75rem;
    color: var(--text-secondary, #64748b);
  }

  .gateway-plans {
    border-top: 1px solid var(--border-color, #e2e8f0);
    padding-top: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .gateway-plan-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .plan-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
    border: 1px solid var(--border-color, #e2e8f0);
    background: var(--bg-secondary, #f8fafc);
    font-size: 0.75rem;
    color: var(--text-secondary, #64748b);
  }

  .plan-chip.active {
    border-color: #22c55e;
    background: #ecfdf5;
    color: #15803d;
  }

  .plan-chip-name {
    font-weight: 500;
  }

  .plan-chip-price {
    font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  }

  .gateway-expand-btn {
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 999px;
    padding: 0.2rem 0.7rem;
    font-size: 0.75rem;
    background: var(--bg-primary, #ffffff);
    color: var(--text-secondary, #64748b);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .gateway-expand-btn:hover {
    background: var(--bg-secondary, #f8fafc);
    border-color: #cbd5e1;
    color: var(--text-primary, #1e293b);
  }

  .btn-ghost {
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 999px;
    padding: 0.35rem 0.8rem;
    font-size: 0.8rem;
    background: var(--bg-primary, #ffffff);
    color: var(--text-secondary, #64748b);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-ghost:hover {
    background: var(--bg-secondary, #f8fafc);
    border-color: #cbd5e1;
    color: var(--text-primary, #1e293b);
  }

  .plans-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 0.9rem;
    border-radius: 999px;
    border: 1px solid var(--border-color, #e2e8f0);
    background: var(--bg-secondary, #f8fafc);
    font-size: 0.8rem;
    color: var(--text-secondary, #64748b);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .plans-btn:hover {
    background: var(--bg-primary, #ffffff);
    border-color: #cbd5e1;
    color: var(--text-primary, #1e293b);
  }

.upload-btn, .upload-btn-large {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  background: var(--gradient-primary);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px var(--primary-a30);
}

.upload-btn:hover, .upload-btn-large:hover {
  background: linear-gradient(135deg, var(--accent-secondary) 0%, #1a5276 100%);
  box-shadow: 0 6px 16px var(--primary-a40);
  transform: translateY(-1px);
}

.upload-btn input, .upload-btn-large input {
  display: none;
}

.upload-menu {
  position: relative;
  display: inline-flex;
}

.upload-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  min-width: 190px;
  background: var(--bg-primary, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
  padding: 0.35rem;
  z-index: 50;
}

.upload-dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.55rem 0.75rem;
  border-radius: 10px;
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--text-primary, #1e293b);
  user-select: none;
}

.upload-dropdown-item:hover {
  background: var(--bg-secondary, #f8fafc);
}

.upload-dropdown-item input {
  display: none;
}

.upload-btn-large {
  padding: 1rem 1.75rem;
}

/* Upload Progress */
.upload-progress {
  background: var(--bg-secondary, #f5f5f7);
  border-radius: 10px;
  padding: 1rem 1.25rem;
  margin-bottom: 1rem;
}

/* Folder breadcrumb */
.browse-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
  margin-bottom: 0.75rem;
}

.browse-crumbs {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
  flex-wrap: wrap;
}

.browse-crumbs .crumb {
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  color: var(--text-primary, #1e293b);
  font-size: 0.85rem;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.browse-crumbs .crumb:hover {
  color: var(--accent-primary);
}

.browse-crumbs .sep {
  color: var(--text-secondary, #64748b);
}

.progress-content {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.progress-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

/* Fetch Section */
.fetch-section {
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
}

.fetch-card {
  background: linear-gradient(135deg, var(--bg-secondary, #f8fafc) 0%, var(--hover-bg, #f1f5f9) 100%);
  border-radius: 20px;
  padding: 3rem;
  text-align: center;
  max-width: 480px;
  width: 100%;
  border: 1px solid var(--border-color, #e2e8f0);
}

.fetch-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 1.5rem;
  background: var(--gradient-primary);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 8px 24px var(--primary-a25);
}

.fetch-input-group {
  display: flex;
  gap: 0.5rem;
  margin-top: 1.5rem;
}

.fetch-input {
  flex: 1;
  padding: 0.875rem 1rem;
  border: 1px solid var(--border-color, #d2d2d7);
  border-radius: 8px;
  font-size: 0.875rem;
  font-family: 'SF Mono', 'Consolas', monospace;
  background: var(--card-bg, #ffffff);
  color: var(--text-primary, #0f172a);
}

.fetch-input:focus {
  outline: none;
  border-color: #0071e3;
}

.fetch-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1.5rem;
  background: var(--gradient-primary);
  color: white;
  border: none;
  border-radius: 10px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px var(--primary-a30);
}

.fetch-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--accent-secondary) 0%, #1a5276 100%);
  transform: translateY(-1px);
}

.fetch-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.fetch-error {
  color: #ff3b30;
  margin-top: 1rem;
}

/* Files Grid */
.files-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.75rem;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  padding: 0.25rem;
  align-content: start;
}

.file-card {
  background: var(--bg-primary, #fff);
  border-radius: 10px;
  padding: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 0;
  border: 1px solid var(--border-color, #e2e8f0);
  height: fit-content;
}

.file-card:hover {
  background: var(--bg-secondary, #f8fafc);
  border-color: #cbd5e1;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

.file-card.selected {
  background: #d1fae5;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--primary-a15);
}

.file-preview {
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  margin-bottom: 0.5rem;
  background: var(--bg-secondary, #f8fafc);
  color: var(--text-tertiary, #94a3b8);
  overflow: hidden;
  position: relative;
  border: 1px solid var(--border-color, #e2e8f0);
}

.file-preview .preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
}

.file-preview .preview-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
}

.file-preview.type-image { color: #ff9500; background: var(--card-bg, #fff8f0); }
.file-preview.type-video { color: #ff2d55; background: var(--card-bg, #fff0f3); }
.file-preview.type-audio { color: #af52de; background: var(--card-bg, #f8f0ff); }
.file-preview.type-archive { color: #34c759; background: var(--card-bg, #f0fff4); }
.file-preview.type-document { color: #0071e3; background: var(--card-bg, #f0f7ff); }
.file-preview.type-file { color: #86868b; background: var(--card-bg, #f8fafc); }

.file-info {
  margin-bottom: 0.25rem;
}

.file-name {
  font-size: 0.75rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary, #1e293b);
}

.file-meta {
  font-size: 0.65rem;
  color: var(--text-secondary, #64748b);
  margin-top: 0.1rem;
}

.file-actions {
  display: flex;
  gap: 0.15rem;
  justify-content: flex-start;
  margin-top: 0.35rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--border-color, #e2e8f0);
}

.action-btn {
  padding: 0.25rem;
  border: none;
  background: var(--hover-bg, #f1f5f9);
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-secondary, #64748b);
  transition: all 0.15s;
}

.action-btn:hover {
  background: var(--accent-primary);
  color: white;
}

.action-btn.danger:hover {
  background: #e74c3c;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-align: center;
}

.empty-icon {
  width: 80px;
  height: 80px;
  background: var(--bg-secondary, #f5f5f7);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary, #86868b);
  margin-bottom: 1rem;
}

/* Detail Panel */
.detail-panel {
  width: 280px;
  min-width: 280px;
  max-width: 280px;
  background: var(--bg-primary, #fff);
  display: flex;
  flex-direction: column;
  padding: 1.25rem;
  margin: 0.5rem 0.5rem 0.5rem 0;
  border-radius: 16px;
  flex-shrink: 0;
  border: 1px solid var(--border-color, #e2e8f0);
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
}

.close-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: #e8e8ed;
  cursor: pointer;
  color: var(--text-tertiary, #86868b);
  border-radius: 6px;
}

.close-btn:hover {
  background: #ff3b30;
  color: white;
}

.detail-preview {
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  margin-bottom: 1.25rem;
  background: var(--bg-secondary, #f8fafc);
  color: var(--text-tertiary, #86868b);
  overflow: hidden;
}

.detail-preview-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 12px;
}

.detail-preview-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 12px;
}

.detail-info {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.info-row {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.info-label {
  font-size: 0.65rem;
  color: var(--text-tertiary, #86868b);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.info-value {
  font-size: 0.8rem;
  color: var(--text-primary, #1d1d1f);
  font-weight: 500;
}

.info-value.cid {
  font-family: 'SF Mono', 'Consolas', monospace;
  font-size: 0.7rem;
  word-break: break-all;
  background: var(--bg-primary, #fff);
  padding: 0.5rem;
  border-radius: 6px;
  color: #0071e3;
}

.detail-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.detail-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-primary, #fff);
  border-radius: 10px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-secondary, #64748b);
}

.detail-btn:hover {
  background: var(--hover-bg, #f1f5f9);
  color: var(--text-primary, #1e293b);
}

.detail-btn.primary {
  background: var(--gradient-primary);
  border: none;
  color: white;
  box-shadow: 0 4px 12px var(--primary-a30);
}

.detail-btn.primary:hover {
  background: linear-gradient(135deg, var(--accent-secondary) 0%, #1a5276 100%);
  transform: translateY(-1px);
  box-shadow: 0 6px 16px var(--primary-a40);
}

/* Toast */
.toast {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: var(--gradient-primary);
  color: white;
  border-radius: 10px;
  font-size: 0.8rem;
  font-weight: 500;
  z-index: 100;
}

.toast.error {
  background: #ff3b30;
}

.toast-enter-active, .toast-leave-active {
  transition: all 0.2s ease;
}

.toast-enter-from, .toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 10px);
}

/* Drop Overlay */
.drop-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.drop-content {
  text-align: center;
  color: white;
}

/* View Switcher */
.view-switcher {
  display: flex;
  background: var(--hover-bg, #f1f5f9);
  border-radius: 10px;
  padding: 4px;
  border: 1px solid var(--border-color, #e2e8f0);
}

.view-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 0.625rem;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-tertiary, #94a3b8);
  transition: all 0.2s;
}

.view-btn:hover {
  color: var(--text-secondary, #64748b);
}

.view-btn.active {
  background: var(--bg-primary, #fff);
  color: var(--accent-primary);
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

/* List View */
.files-list {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  flex: 1;
  background: var(--bg-primary, #fff);
  border-radius: 12px;
  border: 1px solid var(--border-color, #e2e8f0);
}

.list-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--hover-bg, #f1f5f9);
  border-bottom: 1px solid var(--border-color, #e2e8f0);
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary, #64748b);
  position: sticky;
  top: 0;
  z-index: 1;
}

.list-icon-header {
  width: 32px;
  flex-shrink: 0;
}

.list-name-header {
  flex: 1;
  min-width: 0;
}

.list-size-header {
  width: 80px;
  min-width: 80px;
  text-align: right;
}

.list-date-header {
  width: 140px;
  min-width: 140px;
  text-align: right;
}

.list-actions-header {
  width: 80px;
  min-width: 80px;
}

.list-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 1rem;
  cursor: pointer;
  transition: all 0.1s;
  border-bottom: 1px solid var(--hover-bg, #f1f5f9);
}

.list-item:last-child {
  border-bottom: none;
}

.list-item:hover {
  background: var(--bg-secondary, #f8fafc);
}

.list-item.selected {
  background: #d1fae5;
}

.list-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary, #64748b);
  flex-shrink: 0;
}

.list-thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
}

.list-name {
  flex: 1;
  min-width: 0;
  font-size: 0.85rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary, #1e293b);
}

.list-size {
  font-size: 0.8rem;
  color: var(--text-secondary, #64748b);
  width: 80px;
  min-width: 80px;
  text-align: right;
  flex-shrink: 0;
}

.list-date {
  font-size: 0.8rem;
  color: var(--text-secondary, #64748b);
  width: 140px;
  min-width: 140px;
  text-align: right;
  flex-shrink: 0;
}

.list-actions {
  display: flex;
  gap: 0.25rem;
  width: 80px;
  min-width: 80px;
  justify-content: flex-end;
}

.list-item:hover .list-actions {
  opacity: 1;
}

/* Details Table View */
.files-table-wrapper {
  flex: 1;
  overflow: auto;
  background: var(--bg-primary, #fff);
  border-radius: 12px;
  border: 1px solid var(--border-color, #e2e8f0);
  min-height: 0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}

.files-table {
  width: 100%;
  min-width: 600px;
  border-collapse: collapse;
  font-size: 0.8rem;
  table-layout: fixed;
}

.files-table thead {
  position: sticky;
  top: 0;
  background: var(--hover-bg, #f1f5f9);
  z-index: 1;
}

.files-table th {
  text-align: left;
  padding: 0.875rem 1rem;
  font-weight: 600;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary, #64748b);
  border-bottom: 1px solid var(--border-color, #e2e8f0);
}

.files-table td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
  color: var(--text-primary, #1d1d1f);
}

.files-table tbody tr {
  cursor: pointer;
  transition: background 0.1s;
}

.files-table tbody tr:hover {
  background: var(--bg-secondary, #f8fafc);
}

.files-table tbody tr.selected {
  background: #d1fae5;
}

.td-name {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: 500;
}

.th-name {
  width: 35%;
  min-width: 200px;
}

.td-name span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.table-icon {
  width: 32px;
  height: 32px;
  min-width: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: var(--bg-secondary, #f8fafc);
  color: var(--text-secondary, #64748b);
  flex-shrink: 0;
  overflow: hidden;
}

.table-thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 6px;
}

.td-size, .th-size {
  width: 100px;
  min-width: 100px;
  text-align: right;
}

.td-size {
  color: var(--text-tertiary, #86868b);
}

.td-cid, .th-cid {
  width: 220px;
  min-width: 220px;
}

.td-date, .th-date {
  width: 160px;
  min-width: 160px;
  text-align: right;
}

.td-date {
  color: var(--text-tertiary, #86868b);
  font-size: 0.75rem;
}

.td-cid code {
  font-family: 'SF Mono', 'Consolas', monospace;
  font-size: 0.7rem;
  background: #ecf0f1;
  padding: 0.3rem 0.5rem;
  border-radius: 4px;
  color: #2c3e50;
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.copy-inline {
  padding: 0.2rem;
  margin-left: 0.25rem;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--text-tertiary, #86868b);
  opacity: 0;
}

.td-cid:hover .copy-inline {
  opacity: 1;
}

.copy-inline:hover {
  color: var(--accent-primary);
}

.td-actions, .th-actions {
  width: 120px;
  min-width: 120px;
  text-align: center;
}

.td-actions {
  width: 100px;
}

.td-actions .action-btn {
  background: var(--border-color, #e2e8f0);
  color: var(--text-secondary, #64748b);
  margin-right: 0.25rem;
}

.td-actions .action-btn:hover {
  background: var(--accent-primary);
  color: white;
}

.td-actions .action-btn.danger:hover {
  background: #e74c3c;
}

.files-table tbody tr:hover .td-actions .action-btn {
  background: var(--accent-primary);
  color: white;
}

.th-actions {
  width: 100px;
}

/* Responsive Design */
@media (max-width: 1200px) {
  .detail-panel {
    width: 260px;
    min-width: 260px;
    max-width: 260px;
  }
  
  .td-cid {
    max-width: 120px;
  }
  
  .td-date {
    display: none;
  }
  
  .th-date {
    display: none;
  }
}

@media (max-width: 900px) {
  .sidebar {
    width: 200px;
    min-width: 200px;
    max-width: 200px;
    padding: 1rem;
  }
  
  .detail-panel {
    position: fixed;
    right: 0;
    top: 0;
    bottom: 0;
    width: 300px;
    min-width: 300px;
    max-width: 300px;
    margin: 0;
    border-radius: 0;
    z-index: 100;
    box-shadow: -4px 0 20px rgba(0,0,0,0.15);
  }
  
  .main-content {
    padding: 1rem 1.25rem;
  }
  
  .files-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.75rem;
  }
  
  .td-cid {
    display: none;
  }
  
  .th-cid {
    display: none;
  }
}

@media (max-width: 700px) {
  .sidebar {
    width: 60px;
    min-width: 60px;
    max-width: 60px;
    padding: 0.75rem;
  }
  
  .sidebar-header span,
  .nav-item span,
  .storage-stats,
  .ipfs-status span {
    display: none;
  }
  
  .sidebar-header {
    justify-content: center;
    padding: 0.5rem;
  }
  
  .nav-item {
    justify-content: center;
    padding: 0.75rem;
  }
  
  .nav-item .badge {
    display: none;
  }
  
  .ipfs-status {
    justify-content: center;
    padding: 0.5rem;
  }
  
  .content-header h1 {
    font-size: 1.25rem;
  }
  
  .content-header p {
    display: none;
  }
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: var(--bg-primary, #fff);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
}

.modal-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: var(--hover-bg, #f1f5f9);
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.modal-close:hover {
  background: var(--border-color, #e2e8f0);
  color: var(--text-primary, #1e293b);
}

.modal-body {
  padding: 1.5rem;
}

.modal-desc {
  color: var(--text-secondary, #64748b);
  font-size: 0.875rem;
  margin-bottom: 1.5rem;
}

.share-option {
  margin-bottom: 1.25rem;
}

.share-option:last-child {
  margin-bottom: 0;
}

.share-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #475569;
  margin-bottom: 0.5rem;
  display: block;
}

.share-input-group {
  display: flex;
  gap: 0.5rem;
}

.share-input {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 10px;
  font-size: 0.875rem;
  color: var(--text-primary, #1e293b);
  background: var(--bg-secondary, #f8fafc);
  font-family: 'Courier New', monospace;
}

.share-copy-btn {
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 10px;
  background: var(--gradient-primary);
  color: white;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.share-copy-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px var(--primary-a30);
}

.permalink-options {
  margin-bottom: 1.5rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #475569;
  margin-bottom: 0.5rem;
}

.form-select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 10px;
  font-size: 0.875rem;
  color: var(--text-primary, #1e293b);
  background: var(--bg-primary, #fff);
  cursor: pointer;
  transition: all 0.2s ease;
}

.form-select:hover {
  border-color: #cbd5e1;
}

.form-select:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--primary-a10);
}

.btn-modal-primary {
  width: 100%;
  padding: 0.875rem;
  border: none;
  border-radius: 10px;
  background: var(--gradient-primary);
  color: white;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-modal-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px var(--primary-a30);
}

.btn-modal-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.permalink-help {
  font-size: 0.8125rem;
  color: var(--text-secondary, #64748b);
  margin-top: 0.75rem;
  line-height: 1.5;
}

.permalink-loading {
  text-align: center;
  padding: 2rem 0;
}

.permalink-loading .spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #e2e8f0;
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.permalink-loading p {
  color: var(--text-secondary, #64748b);
  font-size: 0.875rem;
}

.permalink-success {
  text-align: center;
  padding: 1rem 0;
}

.success-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1rem;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.success-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
  margin-bottom: 0.5rem;
}

.permalink-success p {
  color: var(--text-secondary, #64748b);
  font-size: 0.875rem;
  margin-bottom: 1.5rem;
}

.permalink-result-box {
  background: var(--bg-secondary, #f8fafc);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 10px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.result-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary, #64748b);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
}

.result-input-group {
  display: flex;
  gap: 0.5rem;
}

.result-input {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: var(--text-primary, #1e293b);
  background: var(--bg-primary, #fff);
  font-family: 'Courier New', monospace;
}

.result-copy-btn {
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 8px;
  background: var(--accent-primary);
  color: white;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.result-copy-btn:hover {
  background: var(--accent-secondary);
}

.btn-modal-secondary {
  width: 100%;
  padding: 0.875rem;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 10px;
  background: var(--bg-primary, #fff);
  color: var(--text-secondary, #64748b);
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-modal-secondary:hover {
  background: var(--bg-secondary, #f8fafc);
  border-color: #cbd5e1;
}

/* Modal Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

