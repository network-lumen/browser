<template>
  <div class="drive-page internal-page">
    <!-- Sidebar -->
    <InternalSidebar title="Drive" :icon="Cloud" activeKey="drive">
      <!-- Hosting -->
      <div class="hosting-panel">
        <div class="stats-header">
          <Database :size="14" />
          <span>Storage</span>
        </div>

        <div class="hosting-row" :class="{ active: hosting.kind === 'local' }">
          <button
            class="hosting-main"
            type="button"
            @click="selectHosting('local')"
          >
            <span
              class="hosting-dot"
              :class="ipfsConnected ? 'ok' : 'off'"
            ></span>
            <span class="hosting-title">Local</span>
          </button>
          <button
            class="hosting-details"
            type="button"
            @click.stop="openLocalDetails"
            title="Local details"
          >
            <TableProperties :size="16" />
          </button>
        </div>

        <div class="hosting-divider"></div>

        <div class="hosting-subheader">
          <span class="hosting-subheader-title">Subscriptions</span>
          <button
            class="hosting-subheader-action"
            type="button"
            @click="openPlansModal"
          >
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
          :class="{
            active:
              hosting.kind === 'gateway' && hosting.gatewayId === sub.gatewayId,
          }"
        >
          <button
              class="hosting-main"
              type="button"
              @click="selectGateway(sub.gatewayId)"
            >
              <span class="hosting-dot" :class="sub.statusDot"></span>
              <span class="hosting-title" :title="sub.hoverTitle">{{
                sub.label
              }}</span>
              <span
                v-if="sub.regionLabel"
                class="hosting-region"
                :title="sub.regionTitle"
              >
                {{ sub.regionLabel }}
              </span>
              <span class="hosting-tags" v-if="sub.planTags.length">
                <span v-for="p in sub.planTags" :key="p" class="hosting-tag">{{
                  p
                }}</span>
              </span>
          </button>
          <button
            class="hosting-details"
            type="button"
            @click.stop="openGatewayDetails(sub.gatewayId)"
            title="Subscription details"
          >
            <TableProperties :size="16" />
          </button>
        </div>
      </div>
    </InternalSidebar>

    <!-- Main Content -->
    <main class="main-content">
      <!-- Header -->
      <header class="content-header">
        <div>
          <h1>{{ headerTitle }}</h1>
          <p>{{ headerSubtitle }}</p>
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
              <button
                class="upload-dropdown-item"
                type="button"
                @click="openFilePicker"
              >
                Upload files
              </button>
              <button
                class="upload-dropdown-item"
                type="button"
                @click="openFolderPicker"
              >
                Upload folder
              </button>
            </div>

            <input
              ref="fileUploadInput"
              class="file-picker-input"
              type="file"
              multiple
              @change="handleFileUpload"
            />
            <input
              ref="folderUploadInput"
              class="file-picker-input"
              type="file"
              multiple
              webkitdirectory
              directory
              @change="handleFolderUpload"
            />
          </div>
        </div>
      </header>

      <!-- Privacy Warning Banner -->
      <div class="warning-banner">
        <div class="warning-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </div>
        <div class="warning-content">
          <strong>Privacy Notice:</strong>
          <span>Everything uploaded on Lumen is public. Don't upload personal files.</span>
        </div>
      </div>

      <!-- Search and Filter Bar -->
      <div class="search-filter-bar">
        <div class="search-box">
          <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="Search files..."
            @input="currentPage = 1"
          />
          <button v-if="searchQuery" class="clear-search" @click="searchQuery = ''; currentPage = 1">
            <X :size="14" />
          </button>
        </div>
        <div class="filter-info">
          <span class="file-count">{{ filteredFiles.length }} {{ filteredFiles.length === 1 ? 'file' : 'files' }}</span>
          <select v-model="itemsPerPage" class="per-page-select" @change="currentPage = 1">
            <option :value="10">10 per page</option>
            <option :value="20">20 per page</option>
            <option :value="50">50 per page</option>
            <option :value="100">100 per page</option>
          </select>
        </div>
      </div>

      <!-- Breadcrumb (folders) -->
      <div v-if="isBrowsing" class="browse-bar">
        <button class="btn-ghost" type="button" @click="exitBrowse">
          Back
        </button>
        <div class="browse-crumbs">
          <button class="crumb" type="button" @click="exitBrowse">
            {{ browseHostingLabel }}
          </button>
          <span class="sep">/</span>
          <button class="crumb" type="button" @click="openBrowseAt('')">
            {{ browseRootLabel }}
          </button>
          <template v-for="c in browseCrumbs" :key="c.path">
            <span class="sep">/</span>
            <button class="crumb" type="button" @click="openBrowseAt(c.path)">
              {{ c.label }}
            </button>
          </template>
        </div>
      </div>

      <div v-if="browseLoading" class="listing-loading">
        <div class="drive-spinner" aria-busy="true"></div>
      </div>

      <div v-else-if="browseError" class="fetch-error txt-xs margin-top-25">
        {{ browseError }}
      </div>

      <!-- Upload Progress -->
      <div v-if="uploading" class="upload-progress">
        <div class="progress-content">
          <UiSpinner size="sm" />
          <div class="progress-info">
            <span class="txt-sm txt-weight-strong"
              >Uploading {{ uploadingFile }}</span
            >
            <span class="txt-xs color-gray-blue">
              {{ uploadingStatusLabel
              }}<template v-if="uploadingPercent != null">
                ({{ uploadingPercent }}%)
              </template>
            </span>
            <div class="progress-actions">
              <button
                class="progress-cancel-btn"
                type="button"
                @click="cancelUpload"
                :disabled="uploadingCanceling"
              >
                {{ uploadingCanceling ? "Cancelling..." : "Cancel" }}
              </button>
            </div>
          </div>
        </div>
        <div v-if="uploadingPercent != null" class="progress-bar">
          <div
            class="progress-bar-fill"
            :style="{ width: `${uploadingPercent}%` }"
          ></div>
        </div>
      </div>

      <!-- HLS Conversion Progress -->
      <div v-if="converting" class="upload-progress">
        <div class="progress-content">
          <UiSpinner size="sm" />
          <div class="progress-info">
            <span class="txt-sm txt-weight-strong"
              >Converting {{ convertingFile }}</span
            >
            <span class="txt-xs color-gray-blue"
              >Warning: this can take a while.</span
            >
            <span class="txt-xs color-gray-blue">
              {{ convertingStatusLabel
              }}<template v-if="convertingPercent != null">
                ({{ convertingPercent }}%)
              </template>
            </span>
            <div class="progress-actions">
              <button
                class="progress-cancel-btn"
                type="button"
                @click="cancelHlsConversion"
                :disabled="convertingCanceling"
              >
                {{ convertingCanceling ? "Cancelling..." : "Cancel" }}
              </button>
            </div>
          </div>
        </div>
        <div v-if="convertingPercent != null" class="progress-bar">
          <div
            class="progress-bar-fill"
            :style="{ width: `${convertingPercent}%` }"
          ></div>
        </div>
      </div>

      <div v-if="showSavedListSpinner" class="listing-loading">
        <div class="drive-spinner" aria-busy="true"></div>
      </div>

      <!-- Files Grid View -->
      <div
        v-if="!showSavedListSpinner && !browseLoading && displayFiles.length > 0 && viewMode === 'grid'"
        class="files-grid"
      >
        <div
          v-for="file in displayFiles"
          :key="file.cid"
          class="file-card"
          @click="handleEntryClick(file)"
          :class="{ selected: selectedFile?.cid === file.cid }"
        >
          <div class="file-preview" :class="getFileTypeClass(file)">
            <!-- Show actual image preview -->
            <img
              v-if="isImageFile(file.name)"
              :src="getImageSrc(file)"
              :alt="file.name"
              class="preview-image"
              loading="lazy"
              decoding="async"
              fetchpriority="low"
              @error="() => onImageError(file)"
            />
            <!-- Show video preview -->
            <video
              v-else-if="isVideoFile(file.name)"
              :src="getGatewayUrl(contentTargetFor(file))"
              class="preview-video"
              :poster="videoPosterFor(file)"
              preload="metadata"
              muted
              playsinline
              @loadeddata="markVideoThumbReady(file)"
              @mouseenter="
                (e) =>
                  void (e.target as HTMLVideoElement).play().catch(() => {})
              "
              @mouseleave="
                (e) => {
                  (e.target as HTMLVideoElement).pause();
                  (e.target as HTMLVideoElement).currentTime = 0;
                }
              "
            ></video>
            <img
              v-else-if="isHlsEntry(file)"
              :src="videoPosterFor(file) || ''"
              :alt="file.name"
              class="preview-image"
              loading="lazy"
              decoding="async"
              fetchpriority="low"
            />
            <!-- Show icon for other files -->
            <component
              v-else
              :is="getFileIcon(file)"
              :size="32"
              stroke-width="1.5"
            />
          </div>
          <div class="file-info">
            <p class="file-name">{{ file.name }}</p>
            <p class="file-meta">{{ formatSize(file.size) }}</p>
          </div>
          <div class="file-actions">
            <button
              v-if="!isBrowsing && isDirEntry(file)"
              class="action-btn"
              title="Details"
              @click.stop="openEntryDetails(file)"
            >
              <TableProperties :size="16" />
            </button>
            <button
              class="action-btn"
              title="Download"
              @click.stop="downloadFile(file)"
            >
              <Download :size="16" />
            </button>
            <button
              v-if="!isDirEntry(file) && isVideoFile(file.name)"
              class="action-btn"
              title="Convert to HLS"
              :disabled="converting || uploading"
              @click.stop="convertToHls(file)"
            >
              <Clapperboard :size="16" />
            </button>
            <button
              class="action-btn"
              title="Share"
              @click.stop="copyLumenLinkFor(file)"
            >
              <Share2 :size="16" />
            </button>
            <button
              class="action-btn"
              title="Open"
              @click.stop="openInIpfs(file)"
            >
              <ExternalLink :size="16" />
            </button>
            <button
              class="action-btn danger"
              title="Remove"
              @click.stop="removeFile(file)"
            >
              <Trash2 :size="16" />
            </button>
          </div>
        </div>
      </div>

      <!-- Files List View -->
      <div
        v-else-if="!showSavedListSpinner && !browseLoading && displayFiles.length > 0 && viewMode === 'list'"
        class="files-list"
      >
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
          @click="handleEntryClick(file)"
          :class="{ selected: selectedFile?.cid === file.cid }"
        >
          <div class="list-icon" :class="getFileTypeClass(file)">
            <!-- Show small thumbnail for images -->
            <img
              v-if="isImageFile(file.name)"
              :src="getImageSrc(file)"
              :alt="file.name"
              class="list-thumbnail"
              loading="lazy"
              decoding="async"
              fetchpriority="low"
              @error="() => onImageError(file)"
            />
            <video
              v-else-if="isVideoFile(file.name)"
              :src="getGatewayUrl(contentTargetFor(file))"
              class="list-thumbnail-video"
              :poster="videoPosterFor(file)"
              preload="metadata"
              muted
              playsinline
              @loadeddata="markVideoThumbReady(file)"
            ></video>
            <img
              v-else-if="isHlsEntry(file)"
              :src="videoPosterFor(file) || ''"
              :alt="file.name"
              class="list-thumbnail"
              loading="lazy"
              decoding="async"
              fetchpriority="low"
            />
            <component
              v-else
              :is="getFileIcon(file)"
              :size="20"
              stroke-width="1.5"
            />
          </div>
          <span class="list-name">{{ file.name }}</span>
          <span class="list-size">{{ formatSize(file.size) }}</span>
          <span class="list-date">{{
            file.uploadedAt ? formatDate(file.uploadedAt) : "—"
          }}</span>
          <div class="list-actions">
            <button
              v-if="!isBrowsing && isDirEntry(file)"
              class="action-btn"
              title="Details"
              @click.stop="openEntryDetails(file)"
            >
              <TableProperties :size="14" />
            </button>
            <button
              class="action-btn"
              title="Download"
              @click.stop="downloadFile(file)"
            >
              <Download :size="14" />
            </button>
            <button
              v-if="!isDirEntry(file) && isVideoFile(file.name)"
              class="action-btn"
              title="Convert to HLS"
              :disabled="converting || uploading"
              @click.stop="convertToHls(file)"
            >
              <Clapperboard :size="14" />
            </button>
            <button
              class="action-btn"
              title="Share"
              @click.stop="copyLumenLinkFor(file)"
            >
              <Share2 :size="14" />
            </button>
            <button
              class="action-btn danger"
              title="Remove"
              @click.stop="removeFile(file)"
            >
              <Trash2 :size="14" />
            </button>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="!showSavedListSpinner && !browseLoading && filteredFiles.length > 0 && totalPages > 1" class="pagination-bar">
        <button 
          class="page-btn" 
          :disabled="currentPage === 1"
          @click="currentPage = 1"
          title="First page"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/>
          </svg>
        </button>
        <button 
          class="page-btn" 
          :disabled="currentPage === 1"
          @click="currentPage--"
          title="Previous page"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        
        <div class="page-numbers">
          <template v-for="(page, idx) in pageNumbers" :key="idx">
            <span v-if="page === '...'" class="page-ellipsis">...</span>
            <button 
              v-else
              class="page-num" 
              :class="{ active: currentPage === page }"
              @click="currentPage = page as number"
            >
              {{ page }}
            </button>
          </template>
        </div>
        
        <button 
          class="page-btn" 
          :disabled="currentPage === totalPages"
          @click="currentPage++"
          title="Next page"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
        <button 
          class="page-btn" 
          :disabled="currentPage === totalPages"
          @click="currentPage = totalPages"
          title="Last page"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/>
          </svg>
        </button>
        
        <span class="page-info">
          {{ (currentPage - 1) * itemsPerPage + 1 }}-{{ Math.min(currentPage * itemsPerPage, filteredFiles.length) }} of {{ filteredFiles.length }}
        </span>
      </div>

      <!-- Empty State -->
      <div v-else-if="!showSavedListSpinner && !browseLoading && filteredFiles.length === 0" class="empty-state">
        <div class="empty-icon">
          <Cloud :size="64" stroke-width="1" />
        </div>
        <h3 class="txt-md txt-weight-strong margin-top-50">
          {{ isBrowsing ? "Empty folder" : "No saved content" }}
        </h3>
        <p class="txt-sm color-gray-blue margin-top-25">
          {{
            isBrowsing
              ? "This folder has no entries."
              : "Drag and drop files or click Upload to add files"
          }}
        </p>
        <button
          class="upload-btn-large margin-top-50"
          type="button"
          @click="openFilePicker"
        >
          <Upload :size="20" />
          <span>Choose files to upload</span>
        </button>
      </div>
    </main>

    <!-- File Detail Panel -->
    <aside v-if="selectedFile" class="detail-panel">
      <div class="detail-header">
        <h3 class="txt-sm txt-weight-strong">
          {{ isDirEntry(selectedFile) ? "Folder Details" : "File Details" }}
        </h3>
        <button class="close-btn" @click="selectedFile = null">
          <X :size="18" />
        </button>
      </div>

      <div class="detail-preview" :class="getFileTypeClass(selectedFile)">
        <!-- Show actual image preview in detail panel -->
        <img
          v-if="isImageFile(selectedFile.name)"
          :src="getImageSrc(selectedFile)"
          :alt="selectedFile.name"
          class="detail-preview-image"
          decoding="async"
          @error="() => selectedFile && onImageError(selectedFile)"
        />
        <!-- Show video preview in detail panel -->
        <video
          v-else-if="isVideoFile(selectedFile.name)"
          :src="getGatewayUrl(contentTargetFor(selectedFile))"
          class="detail-preview-video"
          controls
          muted
          playsinline
        ></video>
        <img
          v-else-if="isHlsEntry(selectedFile)"
          :src="videoPosterFor(selectedFile) || ''"
          :alt="selectedFile.name"
          class="detail-preview-image"
          decoding="async"
        />
        <!-- Show icon for other files -->
        <component
          v-else
          :is="getFileIcon(selectedFile)"
          :size="48"
          stroke-width="1.5"
        />
      </div>

      <div class="detail-info">
        <div class="info-row">
          <span class="info-label">Name</span>
          <input
            v-if="canRenameSelected"
            class="info-value name-input"
            v-model.trim="renameDraft"
            type="text"
            placeholder="Unknown"
            @keyup.enter="saveSelectedName"
            @blur="saveSelectedName"
          />
          <span v-else class="info-value">{{ selectedFile.name }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Size</span>
          <span class="info-value">{{ formatSize(selectedFile.size) }}</span>
        </div>
        <div class="info-row" v-if="selectedFile.uploadedAt">
          <span class="info-label">Added</span>
          <span class="info-value">{{
            formatDate(selectedFile.uploadedAt)
          }}</span>
        </div>
      </div>

      <div class="detail-actions">
        <button
          v-if="!isDirEntry(selectedFile)"
          class="detail-btn primary"
          @click="downloadFile(selectedFile)"
        >
          <Download :size="16" />
          Download
        </button>
        <button
          v-if="!isDirEntry(selectedFile) && isVideoFile(selectedFile.name)"
          class="detail-btn"
          :disabled="converting || uploading"
          @click="convertSelectedToHls"
          title="Convert to HLS (creates a new CID)"
        >
          <Clapperboard :size="16" />
          Convert to HLS
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
        <p class="txt-md txt-weight-strong margin-top-25">
          Drop files to upload
        </p>
      </div>
    </div>

    <!-- Upload Path Modal (fallback for environments without a working file picker) -->
    <Transition name="modal">
      <div
        v-if="showUploadPathModal"
        class="modal-overlay"
        @click="closeUploadPathModal"
      >
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>{{ uploadPathMode === "folder" ? "Upload folder" : "Upload files" }}</h3>
            <button
              class="modal-close"
              type="button"
              @click="closeUploadPathModal"
            >
              <X :size="20" />
            </button>
          </div>

          <div class="modal-body">
            <p class="modal-desc">
              Paste {{ uploadPathMode === "folder" ? "folder" : "file" }} path{{
                uploadPathMode === "folder" ? "" : "s"
              }}
              (one per line).
            </p>
            <textarea
              v-model="uploadPathText"
              class="upload-path-textarea"
              rows="5"
              :placeholder="
                uploadPathMode === 'folder'
                  ? '/root/my-folder'
                  : '/root/my-file.txt'
              "
            ></textarea>
          </div>

          <div class="modal-footer">
            <button
              class="btn-modal-secondary"
              type="button"
              @click="closeUploadPathModal"
              :disabled="uploadPathBusy"
            >
              Cancel
            </button>
            <button
              class="btn-modal-primary"
              type="button"
              @click="submitUploadPathModal"
              :disabled="uploadPathBusy"
            >
              <UiSpinner v-if="uploadPathBusy" size="sm" />
              <span>{{ uploadPathBusy ? "Uploading..." : "Upload" }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Local Details Modal -->
    <Transition name="modal">
      <div
        v-if="showLocalDetails"
        class="modal-overlay"
        @click="closeLocalDetails"
      >
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>Local drive</h3>
            <button class="modal-close" @click="closeLocalDetails">
              <X :size="20" />
            </button>
          </div>
          <div class="modal-body">

            <div class="details-grid">
              <div class="details-row">
                <span class="details-label">Status</span>
                <span
                  class="details-value"
                  :class="ipfsConnected ? 'ok' : 'off'"
                >
                  {{ ipfsConnected ? "Online" : "Offline" }}
                </span>
              </div>
              <div class="details-row" v-if="stats">
                <span class="details-label">Used</span>
                <span class="details-value">{{
                  formatSize(stats.repoSize)
                }}</span>
              </div>
              <div class="details-row">
                <span class="details-label">Saved items</span>
                <span class="details-value">{{ localSavedCount }}</span>
              </div>
              <div class="details-row">
                <span class="details-label">Pinned locally</span>
                <span class="details-value">{{ pinnedFiles.length }}</span>
              </div>
            </div>

            <div class="details-section">
              <div class="details-section-header">
                <h4>Backup</h4>
                <UiSpinner v-if="driveBackupBusy" size="sm" />
              </div>

              <p class="txt-xs color-gray-blue" style="margin: 0 0 0.75rem 0">
                Export/import your drive metadata (CIDs, names, favourites). The snapshot is
                encrypted with a password you choose. It doesn't include the data behind CIDs
                (only references). Keep the file + password safe.
              </p>

              <div v-if="driveBackupError" class="plans-error">
                <div class="plans-error-title">Backup failed</div>
                <div class="plans-error-text">{{ driveBackupError }}</div>
              </div>

              <div class="details-grid">
                <div class="details-row">
                  <span class="details-label">Last export</span>
                  <span class="details-value">{{
                    driveBackupLastExportAt ? formatDate(driveBackupLastExportAt) : "—"
                  }}</span>
                </div>
                <div class="details-row">
                  <span class="details-label">Last import</span>
                  <span class="details-value">{{
                    driveBackupLastImportAt ? formatDate(driveBackupLastImportAt) : "—"
                  }}</span>
                </div>
              </div>

              <div class="details-actions" style="margin-top: 0.75rem; flex-wrap: wrap">
                <button
                  class="btn-ghost"
                  type="button"
                  :disabled="driveBackupBusy"
                  @click="openDriveBackupExportModal"
                >
                  Export snapshot
                </button>
                <button
                  class="btn-ghost"
                  type="button"
                  :disabled="driveBackupBusy"
                  @click="triggerImportDriveBackup"
                >
                  Import snapshot
                </button>
                <input
                  ref="driveBackupImportInput"
                  type="file"
                  accept="application/json,.json"
                  style="display: none"
                  @change="handleImportDriveBackupFile"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Export Snapshot Modal -->
    <Transition name="modal">
      <div
        v-if="showDriveBackupExportModal"
        class="modal-overlay"
        @click="closeDriveBackupExportModal"
      >
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>Export drive snapshot</h3>
            <button class="modal-close" @click="closeDriveBackupExportModal">
              <X :size="20" />
            </button>
          </div>
          <div class="modal-body">
            <p class="modal-desc">
              Set a password to encrypt your drive metadata backup for
              <strong>{{ activeProfileDisplay || "this profile" }}</strong>.
            </p>

            <div class="drive-backup-form">
              <div class="drive-backup-field">
                <label class="drive-backup-label">Password</label>
                <input
                  class="drive-backup-input"
                  :type="driveBackupExportShowPassword ? 'text' : 'password'"
                  v-model="driveBackupExportPassword"
                  placeholder="Min 8 characters (recommended: long passphrase)"
                  :disabled="driveBackupBusy"
                />
              </div>

              <div class="drive-backup-field">
                <label class="drive-backup-label">Confirm password</label>
                <input
                  class="drive-backup-input"
                  :type="driveBackupExportShowPassword ? 'text' : 'password'"
                  v-model="driveBackupExportPasswordConfirm"
                  placeholder="Repeat password"
                  :disabled="driveBackupBusy"
                  @keyup.enter="confirmDriveBackupExport"
                />
              </div>

              <label class="drive-backup-toggle">
                <input
                  type="checkbox"
                  v-model="driveBackupExportShowPassword"
                  :disabled="driveBackupBusy"
                />
                <span>Show password</span>
              </label>

              <p class="txt-xs color-gray-blue" style="margin: 0.75rem 0 0 0">
                If you lose the password, this backup cannot be recovered.
              </p>

              <div v-if="driveBackupError" class="plans-error" style="margin-top: 0.75rem">
                <div class="plans-error-title">Backup failed</div>
                <div class="plans-error-text">{{ driveBackupError }}</div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button
              class="btn-modal-secondary"
              type="button"
              :disabled="driveBackupBusy"
              @click="closeDriveBackupExportModal"
            >
              Cancel
            </button>
            <button
              class="btn-modal-primary"
              type="button"
              :disabled="
                driveBackupBusy ||
                !driveBackupExportPassword ||
                driveBackupExportPassword.length < 8 ||
                driveBackupExportPassword !== driveBackupExportPasswordConfirm
              "
              @click="confirmDriveBackupExport"
            >
              <UiSpinner v-if="driveBackupBusy" size="sm" />
              <span>{{ driveBackupBusy ? "Exporting..." : "Export" }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Import Snapshot Modal -->
    <Transition name="modal">
      <div
        v-if="showDriveBackupImportModal"
        class="modal-overlay"
        @click="closeDriveBackupImportModal"
      >
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>Import drive snapshot</h3>
            <button class="modal-close" @click="closeDriveBackupImportModal">
              <X :size="20" />
            </button>
          </div>
          <div class="modal-body">
            <p class="modal-desc">
              This will replace your local drive metadata (CIDs, names, favourites) for
              <strong>{{ activeProfileDisplay || "this profile" }}</strong>.
            </p>

            <div v-if="driveBackupImportFilename" class="details-grid">
              <div class="details-row">
                <span class="details-label">File</span>
                <span class="details-value">{{ driveBackupImportFilename }}</span>
              </div>
            </div>

            <div
              v-if="!driveBackupRestoreDetails"
              class="drive-backup-form"
              style="margin-top: 1rem"
            >
              <div class="drive-backup-field">
                <label class="drive-backup-label">Password</label>
                <input
                  class="drive-backup-input"
                  :type="driveBackupImportShowPassword ? 'text' : 'password'"
                  v-model="driveBackupImportPassword"
                  placeholder="Enter backup password"
                  :disabled="driveBackupBusy"
                  @keyup.enter="decryptDriveBackupImport"
                />
              </div>

              <label class="drive-backup-toggle">
                <input
                  type="checkbox"
                  v-model="driveBackupImportShowPassword"
                  :disabled="driveBackupBusy"
                />
                <span>Show password</span>
              </label>

              <div v-if="driveBackupError" class="plans-error" style="margin-top: 0.75rem">
                <div class="plans-error-title">Import failed</div>
                <div class="plans-error-text">{{ driveBackupError }}</div>
              </div>
            </div>

            <template v-else>
              <div class="details-grid" style="margin-top: 1rem">
                <div class="details-row">
                  <span class="details-label">Wallet</span>
                  <span class="details-value mono">{{
                    driveBackupRestoreDetails.walletAddress || "—"
                  }}</span>
                </div>
                <div class="details-row">
                  <span class="details-label">Created</span>
                  <span class="details-value">{{
                    driveBackupRestoreDetails.createdAt
                      ? formatDate(driveBackupRestoreDetails.createdAt)
                      : "—"
                  }}</span>
                </div>
                <div class="details-row">
                  <span class="details-label">Saved items</span>
                  <span class="details-value">{{ driveBackupRestoreDetails.filesCount }}</span>
                </div>
                <div class="details-row">
                  <span class="details-label">Favourites</span>
                  <span class="details-value">{{ driveBackupRestoreDetails.favCount }}</span>
                </div>
              </div>

              <div
                v-if="driveBackupRestoreDetails.walletMismatch"
                class="plans-error"
                style="margin-top: 1rem"
              >
                <div class="plans-error-title">Different wallet</div>
                <div class="plans-error-text">
                  This snapshot was created for a different wallet. Importing it will still work,
                  but make sure you're restoring into the right profile.
                </div>
              </div>

              <div v-if="driveBackupRestoreDetails.rollback" class="plans-error" style="margin-top: 1rem">
                <div class="plans-error-title">Older snapshot</div>
                <div class="plans-error-text">
                  This snapshot looks older than your current local version (seq
                  {{ driveBackupRestoreDetails.localSeq }}).
                </div>
              </div>

              <div v-if="driveBackupError" class="plans-error" style="margin-top: 0.75rem">
                <div class="plans-error-title">Import failed</div>
                <div class="plans-error-text">{{ driveBackupError }}</div>
              </div>
            </template>
          </div>
          <div class="modal-footer">
            <button
              class="btn-modal-secondary"
              type="button"
              :disabled="driveBackupBusy"
              @click="closeDriveBackupImportModal"
            >
              Cancel
            </button>
            <button
              class="btn-modal-primary"
              type="button"
              :disabled="
                driveBackupBusy ||
                !pendingDriveBackupImport ||
                (!driveBackupRestoreDetails &&
                  (!driveBackupImportPassword || driveBackupImportPassword.length < 8))
              "
              @click="driveBackupRestoreDetails ? confirmDriveBackupRestore() : decryptDriveBackupImport()"
            >
              <UiSpinner v-if="driveBackupBusy" size="sm" />
              <span>{{
                driveBackupBusy
                  ? driveBackupRestoreDetails
                    ? "Restoring..."
                    : "Decrypting..."
                  : driveBackupRestoreDetails
                    ? "Restore"
                    : "Decrypt"
              }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Subscription Details Modal -->
    <Transition name="modal">
      <div
        v-if="showGatewayDetails"
        class="modal-overlay"
        @click="closeGatewayDetails"
      >
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>Subscription details</h3>
            <button class="modal-close" @click="closeGatewayDetails">
              <X :size="20" />
            </button>
          </div>
          <div class="modal-body">
            <div v-if="gatewayDetailsLoading" class="permalink-loading">
              <div class="drive-spinner" aria-busy="true"></div>
            </div>

            <template v-else>
              <div class="details-grid">
                <div class="details-row">
                  <span class="details-label">Gateway</span>
                  <span class="details-value">{{
                    gatewayDetailsGatewayLabel
                  }}</span>
                </div>
                <div class="details-row" v-if="false">
                  <span class="details-label">Base URL</span>
                  <span class="details-value mono">{{ gatewayBase || "-" }}</span>
                </div>
                <div class="details-row">
                  <span class="details-label">Status</span>
                  <span
                    class="details-value"
                    :class="gatewayDetailsStatusClass"
                  >
                    {{ gatewayDetailsStatusLabel }}
                  </span>
                </div>
                <div class="details-row">
                  <span class="details-label">Saved</span>
                  <span class="details-value">
                    {{ gatewayDetailsPinned.length }}
                  </span>
                </div>
              </div>

              <div class="details-section">
                <div class="details-section-header">
                  <h4>Usage</h4>
                </div>
                <div
                  v-if="gatewayDetailsUsageError === 'password_required'"
                  class="plans-error"
                >
                  <div class="plans-error-title">Wallet locked</div>
                  <div class="plans-error-text">
                    Unlock your Lumen identity to fetch usage from this cloud.
                  </div>
                  <button
                    class="btn-ghost"
                    type="button"
                    @click="requestUnlock"
                  >
                    Unlock
                  </button>
                </div>
                <div v-else-if="gatewayDetailsUsageError" class="plans-error">
                  {{ gatewayDetailsUsageError }}
                </div>
                <div v-else-if="gatewayDetailsUsage" class="details-grid">
                  <div class="details-row">
                    <span class="details-label">Quota</span>
                    <span class="details-value">
                      {{
                        gatewayDetailsUsage.plan?.quota_bytes_total != null ||
                        gatewayDetailsUsage.plan?.quotaBytesTotal != null
                          ? formatSize(
                              (gatewayDetailsUsage.plan.quota_bytes_total ??
                                gatewayDetailsUsage.plan.quotaBytesTotal) as number,
                            )
                          : "-"
                      }}
                    </span>
                  </div>
                  <div class="details-row">
                    <span class="details-label">Used</span>
                    <span class="details-value">
                      {{
                        gatewayDetailsUsage.plan?.quota_bytes_used != null ||
                        gatewayDetailsUsage.plan?.quotaBytesUsed != null
                          ? formatSize(
                              (gatewayDetailsUsage.plan.quota_bytes_used ??
                                gatewayDetailsUsage.plan.quotaBytesUsed) as number,
                            )
                          : "-"
                      }}
                    </span>
                  </div>
                  <div class="details-row">
                    <span class="details-label">Bandwidth</span>
                    <span class="details-value">{{
                      gatewayDetailsBandwidthUsed
                    }}</span>
                  </div>
                  <div class="details-row">
                    <span class="details-label">Roots</span>
                    <span class="details-value">{{
                      gatewayDetailsUsage.usage?.roots_total ??
                      gatewayDetailsUsage.usage?.rootsTotal ??
                      "-"
                    }}</span>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Plans Modal -->
    <Transition name="modal">
      <div v-if="showPlansModal" class="modal-overlay" @click="closePlansModal">
        <div class="modal-content plans-modal" @click.stop>
          <div class="modal-header">
            <h3>Cloud plans</h3>
            <button class="modal-close" @click="closePlansModal">
              <X :size="20" />
            </button>
          </div>
          <div class="modal-body">

            <div v-if="plansLoading" class="permalink-loading">
              <div class="drive-spinner" aria-busy="true"></div>
            </div>

            <div v-else-if="plansError" class="permalink-success">
              <p>{{ plansError }}</p>
            </div>

            <div v-else-if="!plans.length" class="permalink-success">
              <p>No plans available at the moment.</p>
            </div>

            <div v-else class="plans-list">
              <div v-if="false">
                <div v-for="plan in plans" :key="plan.id" class="plan-row">
                  <div class="plan-main">
                    <div class="plan-title-row">
                      <span class="plan-name">{{ planDisplayName(plan) }}</span>
                      <span
                        class="plan-status-badge"
                        :class="{
                          active: planStatus(plan) === 'active',
                          pending: planStatus(plan) === 'pending',
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
                            : "Not specified"
                        }}
                      </span>
                    </div>
                    <div class="plan-meta-line">
                      <span class="label">Egress</span>
                      <span class="value">
                        {{
                          plan.networkGbPerMonth
                            ? `${plan.networkGbPerMonth} GB / month`
                            : "Fair usage"
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
                 <div class="plans-controls-row">
                   <div class="plans-search-group plans-search-group-primary">
                     <div class="plans-search-input">
                       <Search :size="16" class="plans-search-ico" />
                       <input
                         v-model.trim="planFilter"
                         type="search"
                         placeholder="Search gateways or plans"
                         class="plans-filter-input"
                         @keydown.stop
                         aria-label="Search gateways"
                       />
                     </div>

                     <select
                       v-model="planRegion"
                       class="plans-filter-select"
                       aria-label="Region filter"
                     >
                       <option value="">All regions</option>
                       <option v-for="r in planRegions" :key="r" :value="r">
                         {{ r }}
                       </option>
                     </select>
                   </div>

                   <div class="plans-search-group plans-search-group-sort">
                     <select
                       v-model="planSortBy"
                       class="plans-filter-select"
                       aria-label="Sort by"
                     >
                       <option value="score-desc">Sort: Score (high-low)</option>
                       <option value="name-asc">Sort: Name (A-Z)</option>
                       <option value="name-desc">Sort: Name (Z-A)</option>
                     </select>
                   </div>
                 </div>

                 <div class="plans-controls-row plans-controls-row-secondary">
                   <label class="plans-filter-checkbox">
                     <input type="checkbox" v-model="planOnlineOnly" />
                     <span>Online only</span>
                   </label>
                 </div>
               </div>

               <div v-if="!planGroups.length" class="plans-empty">
                 <h4>No gateways match your filters</h4>
                 <p class="plans-empty-muted">Try clearing filters or search.</p>
                 <div class="plans-empty-actions">
                   <button
                     v-if="planFilter"
                     type="button"
                     class="btn-ghost"
                     @click="planFilter = ''"
                   >
                     Clear search
                   </button>
                   <button
                     v-if="hasPlanFilters"
                     type="button"
                     class="btn-ghost"
                     @click="resetPlanFilters"
                   >
                     Reset filters
                   </button>
                   <button type="button" class="btn-ghost" @click="openPlansModal">
                     Reload
                   </button>
                 </div>
               </div>

               <!-- Grouped by gateway -->
               <div v-if="planGroups.length" class="plans-grid">
                 <article
                   v-for="group in planPagedGroups"
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
                      <span
                        v-if="group.gateway.regions.length"
                        class="gateway-region"
                        :title="formatRegionsTitle(group.gateway.regions)"
                      >
                        <MapPin :size="14" class="gateway-region-ico" />
                        <span class="gateway-region-text">{{
                          formatRegionsLabel(group.gateway.regions)
                        }}</span>
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
                        {{
                          isGatewayExpanded(group.gateway.id)
                            ? "Hide details"
                            : "Show details"
                        }}
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
                            <span class="plan-name">{{
                              planDisplayName(plan)
                            }}</span>
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
                                  : "Not specified"
                              }}
                            </span>
                          </div>
                          <div class="plan-meta-line">
                            <span class="label">Egress</span>
                            <span class="value">
                              {{
                                plan.networkGbPerMonth
                                  ? `${plan.networkGbPerMonth} GB / month`
                                  : "Fair usage"
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
                              pending: planStatus(plan) === 'pending',
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

             <div v-if="planGroups.length" class="plans-pager">
               <div class="plans-pager-side">
                 <span class="plans-pager-text">
                   Showing {{ planPageStart + 1 }}-{{
                     Math.min(planPageEnd, planGroups.length)
                   }}
                   of {{ planGroups.length }}
                 </span>
               </div>
               <div class="plans-pager-controls">
                 <button
                   type="button"
                   class="plans-pager-btn"
                   :disabled="planPage === 1"
                   @click="planPage = 1"
                 >
                   ⟪
                 </button>
                 <button
                   type="button"
                   class="plans-pager-btn"
                   :disabled="planPage === 1"
                   @click="planPage--"
                 >
                   Prev
                 </button>
                 <span class="plans-pager-text">
                   Page {{ planPage }} / {{ planTotalPages || 1 }}
                 </span>
                 <button
                   type="button"
                   class="plans-pager-btn"
                   :disabled="planPage === planTotalPages"
                   @click="planPage++"
                 >
                   Next
                 </button>
                 <button
                   type="button"
                   class="plans-pager-btn"
                   :disabled="planPage === planTotalPages"
                   @click="planPage = planTotalPages"
                 >
                   ⟫
                 </button>
               </div>
               <div class="plans-pager-side">
                 <select
                   v-model.number="planPageSize"
                   aria-label="Rows per page"
                   class="per-page-select"
                 >
                   <option :value="8">8 / page</option>
                   <option :value="16">16 / page</option>
                   <option :value="24">24 / page</option>
                 </select>
               </div>
             </div>
           </div>
         </div>
       </div>
     </div>
    </Transition>

    <!-- Subscribe Plan Modal -->
    <Transition name="modal">
      <div
        v-if="showSubscribeModal && subscribePlan"
        class="modal-overlay"
        @click="closeSubscribeModal"
      >
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
                      : "Not specified"
                  }}
                </span>
              </div>
              <div class="plan-meta-line">
                <span class="label">Egress</span>
                <span class="value">
                  {{
                    subscribePlan.networkGbPerMonth
                      ? `${subscribePlan.networkGbPerMonth} GB / month`
                      : "Fair usage"
                  }}
                </span>
              </div>
              <div class="plan-meta-line">
                <span class="label">Duration</span>
                <span class="value">
                  {{ subscribeMonths }} month{{
                    subscribeMonths > 1 ? "s" : ""
                  }}
                </span>
              </div>
              <div class="plan-meta-line">
                <span class="label">Total</span>
                <span class="value">
                  {{
                    subscribeTotalPrice.toFixed(
                      subscribeTotalPrice >= 10 ? 0 : 2,
                    )
                  }}
                  LMN
                </span>
              </div>
              <div class="plan-meta-line">
                <span class="label">Balance</span>
                <span class="value">
                  <template v-if="subscribeBalance !== null">
                    {{
                      subscribeBalance.toFixed(subscribeBalance >= 10 ? 0 : 2)
                    }}
                    LMN
                  </template>
                  <template v-else-if="subscribeBalanceLoading">
                    Loading...
                  </template>
                  <template v-else> — </template>
                </span>
              </div>
              <p
                v-if="hasInsufficientFunds"
                class="txt-xs color-red-base"
                style="margin-top: 0.5rem"
              >
                You can't subscribe because your wallet balance is too low.
              </p>
            </div>

            <div v-if="subscribeError" class="fetch-error txt-xs margin-top-25">
              {{ subscribeError }}
            </div>

            <p v-if="subscribeBusy" class="txt-xs color-gray-blue margin-top-25">
              Submitting on-chain transaction… This can take ~1–2 minutes the
              first time (PQC setup + block confirmation).
            </p>
          </div>
          <div class="modal-footer">
            <button
              class="btn-modal-secondary"
              type="button"
              @click="closeSubscribeModal"
              :disabled="subscribeBusy"
            >
              Cancel
            </button>
            <button
              class="btn-modal-primary"
              type="button"
              @click="confirmSubscribe"
              :disabled="
                subscribeBusy || hasInsufficientFunds || !subscribePlan
              "
            >
              <UiSpinner v-if="subscribeBusy" size="sm" />
              <span>{{ subscribeBusy ? "Submitting..." : "Confirm" }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>

  </div>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  onMounted,
  onUnmounted,
  onActivated,
  onDeactivated,
  watch,
  inject,
  toRaw,
  markRaw,
} from "vue";

const currentTabRefresh = inject<any>("currentTabRefresh", null);
const currentTabUrl = inject<any>("currentTabUrl", null);
const currentTabId = inject<any>("currentTabId", null);
const navigate = inject<((url: string, opts?: { push?: boolean }) => void) | null>(
  "navigate",
  null,
);

import {
  Cloud,
  Search,
  Download,
  Database,
  Plus,
  Upload,
  Clapperboard,
  ExternalLink,
  Trash2,
  X,
  Share2,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  BookOpen,
  Folder,
  File,
  CheckCircle,
  AlertCircle,
  LayoutGrid,
  List,
  TableProperties,
  MapPin,
  User,
} from "lucide-vue-next";
import UiSpinner from "../../ui/UiSpinner.vue";
import InternalSidebar from "../../components/InternalSidebar.vue";
import {
  localIpfsGatewayBase,
  loadWhitelistedGatewayBases,
} from "../services/contentResolver";
import { profilesState, activeProfileId } from "../profilesStore";
import { useFavourites, setFavouritesForProfile } from "../favouritesStore";

interface DriveFile {
  cid: string;
  name: string;
  size: number;
  uploadedAt?: number;
  type?: "file" | "dir";
  rootCid?: string;
  relPath?: string;
}

interface IpfsStats {
  repoSize: number;
  storageMax: number;
  numObjects: number;
}

type HostingKind = "local" | "gateway";
type HostingState = { kind: HostingKind; gatewayId: string };

const viewMode = ref<"grid" | "list">("list");
const files = ref<DriveFile[]>([]);
const pinnedFiles = ref<string[]>([]);
const localPinnedLoading = ref(false);
const selectedFile = ref<DriveFile | null>(null);
const ipfsConnected = ref(false);
const stats = ref<IpfsStats | null>(null);
const hosting = ref<HostingState>({ kind: "local", gatewayId: "" });

// Search and Pagination
const searchQuery = ref("");
const currentPage = ref(1);
const itemsPerPage = ref(20);

const uploading = ref(false);
const uploadingFile = ref("");
const uploadingStage = ref<
  | "preparing"
  | "adding"
  | "gateway-preflight"
  | "gateway-export"
  | "gateway-upload"
  | "done"
  | "cancelling"
>("preparing");
const uploadingPercent = ref<number | null>(null);
const uploadingCanceling = ref(false);
const converting = ref(false);
const convertingFile = ref("");
const convertingStage = ref<
  "preparing" | "downloading" | "transcoding" | "adding" | "done" | "cancelling"
>("preparing");
const convertingPercent = ref<number | null>(null);
const convertingCanceling = ref(false);
const isDragging = ref(false);
const showUploadMenu = ref(false);
const fileUploadInput = ref<HTMLInputElement | null>(null);
const folderUploadInput = ref<HTMLInputElement | null>(null);
const showUploadPathModal = ref(false);
const uploadPathMode = ref<"files" | "folder">("files");
const uploadPathText = ref("");
const uploadPathBusy = ref(false);

const toast = ref("");
const toastType = ref<"success" | "error">("success");

const uploadingStatusLabel = computed(() => {
  if (uploadingCanceling.value) return "Cancelling…";
  if (uploadingStage.value === "adding") return "Adding to local IPFS…";
  if (uploadingStage.value === "gateway-preflight") return "Preparing gateway upload…";
  if (uploadingStage.value === "gateway-export") return "Exporting DAG…";
  if (uploadingStage.value === "gateway-upload") return "Uploading to gateway…";
  if (uploadingStage.value === "done") return "Finalizing…";
  return "Preparing upload…";
});

const convertingStatusLabel = computed(() => {
  if (convertingCanceling.value) return "Cancelling…";
  if (convertingStage.value === "adding") return "Adding HLS files to IPFS…";
  if (convertingStage.value === "done") return "Finalizing…";
  return "Building an HLS ladder locally…";
});

const openInNewTab = inject<((url: string) => void) | null>(
  "openInNewTab",
  null,
);

const profiles = profilesState;
const activeProfile = computed(
  () => profiles.value.find((p) => p.id === activeProfileId.value) || null,
);
const activeProfileDisplay = computed(
  () => activeProfile.value?.name || activeProfile.value?.id || "",
);

const { favourites } = useFavourites();

const LEGACY_STORAGE_KEY = "lumen_drive_files";
const LEGACY_LOCAL_NAMES_KEY = "lumen_drive_saved_names";
const STORAGE_KEY_PREFIX = "lumen:drive:files:v1";
const LOCAL_NAMES_KEY_PREFIX = "lumen:drive:names:v1";

function filesStorageKey(profileId: string): string {
  const pid = String(profileId || "").trim() || "default";
  return `${STORAGE_KEY_PREFIX}:${pid}`;
}

function localNamesStorageKey(profileId: string): string {
  const pid = String(profileId || "").trim() || "default";
  return `${LOCAL_NAMES_KEY_PREFIX}:${pid}`;
}
const localNames = ref<Record<string, string>>({});
const renameDraft = ref("");
const imagePreviewUrls = ref<Record<string, string>>({});
const imagePreviewTried = ref<Record<string, boolean>>({});
const imagePreviewInFlight = new Set<string>();
const videoThumbReady = ref<Record<string, true>>({});

// Gateway / PQC usage (DrivePanel-style)
const gatewayUsage = ref<any | null>(null);
const gatewayUsageError = ref("");
const gatewayUsageLoading = ref(false);
const gatewayDetailsLoading = ref(false);
const gatewayPinned = ref<string[]>([]);
const gatewayPinnedNames = ref<Record<string, string>>({});
const gatewayPinnedError = ref("");
const gatewayPinnedLoading = ref(false);

const gatewayDetailsGatewayId = ref("");
const gatewayDetailsUsage = ref<any | null>(null);
const gatewayDetailsUsageError = ref("");
const gatewayDetailsPinned = ref<string[]>([]);
const gatewayDetailsPinnedError = ref("");
const gatewayBase = ref<string | null>(null);
const optimisticGatewayPinned = ref<Record<string, Record<string, number>>>({});
const OPTIMISTIC_GATEWAY_PIN_TTL_MS = 2 * 60 * 1000;

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
const plansError = ref("");
const planFilter = ref("");
const planRegion = ref("");
const planOnlineOnly = ref(false);
const planSortBy = ref<"score-desc" | "name-asc" | "name-desc">("score-desc");
const planPage = ref(1);
const planPageSize = ref(8);

// Gateway health (PQ /pq/pub reachability)
// Used to avoid showing "green" status dots for subscriptions when the gateway is actually offline.
const SUBSCRIBED_GATEWAY_HEALTH_TTL_MS = 10 * 60 * 1000;
const subscribedGatewayHealthById = ref<Record<string, { at: number; ok: boolean }>>({});
let subscribedGatewayHealthSeq = 0;

// Local details
const showLocalDetails = ref(false);
const driveBackupBusy = ref(false);
const driveBackupError = ref("");
const driveBackupLastExportAt = ref<number | null>(null);
const driveBackupLastImportAt = ref<number | null>(null);
const driveBackupImportInput = ref<HTMLInputElement | null>(null);
const showDriveBackupExportModal = ref(false);
const driveBackupExportPassword = ref("");
const driveBackupExportPasswordConfirm = ref("");
const driveBackupExportShowPassword = ref(false);
const showDriveBackupImportModal = ref(false);
const pendingDriveBackupImport = ref<{ filename: string; encrypted: any } | null>(null);
const driveBackupImportPassword = ref("");
const driveBackupImportShowPassword = ref(false);
const pendingDriveBackupRestore = ref<{ source: string; snapshot: any } | null>(null);

// Subscription details
const showGatewayDetails = ref(false);
async function requestUnlock() {
  try {
    await (window as any).lumen?.security?.lockSession?.();
  } catch {
    // ignore
  }
}

const planRegions = computed(() => {
  const set = new Set<string>();
  for (const gw of gateways.value) {
    (gw.regions || []).forEach((r) => set.add(r));
  }
  return Array.from(set).sort();
});

const hasPlanFilters = computed(() => {
  return !!planRegion.value || !!planOnlineOnly.value;
});

function resetPlanFilters() {
  planRegion.value = "";
  planOnlineOnly.value = false;
}

watch([planFilter, planRegion, planOnlineOnly, planSortBy, planPageSize], () => {
  planPage.value = 1;
});

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
  const key = String(id || "").trim();
  if (!key) return;
  const next = new Set(expandedGatewayIds.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  expandedGatewayIds.value = next;
}

function isGatewayExpanded(id: string): boolean {
  const key = String(id || "").trim();
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
      const ep = String(p.gatewayEndpoint || "").toLowerCase();
      return name.includes(query) || ep.includes(query);
    });
  });

  if (planSortBy.value === "score-desc") {
    gwList.sort(
      (a, b) =>
        (b.score ?? 0) - (a.score ?? 0) ||
        planGatewayLabel(a).localeCompare(planGatewayLabel(b)),
    );
  } else if (planSortBy.value === "name-asc") {
    gwList.sort((a, b) =>
      planGatewayLabel(a).localeCompare(planGatewayLabel(b)),
    );
  } else if (planSortBy.value === "name-desc") {
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

const planTotalPages = computed(() => {
  return Math.max(1, Math.ceil(planGroups.value.length / planPageSize.value));
});
const planPageStart = computed(() => (planPage.value - 1) * planPageSize.value);
const planPageEnd = computed(() => planPageStart.value + planPageSize.value);
const planPagedGroups = computed(() => {
  return planGroups.value.slice(planPageStart.value, planPageEnd.value);
});

watch(planTotalPages, (total) => {
  if (planPage.value > total) planPage.value = total;
});

const localSavedMetaCids = computed(() => {
  const meta = Array.isArray(files.value) ? files.value : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of meta) {
    const cid = String((f as any)?.cid || "").trim();
    if (!cid || isIgnoredCid(cid)) continue;
    const key = cid;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cid);
  }
  return out;
});

const activeSavedCids = computed(() => {
  if (hosting.value.kind === "gateway") return gatewayPinned.value;
  return localSavedMetaCids.value;
});

const savedRootsLoading = computed(() => {
  return hosting.value.kind === "gateway" ? gatewayPinnedLoading.value : false;
});

const showSavedListSpinner = computed(() => {
  return !isBrowsing.value && savedRootsLoading.value;
});

const localSavedCount = computed(() => localSavedMetaCids.value.length);

const entryTypeCache = ref<Record<string, "file" | "dir">>({});
const entryContentTypeCache = ref<Record<string, string>>({});
const entryContentTypeInFlight = new Set<string>();

const browseRootCid = ref("");
const browseRelPath = ref("");
const browseEntries = ref<DriveFile[]>([]);
const browseLoading = ref(false);
const browseError = ref("");
let browseLoadSeq = 0;
let gatewayDetailsLoadSeq = 0;
let gatewayPinnedSeq = 0;
let gatewayUsageSeq = 0;

const isBrowsing = computed(() => !!browseRootCid.value);
const canRenameSelected = computed(() => canRenameEntry(selectedFile.value));

function encodeIpfsTarget(target: string): string {
  const cleaned = String(target || "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  if (!cleaned) return "";
  const parts = cleaned.split("/").filter(Boolean);
  const cid = parts[0] || "";
  const rest = parts
    .slice(1)
    .map((s) => encodeURIComponent(s))
    .join("/");
  return rest ? `${cid}/${rest}` : cid;
}

function contentTargetFor(file: DriveFile): string {
  const root = String(file?.rootCid || "").trim();
  const rel = String(file?.relPath || "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  if (root) return rel ? `${root}/${rel}` : root;
  return String(file?.cid || "").trim();
}

function isHlsEntry(file: DriveFile | null | undefined): boolean {
  const rel = String(file?.relPath || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .toLowerCase();
  if (rel.endsWith(".m3u8")) return true;

  const name = String(file?.name || "").trim();
  const lower = name.toLowerCase();
  if (lower.endsWith(".m3u8")) return true;
  return /\s-\s*hls$/i.test(name);
}

function openTargetFor(file: DriveFile): string {
  const target = contentTargetFor(file);
  if (String(target).toLowerCase().endsWith(".m3u8")) return target;
  if (!isHlsEntry(file)) return target;
  const root = String(file?.rootCid || file?.cid || "").trim();
  if (!root) return target;
  return `${root}/master.m3u8`;
}

const rootSavedEntries = computed<DriveFile[]>(() => {
  return activeSavedCids.value
    .filter((cid) => !isIgnoredCid(cid))
    .map((cid) => {
      const existing = files.value.find((f) => f.cid === cid);
      const displayName = getSavedName(cid);
      return {
        cid,
        name: displayName,
        size: existing?.size ?? 0,
        uploadedAt: existing?.uploadedAt,
        type: entryTypeCache.value[String(cid)] || existing?.type || undefined,
        rootCid: String(existing?.rootCid || cid),
        relPath: String(existing?.relPath || ""),
      };
    });
});

// Filtered files (after search)
const filteredFiles = computed<DriveFile[]>(() => {
  const source = isBrowsing.value ? browseEntries.value : rootSavedEntries.value;
  const query = searchQuery.value.toLowerCase().trim();
  if (!query) return source;
  return source.filter((f) => f.name.toLowerCase().includes(query));
});

// Paginated files
const displayFiles = computed<DriveFile[]>(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return filteredFiles.value.slice(start, end);
});

// Total pages
const totalPages = computed(() => {
  return Math.ceil(filteredFiles.value.length / itemsPerPage.value) || 1;
});

watch(totalPages, (total) => {
  if (currentPage.value > total) currentPage.value = total;
  if (currentPage.value < 1) currentPage.value = 1;
});

// Page numbers for pagination
const pageNumbers = computed(() => {
  const total = totalPages.value;
  const current = currentPage.value;
  const pages: (number | string)[] = [];
  
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (current > 3) pages.push('...');
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
      pages.push(i);
    }
    if (current < total - 2) pages.push('...');
    pages.push(total);
  }
  return pages;
});

const sidebarFilesCount = computed(() => {
  return activeSavedCids.value.length;
});

const activeGateway = computed(() => {
  const id = String(hosting.value.gatewayId || "").trim();
  if (!id) return null;
  return gateways.value.find((g) => String(g.id) === id) || null;
});

function gatewayHintForId(gatewayId: string): string {
  const gid = String(gatewayId || "").trim();
  if (!gid) return "";

  const gw = gateways.value.find((g) => String(g.id) === gid) || null;
  if (gw?.endpoint) return String(gw.endpoint).trim();

  const sub = planSubscriptionsRaw.value.find((s) => String(s.gatewayId) === gid);
  const metaEndpoint =
    sub?.metadata?.endpoint ?? sub?.metadata?.baseUrl ?? sub?.metadata?.url;
  if (typeof metaEndpoint === "string" && metaEndpoint.trim())
    return metaEndpoint.trim();

  const plan = plans.value.find((p) => String(p.gatewayId) === gid);
  const planEndpoint = plan?.gatewayEndpoint;
  return typeof planEndpoint === "string" ? planEndpoint.trim() : "";
}

const activeGatewayHint = computed(() => {
  const gid = String(hosting.value.gatewayId || "").trim();
  return gatewayHintForId(gid);
});

const activeGatewayLabel = computed(() => {
  const gw = activeGateway.value;
  if (!gw) return "-";
  return gw.endpoint || `Gateway ${gw.id}`;
});

const gatewayDetailsGateway = computed(() => {
  const gid = String(gatewayDetailsGatewayId.value || "").trim();
  if (!gid) return null;
  return gateways.value.find((g) => String(g.id) === gid) || null;
});

const gatewayDetailsGatewayLabel = computed(() => {
  const gid = String(gatewayDetailsGatewayId.value || "").trim();
  if (!gid) return "-";
  const gw = gatewayDetailsGateway.value;
  if (!gw) return `Gateway ${gid}`;
  return gw.endpoint || `Gateway ${gw.id}`;
});

const hostingLabel = computed(() => {
  if (hosting.value.kind === "gateway")
    return activeGatewayLabel.value || "Gateway";
  return "Local";
});

const headerTitle = computed(() => {
  return hosting.value.kind === "gateway" ? hostingLabel.value : "Local";
});

const browseRootName = computed(() => {
  const cid = String(browseRootCid.value || "").trim();
  if (!cid) return "";
  const name = getSavedName(cid);
  return name && name !== "Unknown" ? name : "";
});

const browseHostingLabel = computed(() => {
  return hosting.value.kind === "gateway" ? hostingLabel.value : "Local drive";
});

const browseRootLabel = computed(() => {
  const name = String(browseRootName.value || "").trim();
  if (name) return name;
  const cid = String(browseRootCid.value || "").trim();
  if (!cid) return "Folder";
  return cid.length > 10 ? `${cid.slice(0, 10)}…` : cid;
});

const browseCrumbs = computed(() => {
  const p = String(browseRelPath.value || "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  if (!p) return [] as { label: string; path: string }[];
  const parts = p.split("/").filter(Boolean);
  return parts.map((label, idx) => ({
    label,
    path: parts.slice(0, idx + 1).join("/"),
  }));
});

const headerSubtitle = computed(() => {
  if (isBrowsing.value) {
    const suffix = browseRelPath.value ? `/${browseRelPath.value}` : "/";
    return `Browsing: ${browseRootName.value}${suffix}`;
  }
  return hosting.value.kind === "gateway"
    ? "Saved files on your cloud plan"
    : "Saved files on your local drive";
});

function deriveGatewayStatus(
  subs: SubscriptionView[],
): "active" | "pending" | "off" {
  const normalized = subs.map((s) => String(s.status || "").toLowerCase());
  if (normalized.some((s) => s.includes("active"))) return "active";
  if (normalized.some((s) => s.includes("pending"))) return "pending";
  return "off";
}

function normalizeRegions(input: string[] | null | undefined): string[] {
  const list = Array.isArray(input) ? input : [];
  return list
    .map((r) => String(r || "").trim())
    .filter((r) => r);
}

function formatRegionsTitle(input: string[] | null | undefined): string {
  return normalizeRegions(input).join(", ");
}

function formatRegionsLabel(
  input: string[] | null | undefined,
  max = 2,
): string {
  const regions = normalizeRegions(input);
  if (!regions.length) return "";
  const cap =
    typeof max === "number" && Number.isFinite(max) && max > 0 ? Math.floor(max) : 2;
  if (regions.length <= cap) return regions.join(" · ");
  return `${regions.slice(0, cap).join(" · ")} +${regions.length - cap}`;
}

const subscribedGatewayIds = computed(() => {
  const set = new Set<string>();
  for (const sub of planSubscriptionsRaw.value) {
    const gid = String(sub.gatewayId || "").trim();
    if (gid) set.add(gid);
  }
  return Array.from(set);
});

const subscribedGatewayEndpointsKey = computed(() => {
  const ids = subscribedGatewayIds.value;
  if (!ids.length) return "";

  const byId = new Map<string, string>();
  for (const g of gateways.value) {
    const id = String(g?.id ?? "").trim();
    if (!id) continue;
    const endpoint = String(g?.endpoint ?? "").trim();
    if (!endpoint) continue;
    byId.set(id, endpoint);
  }

  return ids
    .map((id) => `${id}:${String(byId.get(id) || "").toLowerCase()}`)
    .sort()
    .join("|");
});

function isSubscribedGatewayOnlineCached(gatewayId: string): boolean | null {
  const gid = String(gatewayId || "").trim();
  if (!gid) return null;
  const cached = subscribedGatewayHealthById.value[gid];
  if (!cached) return null;
  return !!cached.ok;
}

async function refreshSubscribedGatewayHealth(): Promise<void> {
  const api: any = (window as any).lumen;
  const gwApi = api?.gateway;
  if (!gwApi || typeof gwApi.checkAlive !== "function") return;

  const seq = ++subscribedGatewayHealthSeq;
  const now = Date.now();

  const byId = new Map<string, GatewayView>();
  for (const g of gateways.value) byId.set(String(g.id), g);

  const targets: Array<{ id: string; endpoint: string }> = [];
  for (const gidRaw of subscribedGatewayIds.value) {
    const gid = String(gidRaw || "").trim();
    if (!gid) continue;
    const gw = byId.get(gid);
    const endpoint = gw?.endpoint ? String(gw.endpoint).trim() : "";
    if (!endpoint) continue;

    const cached = subscribedGatewayHealthById.value[gid];
    if (cached && now - cached.at < SUBSCRIBED_GATEWAY_HEALTH_TTL_MS) continue;
    targets.push({ id: gid, endpoint });
  }

  if (!targets.length) return;

  const results = await Promise.all(
    targets.map(async (t) => {
      const res = await gwApi
        .checkAlive({ endpoint: t.endpoint, timeoutMs: 2500 })
        .catch(() => null);
      return { id: t.id, ok: !!res?.ok };
    }),
  ).catch(() => [] as Array<{ id: string; ok: boolean }>);

  if (seq !== subscribedGatewayHealthSeq) return;
  if (!results.length) return;

  const next = { ...subscribedGatewayHealthById.value };
  for (const r of results) {
    const id = String(r?.id || "").trim();
    if (!id) continue;
    next[id] = { at: now, ok: !!r.ok };
  }
  subscribedGatewayHealthById.value = next;
}

let subscribedGatewayHealthPollTimer: number | null = null;
function startSubscribedGatewayHealthPolling(): void {
  if (subscribedGatewayHealthPollTimer != null) return;
  subscribedGatewayHealthPollTimer = window.setInterval(() => {
    void refreshSubscribedGatewayHealth();
  }, 60_000);
}

function stopSubscribedGatewayHealthPolling(): void {
  if (subscribedGatewayHealthPollTimer == null) return;
  window.clearInterval(subscribedGatewayHealthPollTimer);
  subscribedGatewayHealthPollTimer = null;
}

const subscriptionRows = computed(() => {
  const byGateway = new Map<string, SubscriptionView[]>();
  for (const sub of planSubscriptionsRaw.value) {
    const gid = String(sub.gatewayId || "").trim();
    if (!gid) continue;
    if (!byGateway.has(gid)) byGateway.set(gid, []);
    byGateway.get(gid)!.push(sub);
  }

  const rows = Array.from(byGateway.entries()).map(([gatewayId, subs]) => {
    const gw = gateways.value.find((g) => String(g.id) === gatewayId) || null;
    const status = deriveGatewayStatus(subs);
    const onlineCached = isSubscribedGatewayOnlineCached(gatewayId);
    const isOffline = onlineCached === false;
    const statusDot = isOffline
      ? "off"
      : status === "active"
        ? "ok"
        : status === "pending"
          ? "pending"
          : "off";
    const endpoint = gw?.endpoint ? String(gw.endpoint).trim() : "";
    const labelBase =
      endpoint ||
      (gw?.operator ? `Gateway ${gw.operator}` : `Gateway ${gatewayId}`);
    const label = labelBase.replace(/^gtw\./i, "");
    const hoverTitle = endpoint || labelBase;
    const regions = normalizeRegions(gw?.regions);
    const regionLabel = formatRegionsLabel(regions, 1);
    const regionTitle = formatRegionsTitle(regions);
    const planTags = Array.from(
      new Set(
        subs
          .map((s) =>
            String(s?.metadata?.planId ?? s?.metadata?.plan_id ?? "").trim(),
          )
          .filter(Boolean)
          .map((planId) => {
            const plan =
              plans.value.find(
                (p) => p.gatewayId === gatewayId && p.planId === planId,
              ) ||
              plans.value.find(
                (p) => p.gatewayId === gatewayId && p.id === planId,
              ) ||
              null;
            return plan ? planDisplayName(plan) : planId;
          })
      )
    ).slice(0, 4);
    return {
      gatewayId,
      label,
      hoverTitle,
      regionLabel,
      regionTitle,
      status,
      statusDot,
      planTags,
    };
  });

  rows.sort((a, b) => a.label.localeCompare(b.label));
  return rows;
});

watch(
  () => subscribedGatewayEndpointsKey.value,
  () => {
    void refreshSubscribedGatewayHealth();
  },
  { immediate: true },
);

const activeSubscriptionRow = computed(() => {
  if (hosting.value.kind !== "gateway") return null;
  return (
    subscriptionRows.value.find(
      (r) => r.gatewayId === hosting.value.gatewayId,
    ) || null
  );
});

const activeSubscriptionStatusLabel = computed(() => {
  const row = activeSubscriptionRow.value;
  if (!row) return "—";
  if (row.status === "active") return "Active";
  if (row.status === "pending") return "Pending";
  return "Off";
});

const activeSubscriptionStatusClass = computed(() => {
  const row = activeSubscriptionRow.value;
  if (!row) return "off";
  return row.status === "active"
    ? "ok"
    : row.status === "pending"
      ? "pending"
      : "off";
});

const gatewayDetailsSubscriptionRow = computed(() => {
  const gid = String(gatewayDetailsGatewayId.value || "").trim();
  if (!gid) return null;
  return subscriptionRows.value.find((r) => r.gatewayId === gid) || null;
});

const gatewayDetailsStatusLabel = computed(() => {
  const row = gatewayDetailsSubscriptionRow.value;
  if (!row) return "-";
  if (row.status === "active") return "Active";
  if (row.status === "pending") return "Pending";
  return "Off";
});

const gatewayDetailsStatusClass = computed(() => {
  const row = gatewayDetailsSubscriptionRow.value;
  if (!row) return "off";
  return row.status === "active"
    ? "ok"
    : row.status === "pending"
      ? "pending"
      : "off";
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
  return Number.isFinite(n) && n >= 0 ? formatSize(n) : "-";
});

const gatewayDetailsBandwidthUsed = computed(() => {
  const u = gatewayDetailsUsage.value?.usage || {};
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
  return Number.isFinite(n) && n >= 0 ? formatSize(n) : "-";
});

const toastIcon = computed(() =>
  toastType.value === "success" ? CheckCircle : AlertCircle,
);

function readInjectedTabUrl(): string {
  const v: any = currentTabUrl;
  try {
    if (!v) return "";
    if (typeof v === "string") return v;
    if (typeof v === "function") return String(v() || "");
    if (typeof v === "object" && "value" in v) return String(v.value || "");
  } catch {
    // ignore
  }
  return "";
}

let browseUrlSyncSeq = 0;
let browseUrlSyncInFlight = "";
async function syncBrowseFromUrl(rawUrl: string) {
  const parsed = parseDriveBrowseFromUrl(rawUrl);
  if (!parsed) return;

  const canonical = driveUrlForBrowse(parsed.root, parsed.path);
  const currentCanonical = driveUrlForBrowse(
    String(browseRootCid.value || ""),
    String(browseRelPath.value || ""),
  );
  if (canonical === currentCanonical) return;
  if (canonical === browseUrlSyncInFlight) return;

  browseUrlSyncInFlight = canonical;
  const seq = ++browseUrlSyncSeq;
  try {
    await applyBrowseLocation(parsed.root, parsed.path);
  } finally {
    if (browseUrlSyncInFlight === canonical) browseUrlSyncInFlight = "";
  }
  if (seq !== browseUrlSyncSeq) return;
}

watch(
  () => String(readInjectedTabUrl() || ""),
  (url) => {
    void syncBrowseFromUrl(url);
  },
  { immediate: true },
);

let urlBarPollTimer: number | null = null;
let urlBarLastValue = "";
let urlBarLastUserInputAt = 0;
let tabUrlChangedHandler: ((ev: any) => void) | null = null;
let tabHistoryStepHandler: ((ev: any) => void) | null = null;
let hlsProgressUnsub: (() => void) | null = null;
let ipfsAddProgressUnsub: (() => void) | null = null;
let gatewayIngestProgressUnsub: (() => void) | null = null;

function readUrlBarUrl(): string {
  try {
    const el = document.querySelector<HTMLInputElement>(".url-bar-input");
    return String(el?.value || "");
  } catch {
    return "";
  }
}

function isUrlBarUserEditing(): boolean {
  return Date.now() - urlBarLastUserInputAt < 600;
}

function ensureUrlBarUserInputTracking() {
  const el = document.querySelector<HTMLInputElement>(".url-bar-input");
  if (!el) return;
  const anyEl: any = el;
  if (anyEl.__driveUrlBarTrackingAttached) return;
  anyEl.__driveUrlBarTrackingAttached = true;
  el.addEventListener(
    "input",
    () => {
      urlBarLastUserInputAt = Date.now();
    },
    { passive: true },
  );
}

function startUrlBarSync() {
  if (urlBarPollTimer != null) return;
  urlBarPollTimer = window.setInterval(() => {
    ensureUrlBarUserInputTracking();
    const val = readUrlBarUrl();
    if (!val || val === urlBarLastValue) return;
    urlBarLastValue = val;
    if (isUrlBarUserEditing()) return;
    void syncBrowseFromUrl(val);
  }, 150);
}

function stopUrlBarSync() {
  if (urlBarPollTimer == null) return;
  window.clearInterval(urlBarPollTimer);
  urlBarPollTimer = null;
}

// Watch for refresh signal from navbar
watch(
  () => currentTabRefresh?.value,
  () => {
    if (hosting.value.kind === "local") {
      void loadStats();
      void loadPinnedFiles();
      loadFiles();
    } else if (hosting.value.kind === "gateway") {
      void refreshActiveGatewayData();
    }
  }
);

onMounted(async () => {
  await checkIpfsStatus();
  loadFiles();
  loadLocalNames();
  loadDriveBackupMeta();
  loadStats();
  void loadPinnedFiles();

  void refreshGatewayOverview();
  startSubscribedGatewayHealthPolling();

  try {
    const api: any = (window as any).lumen;
    if (typeof api?.driveOnHlsProgress === "function") {
      hlsProgressUnsub = api.driveOnHlsProgress((payload: any) => {
        const stage = String(payload?.stage || "");
        if (stage === "downloading") convertingStage.value = "downloading";
        else if (stage === "transcoding") convertingStage.value = "transcoding";
        else if (stage === "adding") convertingStage.value = "adding";
        else if (stage === "done") convertingStage.value = "done";

        if (stage === "transcoding" || stage === "done") {
          const pct = payload?.percent;
          if (typeof pct === "number" && Number.isFinite(pct)) {
            convertingPercent.value = Math.max(
              0,
              Math.min(100, Math.round(pct)),
            );
          }
        }
      });
    }
  } catch {}

  try {
    const api: any = (window as any).lumen;
    if (typeof api?.ipfsOnAddProgress === "function") {
      ipfsAddProgressUnsub = api.ipfsOnAddProgress((payload: any) => {
        if (!uploading.value) return;
        if (String(uploadingStage.value).startsWith("gateway-")) return;
        if (!uploadingCanceling.value) uploadingStage.value = "adding";
        const pct = payload?.percent;
        if (typeof pct === "number" && Number.isFinite(pct)) {
          uploadingPercent.value = Math.max(0, Math.min(100, Math.round(pct)));
        } else {
          uploadingPercent.value = null;
        }
      });
    }
  } catch {}

  try {
    const api: any = (window as any).lumen;
    if (typeof api?.gateway?.onIngestProgress === "function") {
      gatewayIngestProgressUnsub = api.gateway.onIngestProgress((payload: any) => {
        if (!uploading.value) return;
        const stage = String(payload?.stage || "");
        if (!uploadingCanceling.value) {
          if (stage === "preflight") uploadingStage.value = "gateway-preflight";
          else if (stage === "exporting") uploadingStage.value = "gateway-export";
          else if (stage === "uploading") uploadingStage.value = "gateway-upload";
          else if (stage === "done") uploadingStage.value = "done";
        }

        const pct = payload?.percent;
        if (typeof pct === "number" && Number.isFinite(pct)) {
          uploadingPercent.value = Math.max(0, Math.min(100, Math.round(pct)));
        } else {
          uploadingPercent.value = null;
        }
      });
    }
  } catch {}

  try {
    tabUrlChangedHandler = (ev: any) => {
      const detail = ev?.detail || {};
      const url = String(detail?.url || "");
      const tabId = String(detail?.tabId || "");
      const mine =
        typeof currentTabId === "object" &&
        currentTabId &&
        "value" in currentTabId
          ? String((currentTabId as any).value || "")
          : String(currentTabId || "");
      if (mine && tabId && mine !== tabId) return;
      void syncBrowseFromUrl(url);
    };
    window.addEventListener(
      "lumen:tab-url-changed",
      tabUrlChangedHandler as any,
    );
  } catch {}

  try {
    tabHistoryStepHandler = (ev: any) => {
      const detail = ev?.detail || {};
      const tabId = String(detail?.tabId || "");
      const mine =
        typeof currentTabId === "object" &&
        currentTabId &&
        "value" in currentTabId
          ? String((currentTabId as any).value || "")
          : String(currentTabId || "");
      if (mine && tabId && mine !== tabId) return;
      // History step changes URL without necessarily triggering reactive injection in this component.
      // Wait a tick, then read from the navbar field (which visibly updates) and sync.
      window.setTimeout(() => {
        void syncBrowseFromUrl(readUrlBarUrl() || readInjectedTabUrl());
      }, 0);
    };
    window.addEventListener(
      "lumen:tab-history-step",
      tabHistoryStepHandler as any,
    );
  } catch {}

  startUrlBarSync();
  document.addEventListener("dragover", handleDragOver);
  document.addEventListener("dragleave", handleDragLeave);
  document.addEventListener("drop", handleDrop);
  document.addEventListener("click", handleDocumentClick);
});

onActivated(() => {
  startUrlBarSync();
  startSubscribedGatewayHealthPolling();
  void syncBrowseFromUrl(readInjectedTabUrl() || readUrlBarUrl());
});

onDeactivated(() => {
  stopUrlBarSync();
  stopSubscribedGatewayHealthPolling();
});

onUnmounted(() => {
  stopUrlBarSync();
  stopSubscribedGatewayHealthPolling();
  try {
    hlsProgressUnsub?.();
  } catch {
    // ignore
  }
  hlsProgressUnsub = null;
  try {
    ipfsAddProgressUnsub?.();
  } catch {
    // ignore
  }
  ipfsAddProgressUnsub = null;
  try {
    gatewayIngestProgressUnsub?.();
  } catch {
    // ignore
  }
  gatewayIngestProgressUnsub = null;
  try {
    if (tabUrlChangedHandler)
      window.removeEventListener(
        "lumen:tab-url-changed",
        tabUrlChangedHandler as any,
      );
  } catch {}
  tabUrlChangedHandler = null;
  try {
    if (tabHistoryStepHandler)
      window.removeEventListener(
        "lumen:tab-history-step",
        tabHistoryStepHandler as any,
      );
  } catch {}
  tabHistoryStepHandler = null;
  document.removeEventListener("dragover", handleDragOver);
  document.removeEventListener("dragleave", handleDragLeave);
  document.removeEventListener("drop", handleDrop);
  document.removeEventListener("click", handleDocumentClick);

  for (const url of Object.values(imagePreviewUrls.value)) {
    if (typeof url === "string" && url.startsWith("blob:")) {
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

async function openFilePicker() {
  showUploadMenu.value = false;

  if (shouldUsePathPicker()) {
    openUploadPathModal("files");
    return;
  }

  const api: any = (window as any).lumen;
  if (typeof api?.dialogOpenFiles === "function") {
    const res = await api
      .dialogOpenFiles({ title: "Select files to upload", multi: true })
      .catch((e: any) => ({ ok: false, error: String(e?.message || e) }));
    if (!res?.ok) {
      const err = String(res?.error || "");
      if (err === "unsupported_environment") {
        openUploadPathModal("files");
        return;
      }
      if (err && err !== "canceled") {
        showToast(`File picker error (${compactError(err)})`, "error");
      }
      return;
    }
    const paths = Array.isArray(res.paths) ? res.paths : [];
    const selected = paths.map((p: any) => String(p || "").trim()).filter(Boolean);
    if (!selected.length) return;

    const ok = await ensureIpfsConnected();
    if (!ok) return;

    for (const filePath of selected) {
      const name = basenameFromPath(filePath) || "file";
      const pseudo: any = { name, path: filePath };
      const out = await uploadFile(pseudo as File);
      if ((out as any)?.cancelled) break;
    }
    return;
  }

  const input = fileUploadInput.value;
  if (!input) return;
  try {
    input.value = "";
  } catch {}
  input.click();
}

async function openFolderPicker() {
  showUploadMenu.value = false;

  if (shouldUsePathPicker()) {
    openUploadPathModal("folder");
    return;
  }

  const api: any = (window as any).lumen;
  if (typeof api?.dialogOpenFolder === "function") {
    const res = await api
      .dialogOpenFolder({ title: "Select folder to upload", multi: true })
      .catch((e: any) => ({ ok: false, error: String(e?.message || e) }));
    if (!res?.ok) {
      const err = String(res?.error || "");
      if (err === "unsupported_environment") {
        openUploadPathModal("folder");
        return;
      }
      if (err && err !== "canceled") {
        showToast(`Folder picker error (${compactError(err)})`, "error");
      }
      return;
    }
    const paths = Array.isArray(res.paths) ? res.paths : [];
    const selected = paths.map((p: any) => String(p || "").trim()).filter(Boolean);
    if (!selected.length) return;

    const ok = await ensureIpfsConnected();
    if (!ok) return;

    for (const dirPath of selected) {
      const out = await uploadDirectoryFromPath(dirPath);
      if ((out as any)?.cancelled) break;
    }
    return;
  }

  const input = folderUploadInput.value;
  if (!input) return;
  try {
    input.value = "";
  } catch {}
  input.click();
}

function shouldUsePathPicker() {
  try {
    const api: any = (window as any).lumen;
    const platform = String(api?.appPlatform || "").toLowerCase();
    if (platform !== "linux") return false;
    if (api?.appDialogLikelyBroken === true) return true;
    const isRoot = typeof api?.appIsRoot === "function" ? api.appIsRoot() : false;
    return isRoot === true;
  } catch {
    return false;
  }
}

function openUploadPathModal(mode: "files" | "folder") {
  if (uploadPathBusy.value) return;
  if (uploading.value || converting.value) {
    showToast("Another task is already running. Please wait…", "error");
    return;
  }
  uploadPathMode.value = mode;
  uploadPathText.value = "";
  showUploadPathModal.value = true;
}

function closeUploadPathModal() {
  if (uploadPathBusy.value) return;
  showUploadPathModal.value = false;
  uploadPathText.value = "";
}

function parseUploadPaths(raw: string) {
  const lines = String(raw || "")
    .split(/\r?\n/)
    .map((l) => String(l || "").trim())
    .filter(Boolean);
  const cleaned = lines
    .map((s) => s.replace(/^['"](.+)['"]$/, "$1").trim())
    .filter(Boolean);
  return Array.from(new Set(cleaned));
}

async function submitUploadPathModal() {
  if (uploadPathBusy.value) return;
  if (uploading.value || converting.value) {
    showToast("Another task is already running. Please wait…", "error");
    return;
  }
  const paths = parseUploadPaths(uploadPathText.value);
  if (!paths.length) {
    showToast("Please paste at least one path.", "error");
    return;
  }

  const ok = await ensureIpfsConnected();
  if (!ok) return;

  uploadPathBusy.value = true;
  showUploadPathModal.value = false;

  try {
    if (uploadPathMode.value === "folder") {
      for (const dirPath of paths) {
        const res = await uploadDirectoryFromPath(dirPath);
        if ((res as any)?.cancelled) break;
      }
      return;
    }

    for (const filePath of paths) {
      const name = basenameFromPath(filePath) || "file";
      const pseudo: any = { name, path: filePath };
      const res = await uploadFile(pseudo as File);
      if ((res as any)?.cancelled) break;
    }
  } finally {
    uploadPathBusy.value = false;
  }
}

async function handleDrop(e: DragEvent) {
  e.preventDefault();
  isDragging.value = false;

  if (!ipfsConnected.value) {
    showToast("IPFS not connected", "error");
    return;
  }

  const dt = e.dataTransfer;
  if (!dt) return;

  const items = Array.from(dt.items || []);
  const supportsEntries = items.some(
    (it: any) => typeof it?.webkitGetAsEntry === "function",
  );

  if (supportsEntries) {
    const rootFiles: File[] = [];
    const folderGroups = new Map<string, { path: string; file: File }[]>();

    async function readAllDirEntries(dirEntry: any): Promise<any[]> {
      const reader = dirEntry.createReader();
      const out: any[] = [];
      while (true) {
        const batch: any[] = await new Promise((resolve) =>
          reader.readEntries(resolve),
        );
        if (!batch || batch.length === 0) break;
        out.push(...batch);
      }
      return out;
    }

    async function collectEntryFiles(
      entry: any,
      basePath: string,
    ): Promise<{ path: string; file: File }[]> {
      if (!entry) return [];
      if (entry.isFile) {
        const f: File = await new Promise((resolve, reject) =>
          entry.file(resolve, reject),
        );
        const name = String(f?.name || entry.name || "file");
        const path = basePath ? `${basePath}/${name}` : name;
        return [{ path, file: f }];
      }
      if (entry.isDirectory) {
        const dirName = String(entry.name || "").trim();
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
        const rootName = String(entry.name || "folder");
        const all = await collectEntryFiles(entry, "");
        const normalized = all
          .map(({ path, file }) => ({
            path: String(path).replace(/\\/g, "/").replace(/^\/+/, ""),
            file,
          }))
          .filter((x) => x.path && x.file);
        folderGroups.set(rootName, normalized);
      }
    }

    for (const f of rootFiles) {
      const res = await uploadFile(f);
      if ((res as any)?.cancelled) return;
    }
    for (const [rootName, files] of folderGroups.entries()) {
      const res = await uploadDirectory(rootName, files);
      if ((res as any)?.cancelled) return;
    }
    return;
  }

  const droppedFiles = dt.files;
  if (droppedFiles?.length) {
    for (const file of Array.from(droppedFiles)) {
      const res = await uploadFile(file);
      if ((res as any)?.cancelled) break;
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

async function ensureIpfsConnected() {
  if (ipfsConnected.value) return true;
  await checkIpfsStatus();
  if (ipfsConnected.value) return true;
  showToast("IPFS not connected", "error");
  return false;
}

function selectHosting(kind: HostingKind) {
  if (kind === hosting.value.kind) return;
  if (kind === "gateway") return;
  exitBrowseSilent();
  currentPage.value = 1;
  hosting.value = { kind, gatewayId: "" };
  gatewayBase.value = null;
  void checkIpfsStatus();
  void loadStats();
  void loadPinnedFiles();
}

function selectGateway(gatewayId: string) {
  const gid = String(gatewayId || "").trim();
  if (!gid) return;
  exitBrowseSilent();
  currentPage.value = 1;
  hosting.value = { kind: "gateway", gatewayId: gid };
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
  const gid = String(gatewayId || "").trim();
  if (!gid) return;
  gatewayDetailsGatewayId.value = gid;
  showGatewayDetails.value = true;
  void refreshGatewayDetailsData(gid);
}

function closeGatewayDetails() {
  showGatewayDetails.value = false;
  gatewayDetailsGatewayId.value = "";
  gatewayDetailsUsage.value = null;
  gatewayDetailsUsageError.value = "";
  gatewayDetailsPinned.value = [];
  gatewayDetailsPinnedError.value = "";
  gatewayDetailsLoading.value = false;
}

async function refreshGatewayDetailsData(gatewayId: string) {
  const gid = String(gatewayId || "").trim();
  if (!gid) return;

  const seq = ++gatewayDetailsLoadSeq;
  gatewayDetailsLoading.value = true;
  gatewayDetailsUsage.value = null;
  gatewayDetailsUsageError.value = "";
  gatewayDetailsPinned.value = [];
  gatewayDetailsPinnedError.value = "";

  try {
    const api: any = (window as any).lumen;
    const profilesApi = api?.profiles;
    const gwApi = api?.gateway;
    if (!profilesApi || !gwApi) {
      gatewayDetailsUsageError.value = "Gateway API unavailable";
      return;
    }

    const active = await profilesApi.getActive?.().catch(() => null);
    const profileId = active?.id;
    if (!profileId) {
      gatewayDetailsUsageError.value = "No active profile";
      return;
    }

    const hint = gatewayHintForId(gid);
    const [usageRes, pinnedRes] = await Promise.all([
      gwApi.getWalletUsage(profileId, hint).catch((e: any) => ({
        ok: false,
        error: String(e?.message || e),
      })),
      gwApi.getWalletPinnedCids(profileId, hint, 1).catch((e: any) => ({
        ok: false,
        error: String(e?.message || e),
      })),
    ]);
    if (
      seq !== gatewayDetailsLoadSeq ||
      !showGatewayDetails.value ||
      String(gatewayDetailsGatewayId.value || "").trim() !== gid
    ) {
      return;
    }

    if (!usageRes || usageRes.ok === false) {
      const code = String(usageRes?.error || "").trim();
      if (code === "password_required" || code === "invalid_password") {
        try {
          await api?.security?.lockSession?.();
        } catch {}
      }
      if (code !== "kyber_pubkey_http_unavailable") {
        gatewayDetailsUsageError.value = code || "Usage fetch failed";
      }
    } else {
      gatewayDetailsUsage.value = usageRes.data ?? null;
    }

    if (!pinnedRes || pinnedRes.ok === false) {
      const code = String(pinnedRes?.error || "").trim();
      if (code === "password_required" || code === "invalid_password") {
        try {
          await api?.security?.lockSession?.();
        } catch {}
      }
      if (code !== "kyber_pubkey_http_unavailable") {
        gatewayDetailsPinnedError.value = code || "Pinned CIDs fetch failed";
      }
    } else {
      const data = pinnedRes.data ?? null;
      const cids = Array.isArray(data?.cids)
        ? data.cids
            .map((x: any) => String(x || "").trim())
            .filter((x: string) => x && !isIgnoredCid(x))
        : [];
      gatewayDetailsPinned.value = Array.from(new Set(cids));
    }
  } catch (e: any) {
    if (seq !== gatewayDetailsLoadSeq) return;
    gatewayDetailsUsageError.value = String(e?.message || "Usage fetch failed");
  } finally {
    if (seq === gatewayDetailsLoadSeq) gatewayDetailsLoading.value = false;
  }
}

async function refreshActiveGatewayData() {
  if (hosting.value.kind !== "gateway") return;
  const hint = activeGatewayHint.value;
  await refreshGatewayPinned(hint);
}

async function refreshActiveGatewayPinned() {
  if (hosting.value.kind !== "gateway") return;
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

    const res = await gwApi
      .getPlansOverview(profileId, { includePricing: false, timeoutMs: 2500 })
      .catch(() => null);
    if (!res || res.ok === false) return;

    const list = Array.isArray(res.plans) ? res.plans : [];
    plans.value = list
      .map((p: any) => ({
        id: String(p?.id ?? ""),
        planId: String(p?.planId ?? p?.id ?? ""),
        gatewayId: String(p?.gatewayId ?? ""),
        gatewayName: String(
          p?.gatewayName ?? p?.gateway ?? `Gateway ${p?.gatewayId ?? ""}`,
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
        description: p?.description ?? "",
      }))
      .filter((p: PlanView) => p.planId && p.gatewayId);

    const gwRaw = Array.isArray(res.gateways) ? res.gateways : [];
    const gwMap = new Map<string, GatewayView>();
    for (const g of gwRaw) {
      const id = String(g?.id ?? g?.gatewayId ?? "").trim();
      if (!id) continue;
      if (gwMap.has(id)) continue;
      const endpoint = String(g?.endpoint ?? g?.baseUrl ?? g?.url ?? "").trim();
      const regions = Array.isArray(g?.regions)
        ? g.regions.map((r: any) => String(r || "")).filter(Boolean)
        : [];
      const active =
        typeof g?.active === "boolean"
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
        operator: String(g?.operator ?? ""),
        regions,
        active,
        score,
      });
    }
    gateways.value = Array.from(gwMap.values());

    const subsRaw = Array.isArray(res.subscriptions) ? res.subscriptions : [];
    planSubscriptionsRaw.value = subsRaw.map((s: any) => ({
      id: String(s?.id ?? ""),
      gatewayId: String(s?.gatewayId ?? s?.gateway_id ?? ""),
      status: String(s?.status ?? "").toLowerCase(),
      metadata: typeof s?.metadata === "object" ? s.metadata : undefined,
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

    const res = await gwApi
      .getBaseUrl(profileId, baseUrlHint)
      .catch(() => null);
    if (!res || res.ok === false) {
      const code = String(res?.error || "").trim();
      if (code === "password_required" || code === "invalid_password") {
        try {
          await api?.security?.lockSession?.();
        } catch {}
      }
      gatewayBase.value = null;
      return;
    }
    gatewayBase.value =
      typeof res.baseUrl === "string" ? String(res.baseUrl) : null;
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
    planPage.value = 1;
    expandedGatewayIds.value = new Set();
    plansLoading.value = true;
    plansError.value = "";

    const active = await profilesApi.getActive?.().catch(() => null);
    const profileId = active?.id;
    if (!profileId) {
      plansError.value = "No active profile";
      plansLoading.value = false;
      return;
    }

    const res = await gwApi
      .getPlansOverview(profileId, { includePricing: true, timeoutMs: 2500 })
      .catch(() => null);
    if (!res || res.ok === false) {
      plansError.value = String(res?.error || "Unable to load plans.");
      plansLoading.value = false;
      return;
    }

    const list = Array.isArray(res.plans) ? res.plans : [];
    plans.value = list
      .map((p: any) => ({
        id: String(p?.id ?? ""),
        planId: String(p?.planId ?? p?.id ?? ""),
        gatewayId: String(p?.gatewayId ?? ""),
        gatewayName: String(
          p?.gatewayName ?? p?.gateway ?? `Gateway ${p?.gatewayId ?? ""}`,
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
        description: p?.description ?? "",
      }))
      .filter((p: PlanView) => p.planId && p.gatewayId);

    const gwRaw = Array.isArray(res.gateways) ? res.gateways : [];
    const gwMap = new Map<string, GatewayView>();
    for (const g of gwRaw) {
      const id = String(g?.id ?? g?.gatewayId ?? "").trim();
      if (!id) continue;
      const existing = gwMap.get(id);
      if (existing) continue;
      const endpoint = String(g?.endpoint ?? g?.baseUrl ?? g?.url ?? "").trim();
      const regions = Array.isArray(g?.regions)
        ? g.regions.map((r: any) => String(r || "")).filter(Boolean)
        : [];
      const active =
        typeof g?.active === "boolean"
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
        operator: String(g?.operator ?? ""),
        regions,
        active,
        score,
      });
    }
    gateways.value = Array.from(gwMap.values());

    const subsRaw = Array.isArray(res.subscriptions) ? res.subscriptions : [];
    planSubscriptionsRaw.value = subsRaw.map((s: any) => ({
      id: String(s?.id ?? ""),
      gatewayId: String(s?.gatewayId ?? s?.gateway_id ?? ""),
      status: String(s?.status ?? "").toLowerCase(),
      metadata: typeof s?.metadata === "object" ? s.metadata : undefined,
    }));
  } catch (e: any) {
    plansError.value = String(e?.message || "Unable to load plans.");
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
    const metaPlanId = String(sub.metadata?.planId ?? "").toLowerCase();
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
    const active = candidates.find((s) => s.status === "active");
    if (active) return "active";
    const pending = candidates.find((s) => s.status === "pending");
    if (pending) return "pending";
    return candidates[0].status || "unknown";
  }
  const fallback = planSubscriptions.value.get(plan.gatewayId.toLowerCase());
  if (fallback && fallback.length) return fallback[0].status || "unknown";
  return "none";
}

function planStatusLabel(plan: PlanView): string {
  const status = planStatus(plan);
  switch (status) {
    case "active":
      return "Subscribed";
    case "pending":
      return "Pending";
    case "cancelled":
    case "canceled":
      return "Cancelled";
    case "completed":
      return "Completed";
    default:
      return "Subscribe";
  }
}

function planDisplayName(plan: PlanView): string {
  return plan.planId?.split(":").pop() || "Plan";
}

function formatPlanPrice(ulmn: number): string {
  const lmn = ulmn / 1_000_000;
  if (!ulmn) return "Free";
  return `${lmn.toFixed(lmn >= 10 ? 0 : 2)} LMN / mo`;
}

function formatPlanPriceShort(ulmn: number): string {
  const lmn = ulmn / 1_000_000;
  if (!ulmn) return "Free";
  return lmn >= 10 ? `${lmn.toFixed(0)} LMN` : `${lmn.toFixed(2)} LMN`;
}

const showSubscribeModal = ref(false);
const subscribePlan = ref<PlanView | null>(null);
const subscribeMonths = ref(1);
const subscribeBusy = ref(false);
const subscribeError = ref("");
const subscribeBalance = ref<number | null>(null);
const subscribeBalanceLoading = ref(false);

let profileReloadSeq = 0;

function normalizeSubscribeError(raw: string): string {
  const msg = String(raw || "").trim();
  if (!msg) return "Subscription failed";
  if (/insufficient funds/i.test(msg) || /spendable balance/i.test(msg)) {
    return "Insufficient funds.";
  }
  return msg;
}

function openSubscribeModal(plan: PlanView) {
  subscribePlan.value = plan;
  subscribeMonths.value = Math.max(1, plan.monthsTotal || 1);
  subscribeError.value = "";
  showSubscribeModal.value = true;
  void loadSubscribeBalance();
}

function closeSubscribeModal() {
  if (subscribeBusy.value) return;
  showSubscribeModal.value = false;
  subscribePlan.value = null;
  subscribeError.value = "";
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
      typeof amount === "number"
        ? amount / 1_000_000
        : typeof amount === "string"
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
    subscribeError.value = "";

    const api: any = (window as any).lumen;
    const profilesApi = api?.profiles;
    const gwApi = api?.gateway;
    if (!profilesApi || !gwApi || !gwApi.subscribePlan) {
      subscribeError.value = "Subscription API unavailable";
      return;
    }

    const active = await profilesApi.getActive?.().catch(() => null);
    const profileId = active?.id;
    if (!profileId) {
      subscribeError.value = "No active profile";
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
    subscribeError.value = "";
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
  const anyWin: any = window;
  if (hosting.value.kind === "gateway") {
    await refreshGatewayPinned(activeGatewayHint.value);
    return;
  }

  localPinnedLoading.value = true;
  try {
    const result = await anyWin.lumen?.ipfsPinList?.();
    if (result?.ok) {
      const pins = Array.isArray(result.pins) ? result.pins : [];
      pinnedFiles.value = pins
        .map((x: any) => String(x || "").trim())
        .filter((x: string) => x && !isIgnoredCid(x));
    }
  } catch {
    // ignore
  } finally {
    localPinnedLoading.value = false;
  }
}

async function refreshGatewayUsage(baseUrlHint?: string) {
  const gid = String(hosting.value.gatewayId || "").trim();
  if (hosting.value.kind !== "gateway" || !gid) return;
  const seq = ++gatewayUsageSeq;

  gatewayUsageLoading.value = true;
  gatewayUsageError.value = "";
  try {
    const api: any = (window as any).lumen;
    const profilesApi = api?.profiles;
    const gwApi = api?.gateway;
    if (!profilesApi || !gwApi) return;

    const active = await profilesApi.getActive?.().catch(() => null);
    const profileId = active?.id;
    if (!profileId) return;

    const res = await gwApi
      .getWalletUsage(profileId, baseUrlHint)
      .catch(() => null);
    if (
      seq !== gatewayUsageSeq ||
      hosting.value.kind !== "gateway" ||
      String(hosting.value.gatewayId || "").trim() !== gid
    ) {
      return;
    }
    if (!res || res.ok === false) {
      const code = String(res?.error || "").trim();
      if (code === "password_required" || code === "invalid_password") {
        try {
          await api?.security?.lockSession?.();
        } catch {}
      }
      // If the gateway doesn't expose a Kyber pubkey, just treat it as "no plan"
      if (code === "kyber_pubkey_http_unavailable") {
        gatewayUsage.value = null;
        gatewayUsageError.value = "";
        return;
      }
      gatewayUsage.value = null;
      gatewayUsageError.value = code || "Usage fetch failed";
      return;
    }

    gatewayUsage.value = res.data ?? null;
  } catch (e: any) {
    if (seq !== gatewayUsageSeq) return;
    gatewayUsage.value = null;
    const msg = String(e?.message || "Usage fetch failed");
    gatewayUsageError.value =
      msg === "Error: kyber_pubkey_http_unavailable" ? "" : msg;
  } finally {
    if (seq === gatewayUsageSeq) gatewayUsageLoading.value = false;
  }
}

async function refreshGatewayPinned(baseUrlHint?: string) {
  const gid = String(hosting.value.gatewayId || "").trim();
  if (hosting.value.kind !== "gateway" || !gid) return;
  const seq = ++gatewayPinnedSeq;

  gatewayPinnedLoading.value = true;
  gatewayPinnedError.value = "";
  try {
    const api: any = (window as any).lumen;
    const profilesApi = api?.profiles;
    const gwApi = api?.gateway;
    if (!profilesApi || !gwApi) return;

    const active = await profilesApi.getActive?.().catch(() => null);
    const profileId = active?.id;
    if (!profileId) return;

    const res = await gwApi
      .getWalletPinnedCids(profileId, baseUrlHint, 1)
      .catch(() => null);
    if (
      seq !== gatewayPinnedSeq ||
      hosting.value.kind !== "gateway" ||
      String(hosting.value.gatewayId || "").trim() !== gid
    ) {
      return;
    }
    if (!res || res.ok === false) {
      const code = String(res?.error || "").trim();
      if (code === "password_required" || code === "invalid_password") {
        try {
          await api?.security?.lockSession?.();
        } catch {}
      }
      if (code === "kyber_pubkey_http_unavailable") {
        gatewayPinned.value = [];
        gatewayPinnedNames.value = {};
        gatewayPinnedError.value = "";
        return;
      }
      gatewayPinned.value = [];
      gatewayPinnedNames.value = {};
      gatewayPinnedError.value = code || "Pinned CIDs fetch failed";
      return;
    }

    const data = res.data ?? null;
    const cids = Array.isArray(data?.cids)
      ? data.cids.map((x: any) => String(x))
      : [];

    const now = Date.now();
    const server = Array.from(
      new Set(
        cids
          .map((x: any) => String(x || "").trim())
          .filter((x: string) => x && !isIgnoredCid(x)),
      ),
    );
    const serverSet = new Set(server);
    const optimisticMissing: string[] = [];
    const nextOptimistic: Record<string, number> = {};
    const optimisticForGateway = optimisticGatewayPinned.value[gid] || {};
    for (const [cid, ts] of Object.entries(optimisticForGateway)) {
      const key = String(cid || "").trim();
      if (!key) continue;
      if (serverSet.has(key)) continue;
      if (typeof ts !== "number" || !Number.isFinite(ts)) continue;
      if (now - ts > OPTIMISTIC_GATEWAY_PIN_TTL_MS) continue;
      nextOptimistic[key] = ts;
      optimisticMissing.push(key);
    }
    optimisticGatewayPinned.value = {
      ...optimisticGatewayPinned.value,
      [gid]: nextOptimistic,
    };
    gatewayPinned.value = [...optimisticMissing, ...server as string[]];

    const allowSet = new Set(server);
    const nextNames: Record<string, string> = {};

    try {
      const namesRaw = data?.names;
      if (namesRaw && typeof namesRaw === "object" && !Array.isArray(namesRaw)) {
        for (const [cid, nameVal] of Object.entries(namesRaw as Record<string, any>)) {
          const key = String(cid || "").trim();
          if (!key || !allowSet.has(key) || isIgnoredCid(key)) continue;
          const name = typeof nameVal === "string" ? nameVal.trim() : "";
          if (!name || name.toLowerCase() === "unknown") continue;
          nextNames[key] = name;
        }
      }

      const itemsRaw = Array.isArray(data?.items) ? data.items : [];
      for (const row of itemsRaw) {
        const key = String(row?.cid || "").trim();
        if (!key || !allowSet.has(key) || isIgnoredCid(key)) continue;
        const nameRaw = row?.display_name ?? row?.displayName ?? row?.name ?? null;
        const name = typeof nameRaw === "string" ? nameRaw.trim() : "";
        if (!name || name.toLowerCase() === "unknown") continue;
        nextNames[key] = name;
      }
    } catch {
      // ignore name parsing errors
    }

    gatewayPinnedNames.value = nextNames;
  } catch (e: any) {
    if (seq !== gatewayPinnedSeq) return;
    gatewayPinned.value = [];
    gatewayPinnedNames.value = {};
    const msg = String(e?.message || "Pinned CIDs fetch failed");
    gatewayPinnedError.value =
      msg === "Error: kyber_pubkey_http_unavailable" ? "" : msg;
  } finally {
    if (seq === gatewayPinnedSeq) gatewayPinnedLoading.value = false;
  }
}

function addOptimisticGatewayPinnedCid(cid: string) {
  const key = String(cid || "").trim();
  if (!key) return;
  const gid = String(hosting.value.gatewayId || "").trim();
  if (!gid) return;
  const current = optimisticGatewayPinned.value[gid] || {};
  optimisticGatewayPinned.value = {
    ...optimisticGatewayPinned.value,
    [gid]: { ...current, [key]: Date.now() },
  };
  if (hosting.value.kind === "gateway") {
    gatewayPinned.value = [
      key,
      ...gatewayPinned.value.filter((x) => String(x) !== key),
    ];
  }
}

function removeOptimisticGatewayPinnedCid(cid: string) {
  const key = String(cid || "").trim();
  if (!key) return;
  const gid = String(hosting.value.gatewayId || "").trim();
  if (!gid) return;
  const current = optimisticGatewayPinned.value[gid];
  if (!current || !current[key]) return;
  const next = { ...current };
  delete next[key];
  optimisticGatewayPinned.value = { ...optimisticGatewayPinned.value, [gid]: next };
}

function loadFiles() {
  files.value = [];
  const pid = String(activeProfileId.value || "").trim();
  if (!pid) return;
  const key = filesStorageKey(pid);
  try {
    const stored = localStorage.getItem(key);
    const storedParsed = stored ? JSON.parse(stored) : null;
    const storedFiles = Array.isArray(storedParsed) ? (storedParsed as DriveFile[]) : [];

    // One-shot migrate legacy global key to per-profile storage, then delete legacy.
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const legacyParsed = JSON.parse(legacy);
      const legacyFiles = Array.isArray(legacyParsed) ? (legacyParsed as DriveFile[]) : [];
      const byCid = new Map<string, DriveFile>();

      // Prefer the current per-profile entries over legacy for conflicts.
      for (const f of legacyFiles) {
        const cid = String((f as any)?.cid || "").trim();
        if (!cid) continue;
        byCid.set(cid, f);
      }
      for (const f of storedFiles) {
        const cid = String((f as any)?.cid || "").trim();
        if (!cid) continue;
        byCid.set(cid, f);
      }

      files.value = Array.from(byCid.values());
      try {
        localStorage.setItem(key, JSON.stringify(files.value));
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch {}
      return;
    }

    files.value = storedFiles;
  } catch {
    files.value = [];
  }
}

function saveFiles() {
  try {
    const pid = String(activeProfileId.value || "").trim() || "default";
    const key = filesStorageKey(pid);
    localStorage.setItem(key, JSON.stringify(files.value));
    nextDriveBackupSeq(pid);
  } catch {
    // ignore
  }
}

function loadLocalNames() {
  localNames.value = {};
  const pid = String(activeProfileId.value || "").trim();
  if (!pid) return;
  const key = localNamesStorageKey(pid);
  try {
    const stored = localStorage.getItem(key);
    const storedParsed = stored ? JSON.parse(stored) : null;
    const storedNames =
      storedParsed && typeof storedParsed === "object"
        ? (storedParsed as Record<string, string>)
        : {};

    // One-shot migrate legacy global key to per-profile storage, then delete legacy.
    const legacy = localStorage.getItem(LEGACY_LOCAL_NAMES_KEY);
    if (legacy) {
      const legacyParsed = JSON.parse(legacy);
      const legacyNames =
        legacyParsed && typeof legacyParsed === "object"
          ? (legacyParsed as Record<string, string>)
          : {};

      // Prefer the current per-profile names over legacy for conflicts.
      localNames.value = { ...legacyNames, ...storedNames };
        try {
          localStorage.setItem(key, JSON.stringify(localNames.value));
          localStorage.removeItem(LEGACY_LOCAL_NAMES_KEY);
        } catch {}
        return;
    }

    localNames.value = storedNames;
  } catch {
    localNames.value = {};
  }
}

function saveLocalNames() {
  try {
    const pid = String(activeProfileId.value || "").trim() || "default";
    const key = localNamesStorageKey(pid);
    localStorage.setItem(key, JSON.stringify(localNames.value));
    nextDriveBackupSeq(pid);
  } catch {
    // ignore
  }
}

type DriveBackupSnapshotV1 = {
  type: "lumen.driveBackup.snapshot";
  version: 1;
  createdAt: number;
  seq: number;
  walletAddress: string;
  drive: {
    files: DriveFile[];
    localNames: Record<string, string>;
  };
  favourites: string[];
};

const DRIVE_BACKUP_SEQ_KEY_PREFIX = "lumen:driveBackup:seq:v1";
const DRIVE_BACKUP_LAST_EXPORT_AT_KEY_PREFIX = "lumen:driveBackup:lastExportAt:v1";
const DRIVE_BACKUP_LAST_IMPORT_AT_KEY_PREFIX = "lumen:driveBackup:lastImportAt:v1";

function driveBackupSeqKey(profileId: string): string {
  const pid = String(profileId || "").trim() || "default";
  return `${DRIVE_BACKUP_SEQ_KEY_PREFIX}:${pid}`;
}

function driveBackupLastExportAtKey(profileId: string): string {
  const pid = String(profileId || "").trim() || "default";
  return `${DRIVE_BACKUP_LAST_EXPORT_AT_KEY_PREFIX}:${pid}`;
}

function driveBackupLastImportAtKey(profileId: string): string {
  const pid = String(profileId || "").trim() || "default";
  return `${DRIVE_BACKUP_LAST_IMPORT_AT_KEY_PREFIX}:${pid}`;
}

function activeWalletAddress(): string {
  const p = activeProfile.value;
  const addr = p && (p.walletAddress || p.address);
  return String(addr || "").trim();
}

function nextDriveBackupSeq(profileId: string): number {
  const key = driveBackupSeqKey(profileId);
  const current = Number.parseInt(String(localStorage.getItem(key) || "0"), 10);
  const base = Number.isFinite(current) && current >= 0 ? current : 0;
  const next = base + 1;
  try {
    localStorage.setItem(key, String(next));
  } catch {}
  return next;
}

function bumpDriveBackupSeq(profileId: string, nextSeq: number) {
  const key = driveBackupSeqKey(profileId);
  const current = Number.parseInt(String(localStorage.getItem(key) || "0"), 10);
  const base = Number.isFinite(current) && current >= 0 ? current : 0;
  const next = Number.isFinite(nextSeq) && nextSeq > base ? Math.floor(nextSeq) : base;
  try {
    localStorage.setItem(key, String(next));
  } catch {}
}

function getCurrentDriveBackupSeq(profileId: string): number {
  const pid = String(profileId || "").trim() || "default";
  const raw = localStorage.getItem(driveBackupSeqKey(pid));
  const v = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(v) && v > 0 ? v : 0;
}

function loadDriveBackupMeta() {
  const pid = String(activeProfileId.value || "").trim() || "default";
  const exportAtRaw = localStorage.getItem(driveBackupLastExportAtKey(pid));
  const importAtRaw = localStorage.getItem(driveBackupLastImportAtKey(pid));
  const exportAt = exportAtRaw ? Number.parseInt(exportAtRaw, 10) : NaN;
  const importAt = importAtRaw ? Number.parseInt(importAtRaw, 10) : NaN;
  driveBackupLastExportAt.value = Number.isFinite(exportAt) ? exportAt : null;
  driveBackupLastImportAt.value = Number.isFinite(importAt) ? importAt : null;
}

function setDriveBackupMeta(kind: "export" | "import", ts: number) {
  const pid = String(activeProfileId.value || "").trim() || "default";
  const key = kind === "export" ? driveBackupLastExportAtKey(pid) : driveBackupLastImportAtKey(pid);
  try {
    localStorage.setItem(key, String(ts));
  } catch {}
  if (kind === "export") driveBackupLastExportAt.value = ts;
  else driveBackupLastImportAt.value = ts;
}

function makeDriveBackupSnapshot(): DriveBackupSnapshotV1 | null {
  const pid = String(activeProfileId.value || "").trim();
  if (!pid) return null;
  const walletAddress = activeWalletAddress();
  let seq = getCurrentDriveBackupSeq(pid);
  if (!seq) seq = nextDriveBackupSeq(pid);

  const rawFiles = Array.isArray(files.value) ? files.value : [];
  const outFiles: DriveFile[] = rawFiles
    .map((f: any) => {
      const cid = String(f?.cid || "").trim();
      if (!cid) return null;
      const name = String(f?.name || "").trim() || "Unknown";
      const sizeRaw = Number(f?.size);
      const size = Number.isFinite(sizeRaw) && sizeRaw >= 0 ? sizeRaw : 0;
      const uploadedAtRaw = Number(f?.uploadedAt);
      const uploadedAt = Number.isFinite(uploadedAtRaw) ? uploadedAtRaw : undefined;
      const type = f?.type === "dir" ? "dir" : f?.type === "file" ? "file" : undefined;
      const rootCid = String(f?.rootCid || "").trim() || undefined;
      const relPath = String(f?.relPath || "").trim() || undefined;
      return {
        cid,
        name,
        size,
        ...(uploadedAt != null ? { uploadedAt } : {}),
        ...(type ? { type } : {}),
        ...(rootCid ? { rootCid } : {}),
        ...(relPath ? { relPath } : {}),
      } as DriveFile;
    })
    .filter(Boolean)
    .slice(0, 500) as DriveFile[];

  const rawNames =
    localNames.value && typeof localNames.value === "object" ? localNames.value : {};
  const outNames = Object.fromEntries(
    Object.entries(rawNames)
      .map(([k, v]) => [String(k || "").trim(), String(v || "").trim()] as const)
      .filter(([k, v]) => !!k && !!v && v.toLowerCase() !== "unknown")
      .slice(0, 5000),
  ) as Record<string, string>;

  return {
    type: "lumen.driveBackup.snapshot",
    version: 1,
    createdAt: Date.now(),
    seq,
    walletAddress,
    drive: {
      files: outFiles,
      localNames: outNames,
    },
    favourites: Array.from(
      new Set(
        (Array.isArray(favourites.value) ? favourites.value : [])
          .map((u) => String(u || "").trim())
          .filter(Boolean),
      ),
    ),
  };
}

function sanitizeBackupFilenameSegment(input: string): string {
  const raw = String(input || "").trim();
  if (!raw) return "";
  let out = raw.replace(/[<>:"/\\|?*\x00-\x1F]/g, "").replace(/\s+/g, " ").trim();
  out = out.replace(/[. ]+$/g, "");
  if (out.length > 64) out = out.slice(0, 64).trim();
  return out;
}

function downloadTextFile(filename: string, text: string, mime = "application/json") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "download.json";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function driveBackupFriendlyError(code: string): string {
  const c = String(code || "").trim();
  if (!c) return "Backup failed";
  if (c === "missing_password") return "Password required.";
  if (c === "weak_password") return "Password too short (min 8 characters).";
  if (c === "decrypt_failed") return "Wrong password or corrupted backup file.";
  if (c === "invalid_envelope") return "Invalid backup file.";
  if (c === "invalid_snapshot") return "Invalid snapshot.";
  return c.replace(/_/g, " ");
}

function applyDriveBackupSnapshotPayload(snap: any): { ok: boolean; error?: string; seq?: number } {
  const pid = String(activeProfileId.value || "").trim();
  if (!pid) return { ok: false, error: "missing_profile_id" };

  if (!snap || snap.type !== "lumen.driveBackup.snapshot" || snap.version !== 1) {
    return { ok: false, error: "invalid_snapshot" };
  }

  const rawFiles = Array.isArray(snap.drive?.files) ? snap.drive.files : [];
  const nextFiles: DriveFile[] = rawFiles
    .map((f: any) => {
      const cid = String(f?.cid || "").trim();
      if (!cid) return null;
      const name = String(f?.name || "").trim() || "Unknown";
      const sizeRaw = Number(f?.size);
      const size = Number.isFinite(sizeRaw) && sizeRaw >= 0 ? sizeRaw : 0;
      const uploadedAtRaw = Number(f?.uploadedAt);
      const uploadedAt = Number.isFinite(uploadedAtRaw) ? uploadedAtRaw : undefined;
      const type = f?.type === "dir" ? "dir" : f?.type === "file" ? "file" : undefined;
      const rootCid = String(f?.rootCid || "").trim() || undefined;
      const relPath = String(f?.relPath || "").trim() || undefined;
      return {
        cid,
        name,
        size,
        ...(uploadedAt != null ? { uploadedAt } : {}),
        ...(type ? { type } : {}),
        ...(rootCid ? { rootCid } : {}),
        ...(relPath ? { relPath } : {}),
      } as DriveFile;
    })
    .filter(Boolean)
    .slice(0, 500) as DriveFile[];

  const rawNames = snap.drive?.localNames && typeof snap.drive.localNames === "object" ? snap.drive.localNames : {};
  const nextNames = Object.fromEntries(
    Object.entries(rawNames)
      .map(([k, v]) => [String(k || "").trim(), String(v || "").trim()] as const)
      .filter(([k, v]) => !!k && !!v && v.toLowerCase() !== "unknown")
      .slice(0, 5000),
  ) as Record<string, string>;

  const nextFav = Array.from(
    new Set(
      (Array.isArray(snap.favourites) ? snap.favourites : [])
        .map((u: any) => String(u || "").trim())
        .filter(Boolean),
    ),
  );

  files.value = nextFiles;
  localNames.value = nextNames;
  saveFiles();
  saveLocalNames();
  setFavouritesForProfile(pid, nextFav);

  const seq = Number(snap.seq);
  if (Number.isFinite(seq) && seq > 0) {
    bumpDriveBackupSeq(pid, seq);
  }

  setDriveBackupMeta("import", Date.now());

  // Ensure the restored metadata is visible immediately.
  exitBrowseSilent();
  if (hosting.value.kind === "gateway") {
    selectHosting("local");
  } else {
    void loadPinnedFiles();
  }
  return { ok: true, ...(Number.isFinite(seq) && seq > 0 ? { seq } : {}) };
}

const driveBackupRestoreDetails = computed(() => {
  const pending = pendingDriveBackupRestore.value;
  if (!pending) return null;
  const snap = pending.snapshot;
  const createdAt = Number(snap?.createdAt) || 0;
  const seq = Number(snap?.seq) || 0;
  const walletAddress = String(snap?.walletAddress || "").trim();
  const filesCount = Array.isArray(snap?.drive?.files) ? snap.drive.files.length : 0;
  const favCount = Array.isArray(snap?.favourites) ? snap.favourites.length : 0;
  const pid = String(activeProfileId.value || "").trim();
  const localSeq = pid ? getCurrentDriveBackupSeq(pid) : 0;
  const rollback = !!seq && !!localSeq && seq < localSeq;
  const currentWallet = activeWalletAddress();
  const walletMismatch =
    !!walletAddress &&
    !!currentWallet &&
    walletAddress.toLowerCase() !== currentWallet.toLowerCase();
  return {
    source: String(pending.source || "").trim(),
    createdAt,
    seq,
    walletAddress,
    filesCount,
    favCount,
    localSeq,
    rollback,
    walletMismatch,
  };
});

const driveBackupImportFilename = computed(() => {
  const pending = pendingDriveBackupImport.value;
  return pending ? String(pending.filename || "").trim() : "";
});

function openDriveBackupExportModal() {
  driveBackupError.value = "";
  driveBackupExportPassword.value = "";
  driveBackupExportPasswordConfirm.value = "";
  driveBackupExportShowPassword.value = false;
  showDriveBackupExportModal.value = true;
}

function closeDriveBackupExportModal() {
  if (driveBackupBusy.value) return;
  showDriveBackupExportModal.value = false;
  driveBackupExportPassword.value = "";
  driveBackupExportPasswordConfirm.value = "";
  driveBackupExportShowPassword.value = false;
  driveBackupError.value = "";
}

async function confirmDriveBackupExport() {
  driveBackupError.value = "";
  const pid = String(activeProfileId.value || "").trim();
  const snapshot = makeDriveBackupSnapshot();
  if (!pid || !snapshot) {
    driveBackupError.value = "No active profile";
    return;
  }

  const password = String(driveBackupExportPassword.value || "");
  const confirm = String(driveBackupExportPasswordConfirm.value || "");
  if (password.length < 8) {
    driveBackupError.value = driveBackupFriendlyError("weak_password");
    return;
  }
  if (password !== confirm) {
    driveBackupError.value = "Passwords do not match.";
    return;
  }

  const api: any = (window as any).lumen?.driveBackup;
  if (!api || typeof api.encryptSnapshot !== "function") {
    driveBackupError.value = "Backup API unavailable";
    return;
  }

  if (driveBackupBusy.value) return;
  driveBackupBusy.value = true;
  let shouldClose = false;
  try {
    const res = await api.encryptSnapshot(pid, snapshot, password).catch(() => null);
    if (!res || res.ok === false || !res.encrypted) {
      const code = String(res?.error || "encrypt_failed");
      driveBackupError.value = driveBackupFriendlyError(code);
      return;
    }

    const nameSeg = sanitizeBackupFilenameSegment(activeProfileDisplay.value) || "profile";
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `lumen-drive-backup-${nameSeg}-${stamp}.enc.json`;
    downloadTextFile(filename, JSON.stringify(res.encrypted, null, 2));
    setDriveBackupMeta("export", Date.now());
    showToast("Drive snapshot exported", "success");
    shouldClose = true;
  } catch (e: any) {
    driveBackupError.value = String(e?.message || e || "export_failed");
  } finally {
    driveBackupBusy.value = false;
    if (shouldClose) closeDriveBackupExportModal();
  }
}

function triggerImportDriveBackup() {
  driveBackupError.value = "";
  driveBackupImportInput.value?.click();
}

async function handleImportDriveBackupFile(e: Event) {
  driveBackupError.value = "";
  const pid = String(activeProfileId.value || "").trim();
  if (!pid) {
    driveBackupError.value = "No active profile";
    return;
  }

  const input = e.target as HTMLInputElement;
  const file = input?.files && input.files[0] ? input.files[0] : null;
  try {
    input.value = "";
  } catch {}
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    driveBackupError.value = "Backup file too large (max 5 MB).";
    return;
  }

  try {
    const raw = await file.text();
    const encrypted = JSON.parse(raw);
    const envelope =
      encrypted && typeof encrypted === "object"
        ? markRaw(encrypted)
        : encrypted;
    pendingDriveBackupImport.value = {
      filename: String(file.name || "").trim() || "backup.json",
      encrypted: envelope,
    };
    pendingDriveBackupRestore.value = null;
    driveBackupImportPassword.value = "";
    driveBackupImportShowPassword.value = false;
    showDriveBackupImportModal.value = true;
  } catch {
    driveBackupError.value = driveBackupFriendlyError("invalid_envelope");
  }
}

function closeDriveBackupImportModal() {
  if (driveBackupBusy.value) return;
  showDriveBackupImportModal.value = false;
  pendingDriveBackupImport.value = null;
  pendingDriveBackupRestore.value = null;
  driveBackupImportPassword.value = "";
  driveBackupImportShowPassword.value = false;
  driveBackupError.value = "";
}

async function decryptDriveBackupImport() {
  driveBackupError.value = "";
  const pid = String(activeProfileId.value || "").trim();
  if (!pid) {
    driveBackupError.value = "No active profile";
    return;
  }

  const pending = pendingDriveBackupImport.value;
  if (!pending) {
    driveBackupError.value = "No backup file selected";
    return;
  }

  const password = String(driveBackupImportPassword.value || "");
  if (!password) {
    driveBackupError.value = driveBackupFriendlyError("missing_password");
    return;
  }
  if (password.length < 8) {
    driveBackupError.value = driveBackupFriendlyError("weak_password");
    return;
  }

  const api: any = (window as any).lumen?.driveBackup;
  if (!api || typeof api.decryptSnapshot !== "function") {
    driveBackupError.value = "Backup API unavailable";
    return;
  }

  if (driveBackupBusy.value) return;
  driveBackupBusy.value = true;
  try {
    const encryptedPayload =
      pending.encrypted && typeof pending.encrypted === "object"
        ? toRaw(pending.encrypted)
        : pending.encrypted;
    const res = await api
      .decryptSnapshot(pid, encryptedPayload, password)
      .catch(() => null);
    if (!res || res.ok === false || !res.snapshot) {
      const code = String(res?.error || "decrypt_failed");
      driveBackupError.value = driveBackupFriendlyError(code);
      return;
    }
    pendingDriveBackupRestore.value = { source: pending.filename, snapshot: res.snapshot };
    driveBackupImportPassword.value = "";
    driveBackupImportShowPassword.value = false;
  } catch (e: any) {
    driveBackupError.value = String(e?.message || e || "decrypt_failed");
  } finally {
    driveBackupBusy.value = false;
  }
}

function confirmDriveBackupRestore() {
  driveBackupError.value = "";
  const pending = pendingDriveBackupRestore.value;
  if (!pending) return;
  const applied = applyDriveBackupSnapshotPayload(pending.snapshot);
  if (!applied.ok) {
    driveBackupError.value = driveBackupFriendlyError(String(applied.error || "invalid_snapshot"));
    return;
  }
  closeDriveBackupImportModal();
  showToast("Drive snapshot imported", "success");
}

function normalizeCidKey(cid: string): string {
  return String(cid || "").trim();
}

function isIgnoredCid(cid: string): boolean {
  const c = normalizeCidKey(cid).toLowerCase();
  return !c || c === "unknown";
}

function stripExt(name: string): string {
  const s = String(name || "").trim();
  if (!s) return "";
  return s.replace(/\.[a-z0-9]{1,8}$/i, "");
}

function getSavedName(cid: string): string {
  const key = normalizeCidKey(cid);
  if (!key) return "Unknown";

  if (hosting.value.kind === "gateway") {
    const remoteVal = gatewayPinnedNames.value[key];
    const remoteName = typeof remoteVal === "string" ? remoteVal.trim() : "";
    if (remoteName && remoteName.toLowerCase() !== "unknown") return remoteName;
  }

  const value = localNames.value[key];
  const name = typeof value === "string" ? value.trim() : "";
  if (name && name.toLowerCase() !== "unknown") return name;

  // Fallback to stored metadata if available (older entries / imported state).
  try {
    const meta = files.value.find((f) => String(f?.cid || "").trim() === key) || null;
    const metaName = String(meta?.name || "").trim();
    if (metaName && metaName.toLowerCase() !== "unknown") return metaName;
  } catch {
    // ignore
  }

  return "Unknown";
}

function setSavedName(cid: string, name: string) {
  const key = normalizeCidKey(cid);
  if (!key) return;
  const nextName = String(name || "").trim();
  const next = { ...localNames.value };
  if (!nextName || nextName.toLowerCase() === "unknown") {
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
  const selected = Array.from(input.files || []);
  try {
    input.value = "";
  } catch {}
  if (!selected.length) return;

  const ok = await ensureIpfsConnected();
  if (!ok) return;

  for (const file of selected) {
    const res = await uploadFile(file);
    if ((res as any)?.cancelled) break;
  }
}

async function handleFolderUpload(e: Event) {
  showUploadMenu.value = false;
  const input = e.target as HTMLInputElement;
  const filesList = Array.from(input.files || []);
  try {
    input.value = "";
  } catch {}
  if (!filesList.length) return;

  const ok = await ensureIpfsConnected();
  if (!ok) return;

  const groups = new Map<string, { path: string; file: File }[]>();

  for (const f of filesList) {
    const rel = String((f as any).webkitRelativePath || "").replace(/\\/g, "/");
    const parts = rel ? rel.split("/").filter(Boolean) : [f.name];
    const rootName = parts[0] || "folder";
    if (!groups.has(rootName)) groups.set(rootName, []);
    groups.get(rootName)!.push({ path: rel || f.name, file: f });
  }

  for (const [rootName, list] of groups.entries()) {
    const res = await uploadDirectory(rootName, list);
    if ((res as any)?.cancelled) break;
  }

}

function upsertFileMetadata(next: DriveFile) {
  const cid = String(next?.cid || "").trim();
  if (!cid) return;
  const filtered = files.value.filter(
    (f) => String(f?.cid || "").trim() !== cid,
  );
  files.value = [{ ...next, cid }, ...filtered].slice(0, 500);
  saveFiles();
}

async function pinCidToActiveGateway(cid: string, displayName?: string): Promise<
  | { ok: true }
  | { ok: false; error: string; cancelled?: boolean }
> {
  if (hosting.value.kind !== "gateway") return { ok: true as const };

  const api: any = (window as any).lumen;
  const profilesApi = api?.profiles;
  const gwApi = api?.gateway;
  if (!profilesApi || !gwApi || !gwApi.pinCid) {
    return { ok: false as const, error: "Gateway upload unavailable" };
  }

  const active = await profilesApi.getActive?.().catch(() => null);
  const profileId = active?.id;
  if (!profileId) {
    return { ok: false as const, error: "No active profile" };
  }

  const gid = hosting.value.gatewayId;
  const sub =
    planSubscriptionsRaw.value.find(
      (s) =>
        String(s.gatewayId) === String(gid) &&
        String(s.status).includes("active"),
    ) ||
    planSubscriptionsRaw.value.find((s) => String(s.gatewayId) === String(gid));
  const planId = sub?.metadata?.planId ?? sub?.metadata?.plan_id ?? null;

  const res = await gwApi
    .pinCid({
      profileId,
      cid,
      baseUrl: activeGatewayHint.value,
      planId,
      displayName,
    })
    .catch((e: any) => ({ ok: false, error: String(e?.message || e) }));

  if (!res || res.ok === false) {
    const err = String(res?.error || "Gateway pin failed");
    const lower = err.toLowerCase();
    if (
      lower.includes("cancel") ||
      lower.includes("abort") ||
      lower.includes("aborted")
    ) {
      return { ok: false as const, error: "cancelled", cancelled: true };
    }
    return {
      ok: false as const,
      error: err,
    };
  }

  // Some gateways can take a bit of time to reflect the new CID in /wallet/cids.
  // Optimistically add it so the Drive list refreshes immediately.
  addOptimisticGatewayPinnedCid(cid);

  await refreshActiveGatewayPinned();
  await refreshGatewayBase(activeGatewayHint.value);
  return { ok: true as const };
}

async function uploadDirectory(
  rootName: string,
  list: { path: string; file: File }[],
): Promise<{ ok: true } | { ok: false; cancelled?: boolean }> {
  const name = String(rootName || "").trim() || "folder";
  if (!list.length) return { ok: false };

  const estimatedBytes = list.reduce(
    (acc, it) => acc + (Number(it?.file?.size || 0) || 0),
    0,
  );
  if (estimatedBytes > 200 * 1024 * 1024) {
    showToast(`Folder too large (max 200 MB): ${name}`, "error");
    return { ok: false };
  }

  uploading.value = true;
  uploadingFile.value = name;
  uploadingStage.value = "preparing";
  uploadingPercent.value = 0;
  uploadingCanceling.value = false;

  try {
    const api: any = (window as any).lumen;

    const pathFiles = list.map((it) => {
      const rel = String(it.path || it.file?.name || "file")
        .replace(/^\/+/, "")
        .replace(/\\/g, "/");
      const fp = String((it.file as any)?.path || "").trim();
      return { path: rel, filePath: fp };
    });
    const hasAllPaths = pathFiles.every((f) => !!String(f.filePath || "").trim());
    const addDirPathsFn =
      hasAllPaths && typeof api?.ipfsAddDirectoryPathsWithProgress === "function"
        ? api.ipfsAddDirectoryPathsWithProgress
        : hasAllPaths && typeof api?.ipfsAddDirectoryPaths === "function"
          ? api.ipfsAddDirectoryPaths
          : null;

    const addDirBytesFn =
      typeof api?.ipfsAddDirectoryWithProgress === "function"
        ? api.ipfsAddDirectoryWithProgress
        : typeof api?.ipfsAddDirectory === "function"
          ? api.ipfsAddDirectory
          : null;

    if (!addDirPathsFn && !addDirBytesFn) {
      showToast("Upload unavailable", "error");
      return { ok: false };
    }

    uploadingStage.value = "adding";
    uploadingPercent.value = 0;

    let result: any = null;
    let totalBytes = estimatedBytes;

    if (addDirPathsFn) {
      result = await addDirPathsFn({
        rootName: name,
        files: pathFiles,
      });
    } else {
      const payloadFiles: { path: string; data: Uint8Array }[] = [];
      totalBytes = 0;
      for (const it of list) {
        const rel = String(it.path || it.file?.name || "file")
          .replace(/^\/+/, "")
          .replace(/\\/g, "/");
        const buf = await it.file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        totalBytes += bytes.byteLength;
        payloadFiles.push({ path: rel, data: bytes });
      }
      result = await addDirBytesFn?.({
        rootName: name,
        files: payloadFiles,
      });
    }

    if (!result?.ok || !result?.cid) {
      const err = String(result?.error || "");
      const lower = err.toLowerCase();
      if (lower.includes("cancel") || lower.includes("abort")) {
        showToast("Upload cancelled.", "success");
        return { ok: false, cancelled: true };
      }
      if (err === "directory_too_large") {
        showToast(`Folder too large (max 200 MB): ${name}`, "error");
        return { ok: false };
      }
      if (err === "add_in_progress") {
        showToast("Another upload is already running. Please wait…", "error");
        return { ok: false };
      }
      const detail = compactError(err);
      showToast(
        detail
          ? `Failed to upload folder: ${name} (${detail})`
          : `Failed to upload folder: ${name}`,
        "error",
      );
      return { ok: false };
    }

    const cid = String(result.cid);
    entryTypeCache.value = { ...entryTypeCache.value, [cid]: "dir" };
    setSavedName(cid, name);

    upsertFileMetadata({
      cid,
      name,
      size: totalBytes,
      uploadedAt: Date.now(),
      type: "dir",
    });

    if (hosting.value.kind === "gateway") {
      uploadingStage.value = "gateway-preflight";
      uploadingPercent.value = 0;
      const pinned = await pinCidToActiveGateway(cid, name);
      if (!pinned.ok) {
        if ((pinned as any).cancelled) {
          showToast("Upload cancelled.", "success");
          return { ok: false, cancelled: true };
        }
        showToast(pinned.error, "error");
        return { ok: false };
      }
      showToast(`Uploaded folder to gateway: ${name}`, "success");
    } else {
      loadStats();
      await loadPinnedFiles();
      showToast(`Uploaded folder: ${name}`, "success");
    }

    return { ok: true };
  } catch (err) {
    console.error("Folder upload error:", err);
    const msg = String((err as any)?.message || err || "");
    const lower = msg.toLowerCase();
    if (lower.includes("cancel") || lower.includes("abort")) {
      showToast("Upload cancelled.", "success");
      return { ok: false, cancelled: true };
    }
    if (msg === "directory_too_large") {
      showToast(`Folder too large (max 200 MB): ${name}`, "error");
      return { ok: false };
    }
    const detail = compactError(msg);
    showToast(
      detail ? `Error uploading folder: ${name} (${detail})` : `Error uploading folder: ${name}`,
      "error",
    );
    return { ok: false };
  } finally {
    uploading.value = false;
    uploadingFile.value = "";
    uploadingStage.value = "preparing";
    uploadingPercent.value = null;
    uploadingCanceling.value = false;
  }
}

async function uploadDirectoryFromPath(
  dirPath: string,
): Promise<{ ok: true } | { ok: false; cancelled?: boolean }> {
  const rootPath = String(dirPath || "").trim();
  const name = basenameFromPath(rootPath) || "folder";
  if (!rootPath) return { ok: false };

  uploading.value = true;
  uploadingFile.value = name;
  uploadingStage.value = "preparing";
  uploadingPercent.value = 0;
  uploadingCanceling.value = false;

  try {
    const api: any = (window as any).lumen;
    const addFn =
      typeof api?.ipfsAddDirectoryFromPathWithProgress === "function"
        ? api.ipfsAddDirectoryFromPathWithProgress
        : api?.ipfsAddDirectoryFromPath;
    if (typeof addFn !== "function") {
      showToast("Upload unavailable", "error");
      return { ok: false };
    }

    uploadingStage.value = "adding";
    uploadingPercent.value = 0;

    const result = await addFn({ rootPath, rootName: name });

    if (!result?.ok || !result?.cid) {
      const err = String(result?.error || "");
      const lower = err.toLowerCase();
      if (lower.includes("cancel") || lower.includes("abort")) {
        showToast("Upload cancelled.", "success");
        return { ok: false, cancelled: true };
      }
      if (err === "directory_too_large") {
        showToast(`Folder too large (max 200 MB): ${name}`, "error");
        return { ok: false };
      }
      if (err === "too_many_files") {
        showToast(`Too many files in folder: ${name}`, "error");
        return { ok: false };
      }
      if (err === "not_directory") {
        showToast(`Not a folder: ${name}`, "error");
        return { ok: false };
      }
      if (err === "add_in_progress") {
        showToast("Another upload is already running. Please wait…", "error");
        return { ok: false };
      }
      const detail = compactError(err);
      showToast(
        detail
          ? `Failed to upload folder: ${name} (${detail})`
          : `Failed to upload folder: ${name}`,
        "error",
      );
      return { ok: false };
    }

    const cid = String(result.cid);
    const totalBytes = Number(result?.totalBytes || 0) || 0;
    entryTypeCache.value = { ...entryTypeCache.value, [cid]: "dir" };
    setSavedName(cid, name);

    upsertFileMetadata({
      cid,
      name,
      size: totalBytes,
      uploadedAt: Date.now(),
      type: "dir",
    });

    if (hosting.value.kind === "gateway") {
      uploadingStage.value = "gateway-preflight";
      uploadingPercent.value = 0;
      const pinned = await pinCidToActiveGateway(cid, name);
      if (!pinned.ok) {
        if ((pinned as any).cancelled) {
          showToast("Upload cancelled.", "success");
          return { ok: false, cancelled: true };
        }
        showToast(pinned.error, "error");
        return { ok: false };
      }
      showToast(`Uploaded folder to gateway: ${name}`, "success");
    } else {
      loadStats();
      await loadPinnedFiles();
      showToast(`Uploaded folder: ${name}`, "success");
    }

    return { ok: true };
  } catch (err) {
    console.error("Folder upload error:", err);
    const msg = String((err as any)?.message || err || "");
    const lower = msg.toLowerCase();
    if (lower.includes("cancel") || lower.includes("abort")) {
      showToast("Upload cancelled.", "success");
      return { ok: false, cancelled: true };
    }
    if (msg === "directory_too_large") {
      showToast(`Folder too large (max 200 MB): ${name}`, "error");
      return { ok: false };
    }
    const detail = compactError(msg);
    showToast(
      detail ? `Error uploading folder: ${name} (${detail})` : `Error uploading folder: ${name}`,
      "error",
    );
    return { ok: false };
  } finally {
    uploading.value = false;
    uploadingFile.value = "";
    uploadingStage.value = "preparing";
    uploadingPercent.value = null;
    uploadingCanceling.value = false;
  }
}

async function uploadFile(file: File): Promise<{ ok: true } | { ok: false; cancelled?: boolean }> {
  uploading.value = true;
  uploadingFile.value = file.name;
  uploadingStage.value = "preparing";
  uploadingPercent.value = 0;
  uploadingCanceling.value = false;

  try {
    const api: any = (window as any).lumen;
    const filePath = String((file as any)?.path || "").trim();
    const addPathFn =
      filePath && typeof api?.ipfsAddPathWithProgress === "function"
        ? api.ipfsAddPathWithProgress
        : filePath && typeof api?.ipfsAddPath === "function"
          ? api.ipfsAddPath
          : null;

    const addBytesFn =
      typeof api?.ipfsAddWithProgress === "function"
        ? api.ipfsAddWithProgress
        : typeof api?.ipfsAdd === "function"
          ? api.ipfsAdd
          : null;

    if (!addPathFn && !addBytesFn) {
      showToast("Upload unavailable", "error");
      return { ok: false };
    }

    uploadingStage.value = "adding";
    uploadingPercent.value = 0;

    const result = addPathFn
      ? await addPathFn(filePath, file.name)
      : await (async () => {
          const buffer = await file.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          return addBytesFn?.(bytes, file.name);
        })();

    if (result?.cid) {
      const cid = String(result.cid);
      const sizeBytes =
        Number((file as any)?.size || 0) || Number((result as any)?.fileBytes || 0) || 0;
      setSavedName(cid, file.name);
      entryTypeCache.value = { ...entryTypeCache.value, [cid]: "file" };
      upsertFileMetadata({
        cid,
        name: file.name,
        size: sizeBytes,
        uploadedAt: Date.now(),
        type: "file",
      });

      if (hosting.value.kind === "gateway") {
        uploadingStage.value = "gateway-preflight";
        uploadingPercent.value = 0;
        const pinned = await pinCidToActiveGateway(cid, file.name);
        if (!pinned.ok) {
          if ((pinned as any).cancelled) {
            showToast("Upload cancelled.", "success");
            return { ok: false, cancelled: true };
          }
          showToast(pinned.error, "error");
          return { ok: false };
        }
        showToast(`Uploaded to gateway: ${file.name}`, "success");
      } else {
        loadStats();
        await loadPinnedFiles();
        showToast(`Uploaded: ${file.name}`, "success");
      }

      return { ok: true };
    } else {
      const err = String(result?.error || "");
      const lower = err.toLowerCase();
      if (lower.includes("cancel") || lower.includes("abort")) {
        showToast("Upload cancelled.", "success");
        return { ok: false, cancelled: true };
      }
      if (err === "add_in_progress") {
        showToast("Another upload is already running. Please wait…", "error");
        return { ok: false };
      }
      const detail = compactError(err);
      showToast(
        detail ? `Failed to upload: ${file.name} (${detail})` : `Failed to upload: ${file.name}`,
        "error",
      );
      return { ok: false };
    }
  } catch (err) {
    console.error("Upload error:", err);
    const msg = String((err as any)?.message || err || "");
    const lower = msg.toLowerCase();
    if (lower.includes("cancel") || lower.includes("abort")) {
      showToast("Upload cancelled.", "success");
      return { ok: false, cancelled: true };
    }
    const detail = compactError(msg);
    showToast(
      detail ? `Error uploading: ${file.name} (${detail})` : `Error uploading: ${file.name}`,
      "error",
    );
    return { ok: false };
  } finally {
    uploading.value = false;
    uploadingFile.value = "";
    uploadingStage.value = "preparing";
    uploadingPercent.value = null;
    uploadingCanceling.value = false;
  }
}

async function convertToHls(file: DriveFile) {
  const f = file as any;
  if (!f || !String(f.cid || "").trim()) return;
  if (isDirEntry(file)) return;
  if (!isVideoFile(file.name)) return;
  if (!ipfsConnected.value) {
    showToast("IPFS not connected", "error");
    return;
  }
  if (uploading.value || converting.value) {
    showToast("Another task is already running. Please wait…", "error");
    return;
  }

  converting.value = true;
  convertingFile.value = file.name;
  convertingStage.value = "preparing";
  convertingPercent.value = 0;
  convertingCanceling.value = false;

  try {
    const target = contentTargetFor(file);
    const res = await (window as any).lumen?.driveConvertToHls?.({
      cidOrPath: target,
      name: file.name,
      audioBitrate: "128k",
    });

    if (!res?.ok || !res?.cid) {
      const err = String(res?.error || "HLS conversion failed");
      if (err.toLowerCase().includes("cancel")) {
        showToast("Conversion cancelled.", "success");
        return;
      }
      showToast(err, "error");
      return;
    }

    const newCid = String(res.cid);
    const base = stripExt(file.name) || file.name;
    const newName = `${base} - HLS`;

    entryTypeCache.value = { ...entryTypeCache.value, [newCid]: "file" };
    setSavedName(newCid, newName);

    upsertFileMetadata({
      cid: newCid,
      name: newName,
      size: Number(res?.sizeBytes || 0) || 0,
      uploadedAt: Date.now(),
      type: "file",
      rootCid: newCid,
      relPath: "master.m3u8",
    });

    if (hosting.value.kind === "gateway") {
      const pinned = await pinCidToActiveGateway(newCid, newName);
      if (!pinned.ok) {
        showToast(pinned.error, "error");
        return;
      }
      showToast(`Converted & pinned to gateway: ${newName}`, "success");
    } else {
      loadStats();
      await loadPinnedFiles();
      showToast(`Converted to HLS: ${newName}`, "success");
    }
  } catch (e: any) {
    console.error("HLS conversion error:", e);
    const err = String(e?.message || "HLS conversion error");
    if (err.toLowerCase().includes("cancel")) {
      showToast("Conversion cancelled.", "success");
      return;
    }
    showToast(err, "error");
  } finally {
    converting.value = false;
    convertingFile.value = "";
    convertingStage.value = "preparing";
    convertingPercent.value = null;
    convertingCanceling.value = false;
  }
}

function convertSelectedToHls() {
  if (!selectedFile.value) return;
  void convertToHls(selectedFile.value);
}

async function cancelUpload() {
  if (!uploading.value || uploadingCanceling.value) return;

  const prevStage = uploadingStage.value;
  uploadingCanceling.value = true;
  uploadingStage.value = "cancelling";

  try {
    const api: any = (window as any).lumen;
    const cancelers: Promise<any>[] = [];

    if (typeof api?.ipfsCancelAdd === "function") {
      cancelers.push(api.ipfsCancelAdd().catch(() => null));
    }
    if (typeof api?.gateway?.cancelPinCid === "function") {
      cancelers.push(api.gateway.cancelPinCid().catch(() => null));
    }

    if (!cancelers.length) {
      showToast("Cancel is unavailable.", "error");
      uploadingCanceling.value = false;
      uploadingStage.value = prevStage;
      return;
    }

    const results = await Promise.allSettled(cancelers);
    const ok = results.some(
      (r) => r.status === "fulfilled" && r.value && r.value.ok === true,
    );
    if (!ok) {
      showToast("Cancel failed", "error");
      uploadingCanceling.value = false;
      uploadingStage.value = prevStage;
    }
  } catch (e: any) {
    showToast(String(e?.message || "Cancel failed"), "error");
    uploadingCanceling.value = false;
    uploadingStage.value = prevStage;
  }
}

async function cancelHlsConversion() {
  if (!converting.value || convertingCanceling.value) return;
  convertingCanceling.value = true;
  convertingStage.value = "cancelling";
  try {
    const api: any = (window as any).lumen;
    if (typeof api?.driveCancelHlsConvert !== "function") {
      showToast("Cancel is unavailable.", "error");
      convertingCanceling.value = false;
      convertingStage.value = "transcoding";
      return;
    }
    const res = await api.driveCancelHlsConvert().catch(() => null);
    if (!res?.ok) {
      showToast(String(res?.error || "Cancel failed"), "error");
      convertingCanceling.value = false;
      convertingStage.value = "transcoding";
    }
  } catch (e: any) {
    showToast(String(e?.message || "Cancel failed"), "error");
    convertingCanceling.value = false;
    convertingStage.value = "transcoding";
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
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Downloaded!", "success");
    } else {
      showToast("Download failed", "error");
    }
  } catch {
    showToast("Download error", "error");
  }
}

function lumenLinkFor(file: DriveFile): string {
  const target = openTargetFor(file);
  const encoded = encodeIpfsTarget(target);
  const isDir =
    String((file as any)?.type || "") === "dir" && target === contentTargetFor(file);
  return `lumen://ipfs/${encoded}${isDir ? "/" : ""}`;
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
  showToast("Link copied!", "success");
}

function openInIpfs(file: DriveFile) {
  const url = lumenLinkFor(file);
  if (openInNewTab) {
    openInNewTab(url);
    return;
  }
  try {
    window.open(url, "_blank");
  } catch {
    // ignore
  }
}

function normalizeBrowsePath(path: string): string {
  return String(path || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

function driveUrlForBrowse(rootCid: string, relPath: string): string {
  const root = String(rootCid || "").trim();
  const path = normalizeBrowsePath(relPath);
  if (!root) return "lumen://drive";
  const q = new URLSearchParams();
  q.set("root", root);
  if (path) q.set("path", path);
  return `lumen://drive?${q.toString()}`;
}

function parseDriveBrowseFromUrl(
  rawUrl: string,
): { root: string; path: string } | null {
  const s = String(rawUrl || "").trim();
  if (!s) return null;
  if (!/^lumen:\/\//i.test(s)) return null;

  // Do not rely on `new URL()` for custom schemes; in some environments it fails.
  const withoutScheme = s.replace(/^lumen:\/\//i, "");
  const host = (withoutScheme.split(/[/?#]/, 1)[0] || "").toLowerCase();
  if (host !== "drive") return null;

  const query = withoutScheme.includes("?") ? withoutScheme.split("?", 2)[1] : "";
  const qs = query ? query.split("#", 2)[0] : "";
  const params = new URLSearchParams(qs);
  const root = String(params.get("root") || "").trim();
  const path = normalizeBrowsePath(params.get("path") || "");
  return { root, path };
}

function resetBrowseState() {
  browseLoadSeq++;
  browseRootCid.value = "";
  browseRelPath.value = "";
  browseEntries.value = [];
  browseError.value = "";
  browseLoading.value = false;
  selectedFile.value = null;
  renameDraft.value = "";
  currentPage.value = 1;
}

async function applyBrowseLocation(rootCid: string, relPath: string) {
  const root = String(rootCid || "").trim();
  const path = normalizeBrowsePath(relPath);

  if (!root) {
    if (isBrowsing.value) resetBrowseState();
    return;
  }

  const prevRoot = String(browseRootCid.value || "").trim();
  const prevPath = normalizeBrowsePath(browseRelPath.value);
  const changed = root !== prevRoot || path !== prevPath;

  browseRootCid.value = root;
  browseRelPath.value = path;
  selectedFile.value = null;
  renameDraft.value = "";
  currentPage.value = 1;

  if (changed) {
    // Immediately show a "loading" state so the UI reacts as soon as the URL changes.
    browseEntries.value = [];
    browseError.value = "";
    browseLoading.value = true;
    await loadBrowseEntries();
  }
}

async function navigateBrowse(
  rootCid: string,
  relPath: string,
  opts: { push?: boolean } = {},
) {
  const push = opts.push ?? true;
  const root = String(rootCid || "").trim();
  const path = normalizeBrowsePath(relPath);

  if (!root) {
    resetBrowseState();
    navigate?.("lumen://drive", { push });
    return;
  }

  await applyBrowseLocation(root, path);
  navigate?.(driveUrlForBrowse(root, path), { push });
}

async function loadBrowseEntries() {
  const seq = ++browseLoadSeq;
  const cid = String(browseRootCid.value || "").trim();
  const relPath = normalizeBrowsePath(browseRelPath.value);
  if (!cid) return;
  browseLoading.value = true;
  browseError.value = "";
  try {
    const target = relPath ? `${cid}/${relPath}` : cid;
    const res = await (window as any).lumen?.ipfsLs?.(target).catch(() => null);
    if (seq !== browseLoadSeq) return;
    if (!res || res.ok === false) {
      browseEntries.value = [];
      browseError.value = String(res?.error || "Failed to list folder");
      return;
    }
    const list = Array.isArray(res.entries) ? res.entries : [];
    const mapped = list
      .filter((it: any) => it && it.name && it.cid)
      .map((it: any) => {
        const name = String(it.name);
        const rel = relPath ? `${relPath}/${name}` : name;
        return {
          cid: String(it.cid),
          name,
          size: typeof it.size === "number" ? it.size : 0,
          type: String(it.type) === "dir" ? "dir" : "file",
          rootCid: cid,
          relPath: rel,
        } as DriveFile;
      })
      .sort((a: any, b: any) => {
        if (a.type === b.type)
          return String(a.name).localeCompare(String(b.name));
        return a.type === "dir" ? -1 : 1;
      });
    if (seq !== browseLoadSeq) return;
    browseEntries.value = mapped;
  } catch (e: any) {
    if (seq !== browseLoadSeq) return;
    browseEntries.value = [];
    browseError.value = String(e?.message || "Failed to list folder");
  } finally {
    if (seq === browseLoadSeq) browseLoading.value = false;
  }
}

function exitBrowse() {
  const root = String(browseRootCid.value || "").trim();
  const path = normalizeBrowsePath(browseRelPath.value);
  if (!root) {
    void navigateBrowse("", "", { push: true });
    return;
  }
  if (!path) {
    void navigateBrowse("", "", { push: true });
    return;
  }
  const parent = normalizeBrowsePath(path.split("/").slice(0, -1).join("/"));
  void navigateBrowse(root, parent, { push: true });
}

function exitBrowseSilent() {
  void navigateBrowse("", "", { push: false });
}

async function openBrowseAt(path: string) {
  const root = String(browseRootCid.value || "").trim();
  if (!root) return;
  await navigateBrowse(root, path, { push: true });
}

async function openDirectory(file: DriveFile) {
  const root = String(file?.rootCid || file?.cid || "").trim();
  if (!root) return;
  await navigateBrowse(root, String(file?.relPath || ""), { push: true });
}

async function handleEntryClick(file: DriveFile) {
  if (browseLoading.value) return;
  if (isHlsEntry(file)) {
    const cid = String(file?.cid || "").trim();
    if (!cid) return;
    entryTypeCache.value = { ...entryTypeCache.value, [cid]: "file" };
    selectedFile.value = {
      ...file,
      type: "file",
      rootCid: String(file?.rootCid || cid),
      relPath: String(file?.relPath || "master.m3u8"),
    };
    return;
  }
  if (String((file as any)?.type) === "dir") {
    await openDirectory(file);
    return;
  }
  if (String((file as any)?.type) === "file") {
    selectedFile.value = file;
    return;
  }

  // Unknown (root saved entry): best-effort detect if it's a directory.
  const cid = String(file?.cid || "").trim();
  if (!cid) return;
  const res = await (window as any).lumen?.ipfsLs?.(cid).catch(() => null);
  const linksRaw = Array.isArray(res?.entries) ? res.entries : [];
  const links = linksRaw.filter(
    (it: any) =>
      it && String(it.name || "").trim() && String(it.cid || "").trim(),
  );
  const hasHlsMaster = links.some(
    (it: any) => String(it?.name || "").toLowerCase() === "master.m3u8",
  );
  const isDirDetected = links.length > 0 && !hasHlsMaster;
  entryTypeCache.value = {
    ...entryTypeCache.value,
    [cid]: isDirDetected ? "dir" : "file",
  };

  if (hasHlsMaster) {
    const next: DriveFile = {
      ...file,
      type: "file",
      rootCid: cid,
      relPath: "master.m3u8",
    };
    selectedFile.value = next;
    upsertFileMetadata({
      cid,
      name: file.name,
      size: file.size,
      uploadedAt: file.uploadedAt,
      type: "file",
      rootCid: cid,
      relPath: "master.m3u8",
    });
    return;
  }

  if (isDirDetected) {
    await openDirectory({ ...file, type: "dir", rootCid: cid, relPath: "" });
    return;
  }

  selectedFile.value = { ...file, type: "file" };
}

function selectFile(file: DriveFile) {
  void handleEntryClick(file);
}

watch(
  selectedFile,
  (f) => {
    if (!f) {
      renameDraft.value = "";
      return;
    }
    renameDraft.value = canRenameEntry(f) ? getSavedName(f.cid) : f.name;
  },
  { immediate: true },
);

watch(activeProfileId, (next, prev) => {
  const n = String(next || "").trim();
  const p = String(prev || "").trim();
  if (n === p) return;
  void reloadForActiveProfileChange();
});

const contentTypeKnownExts = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "svg",
  "bmp",
  "mp4",
  "webm",
  "mov",
  "avi",
  "mkv",
  "mp3",
  "wav",
  "ogg",
  "flac",
  "m4a",
  "zip",
  "rar",
  "7z",
  "tar",
  "gz",
  "epub",
  "pdf",
  "doc",
  "docx",
  "txt",
  "md",
]);

let contentTypePrefetchSeq = 0;
watch(
  displayFiles,
  (next) => {
    const seq = ++contentTypePrefetchSeq;
    const list = Array.isArray(next) ? next : [];
    const targets = list
      .filter((f) => {
        const cid = String(f?.cid || "").trim();
        if (!cid) return false;
        if (isDirEntry(f)) return false;
        if (isEpubFile(f)) return false;
        if (entryContentTypeCache.value[cid]) return false;
        const ext = String(f?.name || "").split(".").pop()?.toLowerCase() || "";
        return !contentTypeKnownExts.has(ext);
      })
      .slice(0, 20);

    if (!targets.length) return;

    void (async () => {
      const max = Math.min(4, targets.length);
      let nextIndex = 0;
      const workers = new Array(max).fill(0).map(async () => {
        while (true) {
          const idx = nextIndex++;
          if (idx >= targets.length) break;
          if (seq !== contentTypePrefetchSeq) return;
          const cid = String(targets[idx]?.cid || "").trim();
          if (!cid) continue;
          await ensureContentTypeCached(cid);
        }
      });
      await Promise.all(workers);
    })();
  },
  { immediate: true },
);

function isDirEntry(file: DriveFile | null | undefined): boolean {
  if (isHlsEntry(file)) return false;
  if (String((file as any)?.type || "") === "dir") return true;
  const cid = String((file as any)?.cid || "").trim();
  if (!cid) return false;
  return entryTypeCache.value[cid] === "dir";
}

function openEntryDetails(file: DriveFile) {
  selectedFile.value = file;
}

function isRootSavedEntry(f: DriveFile | null | undefined): boolean {
  if (!f) return false;
  if (isBrowsing.value) return false;
  const cid = String(f?.cid || "").trim();
  if (!cid) return false;
  return activeSavedCids.value.some((x) => String(x || "").trim() === cid);
}

function canRenameEntry(f: DriveFile | null | undefined): boolean {
  return isRootSavedEntry(f);
}

async function saveSelectedName() {
  const f = selectedFile.value;
  if (!f) return;
  if (!canRenameEntry(f)) return;

  const cid = String(f?.cid || "").trim();
  if (!cid) return;

  const currentName = getSavedName(cid);
  const currentNorm =
    currentName && currentName.toLowerCase() !== "unknown" ? currentName.trim() : "";
  const nextNorm =
    renameDraft.value && renameDraft.value.toLowerCase() !== "unknown"
      ? renameDraft.value.trim()
      : "";

  if (currentNorm === nextNorm) return;

  if (hosting.value.kind === "gateway") {
    try {
      const api: any = (window as any).lumen;
      const profilesApi = api?.profiles;
      const gwApi = api?.gateway;
      if (!profilesApi || !gwApi || typeof gwApi.renameCid !== "function") {
        showToast("Gateway rename unavailable", "error");
        return;
      }

      const active = await profilesApi.getActive?.().catch(() => null);
      const profileId = active?.id;
      if (!profileId) {
        showToast("No active profile", "error");
        return;
      }

      const res = await gwApi
        .renameCid({
          profileId,
          cid,
          displayName: nextNorm,
          baseUrl: activeGatewayHint.value,
        })
        .catch((e: any) => ({ ok: false, error: String(e?.message || e) }));

      if (!res || res.ok === false) {
        const code = String(res?.error || "rename_failed");
        if (code === "password_required" || code === "invalid_password") {
          try {
            await api?.security?.lockSession?.();
          } catch {}
        }
        showToast(code, "error");
        return;
      }

      const data = res.data ?? null;
      const nameRaw =
        data?.display_name ?? data?.displayName ?? data?.name ?? null;
      const name = typeof nameRaw === "string" ? nameRaw.trim() : "";

      const nextRemote = { ...gatewayPinnedNames.value };
      if (name && name.toLowerCase() !== "unknown") {
        nextRemote[cid] = name;
      } else {
        delete nextRemote[cid];
      }
      gatewayPinnedNames.value = nextRemote;

      // Keep local fallback in sync with remote rename (including clears).
      setSavedName(cid, name);

      selectedFile.value = { ...f, name: getSavedName(cid) };
      return;
    } catch (e: any) {
      showToast(String(e?.message || "rename_failed"), "error");
      return;
    }
  }

  setSavedName(cid, renameDraft.value);
  selectedFile.value = { ...f, name: getSavedName(cid) };
}

async function removeFile(file: DriveFile) {
  const cid = String(file?.cid || "").trim();
  if (!cid) return;
  if (!isRootSavedEntry(file)) {
    showToast("Remove is only available on root saved entries", "error");
    return;
  }

  if (hosting.value.kind === "local") {
    // Drive state is metadata-based; always remove the reference, and best-effort unpin.
    const filtered = files.value.filter((f) => String(f?.cid || "").trim() !== cid);
    files.value = filtered;
    saveFiles();
    setSavedName(cid, "");

    let unpinFailed = false;
    try {
      const res = await (window as any).lumen?.ipfsUnpin?.(cid);
      if (res && res.ok === false) unpinFailed = true;
    } catch {
      unpinFailed = true;
    }

    await loadPinnedFiles();
    void loadStats();
    if (selectedFile.value?.cid === cid) {
      selectedFile.value = null;
      renameDraft.value = "";
    }
    showToast(unpinFailed ? "Removed (couldn't unpin local data)" : "Removed", "success");
    return;
  }

  if (hosting.value.kind === "gateway") {
    try {
      const api: any = (window as any).lumen;
      const profilesApi = api?.profiles;
      const gwApi = api?.gateway;
      if (!profilesApi || !gwApi || !gwApi.unpinCid) {
        showToast("Gateway removal unavailable", "error");
        return;
      }

      const active = await profilesApi.getActive?.().catch(() => null);
      const profileId = active?.id;
      if (!profileId) {
        showToast("No active profile", "error");
        return;
      }

      const res = await gwApi
        .unpinCid({ profileId, cid, baseUrl: activeGatewayHint.value })
        .catch((e: any) => ({ ok: false, error: String(e?.message || e) }));
      if (!res || res.ok === false) {
        showToast(String(res?.error || "Gateway unpin failed"), "error");
        return;
      }

      removeOptimisticGatewayPinnedCid(cid);
      setSavedName(cid, "");
      await refreshActiveGatewayPinned();
      if (selectedFile.value?.cid === cid) {
        selectedFile.value = null;
        renameDraft.value = "";
      }
      showToast("Removed", "success");
      return;
    } catch (e: any) {
      showToast(String(e?.message || "Gateway unpin failed"), "error");
      return;
    }
  }

  showToast("Remove failed", "error");
}

function getFileTypeClass(file: DriveFile | null | undefined): string {
  if (isDirEntry(file)) return "type-folder";
  if (isHlsEntry(file)) return "type-video";
  const name = String(file?.name || "");
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext))
    return "type-image";
  if (["mp4", "webm", "mov", "avi", "mkv"].includes(ext)) return "type-video";
  if (["mp3", "wav", "ogg", "flac", "m4a"].includes(ext)) return "type-audio";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "type-archive";
  if (["epub"].includes(ext) || isEpubFile(file)) return "type-book";
  if (["pdf", "doc", "docx", "txt", "md"].includes(ext)) return "type-document";
  return "type-file";
}

function isImageFile(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext);
}

function isVideoFile(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return ["mp4", "webm", "mov", "avi", "mkv"].includes(ext);
}

function videoPosterFor(file: DriveFile): string | undefined {
  const key = contentTargetFor(file);
  if (!key) return undefined;
  if (videoThumbReady.value[key]) return undefined;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">
<defs>
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#0f172a" stop-opacity="0.18"/>
    <stop offset="1" stop-color="#0f172a" stop-opacity="0.34"/>
  </linearGradient>
</defs>
<rect width="320" height="240" rx="18" fill="url(#g)"/>
<g>
  <circle cx="160" cy="120" r="32" fill="none" stroke="#ffffff" stroke-opacity="0.45" stroke-width="2"/>
  <path d="M154 106 L154 134 L178 120 Z" fill="#ffffff" fill-opacity="0.65"/>
</g>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function markVideoThumbReady(file: DriveFile) {
  const key = contentTargetFor(file);
  if (!key) return;
  if (videoThumbReady.value[key]) return;
  videoThumbReady.value = { ...videoThumbReady.value, [key]: true };
}

function getGatewayUrl(cid: string): string {
  const localBase = localIpfsGatewayBase();
  const publicBase = "https://ipfs.io";
  // "gatewayBase" is the Lumen gateway API base (PQ-auth endpoints) and does not
  // necessarily serve IPFS gateway routes like `/ipfs/<cid>`.
  // For previews/streaming, always use an actual IPFS gateway (local if available).
  const base = ipfsConnected.value ? localBase : publicBase;
  if (!base) return "";
  const encoded = encodeIpfsTarget(cid);
  return `${String(base).replace(/\/+$/, "")}/ipfs/${encoded}`;
}

async function sniffContentType(url: string): Promise<string> {
  const target = String(url || "").trim();
  if (!target) return "";

  try {
    const anyWin: any = window as any;
    const httpHead = anyWin?.lumen?.httpHead;
    let ct = "";

    // Prefer the Electron http bridge to avoid CORS issues with local gateways.
    if (typeof httpHead === "function") {
      const res = await httpHead(target, { timeout: 6000 }).catch(() => null);
      const headers =
        res && res.headers && typeof res.headers === "object" ? res.headers : {};
      const headerKey = Object.keys(headers).find(
        (k) => String(k || "").toLowerCase() === "content-type",
      );
      ct = headerKey ? String(headers[headerKey] || "") : "";
    } else {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(target, {
        method: "HEAD",
        signal: controller.signal,
      });
      clearTimeout(t);
      ct = String(res.headers.get("content-type") || "");
    }

    return String(ct || "").toLowerCase();
  } catch {
    return "";
  }
}

async function ensureContentTypeCached(cid: string) {
  const key = String(cid || "").trim();
  if (!key) return;
  if (entryContentTypeCache.value[key]) return;
  if (entryContentTypeInFlight.has(key)) return;

  entryContentTypeInFlight.add(key);
  try {
    const url = getGatewayUrl(key);
    const ct = await sniffContentType(url);
    if (!ct) return;
    entryContentTypeCache.value = { ...entryContentTypeCache.value, [key]: ct };
  } finally {
    entryContentTypeInFlight.delete(key);
  }
}

function isEpubFile(file: DriveFile | null | undefined): boolean {
  const name = String(file?.name || "").toLowerCase();
  if (name.endsWith(".epub")) return true;
  const ct = entryContentTypeCache.value[String(file?.cid || "").trim()] || "";
  return ct.includes("application/epub+zip");
}

function imageMimeFromName(name: string): string {
  const ext =
    String(name || "")
      .split(".")
      .pop()
      ?.toLowerCase() || "";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "bmp") return "image/bmp";
  return "application/octet-stream";
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
    // Avoid fetching huge images into memory: keep blob previews for small images only.
    const gateways = await loadWhitelistedGatewayBases().catch(() => []);
    const got = await (window as any).lumen
      ?.ipfsGet?.(key, { gateways })
      .catch(() => null);
    if (!got?.ok || !Array.isArray(got.data)) return;
    const bytes = new Uint8Array(got.data);
    if (bytes.byteLength <= 0 || bytes.byteLength > 15_000_000) return;

    const blob = new Blob([bytes], { type: imageMimeFromName(file.name) });
    const url = URL.createObjectURL(blob);

    const prev = imagePreviewUrls.value[key];
    if (typeof prev === "string" && prev.startsWith("blob:")) {
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

function getFileIcon(file: DriveFile | null | undefined) {
  if (isDirEntry(file)) return Folder;
  if (isHlsEntry(file)) return FileVideo;
  const name = String(file?.name || "");
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext))
    return FileImage;
  if (["mp4", "webm", "mov", "avi", "mkv"].includes(ext)) return FileVideo;
  if (["mp3", "wav", "ogg", "flac", "m4a"].includes(ext)) return FileAudio;
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return FileArchive;
  if (["epub"].includes(ext) || isEpubFile(file)) return BookOpen;
  if (["pdf", "doc", "docx", "txt", "md"].includes(ext)) return FileText;
  return File;
}

function formatSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function showToast(msg: string, type: "success" | "error" = "success") {
  toast.value = msg;
  toastType.value = type;
  setTimeout(() => {
    toast.value = "";
  }, 2500);
}

function compactError(err: string, maxLen = 120) {
  const clean = String(err || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "";
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, Math.max(0, maxLen - 1)) + "…";
}

function basenameFromPath(p: string) {
  const s = String(p || "").replace(/\\/g, "/").trim();
  const parts = s.split("/").filter(Boolean);
  return parts[parts.length - 1] || s;
}

async function reloadForActiveProfileChange() {
  const seq = ++profileReloadSeq;

  // Reset per-profile UI state.
  exitBrowseSilent();
  selectedFile.value = null;
  renameDraft.value = "";
  driveBackupError.value = "";
  showDriveBackupExportModal.value = false;
  driveBackupExportPassword.value = "";
  driveBackupExportPasswordConfirm.value = "";
  driveBackupExportShowPassword.value = false;
  showDriveBackupImportModal.value = false;
  pendingDriveBackupImport.value = null;
  driveBackupImportPassword.value = "";
  driveBackupImportShowPassword.value = false;
  pendingDriveBackupRestore.value = null;
  showPlansModal.value = false;
  closeSubscribeModal();

  // Reset per-profile gateway state.
  optimisticGatewayPinned.value = {};
  gatewayUsage.value = null;
  gatewayUsageError.value = "";
  gatewayPinned.value = [];
  gatewayPinnedNames.value = {};
  gatewayPinnedError.value = "";
  gatewayBase.value = null;

  // Reload per-profile local state immediately (don't block on network/gateway calls).
  loadFiles();
  loadLocalNames();
  loadDriveBackupMeta();

  await refreshGatewayOverview();
  if (seq !== profileReloadSeq) return;

  // Reload current hosting view.
  if (hosting.value.kind === "gateway") {
    const rows = subscriptionRows.value;
    const current = String(hosting.value.gatewayId || "").trim();
    const stillValid = !!current && rows.some((r) => r.gatewayId === current);
    if (!stillValid) {
      const fallback =
        rows.find((r) => r.status === "active") ||
        rows.find((r) => r.status === "pending") ||
        rows[0] ||
        null;
      if (fallback?.gatewayId) {
        hosting.value = { kind: "gateway", gatewayId: fallback.gatewayId };
      } else {
        hosting.value = { kind: "local", gatewayId: "" };
      }
    }
  }

  if (hosting.value.kind === "gateway") {
    await refreshActiveGatewayData();
    return;
  }

  void checkIpfsStatus();
  void loadStats();
  void loadPinnedFiles();
}
</script>

<style scoped>
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
  color: var(--text-primary);
}

.profile-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 12px;
  margin-bottom: 1rem;
  border: 1px solid var(--border-color);
}

.avatar {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-primary);
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
  background: var(--primary-a08);
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

.nav-item .badge {
  margin-left: auto;
  font-size: 0.7rem;
  background: var(--bg-tertiary);
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
  background: var(--card-bg);
  border-radius: 12px;
  margin-top: 1rem;
  margin-bottom: 0.75rem;
  border: 1px solid var(--border-color);
}

.hosting-panel {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.hosting-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  border-radius: 12px;
  border: 1px solid transparent;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.hosting-row.active {
  background: var(--primary-a08);
  border-color: var(--primary-a25);
}

.hosting-row:hover {
  background: var(--primary-a08);
  border-color: var(--primary-a25);
}

.hosting-main {
  flex: 1;
  display: grid;
  grid-template-columns: 10px 1fr auto;
  align-items: center;
  column-gap: 0.65rem;
  row-gap: 0.3rem;
  padding: 0.75rem 0.85rem;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 12px;
  color: var(--text-secondary);
  text-align: left;
  min-width: 0;
}

.hosting-title {
  grid-column: 2;
  grid-row: 1;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hosting-region {
  grid-column: 3;
  grid-row: 1;
  justify-self: end;
  align-self: center;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 7.5rem;
}

.hosting-dot {
  grid-column: 1;
  grid-row: 1;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ios-red);
  box-shadow: 0 0 0 rgba(239, 68, 68, 0);
}

.hosting-dot.ok {
  background: var(--ios-green);
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.35);
}

.hosting-dot.pending {
  background: var(--ios-orange);
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.35);
}

.hosting-dot.off {
  background: var(--ios-red);
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.2);
}

.hosting-details {
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  border: 1px solid var(--border-light);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.hosting-details:hover {
  background: var(--primary-a08);
  border-color: var(--primary-a15);
  color: var(--accent-primary);
}

.hosting-divider {
  margin: 1rem 0.25rem 0.75rem;
  height: 1px;
  background: var(--border-color);
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
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.hosting-subheader-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border: 1px solid var(--primary-a15);
  background: var(--primary-a08);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--accent-secondary);
  cursor: pointer;
  padding: 0.3rem 0.65rem;
  border-radius: 999px;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.hosting-subheader-action:hover {
  background: var(--primary-a15);
  border-color: var(--primary-a25);
  color: var(--accent-primary);
}

.hosting-empty {
  margin-top: 0.5rem;
  padding: 0.75rem 0.85rem;
  border-radius: 12px;
  border: 1px dashed var(--border-light);
  font-size: 0.75rem;
  color: var(--text-tertiary);
  background: transparent;
}

.hosting-tags {
  grid-column: 2 / -1;
  grid-row: 2;
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  justify-self: start;
  margin-left: 0;
}

.hosting-tag {
  display: inline-flex;
  align-items: center;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  background: var(--primary-a08);
  border: 1px solid var(--primary-a15);
  color: var(--accent-secondary);
  font-size: 0.68rem;
  font-weight: 700;
}

.stats-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  color: var(--text-secondary);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stats-bar {
  height: 6px;
  background: var(--border-color);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.stats-fill {
  height: 100%;
  background: linear-gradient(
    90deg,
    var(--accent-primary) 0%,
    var(--accent-secondary) 100%
  );
  border-radius: 3px;
  transition: width 0.3s;
}

.stats-value {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
}

.source-card {
  margin-top: 0.5rem;
  padding: 0.75rem 0.85rem;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.source-card.local {
  background: linear-gradient(
    135deg,
    rgba(148, 163, 184, 0.06),
    rgba(148, 163, 184, 0.02)
  );
}

.source-card.gateway {
  background: linear-gradient(
    135deg,
    rgba(45, 95, 79, 0.06),
    rgba(45, 95, 79, 0.02)
  );
}

.source-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.source-name {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-primary);
}

.source-pill {
  font-size: 0.65rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
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
  color: var(--text-secondary);
}

.source-row span:last-child {
  font-weight: 600;
  color: var(--text-primary);
}

.source-row.muted {
  color: var(--text-tertiary);
}

.source-row.error {
  color: var(--ios-red);
}

.source-bar {
  height: 5px;
  background: var(--border-color);
  border-radius: 999px;
  overflow: hidden;
  margin-top: 0.25rem;
}

.source-bar-fill {
  height: 100%;
  background: linear-gradient(
    90deg,
    var(--accent-primary) 0%,
    var(--accent-secondary) 100%
  );
  border-radius: 999px;
  transition: width 0.3s ease;
}

.ipfs-status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-radius: 10px;
  background: var(--card-bg);
  border: 1px solid #fecaca;
  color: var(--ios-red);
  font-size: 0.8rem;
  font-weight: 500;
}

.ipfs-status.connected {
  background: var(--card-bg);
  border-color: var(--border-light);
  color: var(--ios-green);
}

.ipfs-status.connected .status-dot {
  background: var(--ios-green);
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ios-red);
}

/* Details modals */
.details-grid {
  display: grid;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
}

.details-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.details-label {
  font-weight: 700;
  color: var(--text-tertiary);
}

.details-value {
  font-weight: 700;
  color: var(--text-primary);
}

.details-value.ok {
  color: var(--ios-green);
}

.details-value.pending {
  color: var(--ios-orange);
}

.details-value.off {
  color: var(--ios-red);
}

.details-section {
  margin-top: 1rem;
  padding: 0.75rem;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
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
  color: var(--text-primary);
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
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
}

.details-muted {
  color: var(--text-tertiary);
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
  background: var(--bg-secondary);
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
  color: var(--text-primary);
  margin: 0;
}

.content-header p {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0.25rem 0 0 0;
}

/* Warning Banner */
.warning-banner {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.875rem 1.25rem;
  margin-bottom: 1.25rem;
  background: linear-gradient(135deg, rgba(255, 149, 0, 0.1) 0%, rgba(255, 149, 0, 0.05) 100%);
  border: 1.5px solid rgba(255, 149, 0, 0.3);
  border-radius: 12px;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.warning-icon {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 149, 0, 0.15);
  border-radius: 8px;
  color: var(--ios-orange);
}

.warning-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.warning-content strong {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
}

.warning-content span {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

/* Search & Filter Bar */
.search-filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  max-width: 400px;
  min-width: 200px;
  padding: 0.5rem 0.75rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  transition: all 0.2s ease;
}

.search-box:focus-within {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--primary-a10);
}

.search-box .search-icon {
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.search-box .search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 0.85rem;
  color: var(--text-primary);
  outline: none;
  min-width: 0;
}

.search-box .search-input::placeholder {
  color: var(--text-tertiary);
}

.clear-search {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: var(--fill-tertiary);
  border-radius: 50%;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.clear-search:hover {
  background: var(--fill-secondary);
  color: var(--text-primary);
}

.filter-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.file-count {
  font-size: 0.8rem;
  color: var(--text-secondary);
  white-space: nowrap;
}

.per-page-select {
  padding: 0.4rem 0.6rem;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.8rem;
  cursor: pointer;
  outline: none;
  transition: all 0.15s ease;
}

.per-page-select:hover {
  border-color: var(--accent-primary);
}

.per-page-select:focus {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 2px var(--primary-a10);
}

/* Pagination */
.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem 0;
  margin-top: 0.5rem;
  flex-wrap: wrap;
}

.page-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.page-btn:hover:not(:disabled) {
  background: var(--hover-bg);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-numbers {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.page-num {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 0.5rem;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.page-num:hover {
  background: var(--hover-bg);
  border-color: var(--accent-primary);
}

.page-num.active {
  background: var(--gradient-primary);
  border-color: var(--accent-primary);
  color: white;
  font-weight: 600;
}

.page-ellipsis {
  padding: 0 0.25rem;
  color: var(--text-tertiary);
  font-size: 0.85rem;
}

.page-info {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-left: 0.5rem;
  white-space: nowrap;
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
  border: 1px solid var(--border-color);
  font-size: 0.875rem;
  color: var(--text-primary);
  background: var(--bg-secondary);
}

.plans-filter-input:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 2px var(--primary-a10);
  background: var(--bg-primary);
}

.plans-list {
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.plan-row {
  display: flex;
  flex-direction: column;
  flex-basis: 100%;
  
  gap: 0.5rem;
  padding: 1rem;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
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
  color: var(--text-primary);
}

.plan-status-badge {
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 600;
  background: var(--bg-primary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.plan-status-badge.active {
  background: var(--fill-success);
  color: var(--ios-green);
  border-color: var(--border-light);
}

.plan-status-badge.pending {
  background: rgba(255, 204, 0, 0.15);
  color: var(--ios-orange);
  border-color: var(--border-light);
}

.plan-gw {
  font-size: 0.8rem;
  color: var(--text-secondary);
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
  color: var(--text-secondary);
}

.plan-meta-line .value {
  font-weight: 500;
  color: var(--text-primary);
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
  gap: 0.75rem;
  margin-top: 0.75rem;
  margin-bottom: 0.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-color);
  flex-direction: column;
}

.plans-search-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: nowrap;
}

.plans-controls-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
  flex-wrap: nowrap;
}

.plans-search-group-primary {
  flex: 1 1 auto;
  min-width: 0;
}

.plans-search-group-sort {
  margin-left: auto;
}

.plans-controls-row-secondary {
  justify-content: flex-end;
}

.plans-search-input {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 40px;
  padding: 0 0.75rem;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  flex: 1 1 auto;
  min-width: 220px;
}

.plans-filter-input {
  border: none;
  outline: none;
  background: transparent;
  font-size: 0.875rem;
  color: var(--text-primary);
  height: 100%;
  min-width: 140px;
}

.plans-search-ico {
  color: var(--text-secondary);
  opacity: 0.7;
}

.plans-filter-select {
  height: 40px;
  padding: 0 0.75rem;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.875rem;
  cursor: pointer;
  outline: none;
  min-width: 180px;
}

.plans-filter-select:hover {
  border-color: var(--accent-primary);
}

.plans-filter-select:focus {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 2px var(--primary-a10);
}

.plans-filter-checkbox {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
  user-select: none;
}

.plans-filter-checkbox input {
  accent-color: var(--accent-primary);
}

@media (max-width: 720px) {
  .plans-controls-row {
    flex-wrap: wrap;
  }

  .plans-search-group {
    flex-wrap: wrap;
  }

  .plans-search-group-sort {
    margin-left: 0;
  }
}

.plans-empty {
  text-align: center;
  padding: 1rem 0.5rem 0.5rem;
}

.plans-empty h4 {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.plans-empty-muted {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.plans-error {
  margin-top: 0.5rem;
  padding: 0.75rem 0.85rem;
  border-radius: 12px;
  border: 1px solid rgba(255, 59, 48, 0.25);
  background: rgba(255, 59, 48, 0.06);
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.plans-error-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
}

.plans-error-text {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.plans-empty-actions {
  margin-top: 0.5rem;
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.plans-grid {
  display: flex;
  flex-direction: column;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.plans-pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 1rem;
  flex-wrap: wrap;
}

.plans-pager-side {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.plans-pager-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.plans-pager-text {
  font-size: 0.8rem;
  color: var(--text-secondary);
  white-space: nowrap;
}

.plans-pager-btn {
  border: 1px solid var(--border-color);
  background: transparent;
  border-radius: 10px;
  padding: 0.4rem 0.6rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.plans-pager-btn:hover:not(:disabled) {
  background: var(--hover-bg);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.plans-pager-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.gateway-card {
  padding: 0.9rem 1rem;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
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
  background: var(--ios-green);
}

.gateway-status-dot.off {
  background: var(--ios-red);
}

.gateway-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
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
  color: var(--text-secondary);
}

.gateway-region {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.18rem 0.55rem;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  font-size: 0.75rem;
  color: var(--text-secondary);
  max-width: 220px;
}

.gateway-region-ico {
  opacity: 0.7;
  flex: 0 0 auto;
}

.gateway-region-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gateway-plans {
  border-top: 1px solid var(--border-color);
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
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.plan-chip.active {
  border-color: var(--ios-green);
  background: var(--fill-success);
  color: var(--ios-green);
}

.plan-chip-name {
  font-weight: 500;
}

.plan-chip-price {
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco,
    Consolas, "Liberation Mono", "Courier New", monospace;
}

.gateway-expand-btn {
  border: 1px solid var(--border-color);
  border-radius: 999px;
  padding: 0.2rem 0.7rem;
  font-size: 0.75rem;
  background: var(--bg-primary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.gateway-expand-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--border-color);
  color: var(--text-primary);
}

.btn-ghost {
  border: 1px solid var(--border-color);
  border-radius: 999px;
  padding: 0.35rem 0.8rem;
  font-size: 0.8rem;
  background: var(--bg-primary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-ghost:hover {
  background: var(--bg-secondary);
  border-color: var(--border-color);
  color: var(--text-primary);
}

.plans-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.9rem;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  font-size: 0.8rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.plans-btn:hover {
  background: var(--bg-primary);
  border-color: var(--border-color);
  color: var(--text-primary);
}

.upload-btn,
.upload-btn-large {
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

.upload-btn:hover,
.upload-btn-large:hover {
  background: linear-gradient(135deg, var(--accent-secondary) 0%, #1a5276 100%);
  box-shadow: 0 6px 16px var(--primary-a40);
  transform: translateY(-1px);
}

.upload-btn input,
.upload-btn-large input {
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
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
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
  background: transparent;
  border: none;
  padding: 0.55rem 0.75rem;
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  font: inherit;
  font-size: 0.85rem;
  color: var(--text-primary);
  user-select: none;
}

.upload-dropdown-item:hover {
  background: var(--bg-secondary);
}

.file-picker-input {
  position: fixed;
  top: -10000px;
  left: -10000px;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.upload-dropdown-item input {
  display: none;
}

.upload-btn-large {
  padding: 1rem 1.75rem;
}

/* Upload Progress */
.upload-progress {
  background: var(--bg-secondary);
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
  color: var(--text-primary);
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
  color: var(--text-secondary);
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

.progress-actions {
  margin-top: 0.35rem;
  display: flex;
  gap: 0.5rem;
}

.progress-cancel-btn {
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-secondary);
  border-radius: 8px;
  padding: 0.4rem 0.7rem;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.progress-cancel-btn:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.progress-cancel-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.progress-bar {
  margin-top: 0.65rem;
  height: 6px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.25);
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  width: 0;
  background: var(--accent-primary);
  transition: width 0.2s ease;
}

/* Fetch Section */
.fetch-section {
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
}

.fetch-card {
  background: linear-gradient(
    135deg,
    var(--bg-secondary) 0%,
    var(--hover-bg) 100%
  );
  border-radius: 20px;
  padding: 3rem;
  text-align: center;
  max-width: 480px;
  width: 100%;
  border: 1px solid var(--border-color);
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
  box-shadow: 0 4px 12px var(--primary-a25);
}

.fetch-input-group {
  display: flex;
  gap: 0.5rem;
  margin-top: 1.5rem;
}

.fetch-input {
  flex: 1;
  padding: 0.875rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 0.875rem;
  color: var(--text-primary);
  background: var(--card-bg);
}

.fetch-input:focus {
  outline: none;
  border-color: var(--ios-blue);
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
  color: var(--ios-red);
  margin-top: 1rem;
}

/* Files Grid */
.files-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 0.75rem;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  padding: 0.75rem;
  align-content: start;
  background: var(--bg-primary);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
}

.file-card {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 0.6rem;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease,
    transform 0.2s ease;
  min-width: 0;
  border: 1px solid var(--border-light);
  height: fit-content;
  position: relative;
  content-visibility: auto;
  contain-intrinsic-size: 180px 140px;
}

.file-card:hover {
  background: var(--bg-primary);
  border-color: var(--primary-a25);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.file-card.selected {
  background: var(--fill-blue);
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 2px var(--primary-a15);
}

.file-preview {
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  margin-bottom: 0.5rem;
  background: var(--bg-secondary);
  color: var(--text-tertiary);
  overflow: hidden;
  position: relative;
  border: 1px solid var(--border-color);
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

.file-preview.type-image {
  color: var(--ios-orange);
  background: var(--card-bg);
}
.file-preview.type-video {
  color: var(--ios-pink);
  background: var(--card-bg);
}
.file-preview.type-audio {
  color: #af52de;
  background: var(--card-bg);
}
.file-preview.type-archive {
  color: #34c759;
  background: var(--card-bg);
}
.file-preview.type-book {
  color: #f59e0b;
  background: var(--card-bg);
}
.file-preview.type-document {
  color: #0071e3;
  background: var(--card-bg);
}
.file-preview.type-folder {
  color: #8e8e93;
  background: var(--card-bg);
}
.file-preview.type-file {
  color: #86868b;
  background: var(--card-bg);
}

.file-info {
  margin-bottom: 0.25rem;
}

.file-name {
  font-size: 0.75rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
}

.file-meta {
  font-size: 0.65rem;
  color: var(--text-secondary);
  margin-top: 0.1rem;
}

.file-actions {
  display: flex;
  gap: 0.25rem;
  justify-content: flex-end;
  margin-top: 0.35rem;
  padding-top: 0.35rem;
  border-top: 1px solid transparent;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.file-card:hover .file-actions,
.file-card.selected .file-actions {
  border-top-color: var(--border-light);
  opacity: 1;
  pointer-events: auto;
}

.action-btn {
  padding: 0.5rem 0.625rem;
  border: none;
  background: var(--fill-tertiary);
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-primary);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.action-btn::after {
  content: "";
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 1px;
  height: 14px;
  background: var(--border-color);
  opacity: 0.6;
}

.action-btn:last-child::after {
  display: none;
}

.action-btn:hover {
  background: var(--accent-primary);
  color: #ffffff;
  transform: scale(1.05);
}

.action-btn:active {
  transform: scale(0.98);
}

.action-btn.danger {
  background: rgba(255, 59, 48, 0.1);
  color: var(--error-red);
}

.action-btn.danger:hover {
  background: var(--error-red);
  color: #ffffff;
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
  background: var(--bg-secondary);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  margin-bottom: 1rem;
}

/* Detail Panel */
.detail-panel {
  width: 280px;
  min-width: 280px;
  max-width: 280px;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  margin: 0;
  border-radius: 0;
  flex-shrink: 0;
  border-left: 1px solid var(--border-color);
  min-height: 0;
  overflow-y: auto;
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
  border: 1px solid var(--border-light);
  background: transparent;
  cursor: pointer;
  color: var(--text-tertiary);
  border-radius: 8px;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.close-btn:hover {
  background: rgba(255, 59, 48, 0.12);
  border-color: rgba(255, 59, 48, 0.25);
  color: var(--ios-red);
}

.detail-preview {
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  margin-bottom: 1.25rem;
  background: var(--bg-secondary);
  color: var(--text-tertiary);
  overflow: hidden;
  border: 1px solid var(--border-light);
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
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.info-value {
  font-size: 0.8rem;
  color: var(--text-primary);
  font-weight: 500;
}

.name-input {
  width: 100%;
  padding: 0.55rem 0.65rem;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 0.85rem;
  font-weight: 500;
}

.name-input:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--primary-a15);
  background: var(--bg-primary);
}

.info-value.cid {
  font-family: "SF Mono", "Consolas", monospace;
  font-size: 0.7rem;
  word-break: break-all;
  background: var(--bg-secondary);
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
  color: var(--accent-primary);
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
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  border-radius: 10px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-secondary);
}

.detail-btn:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
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

.toast-enter-active,
.toast-leave-active {
  transition: all 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 10px);
}

/* Drop Overlay */
.drop-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
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
  background: var(--hover-bg);
  border-radius: 10px;
  padding: 4px;
  border: 1px solid var(--border-color);
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
  color: var(--text-tertiary);
  transition: all 0.2s;
}

.view-btn:hover {
  color: var(--text-secondary);
}

.view-btn.active {
  background: var(--bg-primary);
  color: var(--accent-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* List View */
.files-list {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  flex: 1;
  background: var(--bg-primary);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
  min-height: 0;
}

.list-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--hover-bg);
  border-bottom: 1px solid var(--border-color);
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
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
  width: 180px;
  min-width: 180px;
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.list-actions-header {
  width: 160px;
  min-width: 160px;
}

.list-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 1rem;
  cursor: pointer;
  transition: all 0.1s;
  border-bottom: 1px solid var(--hover-bg);
  content-visibility: auto;
  contain-intrinsic-size: 920px 56px;
}

.list-item:last-child {
  border-bottom: none;
}

.list-item:hover {
  background: var(--primary-a08);
}

.list-item.selected {
  background: var(--fill-blue);
}

.list-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.list-thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
}

.list-thumbnail-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
  background: var(--bg-secondary);
  display: block;
}

.list-name {
  flex: 1;
  min-width: 0;
  font-size: 0.85rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
}

.list-size {
  font-size: 0.8rem;
  color: var(--text-secondary);
  width: 80px;
  min-width: 80px;
  text-align: right;
  flex-shrink: 0;
}

.list-date {
  font-size: 0.8rem;
  color: var(--text-secondary);
  width: 180px;
  min-width: 180px;
  text-align: right;
  flex-shrink: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.list-actions {
  display: flex;
  gap: 0.25rem;
  width: 160px;
  min-width: 160px;
  justify-content: flex-end;
  flex-wrap: nowrap;
  flex-shrink: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.list-item:hover .list-actions {
  opacity: 1;
  pointer-events: auto;
}

.list-item.selected .list-actions {
  opacity: 1;
  pointer-events: auto;
}

/* Details Table View */
.files-table-wrapper {
  flex: 1;
  overflow: auto;
  background: var(--bg-primary);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  min-height: 0;
  box-shadow: var(--shadow-sm);
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
  background: var(--hover-bg);
  z-index: 1;
}

.files-table th {
  text-align: left;
  padding: 0.875rem 1rem;
  font-weight: 600;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
}

.files-table td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
}

.files-table tbody tr {
  cursor: pointer;
  transition: background 0.1s;
}

.files-table {
  width: 100%;
  min-width: 700px;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 1rem;
  table-layout: fixed;
  background: var(--card-bg, #fff);
  border-radius: 14px;
  box-shadow: var(--shadow-md);
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.files-table tbody tr.selected {
  background: var(--fill-blue);
}

.files-table th {
  text-align: left;
  padding: 1rem 1.25rem;
  font-weight: 700;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-tertiary);
  border-bottom: 2px solid var(--separator);
  background: var(--bg-primary);
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(20px) saturate(180%);
  box-shadow: 0 2px 8px -2px rgba(0, 0, 0, 0.06);
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
  background: var(--bg-secondary);
  color: var(--text-secondary);
  flex-shrink: 0;
  overflow: hidden;
}

.table-thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 6px;
}

.table-thumbnail-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 6px;
  background: var(--bg-secondary);
  display: block;
}

.td-size,
.th-size {
  width: 100px;
  min-width: 100px;
  text-align: right;
}

.td-size {
  color: var(--text-tertiary);
}

.td-date,
.th-date {
  width: 160px;
  min-width: 160px;
  text-align: right;
}

.td-date {
  color: var(--text-tertiary);
  font-size: 0.75rem;
}

.td-actions,
.th-actions {
  width: 120px;
  min-width: 120px;
  text-align: center;
}

.td-actions {
  width: 100px;
}

.td-actions {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.files-table tbody tr:hover .td-actions,
.files-table tbody tr.selected .td-actions {
  opacity: 1;
  pointer-events: auto;
}

.td-actions .action-btn {
  margin: 0 0.125rem;
}

.td-actions .action-btn:first-child {
  margin-left: 0;
}

.td-actions .action-btn:last-child {
  margin-right: 0;
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
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
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
  background: var(--bg-primary);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-content.plans-modal {
  max-width: 860px;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: var(--hover-bg);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.modal-close:hover {
  background: var(--border-color);
  color: var(--text-primary);
}

.modal-body {
  padding: 1.5rem;
}

.modal-desc {
  color: var(--text-secondary);
  font-size: 0.875rem;
  margin-bottom: 1.5rem;
}

.drive-backup-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.drive-backup-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.drive-backup-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.drive-backup-input {
  width: 100%;
  padding: 0.75rem 0.85rem;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 0.9rem;
}

.drive-backup-input:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--primary-a15);
  background: var(--bg-primary);
}

.drive-backup-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-secondary);
  font-size: 0.85rem;
  user-select: none;
}

.drive-backup-toggle input {
  accent-color: var(--accent-primary);
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem 1.5rem;
  border-top: 1px solid var(--border-color);
}

.btn-modal-primary {
  flex: 1;
  padding: 0.875rem;
  border: none;
  border-radius: 10px;
  background: var(--gradient-primary);
  color: white;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  border-bottom: 1px solid var(--separator);
  position: relative;
}

.btn-modal-secondary {
  flex: 1;
  padding: 0.875rem;
  border-radius: 10px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.files-table tbody tr:nth-child(even) {
  background: var(--fill-tertiary);
}

.files-table tbody tr:hover {
  background: var(--hover-bg);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px -6px rgba(0, 0, 0, 0.12), 0 2px 4px -2px rgba(0, 0, 0, 0.06);
  z-index: 1;
}

.files-table tbody tr.selected {
  background: linear-gradient(90deg, var(--fill-blue) 0%, var(--fill-blue) 97%, transparent 100%) !important;
  box-shadow: inset 3px 0 0 0 var(--accent-primary), inset 0 0 0 1px var(--primary-a20);
  position: relative;
}

.files-table tbody tr.selected:hover {
  background: linear-gradient(90deg, var(--primary-a30) 0%, var(--primary-a25) 97%, transparent 100%) !important;
  box-shadow: inset 3px 0 0 0 var(--accent-primary), inset 0 0 0 1px var(--primary-a35), 0 4px 16px -6px rgba(0, 0, 0, 0.15), 0 2px 4px -2px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
  z-index: 2;
}

.files-table tbody tr.selected td {
  border-bottom-color: transparent;
}

.files-table td {
  padding: 0.875rem 1.25rem;
  border-bottom: 1px solid var(--separator);
  color: var(--text-primary);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  vertical-align: middle;
}

.files-table tbody tr:last-child td {
  border-bottom: none;
}

.btn-modal-secondary:hover:not(:disabled) {
  background: var(--bg-secondary);
  border-color: var(--border-color);
  color: var(--text-primary);
}

.btn-modal-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.upload-path-textarea {
  width: 100%;
  padding: 0.75rem;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 0.875rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
  resize: vertical;
  outline: none;
}

.upload-path-textarea:focus {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--primary-a15);
}

.permalink-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  font-weight: 500;
  color: var(--text-primary);
  width: 100%;
  min-height: 220px;
  vertical-align: middle;
}

.listing-loading {
  flex: 1;
  min-height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 56px;
}

.drive-spinner {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 3px solid rgba(148, 163, 184, 0.28);
  border-top-color: var(--accent-primary);
  animation: drive-spin 0.9s linear infinite;
}

@keyframes drive-spin {
  to {
    transform: rotate(360deg);
  }
}

.td-name span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
  font-size: 0.9375rem;
  font-weight: 500;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  letter-spacing: -0.005em;
}

.files-table tbody tr:hover .td-name span {
  color: var(--accent-primary);
  font-weight: 600;
  letter-spacing: 0;
  text-shadow: 0 0 1px rgba(0, 0, 0, 0.05);
}

.files-table tbody tr.selected .td-name span {
  color: var(--accent-primary);
  font-weight: 700;
  letter-spacing: 0;
  text-shadow: 0 0 1px rgba(0, 0, 0, 0.05);
}

.table-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  color: var(--text-secondary);
  opacity: 0.7;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.files-table tbody tr:hover .table-icon {
  opacity: 1;
  color: var(--accent-primary);
  transform: scale(1.1);
}

.files-table tbody tr.selected .table-icon {
  color: var(--accent-primary);
  opacity: 1;
  transform: scale(1.05);
}

.td-size {
  color: var(--text-secondary);
  font-size: 0.875rem;
  min-width: 100px;
  width: 15%;
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  letter-spacing: 0.01em;
  transition: color 0.2s ease;
}

.files-table tbody tr:hover .td-size,
.files-table tbody tr.selected .td-size {
  color: var(--text-primary);
}

.td-date {
  color: var(--text-secondary);
  font-size: 0.875rem;
  min-width: 160px;
  width: 25%;
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  letter-spacing: 0.01em;
  transition: color 0.2s ease;
}

.files-table tbody tr:hover .td-date,
.files-table tbody tr.selected .td-date {
  color: var(--text-primary);
}
.td-actions {
  color: var(--text-tertiary);
  font-size: 0.9375rem;
  min-width: 140px;
  width: 15%;
  text-align: center;
  padding: 0 !important;
}

.files-table tbody tr .td-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.files-table tbody tr:hover .td-actions,
.files-table tbody tr.selected .td-actions {
  gap: 0.25rem;
}

.files-table td:empty::after {
  content: "—";
  color: var(--text-quaternary);
  font-size: 1em;
}

</style>
