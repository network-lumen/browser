<template>
  <!-- ####### lumen://drive DRIVE ####### -->
  <div class="internal-page flex">
    <!-- ####### lumen://drive SIDEBAR ####### -->
    <InternalSidebar title="Drive" :icon="Cloud" activeKey="drive">
      <!-- Hosting -->
      <div class="flex flex-column gap-6px mt-12px">
        <div class="flex-align-center gap-8px color-text-secondary text-uppercase mb-12px text-11px letter-spacing-005em">
          <Database :size="14" />
          <span>Storage</span>
        </div>

        <div class="hover-active-bg-primary-a10-border-a20 transition-colors-015 flex-align-center gap-8px border-radius-12px mt-8px border-1-transparent" :class="{ active: hosting.kind === 'local' }">
          <UiButton variant="none" type="button"
            @click="selectHosting('local')" class="grid-cols-10px-1fr-auto grid gap-x-10px gap-y-4px flex-1 min-w-0 bg-transparent border-none cursor-pointer text-left py-8px px-10px">
            <span
              class="grid-col-1 grid-row-1 border-radius-circle w-8px h-8px bg-error shadow-0-0-0-error-a0"
              :class="ipfsConnected ? 'status-dot-ok' : 'status-dot-off'"
            ></span>
            <span class="grid-col-2 grid-row-1 text-14px txt-weight-medium color-text-primary truncate">Local</span>
          </UiButton>
          <UiButton variant="icon" icon-radius-class="border-radius-10px"
            @click.stop="openLocalDetails"
            title="Local details" class="hover-border-primary-a15 flex-inline-align-justify-center size-32px">
            <TableProperties :size="16" />
          </UiButton>
        </div>

        <div class="h-1px bg-border m-0px mt-16px mr-4px mb-12px ml-4px"></div>

        <div class="flex-align-center-justify-space-between mt-4px">
          <span class="txt-weight-medium color-text-tertiary text-uppercase text-11px letter-spacing-005em">Subscriptions</span>
          <UiButton variant="none" type="button"
            @click="openPlansModal" class="bg-transparent border-none cursor-pointer color-primary text-11px fw-500 py-4px px-8px border-radius-10px hover-bg-primary-a15">
            Cloud
          </UiButton>
        </div>

        <div v-if="!subscriptionRows.length" class="border-radius-12px text-12px color-text-tertiary mt-8px bg-transparent py-12px px-16px border-1-dashed-light">
          No active subscriptions yet.
        </div>

        <div
          v-for="sub in subscriptionRows"
          :key="sub.gatewayId"
          class="hover-active-bg-primary-a10-border-a20 transition-colors-015 flex-align-center gap-8px border-radius-12px mt-8px border-1-transparent"
          :class="{ active: hosting.kind === 'gateway' && hosting.gatewayId === sub.gatewayId, }"
        >
          <UiButton variant="none" type="button"
              @click="selectGateway(sub.gatewayId)" class="grid-cols-10px-1fr-auto grid gap-x-10px gap-y-4px flex-1 min-w-0 bg-transparent border-none cursor-pointer text-left py-8px px-10px">
              <span class="grid-col-1 grid-row-1 border-radius-circle w-8px h-8px bg-error shadow-0-0-0-error-a0" :class="sub.statusDot"></span>
              <span class="grid-col-2 grid-row-1 text-14px txt-weight-medium color-text-primary truncate" :title="sub.hoverTitle">{{
                sub.label
              }}</span>
              <span
                v-if="sub.regionLabel"
                class="grid-col-3 grid-row-1 justify-self-end txt-weight-medium color-text-tertiary text-12px truncate align-self-center max-w-1275px"
                :title="sub.regionTitle"
              >
                {{ sub.regionLabel }}
              </span>
              <span class="grid-col-2-end grid-row-2 justify-self-start inline-flex flex-wrap-wrap gap-6px" v-if="sub.planTags.length">
                <UiTag v-for="p in sub.planTags" :key="p" variant="accent">{{
                  p
                }}</UiTag>
              </span>
          </UiButton>
          <UiButton variant="icon" icon-radius-class="border-radius-10px"
            @click.stop="openGatewayDetails(sub.gatewayId)"
            title="Subscription details" class="hover-border-primary-a15 flex-inline-align-justify-center size-32px">
            <TableProperties :size="16" />
          </UiButton>
        </div>
      </div>

      <div class="flex flex-column gap-6px mt-16px">
        <div class="h-1px bg-border m-0px mb-12px"></div>
        <UiButton variant="none" type="button"
          @click="openSiteDataModal" class="flex-align-center-justify-space-between gap-8px bg-transparent border-none cursor-pointer text-left py-4px px-0px hover-color-primary">
          <span class="flex-align-center gap-8px color-text-secondary text-uppercase text-11px letter-spacing-005em">
            <Globe :size="14" />
            <span>Sites data</span>
          </span>
          <UiTag v-if="siteDataRecords.length" variant="neutral">{{ siteDataRecords.length }}</UiTag>
        </UiButton>
      </div>
    </InternalSidebar>

    <!-- ####### lumen://drive FILE BROWSER ####### -->
    <main class="flex flex-column flex-1 m-0px min-w-0 overflow-hidden py-32px px-40px bg-secondary border-radius-0">
      <!-- Header -->
      <UiPageHeader :title="headerTitle" :subtitle="headerSubtitle">
        <template #actions>
          <UiButton variant="secondary" type="button" @click="openPlansModal">
            <Database :size="16" />
            <span>Cloud</span>
          </UiButton>

          <div class="inline-flex relative" @click.stop>
            <UiButton variant="primary" type="button" @click="toggleUploadMenu" class="hover-bg-gradient-accent-secondary-lift shadow-primary">
              <Plus :size="18" />
              <span>Upload</span>
            </UiButton>
            <div v-if="showUploadMenu" class="top-calc-100pct-05rem border-radius-12px absolute bg-primary border-1 p-4px z-100 right-0 min-w-190px shadow-lg" @click.stop>
              <UiMenuItem @click="openFilePicker">
                Upload files
              </UiMenuItem>
              <UiMenuItem @click="openFolderPicker">
                Upload folder
              </UiMenuItem>
            </div>
          </div>
        </template>
      </UiPageHeader>

      <!-- Privacy Warning Banner -->
      <div class="bg-gradient-warning-banner animate-fade-in flex-align-center gap-16px mb-20px border-radius-12px py-12px px-20px border-15-warning-a30">
        <div class="flex-align-justify-center size-36px color-warning flex-shrink-0 border-radius-8px bg-warning-a15">
          <AlertTriangle :size="20" />
        </div>
        <div class="flex flex-column flex-1 gap-4px">
          <strong class="text-14px txt-weight-light color-text-primary">Privacy Notice:</strong>
          <span class="text-14px color-text-secondary line-height-14">Everything uploaded on Lumen is public. Don't upload personal files.</span>
        </div>
      </div>

      <!-- Search and Filter Bar -->
      <div class="flex-align-center-justify-space-between flex-wrap-wrap gap-16px mb-16px">
        <div class="flex-align-center gap-8px flex-1 border-radius-10px py-8px px-12px bg-primary border-1 transition-all-02 focus-within-border-accent focus-within-ring max-w-400px min-w-200px">
          <Search :size="16" class="color-text-tertiary flex-shrink-0" />
          <input
            v-model="searchQuery"
            type="text"
            class="flex-1 border-none bg-transparent text-14px color-text-primary outline-none min-w-0 placeholder-tertiary"
            placeholder="Search files..."
            @input="currentPage = 1"
          />
          <UiButton variant="icon" v-if="searchQuery" @click="searchQuery = ''; currentPage = 1" class="color-error hover-bg-error-a10-color-error">
            <X :size="14" />
          </UiButton>
        </div>
        <div class="flex-align-center gap-12px">
          <span class="color-text-secondary text-13px nowrap">{{ filteredFiles.length }} {{ filteredFiles.length === 1 ? 'file' : 'files' }}</span>
          <select v-model="itemsPerPage" class="hover-border-accent color-text-primary cursor-pointer outline-none border-radius-8px border-1 bg-primary text-13px transition-all-fast py-8px px-10px focus-border-primary focus-ring focus-outline-none focus-shadow" @change="currentPage = 1">
            <option :value="10">10 per page</option>
            <option :value="20">20 per page</option>
            <option :value="50">50 per page</option>
            <option :value="100">100 per page</option>
          </select>
        </div>
      </div>

      <div v-if="canUseLocalMultiSelect && selectedLocalCount > 0" class="bg-gradient-panel flex-align-center flex-wrap-wrap mb-16px gap-12px border-radius-14px border-1 shadow-sm py-12px px-16px" :class="{ 'ring-primary-a10 border-color-primary-a30': selectedLocalCount > 0 }">
        <UiCheckbox boxed title="Select visible entries" :model-value="allVisibleLocalEntriesSelected" @update:model-value="toggleVisibleLocalSelection" />
        <div class="flex flex-column gap-2px min-w-0">
          <strong class="text-14px color-text-primary">{{ selectedLocalCount }} selected</strong>
          <span class="text-12px color-text-secondary" v-if="canBulkConvertSelectedLocal">
            {{ selectedLocalConvertibleCount }} video{{ selectedLocalConvertibleCount === 1 ? "" : "s" }} ready for HLS
          </span>
        </div>
        <div class="flex-align-center flex-wrap-wrap gap-8px">
          <UiButton variant="secondary" type="button"
            :disabled="!selectedLocalCount"
            @click="clearLocalSelection" class="disabled-fade-50">
            Clear
          </UiButton>
          <UiButton variant="primary" v-if="canBulkConvertSelectedLocal"
            type="button"
            @click="convertSelectedLocalToHls" class="disabled-fade-50">
            Convert to HLS
            <UiCountPill v-if="selectedLocalConvertibleCount" :count="selectedLocalConvertibleCount" pill-class="h-24px color-white txt-weight-medium text-12px bg-black-a35 p-0px pr-4px pl-4px min-w-24px" />
          </UiButton>
          <UiButton variant="danger" type="button"
            :disabled="!canBulkRemoveSelectedLocal"
            @click="removeSelectedLocalFiles" class="disabled-fade-50">
            Remove selected
          </UiButton>
        </div>
      </div>

      <!-- Breadcrumb (folders) -->
      <div v-if="isBrowsing" class="flex-align-center gap-12px mb-12px p-0px pt-8px pb-8px">
        <UiButton variant="secondary" type="button" @click="exitBrowse">
          Back
        </UiButton>
        <div class="flex-align-center flex-wrap-wrap gap-6px min-w-0">
          <UiButton variant="ghost" type="button" @click="exitBrowse" class="hover-color-accent nowrap">
            {{ browseHostingLabel }}
          </UiButton>
          <span class="color-text-secondary">/</span>
          <UiButton variant="ghost" type="button" @click="openBrowseAt('')" class="hover-color-accent nowrap">
            {{ browseRootLabel }}
          </UiButton>
          <template v-for="c in browseCrumbs" :key="c.path">
            <span class="color-text-secondary">/</span>
            <UiButton variant="ghost" type="button" @click="openBrowseAt(c.path)" class="hover-color-accent nowrap">
              {{ c.label }}
            </UiButton>
          </template>
        </div>
      </div>

      <UiLoadingBlock v-if="browseLoading" wrapper-class="flex-1 min-h-280px" spinner-class="" />

      <div v-else-if="browseError" class="text-11px line-height-12 color-error mt-16px">
        {{ browseError }}
      </div>

      <!-- Upload Progress -->
      <div v-for="(upload, key) in uploadActivitiesComputed" :key="key" class="border-radius-10px mb-16px bg-secondary py-16px px-20px">
        <div class="flex-align-center gap-16px" >
          <UiSpinner size="sm" />
          <div class="flex flex-column gap-4px">
            <span class="text-12px line-height-12 txt-weight-strong">Uploading {{ upload?.uploadingFile }} </span>
            <span class="text-11px line-height-12 color-text-tertiary">
              <template v-if="upload?.uploadingPercent != null">
                ({{ upload?.uploadingPercent }}%)
              </template>
            </span>
            <div class="flex gap-8px mt-8px">
              <UiButton variant="secondary" type="button"
                @click="cancelUpload(key)"
                :disabled="upload?.uploadingCanceling" class="disabled-fade-50">
                {{ upload?.uploadingCanceling ? "Cancelling..." : "Cancel" }}
              </UiButton>
            </div>
          </div>
        </div>
        <div v-if="upload?.uploadingPercent != null" class="h-6px border-radius-full bg-fill-secondary overflow-hidden mt-8px">
          <div
            class="transition-width-02 h-full bg-accent w-0"
            :style="{ width: `${upload?.uploadingPercent}%` }"
          ></div>
        </div>
      </div>

      <!-- HLS Conversion Progress -->
      <div v-if="converting" class="border-radius-10px mb-16px bg-secondary py-16px px-20px">
        <div class="flex-align-center gap-16px">
          <UiSpinner size="sm" />
          <div class="flex flex-column gap-4px">
            <span class="text-12px line-height-12 txt-weight-strong"
              >Converting {{ convertingFile }}</span
            >
            <span class="text-11px line-height-12 color-text-tertiary"
              >Warning: this can take a while.</span
            >
            <span class="text-11px line-height-12 color-text-tertiary">
              {{ convertingStatusText }}
            </span>
            <div class="flex gap-8px mt-8px">
              <UiButton variant="secondary" type="button"
                @click="pauseHlsQueue"
                :disabled="convertingCanceling || convertingPauseRequested" class="disabled-fade-50">
                {{
                  convertingPauseRequested ? "Pausing..." : "Pause"
                }}
              </UiButton>
              <UiButton variant="secondary" type="button"
                @click="cancelHlsConversion"
                :disabled="convertingCanceling || convertingPauseRequested" class="disabled-fade-50">
                {{ convertingCanceling ? "Cancelling..." : "Cancel" }}
              </UiButton>
            </div>
          </div>
        </div>
        <div v-if="convertingPercent != null" class="h-6px border-radius-full bg-fill-secondary overflow-hidden mt-8px">
          <div
            class="transition-width-02 h-full bg-accent w-0"
            :style="{ width: `${convertingPercent}%` }"
          ></div>
        </div>
      </div>

      <div v-if="hlsQueueVisible" class="bg-gradient-panel flex flex-column gap-12px mb-16px p-16px border-radius-14px border-1 shadow-sm">
        <div class="flex-align-start gap-16px flex-justify-space-between">
          <div class="flex flex-column gap-2px min-w-0">
            <strong class="text-14px color-text-primary">HLS queue</strong>
            <span class="text-12px color-text-secondary">{{ hlsQueueSummaryText() }}</span>
          </div>
          <div class="flex-inline-align-center flex-wrap-wrap gap-8px flex-justify-end">
            <UiButton variant="secondary" v-if="hlsQueueCanPause"
              type="button"
              @click="pauseHlsQueue"
              :disabled="convertingPauseRequested" class="hover-border-color-accent-enabled disabled-fade-50">
              <Pause :size="14" />
              <span>{{ convertingPauseRequested ? "Pausing..." : "Pause" }}</span>
            </UiButton>
            <UiButton variant="secondary" v-if="hlsQueueCanResume"
              type="button"
              @click="resumeHlsQueue" class="hover-border-color-accent-enabled disabled-fade-50">
              <Play :size="14" />
              <span>Resume</span>
            </UiButton>
            <UiButton variant="secondary" type="button"
              @click="clearHlsQueue"
              :disabled="!hlsQueue.length" class="hover-border-color-accent-enabled disabled-fade-50">
              {{ converting ? "Clear finished" : "Clear queue" }}
            </UiButton>
          </div>
        </div>

        <div class="flex flex-column gap-8px">
          <div
            v-for="item in visibleHlsQueueItems"
            :key="item.id"
            class="flex-align-center-justify-space-between gap-12px border-radius-12px bg-primary border-1-light py-12px px-16px"
            :style="hlsQueueItemStyle(item.status)"
          >
            <div class="flex flex-column gap-2px min-w-0">
              <span class="txt-weight-light color-text-primary text-13px truncate">{{ item.file.name }}</span>
              <span v-if="item.error && item.status === 'failed'" class="color-error text-12px">
                {{ compactError(item.error) }}
              </span>
            </div>
            <span class="flex-inline-align-center txt-weight-medium color-text-secondary gap-8px flex-shrink-0 text-12px" :style="hlsQueueStatusTextStyle(item.status)">
              <UiSpinner v-if="item.status === 'converting'" size="sm" />
              <span>{{ hlsQueueStatusLabel(item) }}</span>
            </span>
          </div>
        </div>

        <div v-if="hlsQueue.length > visibleHlsQueueItems.length" class="color-text-secondary text-12px">
          +{{ hlsQueue.length - visibleHlsQueueItems.length }} more item{{ hlsQueue.length - visibleHlsQueueItems.length === 1 ? "" : "s" }}
        </div>
      </div>

      <div v-if="archiveDownloading" class="border-radius-10px mb-16px bg-secondary py-16px px-20px">
        <div class="flex-align-center gap-16px">
          <UiSpinner size="sm" />
          <div class="flex flex-column gap-4px">
            <span class="text-12px line-height-12 txt-weight-strong">
              Downloading {{ archiveDownloadFile }}
            </span>
            <span class="text-11px line-height-12 color-text-tertiary">
              {{ archiveDownloadStatusText }}
            </span>
            <div class="flex gap-8px mt-8px">
              <UiButton variant="secondary" type="button"
                @click="cancelHlsArchiveDownload"
                :disabled="archiveDownloadCanceling" class="disabled-fade-50">
                {{ archiveDownloadCanceling ? "Cancelling..." : "Cancel" }}
              </UiButton>
            </div>
          </div>
        </div>
        <div v-if="archiveDownloadPercent != null" class="h-6px border-radius-full bg-fill-secondary overflow-hidden mt-8px">
          <div
            class="transition-width-02 h-full bg-accent w-0"
            :style="{ width: `${archiveDownloadPercent}%` }"
          ></div>
        </div>
      </div>

      <UiLoadingBlock v-if="showSavedListSpinner" wrapper-class="flex-1 min-h-280px" spinner-class="" />

      <!-- Files List View -->
      <div
        v-else-if="!showSavedListSpinner && !browseLoading && displayFiles.length > 0 "
        class="flex flex-column flex-1 border-radius-12px overflow-y-auto bg-primary border-1 shadow-sm min-h-0"
      >
        <!-- List Header -->
        <div class="sticky flex-align-center gap-12px txt-weight-light text-uppercase color-text-secondary py-12px px-16px bg-secondary border-bottom-1 text-11px letter-spacing-005em top-0 z-1">
          <div v-if="canUseLocalMultiSelect" class="flex flex-inline-align-center flex-justify-center flex-shrink-0 w-24px min-w-24px">
            <UiCheckbox boxed title="Select visible entries" :model-value="allVisibleLocalEntriesSelected" @update:model-value="toggleVisibleLocalSelection" />
          </div>
          <div class="size-32px flex-shrink-0"></div>
          <span class="flex-1 min-w-0">Name</span>
          <span class="w-80px text-right min-w-80px">Size</span>
          <span class="text-right truncate min-w-180px w-180px">Date Added</span>
          <div class="min-w-160px w-160px"></div>
        </div>
        <!-- List Items -->
        <div
          v-for="file in displayFiles"
          :key="file.cid"
          class="reveal-on-hover hover-bg-primary-a10 content-visibility-auto-920-56 last-border-bottom-none transition-all-fast flex-align-center gap-12px cursor-pointer py-10px px-16px border-bottom-1-hover-bg"
          @click="handleEntryClick(file)"
          :class="{ 'selected bg-fill-blue': selectedFile?.cid === file.cid, 'bg-primary-a05-selected': isLocalFileSelected(file), }"
        >
          <div v-if="canUseLocalMultiSelect" class="flex flex-inline-align-center flex-justify-center flex-shrink-0 w-24px min-w-24px" @click.stop>
            <UiCheckbox boxed :model-value="isLocalFileSelected(file)" @update:model-value="(checked: boolean) => setLocalFileSelected(file, checked)" />
          </div>
          <div class="flex-align-justify-center size-32px color-text-secondary border-radius-6px bg-transparent flex-shrink-0" :class="getFileTypeClass(file)">
            <!-- Show small thumbnail for images -->
            <img
              v-if="isImageFile(file.name)"
              :src="getImageSrc(file)"
              :alt="file.name"
              class="w-full h-full object-fit-cover border-radius-4px"
              loading="lazy"
              decoding="async"
              fetchpriority="low"
              @error="() => onImageError(file)"
            />
            <video
              v-else-if="isVideoFile(file.name)"
              :src="getGatewayUrl(contentTargetFor(file))"
              class="w-full h-full object-fit-cover border-radius-4px bg-secondary block"
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
              class="w-full h-full object-fit-cover border-radius-4px"
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
          <span class="flex-1 text-14px fw-500 color-text-primary min-w-0 truncate">{{ file.name }}</span>
          <span class="color-text-secondary w-80px text-right text-13px flex-shrink-0 min-w-80px">{{ formatSize(file.size) }}</span>
          <span class="color-text-secondary text-right text-13px flex-shrink-0 truncate min-w-180px w-180px">{{
            file.uploadedAt ? formatDate(file.uploadedAt) : "—"
          }}</span>
          <div class="reveal-actions-target divide-x-border flex-justify-end gap-4px flex-shrink-0 cursor-events-none transition-opacity-02 opacity-0 flex-wrap-nowrap min-w-160px w-160px">
            <UiButton variant="icon" icon-radius-class="border-radius-10px" icon-padding-class="p-4px" v-if="!isBrowsing && isDirEntry(file)"
              title="Details"
              @click.stop="openEntryDetails(file)" class="active-scale-98">
              <TableProperties :size="14" />
            </UiButton>
            <UiButton variant="icon" icon-radius-class="border-radius-10px" icon-padding-class="p-4px" title="Download"
              @click.stop="downloadFile(file)" class="active-scale-98">
              <Download :size="14" />
            </UiButton>
            <UiButton variant="icon" icon-radius-class="border-radius-10px" icon-padding-class="p-4px" v-if="!isDirEntry(file) && isVideoFile(file.name)"
              title="Convert to HLS"
              :disabled="converting || uploading"
              @click.stop="convertToHls(file)" class="active-scale-98">
              <Clapperboard :size="14" />
            </UiButton>
            <UiButton variant="icon" icon-radius-class="border-radius-10px" icon-padding-class="p-4px" title="Share"
              @click.stop="copyLumenLinkFor(file)" class="active-scale-98">
              <Share2 :size="14" />
            </UiButton>
            <UiButton variant="icon" icon-radius-class="border-radius-10px" icon-padding-class="p-4px" title="Remove"
              @click.stop="removeFile(file)" class="active-scale-98 hover-bg-error bg-error-a08 color-error">
              <Trash2 :size="14" />
            </UiButton>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="!showSavedListSpinner && !browseLoading && filteredFiles.length > 0 && totalPages > 1" class="flex-align-justify-center flex-wrap-wrap gap-8px mt-8px p-0px pt-16px pb-16px">
        <UiButton variant="none" :disabled="currentPage === 1"
          @click="currentPage = 1"
          title="First page" class="flex-align-justify-center size-32px color-text-primary cursor-pointer border-1 bg-primary border-radius-8px transition-all-fast hover-bg-hover hover-border-accent disabled-fade-50">
          <ChevronsLeft :size="16" />
        </UiButton>
        <UiButton variant="none" :disabled="currentPage === 1"
          @click="currentPage--"
          title="Previous page" class="flex-align-justify-center size-32px color-text-primary cursor-pointer border-1 bg-primary border-radius-8px transition-all-fast hover-bg-hover hover-border-accent disabled-fade-50">
          <ChevronLeft :size="16" />
        </UiButton>

        <div class="flex-align-center gap-4px">
          <template v-for="(page, idx) in pageNumbers" :key="idx">
            <span v-if="page === '...'" class="color-text-tertiary text-14px p-0px pr-4px pl-4px">...</span>
            <button 
              v-else
              class="flex-align-justify-center size-32px color-text-primary text-14px fw-500 cursor-pointer border-1 bg-primary border-radius-8px transition-all-fast min-w-32px py-0px px-8px hover-bg-hover hover-border-accent"
              :class="{ 'pill-selected-gradient-primary': currentPage === page }"
              @click="currentPage = page as number"
            >
              {{ page }}
            </button>
          </template>
        </div>

        <UiButton variant="none" :disabled="currentPage === totalPages"
          @click="currentPage++"
          title="Next page" class="flex-align-justify-center size-32px color-text-primary cursor-pointer border-1 bg-primary border-radius-8px transition-all-fast hover-bg-hover hover-border-accent disabled-fade-50">
          <ChevronRight :size="16" />
        </UiButton>
        <UiButton variant="none" :disabled="currentPage === totalPages"
          @click="currentPage = totalPages"
          title="Last page" class="flex-align-justify-center size-32px color-text-primary cursor-pointer border-1 bg-primary border-radius-8px transition-all-fast hover-bg-hover hover-border-accent disabled-fade-50">
          <ChevronsRight :size="16" />
        </UiButton>

        <span class="color-text-secondary text-13px ml-8px nowrap">
          {{ (currentPage - 1) * itemsPerPage + 1 }}-{{ Math.min(currentPage * itemsPerPage, filteredFiles.length) }} of {{ filteredFiles.length }}
        </span>
      </div>

      <!-- Empty State -->
      <UiEmptyState
        v-else-if="!showSavedListSpinner && !browseLoading && filteredFiles.length === 0"
        class="flex-1"
        icon-size="80px"
        :title="isBrowsing ? 'Empty folder' : 'No saved content'"
        :description="isBrowsing ? 'This folder has no entries.' : 'Click Upload to add files'"
      >
        <Cloud :size="64" stroke-width="1" />
        <template #actions>
          <UiButton variant="primary" type="button" @click="openFilePicker" class="hover-bg-gradient-accent-secondary-lift shadow-primary">
            <Upload :size="20" />
            <span>Choose files to upload</span>
          </UiButton>
        </template>
      </UiEmptyState>
    </main>

    <!-- ####### lumen://drive FILE DETAIL PANEL ####### -->
    <aside v-if="selectedFile" class="flex flex-column p-24px m-0px bg-primary border-radius-0 flex-shrink-0 min-h-0 overflow-y-auto min-w-280px max-w-280px border-left-1-border-color">
      <div class="flex-align-center-justify-space-between mb-20px">
        <h3 class="text-12px line-height-12 txt-weight-strong">
          {{ isDirEntry(selectedFile) ? "Folder Details" : "File Details" }}
        </h3>
        <UiButton variant="icon" @click="selectedFile = null">
          <X :size="18" />
        </UiButton>
      </div>

      <div class="h-160px flex-align-justify-center border-radius-12px mb-20px color-text-tertiary bg-secondary overflow-hidden border-1-light" :class="getFileTypeClass(selectedFile)">
        <!-- Show actual image preview in detail panel -->
        <img
          v-if="isImageFile(selectedFile.name)"
          :src="getImageSrc(selectedFile)"
          :alt="selectedFile.name"
          class="object-fit-contain w-full h-full border-radius-12px"
          decoding="async"
          @error="() => selectedFile && onImageError(selectedFile)"
        />
        <!-- Show video preview in detail panel -->
        <video
          v-else-if="isVideoFile(selectedFile.name)"
          :src="getGatewayUrl(contentTargetFor(selectedFile))"
          class="object-fit-contain w-full h-full border-radius-12px"
          controls
          muted
          playsinline
        ></video>
        <img
          v-else-if="isHlsEntry(selectedFile)"
          :src="videoPosterFor(selectedFile) || ''"
          :alt="selectedFile.name"
          class="object-fit-contain w-full h-full border-radius-12px"
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

      <div class="flex flex-column gap-16px mb-20px">
        <div class="flex flex-column gap-4px">
          <span class="color-text-tertiary text-uppercase text-10px letter-spacing-005em">Name</span>
          <UiInput bg-class="bg-secondary" radius-class="border-radius-10px" font-size-class="text-14px" padding-class="py-8px px-10px" :focus-ring="false" v-if="canRenameSelected"
            v-model.trim="renameDraft"
            placeholder="Unknown"
            @keyup.enter="saveSelectedName"
            @blur="saveSelectedName" class="fw-500 text-13px focus-outline-none focus-ring focus-bg-primary focus-shadow" />
          <span v-else class="color-text-primary fw-500 text-13px">{{ selectedFile.name }}</span>
        </div>
        <div class="flex flex-column gap-4px">
          <span class="color-text-tertiary text-uppercase text-10px letter-spacing-005em">Size</span>
          <span class="color-text-primary fw-500 text-13px">{{ formatSize(selectedFile.size) }}</span>
        </div>
        <div class="flex flex-column gap-4px" v-if="selectedFile.uploadedAt">
          <span class="color-text-tertiary text-uppercase text-10px letter-spacing-005em">Added</span>
          <span class="color-text-primary fw-500 text-13px">{{
            formatDate(selectedFile.uploadedAt)
          }}</span>
        </div>
      </div>

      <div class="flex flex-column gap-8px">
        <UiButton variant="primary" v-if="!isDirEntry(selectedFile)"
          @click="downloadFile(selectedFile)">
          <Download :size="16" />
          Download
        </UiButton>
        <UiButton variant="secondary" v-if="!isDirEntry(selectedFile) && isVideoFile(selectedFile.name)"
          :disabled="converting || uploading"
          @click="convertSelectedToHls"
          title="Convert to HLS (creates a new CID)">
          <Clapperboard :size="16" />
          Convert to HLS
        </UiButton>
        <UiButton variant="secondary" @click="copyLumenLinkFor(selectedFile)">
          <Share2 :size="16" />
          Share
        </UiButton>
        <UiButton variant="secondary" @click="openInIpfs(selectedFile)">
          <ExternalLink :size="16" />
          Open
        </UiButton>
      </div>
    </aside>

    <!-- ####### lumen://drive LOCAL DETAILS MODAL ####### -->
    <UiModal :model-value="showLocalDetails" title="Local drive" panel-class="w-full max-w-520px" @update:model-value="closeLocalDetails">

            <div class="flex flex-column">
              <UiDetailRow variant="modal" label="Status">
                <span class="color-text-primary text-15px fw-500" :class="ipfsConnected ? 'color-success' : 'color-error'">
                  {{ ipfsConnected ? "Online" : "Offline" }}
                </span>
              </UiDetailRow>
              <UiDetailRow v-if="stats" variant="modal" label="Used" :value="formatSize(stats.repoSize)" />
              <UiDetailRow variant="modal" label="Saved items" :value="localSavedCount" />
              <UiDetailRow variant="modal" label="Pinned locally" :value="pinnedFiles.length" />
            </div>

            <div class="mt-24px">
              <div class="flex-align-center-justify-space-between gap-8px mb-8px">
                <h4 class="m-0px text-15px fw-500 color-text-primary">Backup</h4>
                <UiSpinner v-if="driveBackupBusy" size="sm" />
              </div>

              <p class="text-11px line-height-12 color-text-tertiary m-0px mb-12px">
                Export/import your drive metadata (CIDs, names, favourites). The snapshot is
                encrypted with a password you choose. It doesn't include the data behind CIDs
                (only references). Keep the file + password safe.
              </p>

              <div v-if="driveBackupError" class="flex flex-column border-radius-12px mt-8px gap-8px py-12px px-16px border-1-error-a25 bg-error-a08">
                <div class="text-14px txt-weight-light color-text-primary">Backup failed</div>
                <div class="color-text-secondary text-13px">{{ driveBackupError }}</div>
              </div>

              <div class="flex flex-column">
                <UiDetailRow variant="modal" label="Last export" :value="driveBackupLastExportAt ? formatDate(driveBackupLastExportAt) : '—'" />
                <UiDetailRow variant="modal" label="Last import" :value="driveBackupLastImportAt ? formatDate(driveBackupLastImportAt) : '—'" />
              </div>

              <div class="mt-12px flex-wrap-wrap flex-inline-align-center gap-6px">
                <UiButton variant="secondary" type="button"
                  :disabled="driveBackupBusy"
                  @click="openDriveBackupExportModal">
                  Export snapshot
                </UiButton>
                <UiButton variant="secondary" type="button"
                  :disabled="driveBackupBusy"
                  @click="triggerImportDriveBackup">
                  Import snapshot
                </UiButton>
                <input
                  ref="driveBackupImportInput"
                  type="file"
                  accept="application/json,.json"
                  class="hidden"
                  @change="handleImportDriveBackupFile"
                />
              </div>
            </div>
    </UiModal>

    <!-- ####### lumen://drive EXPORT SNAPSHOT MODAL ####### -->
    <UiModal :model-value="showDriveBackupExportModal" title="Export drive snapshot" panel-class="w-full max-w-520px" @update:model-value="closeDriveBackupExportModal">
            <p class="color-text-secondary mb-24px text-14px">
              Set a password to encrypt your drive metadata backup for
              <strong>{{ activeProfileDisplay || "this profile" }}</strong>.
            </p>

            <div class="flex flex-column gap-12px">
              <UiFormGroup label="Password" wrapper-class="flex flex-column gap-6px" label-class="text-12px txt-weight-light color-text-secondary">
                <input
                  class="w-full border-radius-10px color-text-primary border-1 bg-secondary text-14px py-12px px-16px focus-outline-none focus-border-primary focus-ring focus-bg-primary focus-shadow"
                  :type="driveBackupExportShowPassword ? 'text' : 'password'"
                  v-model="driveBackupExportPassword"
                  placeholder="Min 8 characters (recommended: long passphrase)"
                  :disabled="driveBackupBusy"
                />
              </UiFormGroup>

              <UiFormGroup label="Confirm password" wrapper-class="flex flex-column gap-6px" label-class="text-12px txt-weight-light color-text-secondary">
                <input
                  class="w-full border-radius-10px color-text-primary border-1 bg-secondary text-14px py-12px px-16px focus-outline-none focus-border-primary focus-ring focus-bg-primary focus-shadow"
                  :type="driveBackupExportShowPassword ? 'text' : 'password'"
                  v-model="driveBackupExportPasswordConfirm"
                  placeholder="Repeat password"
                  :disabled="driveBackupBusy"
                  @keyup.enter="confirmDriveBackupExport"
                />
              </UiFormGroup>

              <UiCheckbox v-model="driveBackupExportShowPassword" :disabled="driveBackupBusy">Show password</UiCheckbox>

              <p class="text-11px line-height-12 color-text-tertiary m-0px mt-12px">
                If you lose the password, this backup cannot be recovered.
              </p>

              <div v-if="driveBackupError" class="mt-12px flex flex-column border-radius-12px gap-8px py-12px px-16px border-1-error-a25 bg-error-a08">
                <div class="text-14px txt-weight-light color-text-primary">Backup failed</div>
                <div class="color-text-secondary text-13px">{{ driveBackupError }}</div>
              </div>
            </div>
            <template #footer>
              <UiButton variant="secondary" type="button"
                :disabled="driveBackupBusy"
                @click="closeDriveBackupExportModal" class="disabled-fade-50">
                Cancel
              </UiButton>
              <UiButton variant="primary" type="button"
                :disabled="
                  driveBackupBusy ||
                  !driveBackupExportPassword ||
                  driveBackupExportPassword.length < 8 ||
                  driveBackupExportPassword !== driveBackupExportPasswordConfirm
                "
                @click="confirmDriveBackupExport">
                <UiSpinner v-if="driveBackupBusy" size="sm" />
                <span>{{ driveBackupBusy ? "Exporting..." : "Export" }}</span>
              </UiButton>
            </template>
    </UiModal>

    <!-- ####### lumen://drive IMPORT SNAPSHOT MODAL ####### -->
    <UiModal :model-value="showDriveBackupImportModal" title="Import drive snapshot" panel-class="w-full max-w-520px" @update:model-value="closeDriveBackupImportModal">
            <p class="color-text-secondary mb-24px text-14px">
              This will replace your local drive metadata (CIDs, names, favourites) for
              <strong>{{ activeProfileDisplay || "this profile" }}</strong>.
            </p>

            <div v-if="driveBackupImportFilename" class="flex flex-column">
              <UiDetailRow variant="modal" label="File" :value="driveBackupImportFilename" />
            </div>

            <div
              v-if="!driveBackupRestoreDetails"
              class="flex flex-column gap-12px mt-16px"
            >
              <UiFormGroup label="Password" wrapper-class="flex flex-column gap-6px" label-class="text-12px txt-weight-light color-text-secondary">
                <input
                  class="w-full border-radius-10px color-text-primary border-1 bg-secondary text-14px py-12px px-16px focus-outline-none focus-border-primary focus-ring focus-bg-primary focus-shadow"
                  :type="driveBackupImportShowPassword ? 'text' : 'password'"
                  v-model="driveBackupImportPassword"
                  placeholder="Enter backup password"
                  :disabled="driveBackupBusy"
                  @keyup.enter="decryptDriveBackupImport"
                />
              </UiFormGroup>

              <UiCheckbox v-model="driveBackupImportShowPassword" :disabled="driveBackupBusy">Show password</UiCheckbox>

              <div v-if="driveBackupError" class="mt-12px flex flex-column border-radius-12px gap-8px py-12px px-16px border-1-error-a25 bg-error-a08">
                <div class="text-14px txt-weight-light color-text-primary">Import failed</div>
                <div class="color-text-secondary text-13px">{{ driveBackupError }}</div>
              </div>
            </div>

            <template v-else>
              <div class="flex flex-column mt-16px">
                <UiDetailRow variant="modal" label="Wallet" value-class="color-text-primary text-15px fw-500 mono" :value="driveBackupRestoreDetails.walletAddress || '—'" />
                <UiDetailRow variant="modal" label="Created" :value="driveBackupRestoreDetails.createdAt ? formatDate(driveBackupRestoreDetails.createdAt) : '—'" />
                <UiDetailRow variant="modal" label="Saved items" :value="driveBackupRestoreDetails.filesCount" />
                <UiDetailRow variant="modal" label="Favourites" :value="driveBackupRestoreDetails.favCount" />
              </div>

              <div
                v-if="driveBackupRestoreDetails.walletMismatch"
                class="mt-16px flex flex-column border-radius-12px gap-8px py-12px px-16px border-1-error-a25 bg-error-a08"
              >
                <div class="text-14px txt-weight-light color-text-primary">Different wallet</div>
                <div class="color-text-secondary text-13px">
                  This snapshot was created for a different wallet. Importing it will still work,
                  but make sure you're restoring into the right profile.
                </div>
              </div>

              <div v-if="driveBackupRestoreDetails.rollback" class="mt-16px flex flex-column border-radius-12px gap-8px py-12px px-16px border-1-error-a25 bg-error-a08">
                <div class="text-14px txt-weight-light color-text-primary">Older snapshot</div>
                <div class="color-text-secondary text-13px">
                  This snapshot looks older than your current local version (seq
                  {{ driveBackupRestoreDetails.localSeq }}).
                </div>
              </div>

              <div v-if="driveBackupError" class="mt-12px flex flex-column border-radius-12px gap-8px py-12px px-16px border-1-error-a25 bg-error-a08">
                <div class="text-14px txt-weight-light color-text-primary">Import failed</div>
                <div class="color-text-secondary text-13px">{{ driveBackupError }}</div>
              </div>
            </template>
            <template #footer>
              <UiButton variant="secondary" type="button"
                :disabled="driveBackupBusy"
                @click="closeDriveBackupImportModal" class="disabled-fade-50">
                Cancel
              </UiButton>
              <UiButton variant="primary" type="button"
                :disabled="
                  driveBackupBusy ||
                  !pendingDriveBackupImport ||
                  (!driveBackupRestoreDetails &&
                    (!driveBackupImportPassword || driveBackupImportPassword.length < 8))
                "
                @click="driveBackupRestoreDetails ? confirmDriveBackupRestore() : decryptDriveBackupImport()">
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
              </UiButton>
            </template>
    </UiModal>

    <!-- ####### lumen://drive SUBSCRIPTION DETAILS MODAL ####### -->
    <UiModal :model-value="showGatewayDetails" title="Subscription details" panel-class="w-full max-w-520px" @update:model-value="closeGatewayDetails">
            <UiLoadingBlock v-if="gatewayDetailsLoading" wrapper-class="flex-column gap-12px fw-500 color-text-primary w-full align-middle min-h-220px" spinner-class="" />

            <template v-else>
              <div class="flex flex-column">
                <UiDetailRow variant="modal" label="Gateway" :value="gatewayDetailsGatewayLabel" />
                <UiDetailRow variant="modal" label="Status">
                  <span class="color-text-primary text-15px fw-500" :class="gatewayDetailsStatusClass">
                    {{ gatewayDetailsStatusLabel }}
                  </span>
                </UiDetailRow>
                <UiDetailRow variant="modal" label="Saved" :value="gatewayDetailsPinned.length" />
              </div>

              <div class="mt-24px">
                <div class="flex-align-center-justify-space-between gap-8px mb-8px">
                  <h4 class="m-0px text-15px fw-500 color-text-primary">Usage</h4>
                </div>
                <div
                  v-if="gatewayDetailsUsageError === 'password_required'"
                  class="flex flex-column border-radius-12px mt-8px gap-8px py-12px px-16px border-1-error-a25 bg-error-a08"
                >
                  <div class="text-14px txt-weight-light color-text-primary">Wallet locked</div>
                  <div class="color-text-secondary text-13px">
                    Unlock your Lumen identity to fetch usage from this cloud.
                  </div>
                  <UiButton variant="secondary" type="button"
                    @click="requestUnlock">
                    Unlock
                  </UiButton>
                </div>
                <div v-else-if="gatewayDetailsUsageError" class="flex flex-column border-radius-12px mt-8px gap-8px py-12px px-16px border-1-error-a25 bg-error-a08">
                  {{ gatewayDetailsUsageError }}
                </div>
                <div v-else-if="gatewayDetailsUsage" class="flex flex-column">
                  <UiDetailRow variant="modal" label="Quota" :value="
                      gatewayDetailsUsage.plan?.quota_bytes_total != null ||
                      gatewayDetailsUsage.plan?.quotaBytesTotal != null
                        ? formatSize(
                            (gatewayDetailsUsage.plan.quota_bytes_total ??
                              gatewayDetailsUsage.plan.quotaBytesTotal) as number,
                          )
                        : '-'
                    " />
                  <UiDetailRow variant="modal" label="Used" :value="
                      gatewayDetailsUsage.plan?.quota_bytes_used != null ||
                      gatewayDetailsUsage.plan?.quotaBytesUsed != null
                        ? formatSize(
                            (gatewayDetailsUsage.plan.quota_bytes_used ??
                              gatewayDetailsUsage.plan.quotaBytesUsed) as number,
                          )
                        : '-'
                    " />
                  <UiDetailRow variant="modal" label="Bandwidth" :value="gatewayDetailsBandwidthUsed" />
                  <UiDetailRow variant="modal" label="Roots" :value="gatewayDetailsUsage.usage?.roots_total ?? gatewayDetailsUsage.usage?.rootsTotal ?? '-'" />
                </div>
              </div>
            </template>
    </UiModal>

    <!-- ####### lumen://drive SITES DATA MODAL ####### -->
    <UiModal :model-value="showSiteDataModal" title="Sites data" panel-class="w-full max-w-560px" @update:model-value="closeSiteDataModal">
      <p class="text-13px color-text-tertiary m-0px mb-16px">
        Data a site created for itself, one dedicated key per site - separate from the ugly domains you create yourself in Domains. Deleting one makes that site see you as a brand new visitor next time.
      </p>
      <UiLoadingBlock v-if="siteDataLoading" wrapper-class="flex-column gap-12px fw-500 color-text-primary w-full align-middle min-h-140px" spinner-class="" />
      <UiEmptyState v-else-if="!siteDataRecords.length" title="No sites data yet" description="Sites that create a data record for themselves will show up here." />
      <div v-else class="flex flex-column gap-4px">
        <div v-for="record in siteDataRecords" :key="siteDataRowId(record)" class="border-radius-10px">
          <div class="reveal-on-hover hover-bg-primary-a10 flex-align-center gap-12px border-radius-10px py-10px px-12px">
            <UiButton variant="none" type="button" @click="toggleSiteDataExpanded(record)" class="flex-1 min-w-0 bg-transparent border-none cursor-pointer text-left p-0px">
              <div class="text-14px fw-500 color-text-primary truncate mono">{{ siteDataSiteLabel(record) }}</div>
              <div class="text-12px color-text-tertiary truncate">{{ record.schema || "—" }} · {{ record.updatedAt ? formatDate(record.updatedAt) : "—" }}</div>
            </UiButton>
            <UiButton variant="icon" icon-radius-class="border-radius-10px" icon-padding-class="p-4px" title="Delete this site's data"
              :disabled="removingSiteDataId === siteDataRowId(record)"
              @click="removeSiteDataRecord(record)" class="reveal-actions-target active-scale-98 hover-bg-error bg-error-a08 color-error">
              <Trash2 :size="14" />
            </UiButton>
          </div>
          <div v-if="expandedSiteDataId === siteDataRowId(record)" class="border-radius-10px mt-4px py-10px px-12px bg-secondary">
            <UiDetailRow v-if="record.title" variant="modal" label="Title" :value="record.title" />
            <UiDetailRow variant="modal" label="Profile" :value="record.profileId || '—'" />
            <div class="text-11px color-text-tertiary mt-8px mb-4px">Stored data</div>
            <pre class="text-11px color-text-secondary mono overflow-auto max-h-280px m-0px p-8px border-radius-8px bg-card">{{ siteDataJson(record) }}</pre>
          </div>
        </div>
      </div>
    </UiModal>

    <!-- ####### lumen://drive PLANS MODAL ####### -->
    <UiModal :model-value="showPlansModal" title="Cloud plans" panel-class="drivepage-plans-modal w-full max-w-860px" @update:model-value="closePlansModal">
          <div class="p-24px">

            <UiLoadingBlock v-if="plansLoading" wrapper-class="flex-column gap-12px fw-500 color-text-primary w-full align-middle min-h-220px" spinner-class="" />

            <div v-else-if="plansError">
              <p>{{ plansError }}</p>
            </div>

            <div v-else-if="!plans.length">
              <p>No plans available at the moment.</p>
            </div>

            <div v-else class="flex flex-column flex-wrap-wrap gap-12px">
               <!-- Filters -->
               <div class="flex-align-center-justify-space-between flex-column gap-12px mt-12px mb-8px pb-8px border-bottom-1">
                 <div class="flex-align-center-justify-space-between gap-12px w-full flex-wrap-nowrap">
                   <div class="flex-align-center gap-12px flex-1-1-auto min-w-0 flex-wrap-nowrap">
                     <div class="flex-align-center gap-8px size-40px border-radius-10px flex-1-1-auto border-1 bg-secondary p-0px pr-12px pl-12px min-w-220px">
                       <Search :size="16" class="color-text-secondary opacity-70" />
                       <input
                         v-model.trim="planFilter"
                         type="search"
                         placeholder="Search gateways or plans"
                         class="flex-1 min-w-0 outline-none color-text-primary h-full text-14px bg-secondary border-none bg-transparent py-12px px-16px focus-outline-none focus-border-primary focus-bg-primary focus-ring focus-shadow"
                         @keydown.stop
                         aria-label="Search gateways"
                       />
                     </div>

                     <select
                       v-model="planRegion"
                       class="hover-border-accent size-40px border-radius-10px color-text-primary cursor-pointer outline-none border-1 bg-primary text-14px min-w-180px focus-border-primary focus-ring focus-outline-none focus-shadow p-0px pr-12px pl-12px"
                       aria-label="Region filter"
                     >
                       <option value="">All regions</option>
                       <option v-for="r in planRegions" :key="r" :value="r">
                         {{ r }}
                       </option>
                     </select>
                   </div>

                   <div class="flex-align-center gap-12px flex-wrap-nowrap">
                     <select
                       v-model="planSortBy"
                       class="hover-border-accent size-40px border-radius-10px color-text-primary cursor-pointer outline-none border-1 bg-primary text-14px min-w-180px focus-border-primary focus-ring focus-outline-none focus-shadow p-0px pr-12px pl-12px"
                       aria-label="Sort by"
                     >
                       <option value="score-desc">Sort: Score (high-low)</option>
                       <option value="name-asc">Sort: Name (A-Z)</option>
                       <option value="name-desc">Sort: Name (Z-A)</option>
                     </select>
                   </div>
                 </div>

                 <div class="flex-align-center-justify-space-between gap-12px w-full flex-justify-end flex-wrap-nowrap">
                   <UiCheckbox v-model="planOnlineOnly">Online only</UiCheckbox>
                 </div>
               </div>

               <UiEmptyState v-if="!planGroups.length" title="No gateways match your filters" description="Try clearing filters or search.">
                 <template #actions>
                   <UiButton variant="secondary" v-if="planFilter"
                     type="button"
                     @click="planFilter = ''">
                     Clear search
                   </UiButton>
                   <UiButton variant="secondary" v-if="hasPlanFilters"
                     type="button"
                     @click="resetPlanFilters">
                     Reset filters
                   </UiButton>
                   <UiButton variant="secondary" type="button" @click="openPlansModal">
                     Reload
                   </UiButton>
                 </template>
               </UiEmptyState>

               <!-- Grouped by gateway -->
               <div v-if="planGroups.length" class="flex flex-column gap-12px mt-12px">
                 <article
                   v-for="group in planPagedGroups"
                   :key="group.gateway.id"
                   class="flex flex-column border-radius-10px gap-12px border-1 bg-primary py-12px px-16px shadow-md"
                   :class="{ 'is-offline': !group.gateway.active }"
                 >
                  <header class="flex-align-center-justify-space-between gap-8px">
                    <div class="flex-align-center gap-8px min-w-0">
                      <span
                        class="border-radius-full w-10px h-10px bg-success"
                        :class="group.gateway.active ? '' : 'bg-error'"
                      ></span>
                      <span
                        class="txt-weight-light color-text-primary text-14px truncate max-w-260px"
                        :title="planGatewayLabel(group.gateway)"
                      >
                        {{ planGatewayLabel(group.gateway) }}
                      </span>
                    </div>
                    <div class="flex-justify-end flex-wrap-wrap gap-y-4px gap-x-12px">
                      <span
                        v-if="group.gateway.regions.length"
                        class="flex-inline-align-center gap-6px border-radius-full text-12px color-text-secondary border-1 bg-secondary py-2px px-8px max-w-220px"
                        :title="formatRegionsTitle(group.gateway.regions)"
                      >
                        <MapPin :size="14" class="flex-0-0-auto opacity-70" />
                        <span class="truncate">{{
                          formatRegionsLabel(group.gateway.regions)
                        }}</span>
                      </span>
                      <span class="flex flex-wrap-wrap gap-8px">
                        <UiTag
                          v-for="plan in group.plans"
                          :key="plan.id + '-chip'"
                        >
                          <span class="mono">
                            {{ formatPlanPriceShort(plan.priceUlmn) }}
                          </span>
                        </UiTag>
                      </span>
                      <UiButton variant="secondary" type="button"
                        @click.stop="toggleGatewayExpanded(group.gateway.id)">
                        {{
                          isGatewayExpanded(group.gateway.id)
                            ? "Hide details"
                            : "Show details"
                        }}
                      </UiButton>
                    </div>
                  </header>

                  <div class="flex flex-column gap-12px pt-12px border-top-1">
                    <div
                      v-if="isGatewayExpanded(group.gateway.id)"
                    >
                      <div
                        v-for="plan in group.plans"
                        :key="plan.id"
                        class="basis-full flex flex-column gap-8px p-16px border-radius-12px border-1 bg-secondary mb-8px"
                      >
                        <div class="flex flex-column flex-1 gap-6px">
                          <div class="flex-align-center-justify-space-between gap-8px">
                            <span class="txt-weight-light color-text-primary text-15px">{{
                              planDisplayName(plan)
                            }}</span>
                          </div>
                          <div class="color-text-secondary text-13px">
                            {{ plan.gatewayName }}
                            <template v-if="plan.gatewayEndpoint">
                              · {{ plan.gatewayEndpoint }}
                            </template>
                          </div>
                        </div>
                        <div class="flex flex-column gap-4px min-w-170px">
                          <div class="flex-justify-space-between text-12px">
                            <span class="color-text-secondary">Storage</span>
                            <span class="fw-500 color-text-primary">
                              {{
                                plan.storageGbPerMonth
                                  ? `${plan.storageGbPerMonth} GB / month`
                                  : "Not specified"
                              }}
                            </span>
                          </div>
                          <div class="flex-justify-space-between text-12px">
                            <span class="color-text-secondary">Egress</span>
                            <span class="fw-500 color-text-primary">
                              {{
                                plan.networkGbPerMonth
                                  ? `${plan.networkGbPerMonth} GB / month`
                                  : "Fair usage"
                              }}
                            </span>
                          </div>
                          <div class="flex-justify-space-between text-12px">
                            <span class="color-text-secondary">Price</span>
                            <span class="fw-500 color-text-primary">
                              {{ formatPlanPrice(plan.priceUlmn) }}
                            </span>
                          </div>
                        </div>
                        <div class="flex-justify-end mt-4px">
                          <UiButton variant="secondary" v-if="planStatus(plan) === 'none'"
                            type="button"
                            @click.stop="openSubscribeModal(plan)">
                            {{ planStatusLabel(plan) }}
                          </UiButton>
                          <span
                            v-else
                            class="border-radius-full txt-weight-light color-text-secondary text-11px bg-primary border-1 py-2px px-10px"
                            :class="planStatusBadgeClass(plan)"
                          >
                            {{ planStatusLabel(plan) }}
                          </span>
                        </div>
                      </div>
                   </div>
                 </div>
               </article>
             </div>

             <div v-if="planGroups.length" class="flex-align-center-justify-space-between flex-wrap-wrap gap-12px mt-16px">
               <div class="flex-align-center gap-8px">
                 <span class="color-text-secondary text-13px nowrap">
                   Showing {{ planPageStart + 1 }}-{{
                     Math.min(planPageEnd, planGroups.length)
                   }}
                   of {{ planGroups.length }}
                 </span>
               </div>
               <div class="flex-align-justify-center flex-wrap-wrap gap-6px">
                 <UiButton variant="secondary" type="button"
                   :disabled="planPage === 1"
                   @click="planPage = 1" class="disabled-fade-50">
                   ⟪
                 </UiButton>
                 <UiButton variant="secondary" type="button"
                   :disabled="planPage === 1"
                   @click="planPage--" class="disabled-fade-50">
                   Prev
                 </UiButton>
                 <span class="color-text-secondary text-13px nowrap">
                   Page {{ planPage }} / {{ planTotalPages || 1 }}
                 </span>
                 <UiButton variant="secondary" type="button"
                   :disabled="planPage === planTotalPages"
                   @click="planPage++" class="disabled-fade-50">
                   Next
                 </UiButton>
                 <UiButton variant="secondary" type="button"
                   :disabled="planPage === planTotalPages"
                   @click="planPage = planTotalPages" class="disabled-fade-50">
                   ⟫
                 </UiButton>
               </div>
               <div class="flex-align-center gap-8px">
                 <select
                   v-model.number="planPageSize"
                   aria-label="Rows per page"
                   class="hover-border-accent color-text-primary cursor-pointer outline-none border-radius-8px border-1 bg-primary text-13px transition-all-fast py-8px px-10px focus-border-primary focus-ring focus-outline-none focus-shadow"
                 >
                   <option :value="8">8 / page</option>
                   <option :value="16">16 / page</option>
                   <option :value="24">24 / page</option>
                 </select>
               </div>
             </div>
           </div>
         </div>
     </UiModal>

    <!-- ####### lumen://drive SUBSCRIBE PLAN MODAL ####### -->
    <UiModal :model-value="!!(showSubscribeModal && subscribePlan)" :title='`Confirm subscription "${planDisplayName(subscribePlan)}"`' panel-class="w-full max-w-520px" @update:model-value="closeSubscribeModal">
            <p class="color-text-secondary mb-24px text-14px">
              Review the plan details and confirm your subscription.
            </p>

            <div v-if="subscribePlan">
              <div class="flex-justify-space-between text-12px">
                <span class="color-text-secondary">Gateway</span>
                <span class="fw-500 color-text-primary">
                  {{ subscribePlan.gatewayName }}
                  <template v-if="subscribePlan.gatewayEndpoint">
                    · {{ subscribePlan.gatewayEndpoint }}
                  </template>
                </span>
              </div>
              <div class="flex-justify-space-between text-12px">
                <span class="color-text-secondary">Price / month</span>
                <span class="fw-500 color-text-primary">
                  {{ formatPlanPrice(subscribePlan.priceUlmn) }}
                </span>
              </div>
              <div class="flex-justify-space-between text-12px">
                <span class="color-text-secondary">Storage</span>
                <span class="fw-500 color-text-primary">
                  {{
                    subscribePlan.storageGbPerMonth
                      ? `${subscribePlan.storageGbPerMonth} GB / month`
                      : "Not specified"
                  }}
                </span>
              </div>
              <div class="flex-justify-space-between text-12px">
                <span class="color-text-secondary">Egress</span>
                <span class="fw-500 color-text-primary">
                  {{
                    subscribePlan.networkGbPerMonth
                      ? `${subscribePlan.networkGbPerMonth} GB / month`
                      : "Fair usage"
                  }}
                </span>
              </div>
              <div class="flex-justify-space-between text-12px">
                <span class="color-text-secondary">Duration</span>
                <span class="fw-500 color-text-primary">
                  {{ subscribeMonths }} month{{
                    subscribeMonths > 1 ? "s" : ""
                  }}
                </span>
              </div>
              <div class="flex-justify-space-between text-12px">
                <span class="color-text-secondary">Total</span>
                <span class="fw-500 color-text-primary">
                  {{
                    subscribeTotalPrice.toFixed(
                      subscribeTotalPrice >= 10 ? 0 : 2,
                    )
                  }}
                  LMN
                </span>
              </div>
              <div class="flex-justify-space-between text-12px">
                <span class="color-text-secondary">Balance</span>
                <span class="fw-500 color-text-primary">
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
                class="text-11px line-height-12 color-error mt-8px"
              >
                You can't subscribe because your wallet balance is too low.
              </p>
            </div>

            <div v-if="subscribeError" class="text-11px line-height-12 color-error mt-16px">
              {{ subscribeError }}
            </div>

            <p v-if="subscribeBusy" class="text-11px line-height-12 color-text-tertiary mt-4px">
              Submitting on-chain transaction… This can take ~1–2 minutes the
              first time (PQC setup + block confirmation).
            </p>
            <template #footer>
              <UiButton variant="secondary" type="button"
                @click="closeSubscribeModal"
                :disabled="subscribeBusy" class="disabled-fade-50">
                Cancel
              </UiButton>
              <UiButton variant="primary" type="button"
                @click="confirmSubscribe"
                :disabled="
                  subscribeBusy || hasInsufficientFunds || !subscribePlan
                ">
                <UiSpinner v-if="subscribeBusy" size="sm" />
                <span>{{ subscribeBusy ? "Submitting..." : "Confirm" }}</span>
              </UiButton>
            </template>
    </UiModal>

  </div>
</template>

<script setup lang="ts">
import UiInput from '../../ui/UiInput.vue';
import UiButton from '../../ui/UiButton.vue';

import { uploadFolderToLocal, uploadFileToLocal, uploadActivities, uploadCancelUpload } from "../common/upload";
import { useInternalLumen } from '../../composables/useInternalLumen';
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
  
const lumen_api: any = useInternalLumen();
const gateway_lumen_api = lumen_api?.gateway;
const profiles_lumen_api = lumen_api?.profiles;
const siteData_lumen_api = lumen_api?.siteData;

const navigate = inject<((url: string, opts?: { push?: boolean }) => void) | null>(
  "navigate",
  null,
);

import {
  Cloud,
  Search,
  Download,
  Database,
  Globe,
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
  Pause,
  Play,
  TableProperties,
  MapPin,
  AlertTriangle,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from "lucide-vue-next";
import UiSpinner from "../../ui/UiSpinner.vue";
import UiLoadingBlock from "../../ui/UiLoadingBlock.vue";
import UiCheckbox from "../../ui/UiCheckbox.vue";
import UiDetailRow from "../../ui/UiDetailRow.vue";
import UiModal from "../../ui/UiModal.vue";
import UiFormGroup from "../../ui/UiFormGroup.vue";
import UiCountPill from "../../ui/UiCountPill.vue";
import UiPageHeader from "../../ui/UiPageHeader.vue";
import UiEmptyState from "../../ui/UiEmptyState.vue";
import UiTag from "../../ui/UiTag.vue";
import UiMenuItem from "../../ui/UiMenuItem.vue";
import InternalSidebar from "../../components/InternalSidebar.vue";
import {
  localIpfsGatewayBase,
  loadWhitelistedGatewayBases,
} from "../services/contentResolver";
import { profilesState, activeProfileId } from "../profilesStore";
import {
  useFavourites,
  setFavouritesForProfile,
  getFavouriteEntriesForProfile,
  setFavouriteEntriesForProfile,
} from "../favouritesStore";
import JSZip from "jszip";
import { useToast } from "../../composables/useToast";
import type { DriveFile } from "../../types/upload";
import type {
  HlsQueueItemStatus,
  HlsQueueItem,
  IpfsStats,
  HostingKind,
  HostingState,
  PlanView,
  SubscriptionView,
  GatewayView,
  DriveBackupSnapshotV1,
  DriveBackupSnapshot,
} from "../../types/drivePage";

const files = ref<DriveFile[]>([]);
const pinnedFiles = ref<string[]>([]);
const localPinnedLoading = ref(false);
const selectedFile = ref<DriveFile | null>(null);
const selectedLocalCids = ref<string[]>([]);
const ipfsConnected = ref(false);
const stats = ref<IpfsStats | null>(null);
const hosting = ref<HostingState>({ kind: "local", gatewayId: "" });

// Search and Pagination
const ITEMS_PER_PAGE_KEY = "lumen:drive:itemsPerPage:v1";
const ALLOWED_ITEMS_PER_PAGE = [10, 20, 50, 100];

function loadItemsPerPage(): number {
  const stored = Number(localStorage.getItem(ITEMS_PER_PAGE_KEY));
  return ALLOWED_ITEMS_PER_PAGE.includes(stored) ? stored : 20;
}

const searchQuery = ref("");
const currentPage = ref(1);
const itemsPerPage = ref(loadItemsPerPage());

watch(itemsPerPage, (next) => {
  localStorage.setItem(ITEMS_PER_PAGE_KEY, String(next));
});

const uploading = ref(false);

const converting = ref(false);
const convertingFile = ref("");
const convertingStage = ref<
  | "preparing"
  | "downloading"
  | "probing"
  | "extracting-audio"
  | "transcoding"
  | "adding"
  | "done"
  | "cancelling"
>("preparing");
const convertingPercent = ref<number | null>(null);
const convertingDownloadedBytes = ref<number | null>(null);
const convertingDownloadTotalBytes = ref<number | null>(null);
const convertingCanceling = ref(false);
const convertingPauseRequested = ref(false);
const hlsQueue = ref<HlsQueueItem[]>([]);
const hlsQueueProfileId = ref("");
const hlsQueuePauseRequested = ref(false);
const archiveDownloading = ref(false);
const archiveDownloadFile = ref("");
const archiveDownloadStage = ref<
  | "selecting-path"
  | "preparing"
  | "fetching"
  | "zipping"
  | "done"
  | "cancelling"
>("preparing");
const archiveDownloadPercent = ref<number | null>(null);
const archiveDownloadBytesProcessed = ref<number | null>(null);
const archiveDownloadTotalBytes = ref<number | null>(null);
const archiveDownloadCanceling = ref(false);
const showUploadMenu = ref(false);

const toastApi = useToast();

const convertingStatusLabel = computed(() => {
  if (convertingPauseRequested.value) return "Pausing…";
  if (convertingCanceling.value) return "Cancelling…";
  if (convertingStage.value === "downloading")
    return "Downloading source video from IPFS…";
  if (convertingStage.value === "probing") return "Inspecting source video…";
  if (convertingStage.value === "extracting-audio")
    return "Preparing audio track…";
  if (convertingStage.value === "adding") return "Adding HLS files to IPFS…";
  if (convertingStage.value === "done") return "Finalizing…";
  return "Building an HLS ladder locally…";
});

const convertingStatusText = computed(() => {
  const label = convertingStatusLabel.value;
  if (convertingPercent.value != null) return `${label} (${convertingPercent.value}%)`;
  if (
    convertingStage.value === "downloading" &&
    convertingDownloadedBytes.value != null &&
    convertingDownloadedBytes.value > 0
  ) {
    const downloaded = formatSize(convertingDownloadedBytes.value);
    if (
      convertingDownloadTotalBytes.value != null &&
      convertingDownloadTotalBytes.value > 0
    ) {
      return `${label} (${downloaded} / ${formatSize(convertingDownloadTotalBytes.value)})`;
    }
    return `${label} (${downloaded} downloaded)`;
  }
  return label;
});

const archiveDownloadStatusLabel = computed(() => {
  if (archiveDownloadCanceling.value) return "Cancelling…";
  if (archiveDownloadStage.value === "selecting-path")
    return "Waiting for save location…";
  if (archiveDownloadStage.value === "fetching")
    return "Collecting HLS files from local IPFS…";
  if (archiveDownloadStage.value === "zipping") return "Creating ZIP archive…";
  if (archiveDownloadStage.value === "done") return "Finalizing…";
  return "Preparing HLS archive export…";
});

const archiveDownloadStatusText = computed(() => {
  const label = archiveDownloadStatusLabel.value;
  const pct = archiveDownloadPercent.value;
  const done = archiveDownloadBytesProcessed.value;
  const total = archiveDownloadTotalBytes.value;

  if (pct != null && done != null && done > 0 && total != null && total > 0) {
    return `${label} (${pct}%, ${formatSize(done)} / ${formatSize(total)})`;
  }
  if (pct != null) return `${label} (${pct}%)`;
  if (done != null && done > 0 && total != null && total > 0) {
    return `${label} (${formatSize(done)} / ${formatSize(total)})`;
  }
  if (done != null && done > 0) {
    return `${label} (${formatSize(done)} processed)`;
  }
  return label;
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

const LEGACY_LOCAL_NAMES_KEY = "lumen_drive_saved_names";
const STORAGE_KEY_PREFIX = "lumen:drive:files:v1";
const LOCAL_NAMES_KEY_PREFIX = "lumen:drive:names:v1";
const HLS_QUEUE_KEY_PREFIX = "lumen:drive:hlsQueue:v1";

function filesStorageKey(profileId: string): string {
  const pid = String(profileId || "").trim();
  return pid ? `${STORAGE_KEY_PREFIX}:${pid}` : `${STORAGE_KEY_PREFIX}:guest`;
}

function localNamesStorageKey(profileId: string): string {
  const pid = String(profileId || "").trim();
  return pid ? `${LOCAL_NAMES_KEY_PREFIX}:${pid}` : `${LOCAL_NAMES_KEY_PREFIX}:guest`;
}

function hlsQueueStorageKey(profileId: string): string {
  const pid = String(profileId || "").trim();
  return pid ? `${HLS_QUEUE_KEY_PREFIX}:${pid}` : `${HLS_QUEUE_KEY_PREFIX}:guest`;
}
const localNames = ref<Record<string, string>>({});
const renameDraft = ref("");
const imagePreviewUrls = ref<Record<string, string>>({});
const imagePreviewTried = ref<Record<string, boolean>>({});
const imagePreviewInFlight = new Set<string>();
const videoThumbReady = ref<Record<string, true>>({});

// Gateway / PQC usage (DrivePanel-style)
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
const optimisticGatewayPinned = ref<Record<string, Record<string, number>>>({});
const OPTIMISTIC_GATEWAY_PIN_TTL_MS = 2 * 60 * 1000;

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

// Sites data - site-managed data records (one IPNS key per site+profile),
// deliberately kept separate from the user's own hand-created ugly domains.
const siteDataRecords = ref<any[]>([]);
const siteDataLoading = ref(false);
const showSiteDataModal = ref(false);
const removingSiteDataId = ref("");
const expandedSiteDataId = ref("");

function siteDataRowId(record: any): string {
  return `${record?.siteKey || ""}|${record?.profileId || ""}`;
}

function shortSiteDataId(id: string): string {
  const s = String(id || "");
  return s.length > 18 ? `${s.slice(0, 8)}...${s.slice(-6)}` : s;
}

// The site (not the arbitrary title text a site chose for the record) is
// what actually identifies which entry is which - two different sites can
// easily both call their record "My profile", so lead with siteKey/domain.
function siteDataSiteLabel(record: any): string {
  const key = String(record?.siteKey || "").trim();
  if (key.startsWith("domain:")) return key.slice("domain:".length);
  if (key.startsWith("ipfs:")) return `ipfs:${shortSiteDataId(key.slice("ipfs:".length))}`;
  if (key.startsWith("ipns:")) return `ipns:${shortSiteDataId(key.slice("ipns:".length))}`;
  return key || "Unknown site";
}

function toggleSiteDataExpanded(record: any) {
  const id = siteDataRowId(record);
  expandedSiteDataId.value = expandedSiteDataId.value === id ? "" : id;
}

function siteDataJson(record: any): string {
  try {
    return JSON.stringify(record?.datas ?? {}, null, 2);
  } catch {
    return "";
  }
}

async function loadSiteDataRecords() {
  if (!siteData_lumen_api?.list) return;
  siteDataLoading.value = true;
  try {
    const res = await siteData_lumen_api.list();
    siteDataRecords.value = res?.ok && Array.isArray(res.records) ? res.records : [];
  } catch {
    siteDataRecords.value = [];
  } finally {
    siteDataLoading.value = false;
  }
}

function openSiteDataModal() {
  showSiteDataModal.value = true;
  void loadSiteDataRecords();
}

function closeSiteDataModal() {
  showSiteDataModal.value = false;
}

async function removeSiteDataRecord(record: any) {
  if (!siteData_lumen_api?.delete) return;
  const label = siteDataSiteLabel(record);
  const confirmed = window.confirm(`Delete this site's data ("${label}")?\n\nThe site will see you as a brand new visitor next time.`);
  if (!confirmed) return;
  const rowId = siteDataRowId(record);
  removingSiteDataId.value = rowId;
  try {
    await siteData_lumen_api.delete(record?.siteKey, record?.profileId);
    siteDataRecords.value = siteDataRecords.value.filter((r) => siteDataRowId(r) !== rowId);
  } finally {
    removingSiteDataId.value = "";
  }
}

// Subscription details
const showGatewayDetails = ref(false);
async function requestUnlock() {
  try {
    await lumen_api?.security?.lockSession?.();
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

function isWindowsAppPlatform(): boolean {
  try {
    const platform = String(lumen_api?.appPlatform || "")
      .trim()
      .toLowerCase();
    if (platform) return platform === "win32";
  } catch { }

  try {
    return /windows/i.test(String(navigator.userAgent || ""));
  } catch {
    return false;
  }
}

function encodeGatewayPath(p: string): string {
  const cleaned = String(p || "").replace(/^\/+/, "");
  if (!cleaned) return "";
  return cleaned
    .split("/")
    .filter((seg) => seg.length > 0)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

function bytesFromBase64(b64: string): Uint8Array {
  const raw = String(b64 || "");
  if (!raw) return new Uint8Array();
  const bin = atob(raw);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function collectIpfsFilesRecursively(
  rootCid: string,
  relPath = "",
): Promise<Array<{ archivePath: string; target: string }>> {
  const target = relPath ? `${rootCid}/${relPath}` : rootCid;
  const res = await lumen_api?.ipfsLs?.(target).catch(() => null);
  if (!res?.ok || !Array.isArray(res.entries)) {
    throw new Error(String(res?.error || "Failed to list HLS directory"));
  }

  const out: Array<{ archivePath: string; target: string }> = [];
  for (const entry of res.entries) {
    const name = String(entry?.name || "")
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .replace(/\/+$/, "");
    if (!name) continue;
    const childRel = relPath ? `${relPath}/${name}` : name;
    const type = String(entry?.type || "");
    if (type === "dir") {
      out.push(...(await collectIpfsFilesRecursively(rootCid, childRel)));
      continue;
    }
    if (type === "file") {
      out.push({
        archivePath: childRel,
        target: `${rootCid}/${childRel}`,
      });
    }
  }
  return out;
}

async function downloadHlsAsZip(file: DriveFile): Promise<void> {
  const root = String(file?.rootCid || file?.cid || "").trim();
  if (!root) throw new Error("missing_root_cid");
  const localBase = String(localIpfsGatewayBase() || "")
    .replace(/\/+$/, "")
    .trim();

  const archiveRoot =
    String(stripExt(file.name) || file.name || root)
      .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, " ")
      .trim() || root;

  const files = await collectIpfsFilesRecursively(root);
  if (!files.length) throw new Error("empty_hls_directory");

  const zip = new JSZip();
  const concurrency = Math.min(8, Math.max(2, (navigator.hardwareConcurrency || 4)));
  let cursor = 0;

  async function fetchOne(item: { archivePath: string; target: string }) {
    const httpUrl = localBase
      ? `${localBase}/ipfs/${root}/${encodeGatewayPath(item.archivePath)}`
      : "";
    const fast = httpUrl
      ? await lumen_api?.httpGetBytes?.(httpUrl, { timeout: 120000 }).catch(() => null)
      : null;

    if (fast?.ok && typeof fast?.dataB64 === "string") {
      zip.file(`${archiveRoot}/${item.archivePath}`, bytesFromBase64(fast.dataB64));
      return;
    }

    const got = await lumen_api?.ipfsGet?.(item.target, { gateways: [] }).catch(() => null);
    if (!got?.ok || !Array.isArray(got.data)) {
      throw new Error(`Failed to fetch ${item.archivePath}`);
    }
    zip.file(`${archiveRoot}/${item.archivePath}`, new Uint8Array(got.data));
  }

  async function worker() {
    while (true) {
      const idx = cursor++;
      if (idx >= files.length) return;
      await fetchOne(files[idx]!);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const blob = await zip.generateAsync({
    type: "blob",
    compression: "STORE",
    streamFiles: true,
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${archiveRoot}.zip`;
  a.click();
  URL.revokeObjectURL(url);
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

const canUseLocalMultiSelect = computed(
  () => hosting.value.kind === "local" && !isBrowsing.value,
);

const selectedLocalCidSet = computed(
  () =>
    new Set(
      selectedLocalCids.value
        .map((cid) => normalizeCidKey(cid))
        .filter((cid) => cid),
    ),
);

const selectedLocalEntries = computed<DriveFile[]>(() => {
  if (!canUseLocalMultiSelect.value) return [];
  const byCid = new Map(
    rootSavedEntries.value.map((entry) => [normalizeCidKey(entry.cid), entry] as const),
  );
  return selectedLocalCids.value
    .map((cid) => byCid.get(normalizeCidKey(cid)) || null)
    .filter((entry): entry is DriveFile => !!entry);
});

const visibleLocalEntries = computed<DriveFile[]>(() => {
  if (!canUseLocalMultiSelect.value) return [];
  return displayFiles.value.filter((entry) => isRootSavedEntry(entry));
});

const selectedLocalCount = computed(() => selectedLocalEntries.value.length);

const selectedLocalConvertibleEntries = computed(() =>
  selectedLocalEntries.value.filter(
    (entry) => !isDirEntry(entry) && isVideoFile(entry.name),
  ),
);

const selectedLocalConvertibleCount = computed(
  () => selectedLocalConvertibleEntries.value.length,
);

const allVisibleLocalEntriesSelected = computed(() => {
  const visible = visibleLocalEntries.value;
  if (!visible.length) return false;
  return visible.every((entry) =>
    selectedLocalCidSet.value.has(normalizeCidKey(entry.cid)),
  );
});

const hlsQueueActiveCount = computed(
  () =>
    hlsQueue.value.filter(
      (item) => item.status === "queued" || item.status === "converting",
    ).length,
);

const hlsQueueDoneCount = computed(
  () => hlsQueue.value.filter((item) => item.status === "done").length,
);

const hlsQueuePausedCount = computed(
  () => hlsQueue.value.filter((item) => item.status === "paused").length,
);

const hlsQueueFailedCount = computed(
  () => hlsQueue.value.filter((item) => item.status === "failed").length,
);

const hlsQueueCancelledCount = computed(
  () => hlsQueue.value.filter((item) => item.status === "cancelled").length,
);

const hlsQueueVisible = computed(() => {
  if (hlsQueue.value.length > 1) return true;
  return hlsQueue.value.some((item) => item.status !== "converting");
});

const visibleHlsQueueItems = computed(() => hlsQueue.value.slice(0, 6));

const hlsQueueCanPause = computed(
  () =>
    !uploading.value &&
    !convertingCanceling.value &&
    !convertingPauseRequested.value &&
    hlsQueue.value.some(
      (item) => item.status === "queued" || item.status === "converting",
    ),
);

const hlsQueueCanResume = computed(
  () =>
    !uploading.value &&
    !converting.value &&
    !convertingPauseRequested.value &&
    hlsQueuePausedCount.value > 0,
);

const canBulkRemoveSelectedLocal = computed(
  () => selectedLocalCount.value > 0 && !uploading.value && !converting.value,
);

const canBulkConvertSelectedLocal = computed(
  () => selectedLocalConvertibleCount.value > 0 && !uploading.value,
);

// Total pages
const totalPages = computed(() => {
  return Math.ceil(filteredFiles.value.length / itemsPerPage.value) || 1;
});

watch(totalPages, (total) => {
  if (currentPage.value > total) currentPage.value = total;
  if (currentPage.value < 1) currentPage.value = 1;
});

watch(
  canUseLocalMultiSelect,
  (enabled) => {
    if (!enabled && selectedLocalCids.value.length) {
      selectedLocalCids.value = [];
    }
  },
  { immediate: true },
);

watch(
  rootSavedEntries,
  (entries) => {
    const valid = new Set(
      entries.map((entry) => normalizeCidKey(entry.cid)).filter((cid) => cid),
    );
    const next = selectedLocalCids.value.filter((cid) =>
      valid.has(normalizeCidKey(cid)),
    );
    if (next.length !== selectedLocalCids.value.length) {
      selectedLocalCids.value = next;
    }
  },
  { immediate: true },
);

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
  if (typeof lumen_api.checkAlive !== "function") return;

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
      const res = await gateway_lumen_api
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
      ? "status-dot-off"
      : status === "active"
        ? "status-dot-ok"
        : status === "pending"
          ? "status-dot-pending"
          : "status-dot-off";
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
  if (!row) return "color-error";
  return row.status === "active"
    ? "color-success"
    : row.status === "pending"
      ? "pending"
      : "color-error";
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
let driveUpdateHandler: ((ev: any) => void) | null = null;
let hlsProgressUnsub: (() => void) | null = null;
let hlsArchiveProgressUnsub: (() => void) | null = null;
let ipfsAddProgressUnsub: (() => void) | null = null;
let hlsQueueProcessing = false;

function readUrlBarUrl(): string {
  try {
    const el = document.querySelector<HTMLInputElement>(".navbar-url-bar-input");
    return String(el?.value || "");
  } catch {
    return "";
  }
}

function isUrlBarUserEditing(): boolean {
  return Date.now() - urlBarLastUserInputAt < 600;
}

function ensureUrlBarUserInputTracking() {
  const el = document.querySelector<HTMLInputElement>(".navbar-url-bar-input");
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

watch(
  uploading,
  (busy) => {
    if (!busy) void ensureHlsQueueProcessing();
  },
);

onMounted(async () => {
  await checkIpfsStatus();
  loadFiles();
  loadLocalNames();
  loadHlsQueue();
  loadDriveBackupMeta();
  loadStats();
  void loadPinnedFiles();
  void loadSiteDataRecords();

  void refreshGatewayOverview();
  startSubscribedGatewayHealthPolling();
  startUploadActivitiesPolling();

  try {
      hlsProgressUnsub = lumen_api.driveOnHlsProgress((payload: any) => {
        const stage = String(payload?.stage || "");
        if (stage === "downloading") convertingStage.value = "downloading";
        else if (stage === "probing") convertingStage.value = "probing";
        else if (stage === "extracting-audio")
          convertingStage.value = "extracting-audio";
        else if (stage === "transcoding") convertingStage.value = "transcoding";
        else if (stage === "adding") convertingStage.value = "adding";
        else if (stage === "done") convertingStage.value = "done";

        if (stage === "downloading") {
          const bytesDownloaded = payload?.bytesDownloaded;
          const totalBytes = payload?.totalBytes;
          convertingDownloadedBytes.value =
            typeof bytesDownloaded === "number" && Number.isFinite(bytesDownloaded)
              ? Math.max(0, Math.round(bytesDownloaded))
              : null;
          convertingDownloadTotalBytes.value =
            typeof totalBytes === "number" && Number.isFinite(totalBytes)
              ? Math.max(0, Math.round(totalBytes))
              : null;
        } else {
          convertingDownloadedBytes.value = null;
          convertingDownloadTotalBytes.value = null;
        }

        if (stage === "transcoding" || stage === "done") {
          const pct = payload?.percent;
          if (typeof pct === "number" && Number.isFinite(pct)) {
            convertingPercent.value = Math.max(
              0,
              Math.min(100, Math.round(pct)),
            );
          }
        } else {
          convertingPercent.value = null;
        }
      });
  } catch {}

  try {
      hlsArchiveProgressUnsub = lumen_api.driveOnHlsArchiveProgress((payload: any) => {
        const stage = String(payload?.stage || "");
        if (stage === "selecting-path") archiveDownloadStage.value = "selecting-path";
        else if (stage === "preparing") archiveDownloadStage.value = "preparing";
        else if (stage === "fetching") archiveDownloadStage.value = "fetching";
        else if (stage === "zipping") archiveDownloadStage.value = "zipping";
        else if (stage === "done") archiveDownloadStage.value = "done";

        const pct = payload?.percent;
        archiveDownloadPercent.value =
          typeof pct === "number" && Number.isFinite(pct)
            ? Math.max(0, Math.min(100, Math.round(pct)))
            : null;

        const bytesProcessed = payload?.bytesProcessed;
        archiveDownloadBytesProcessed.value =
          typeof bytesProcessed === "number" && Number.isFinite(bytesProcessed)
            ? Math.max(0, Math.round(bytesProcessed))
            : null;

        const totalBytes = payload?.totalBytes;
        archiveDownloadTotalBytes.value =
          typeof totalBytes === "number" && Number.isFinite(totalBytes)
            ? Math.max(0, Math.round(totalBytes))
            : null;
      });
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

  try {
    driveUpdateHandler = (ev: any) => {
      try {
        const detail = ev?.detail || {};
        const profileId = String(detail?.profileId || "").trim();
        if (!profileId) return;
        const activePid = String(activeProfileId.value || "").trim();
        if (profileId !== activePid) return;
        void loadFiles();
        loadLocalNames();
      } catch {
        // ignore
      }
    };
    window.addEventListener("lumen:drive:updated", driveUpdateHandler as any);
  } catch {}

  startUrlBarSync();
  document.addEventListener("click", handleDocumentClick);
});

onActivated(() => {
  startUrlBarSync();
  startSubscribedGatewayHealthPolling();
  startUploadActivitiesPolling();
  void syncBrowseFromUrl(readInjectedTabUrl() || readUrlBarUrl());
});

onDeactivated(() => {
  stopUrlBarSync();
  stopSubscribedGatewayHealthPolling();
  stopUploadActivitiesPolling();
});

onUnmounted(() => {
  stopUrlBarSync();
  stopSubscribedGatewayHealthPolling();
  stopUploadActivitiesPolling();
  try {
    hlsProgressUnsub?.();
  } catch {
    // ignore
  }
  hlsProgressUnsub = null;
  try {
    hlsArchiveProgressUnsub?.();
  } catch {
    // ignore
  }
  hlsArchiveProgressUnsub = null;
  try {
    ipfsAddProgressUnsub?.();
  } catch {
    // ignore
  }
  ipfsAddProgressUnsub = null;
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
  try {
    if (driveUpdateHandler)
      window.removeEventListener(
        "lumen:drive:updated",
        driveUpdateHandler as any,
      );
  } catch {}
  driveUpdateHandler = null;
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

function handleDocumentClick() {
  showUploadMenu.value = false;
}

function toggleUploadMenu() {
  showUploadMenu.value = !showUploadMenu.value;
}

async function openFilePicker() {
  showUploadMenu.value = false;
  uploading.value = true;
  uploadFileToLocal();
}

async function openFolderPicker() {
  showUploadMenu.value = false;
  uploading.value = true;
  uploadFolderToLocal();
}

const uploadActivitiesComputed = ref<any>();
let uploadActivitiesPollCounter = 0;
let uploadActivitiesPollTimer: number | null = null;

function pollUploadActivities(): void {
  uploadActivitiesComputed.value = { ...uploadActivities };
  const activeCount = Object.keys(uploadActivitiesComputed.value).length;
  if (uploadActivitiesPollCounter !== activeCount) loadFiles();
  if (activeCount <= 0) uploading.value = false;
  uploadActivitiesPollCounter = activeCount;
}

function startUploadActivitiesPolling(): void {
  if (uploadActivitiesPollTimer != null) return;
  uploadActivitiesPollTimer = window.setInterval(pollUploadActivities, 500);
}

function stopUploadActivitiesPolling(): void {
  if (uploadActivitiesPollTimer == null) return;
  window.clearInterval(uploadActivitiesPollTimer);
  uploadActivitiesPollTimer = null;
}

async function checkIpfsStatus() {
  try {
    const result = await lumen_api?.ipfsStatus?.();
    ipfsConnected.value = result?.ok === true;
  } catch {
    ipfsConnected.value = false;
  }
}

function selectHosting(kind: HostingKind) {
  if (kind === hosting.value.kind) return;
  if (kind === "gateway") return;
  exitBrowseSilent();
  currentPage.value = 1;
  hosting.value = { kind, gatewayId: "" };
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

async function getActiveProfileId(): Promise<string | null> {
  try {
    const profileId = (await profiles_lumen_api.getActive())?.id;
    return profileId ? String(profileId || "").trim() : null;
  } catch {
    return null;
  }
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

    const profileId = await getActiveProfileId();
    if (!profileId) {
      gatewayDetailsUsageError.value = "No active profile";
      return;
    }

    const hint = gatewayHintForId(gid);
    const [usageRes, pinnedRes] = await Promise.all([
      gateway_lumen_api.getWalletUsage(profileId, hint).catch((e: any) => ({
        ok: false,
        error: String(e?.message || e),
      })),
      gateway_lumen_api.getWalletPinnedCids(profileId, hint, 1).catch((e: any) => ({
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
          await lumen_api?.security?.lockSession?.();
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
          await lumen_api?.security?.lockSession?.();
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
    if (!gateway_lumen_api.getPlansOverview) return;

    const profileId = await getActiveProfileId();
    if (!profileId) return;

    const res = await gateway_lumen_api
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

async function openPlansModal() {
  try {
    if (!gateway_lumen_api.getPlansOverview) return;

    showPlansModal.value = true;
    planPage.value = 1;
    expandedGatewayIds.value = new Set();
    plansLoading.value = true;
    plansError.value = "";

    const profileId = await getActiveProfileId();
    if (!profileId) {
      plansError.value = "No active profile";
      plansLoading.value = false;
      return;
    }

    const res = await gateway_lumen_api
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

function planStatusBadgeClass(plan: PlanView): string {
  const status = planStatus(plan);
  if (status === "active") return "bg-fill-success color-success";
  if (status === "pending") return "bg-warning-a15 color-warning";
  return "";
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

function planDisplayName(plan: PlanView | null): string {
  return plan?.planId?.split(":").pop() || "Plan";
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
    const walletApi = lumen_api?.wallet;
    if (!walletApi) return;
    const active = await profiles_lumen_api.getActive().catch(() => null);
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

    if (!gateway_lumen_api.subscribePlan) {
      subscribeError.value = "Subscription API unavailable";
      return;
    }

    const profileId = await getActiveProfileId();
    if (!profileId) {
      subscribeError.value = "No active profile";
      return;
    }

    const res = await gateway_lumen_api
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
    const result = await lumen_api?.ipfsStats?.();
    if (result?.ok) {
      stats.value = result;
    }
  } catch {}
}

async function loadPinnedFiles() {
  if (hosting.value.kind === "gateway") {
    await refreshGatewayPinned(activeGatewayHint.value);
    return;
  }

  localPinnedLoading.value = true;
  try {
    const result = await useInternalLumen()?.ipfsPinList?.();
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

async function refreshGatewayPinned(baseUrlHint?: string) {
  const gid = String(hosting.value.gatewayId || "").trim();
  if (hosting.value.kind !== "gateway" || !gid) return;
  const seq = ++gatewayPinnedSeq;

  gatewayPinnedLoading.value = true;
  gatewayPinnedError.value = "";
  try {

    const profileId = await getActiveProfileId();
    if (!profileId) return;

    const res = await gateway_lumen_api
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
          await lumen_api?.security?.lockSession?.();
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
  const key = filesStorageKey(pid);
  if (!key) return;
  try {
    const stored = localStorage.getItem(key);
    const storedParsed = stored ? JSON.parse(stored) : null;
    const storedFiles = Array.isArray(storedParsed) ? (storedParsed as DriveFile[]) : [];
    files.value = storedFiles;
  } catch {
    files.value = [];
  }
}

function saveFiles() {
  try {
    const pid = String(activeProfileId.value || "").trim();
    const key = filesStorageKey(pid);
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(files.value));
    nextDriveBackupSeq(pid);
  } catch {
    // ignore
  }
}

function loadLocalNames() {
  localNames.value = {};
  const pid = String(activeProfileId.value || "").trim();
  const key = localNamesStorageKey(pid);
  if (!key) return;
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
    const pid = String(activeProfileId.value || "").trim();
    const key = localNamesStorageKey(pid);
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(localNames.value));
    nextDriveBackupSeq(pid);
  } catch {
    // ignore
  }
}

const DRIVE_BACKUP_SEQ_KEY_PREFIX = "lumen:driveBackup:seq:v1";
const DRIVE_BACKUP_LAST_EXPORT_AT_KEY_PREFIX = "lumen:driveBackup:lastExportAt:v1";
const DRIVE_BACKUP_LAST_IMPORT_AT_KEY_PREFIX = "lumen:driveBackup:lastImportAt:v1";

function driveBackupSeqKey(profileId: string): string {
  const pid = String(profileId || "").trim();
  return pid ? `${DRIVE_BACKUP_SEQ_KEY_PREFIX}:${pid}` : `${DRIVE_BACKUP_SEQ_KEY_PREFIX}:guest`;
}

function driveBackupLastExportAtKey(profileId: string): string {
  const pid = String(profileId || "").trim();
  return pid ? `${DRIVE_BACKUP_LAST_EXPORT_AT_KEY_PREFIX}:${pid}` : `${DRIVE_BACKUP_LAST_EXPORT_AT_KEY_PREFIX}:guest`;
}

function driveBackupLastImportAtKey(profileId: string): string {
  const pid = String(profileId || "").trim();
  return pid ? `${DRIVE_BACKUP_LAST_IMPORT_AT_KEY_PREFIX}:${pid}` : `${DRIVE_BACKUP_LAST_IMPORT_AT_KEY_PREFIX}:guest`;
}

function activeWalletAddress(): string {
  const p = activeProfile.value;
  const addr = p && (p.walletAddress || p.address);
  return String(addr || "").trim();
}

function nextDriveBackupSeq(profileId: string): number {
  const key = driveBackupSeqKey(profileId);
  if (!key) return 0;
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
  if (!key) return;
  const current = Number.parseInt(String(localStorage.getItem(key) || "0"), 10);
  const base = Number.isFinite(current) && current >= 0 ? current : 0;
  const next = Number.isFinite(nextSeq) && nextSeq > base ? Math.floor(nextSeq) : base;
  try {
    localStorage.setItem(key, String(next));
  } catch {}
}

function getCurrentDriveBackupSeq(profileId: string): number {
  const pid = String(profileId || "").trim();
  if (!pid) return 0;
  const key = driveBackupSeqKey(pid);
  if (!key) return 0;
  const raw = localStorage.getItem(key);
  const v = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(v) && v > 0 ? v : 0;
}

function loadDriveBackupMeta() {
  const pid = String(activeProfileId.value || "").trim();
  if (!pid) {
    driveBackupLastExportAt.value = null;
    driveBackupLastImportAt.value = null;
    return;
  }
  const exportKey = driveBackupLastExportAtKey(pid);
  const importKey = driveBackupLastImportAtKey(pid);
  if (!exportKey || !importKey) {
    driveBackupLastExportAt.value = null;
    driveBackupLastImportAt.value = null;
    return;
  }
  const exportAtRaw = localStorage.getItem(exportKey);
  const importAtRaw = localStorage.getItem(importKey);
  const exportAt = exportAtRaw ? Number.parseInt(exportAtRaw, 10) : NaN;
  const importAt = importAtRaw ? Number.parseInt(importAtRaw, 10) : NaN;
  driveBackupLastExportAt.value = Number.isFinite(exportAt) ? exportAt : null;
  driveBackupLastImportAt.value = Number.isFinite(importAt) ? importAt : null;
}

function setDriveBackupMeta(kind: "export" | "import", ts: number) {
  const pid = String(activeProfileId.value || "").trim();
  if (!pid) return;
  const key = kind === "export" ? driveBackupLastExportAtKey(pid) : driveBackupLastImportAtKey(pid);
  if (!key) return;
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
    version: 2,
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
    shortcutEntries: getFavouriteEntriesForProfile(pid).map((entry) => ({
      id: entry.id,
      url: entry.url,
      ...(entry.title ? { title: entry.title } : {}),
      ...(entry.pinned ? { pinned: true } : {}),
      ...(entry.createdAt ? { createdAt: entry.createdAt } : {}),
      ...(entry.updatedAt ? { updatedAt: entry.updatedAt } : {}),
    })),
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

  if (
    !snap ||
    snap.type !== "lumen.driveBackup.snapshot" ||
    ![1, 2].includes(Number(snap.version))
  ) {
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
  const nextShortcutEntries = Array.isArray(snap.shortcutEntries) ? snap.shortcutEntries : null;

  files.value = nextFiles;
  localNames.value = nextNames;
  saveFiles();
  saveLocalNames();
  if (nextShortcutEntries) {
    setFavouriteEntriesForProfile(pid, nextShortcutEntries as any);
  } else {
    setFavouritesForProfile(pid, nextFav);
  }

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
  const snap = pending.snapshot as DriveBackupSnapshot | null;
  const createdAt = Number(snap?.createdAt) || 0;
  const seq = Number(snap?.seq) || 0;
  const walletAddress = String(snap?.walletAddress || "").trim();
  const filesCount = Array.isArray(snap?.drive?.files) ? snap.drive.files.length : 0;
  const favCount = Array.isArray((snap as any)?.shortcutEntries)
    ? (snap as any).shortcutEntries.length
    : Array.isArray(snap?.favourites)
      ? snap.favourites.length
      : 0;
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

  if (driveBackupBusy.value) return;
  driveBackupBusy.value = true;
  let shouldClose = false;
  try {
    const res = await lumen_api.driveBackup.encryptSnapshot(pid, snapshot, password).catch(() => null);
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

  if (driveBackupBusy.value) return;
  driveBackupBusy.value = true;
  try {
    const encryptedPayload =
      pending.encrypted && typeof pending.encrypted === "object"
        ? toRaw(pending.encrypted)
        : pending.encrypted;
    const res = await lumen_api.driveBackup.decryptSnapshot(pid, encryptedPayload, password)
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

function normalizeStoredHlsQueueStatus(rawStatus: unknown): HlsQueueItemStatus {
  const status = String(rawStatus || "").trim().toLowerCase();
  if (status === "done") return "done";
  if (status === "failed") return "failed";
  if (status === "cancelled") return "cancelled";
  return "paused";
}

function sanitizeStoredHlsQueueFile(raw: any): DriveFile | null {
  const cid = String(raw?.cid || "").trim();
  const name = String(raw?.name || "").trim();
  if (!cid || !name) return null;

  const size = Number(raw?.size);
  const uploadedAt = Number(raw?.uploadedAt);
  const type = raw?.type === "dir" ? "dir" : raw?.type === "file" ? "file" : undefined;
  const rootCid = String(raw?.rootCid || "").trim();
  const relPath = String(raw?.relPath || "").trim();

  return {
    cid,
    name,
    size: Number.isFinite(size) && size > 0 ? Math.round(size) : 0,
    uploadedAt:
      Number.isFinite(uploadedAt) && uploadedAt > 0 ? Math.round(uploadedAt) : undefined,
    type,
    rootCid: rootCid || undefined,
    relPath: relPath || undefined,
  };
}

function persistHlsQueue(
  items: HlsQueueItem[] = hlsQueue.value,
  profileId: string = hlsQueueProfileId.value,
) {
  try {
    const key = hlsQueueStorageKey(profileId);
    if (!key) return;
    if (!items.length) {
      localStorage.removeItem(key);
      return;
    }
    const payload = items.map((item) => ({
      id: item.id,
      file: item.file,
      status: item.status,
      error: item.status === "failed" || item.status === "cancelled" ? item.error : undefined,
    }));
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

function loadHlsQueue(profileId: string = String(activeProfileId.value || "").trim()) {
  hlsQueueProfileId.value = String(profileId || "").trim();
  hlsQueuePauseRequested.value = false;
  convertingPauseRequested.value = false;

  const key = hlsQueueStorageKey(hlsQueueProfileId.value);
  if (!key) {
    hlsQueue.value = [];
    return;
  }

  try {
    const stored = localStorage.getItem(key);
    const parsed = stored ? JSON.parse(stored) : null;
    const items = Array.isArray(parsed) ? parsed : [];
    const restored: HlsQueueItem[] = [];

    for (const raw of items) {
      const file = sanitizeStoredHlsQueueFile(raw?.file);
      if (!file) continue;
      restored.push({
        id: String(raw?.id || nextHlsQueueItemId()),
        file,
        status: normalizeStoredHlsQueueStatus(raw?.status),
        error:
          normalizeStoredHlsQueueStatus(raw?.status) === "failed" ||
          normalizeStoredHlsQueueStatus(raw?.status) === "cancelled"
            ? String(raw?.error || "").trim() || undefined
            : undefined,
      });
    }

    hlsQueue.value = restored;
    persistHlsQueue(restored, hlsQueueProfileId.value);
  } catch {
    hlsQueue.value = [];
  }
}

function hlsQueueHasPendingItems(items: HlsQueueItem[] = hlsQueue.value): boolean {
  return items.some(
    (item) =>
      item.status === "queued" ||
      item.status === "converting" ||
      item.status === "paused",
  );
}

function hlsQueueIsPaused(): boolean {
  return (
    hlsQueue.value.some((item) => item.status === "paused") &&
    !hlsQueue.value.some(
      (item) => item.status === "queued" || item.status === "converting",
    )
  );
}

function upsertFileMetadata(next: DriveFile) {
  const cid = String(next?.cid || "").trim();
  if (!cid) return;
  // Refresh from localStorage first: this runs after an await (HLS conversion / dir
  // probe), and `files.value` can be stale by then if an upload finished in the
  // meantime and wrote straight to localStorage without going through this reactive
  // list. Without this, saveFiles() below would persist the stale snapshot and wipe
  // out that upload.
  loadFiles();
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

  if (!gateway_lumen_api.pinCid) {
    return { ok: false as const, error: "Gateway upload unavailable" };
  }

  const profileId = await getActiveProfileId();
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

  const res = await gateway_lumen_api
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
  return { ok: true as const };
}

function startConvertingState(fileName: string) {
  converting.value = true;
  convertingFile.value = fileName;
  convertingStage.value = "preparing";
  convertingPercent.value = null;
  convertingDownloadedBytes.value = null;
  convertingDownloadTotalBytes.value = null;
  convertingCanceling.value = false;
  convertingPauseRequested.value = false;
}

function resetConvertingState() {
  converting.value = false;
  convertingFile.value = "";
  convertingStage.value = "preparing";
  convertingPercent.value = null;
  convertingDownloadedBytes.value = null;
  convertingDownloadTotalBytes.value = null;
  convertingCanceling.value = false;
  convertingPauseRequested.value = false;
}

async function performHlsConversion(
  file: DriveFile,
  opts: {
    targetHostingKind?: HostingKind;
    silentSuccessToast?: boolean;
    silentErrorToast?: boolean;
  } = {},
): Promise<
  | { ok: true; newName: string }
  | { ok: false; cancelled?: boolean; error: string }
> {
  try {
    const target = contentTargetFor(file);
    const res = await lumen_api?.driveConvertToHls?.({
      cidOrPath: target,
      name: file.name,
      audioBitrate: "128k",
    });

    if (!res?.ok || !res?.cid) {
      const err = String(res?.error || "HLS conversion failed");
      const cancelled = err.toLowerCase().includes("cancel");
      if (!opts.silentErrorToast) {
        if (cancelled) showToast("Conversion cancelled.", "success");
        else showToast(err, "error");
      }
      return { ok: false, cancelled, error: err };
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
      sourceTarget: target,
    });

    if ((opts.targetHostingKind ?? hosting.value.kind) === "gateway") {
      const pinned = await pinCidToActiveGateway(newCid, newName);
      if (!pinned.ok) {
        if (!opts.silentErrorToast) showToast(pinned.error, "error");
        return {
          ok: false,
          cancelled: !!pinned.cancelled,
          error: String(pinned.error || "Gateway pin failed"),
        };
      }
      if (!opts.silentSuccessToast) {
        showToast(`Converted & pinned to gateway: ${newName}`, "success");
      }
    } else {
      loadStats();
      await loadPinnedFiles();
      if (!opts.silentSuccessToast) {
        showToast(`Converted to HLS: ${newName}`, "success");
      }
    }

    return { ok: true, newName };
  } catch (e: any) {
    console.error("HLS conversion error:", e);
    const err = String(e?.message || "HLS conversion error");
    const cancelled = err.toLowerCase().includes("cancel");
    if (!opts.silentErrorToast) {
      if (cancelled) showToast("Conversion cancelled.", "success");
      else showToast(err, "error");
    }
    return { ok: false, cancelled, error: err };
  }
}

function enqueueHlsConversions(filesToQueue: DriveFile[]): {
  added: number;
  duplicates: number;
  status: "queued" | "paused";
} {
  resetFinishedHlsQueueIfIdle();
  const nextStatus: "queued" | "paused" =
    hlsQueuePauseRequested.value || hlsQueueIsPaused() ? "paused" : "queued";

  const known = new Set(
    hlsQueue.value.map((item) => hlsQueueKeyFor(item.file)).filter(Boolean),
  );
  const additions: HlsQueueItem[] = [];
  let duplicates = 0;

  for (const file of filesToQueue) {
    const key = hlsQueueKeyFor(file);
    if (!key) continue;
    if (known.has(key)) {
      duplicates += 1;
      continue;
    }
    known.add(key);
    additions.push({
      id: nextHlsQueueItemId(),
      file: { ...file },
      status: nextStatus,
    });
  }

  if (additions.length) {
    hlsQueue.value = [...hlsQueue.value, ...additions];
  }

  return { added: additions.length, duplicates, status: nextStatus };
}

async function runQueuedHlsConversion(
  item: HlsQueueItem,
): Promise<"done" | "failed" | "cancelled" | "paused"> {
  updateHlsQueueItem(item.id, { status: "converting", error: undefined });
  startConvertingState(item.file.name);
  try {
    const result = await performHlsConversion(item.file, {
      targetHostingKind: "local",
      silentSuccessToast: true,
      silentErrorToast: true,
    });
    if (result.ok) {
      updateHlsQueueItem(item.id, { status: "done", error: undefined });
      return "done";
    }
    if (result.cancelled) {
      const paused = hlsQueuePauseRequested.value || convertingPauseRequested.value;
      updateHlsQueueItem(item.id, {
        status: paused ? "paused" : "cancelled",
        error: paused ? undefined : result.error,
      });
      return paused ? "paused" : "cancelled";
    }
    updateHlsQueueItem(item.id, {
      status: "failed",
      error: result.error,
    });
    return "failed";
  } finally {
    hlsQueuePauseRequested.value = false;
    convertingPauseRequested.value = false;
    resetConvertingState();
  }
}

async function ensureHlsQueueProcessing() {
  if (hlsQueueProcessing || uploading.value) return;
  hlsQueueProcessing = true;

  const summary = { done: 0, failed: 0, cancelled: 0, paused: 0 };

  try {
    while (!uploading.value) {
      const next = hlsQueue.value.find((item) => item.status === "queued");
      if (!next) break;
      const outcome = await runQueuedHlsConversion(next);
      if (outcome === "done") summary.done += 1;
      else if (outcome === "failed") summary.failed += 1;
      else if (outcome === "cancelled") summary.cancelled += 1;
      else summary.paused += 1;
    }
  } finally {
    hlsQueueProcessing = false;
  }

  const processed = summary.done + summary.failed + summary.cancelled + summary.paused;
  if (!processed) return;

  const parts: string[] = [];
  if (summary.done) parts.push(`${summary.done} converted`);
  if (summary.failed) parts.push(`${summary.failed} failed`);
  if (summary.cancelled) parts.push(`${summary.cancelled} cancelled`);
  if (summary.paused) parts.push(`${summary.paused} paused`);
  showToast(`HLS queue: ${parts.join(", ")}`, summary.failed ? "error" : "success");
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
  if (uploading.value) {
    showToast("Another task is already running. Please wait…", "error");
    return;
  }

  const { added, status } = enqueueHlsConversions([file]);
  if (!added) {
    showToast("This video is already in the HLS queue.", "error");
    return;
  }

  showToast(
    status === "paused" ? "Added 1 video to paused HLS queue" : "Queued 1 video for HLS",
    "success",
  );
  if (status === "queued") void ensureHlsQueueProcessing();
}

async function convertSelectedLocalToHls() {
  if (!canUseLocalMultiSelect.value) return;
  if (!ipfsConnected.value) {
    showToast("IPFS not connected", "error");
    return;
  }
  if (uploading.value) {
    showToast("Another task is already running. Please wait…", "error");
    return;
  }

  const selected = selectedLocalEntries.value.slice();
  if (!selected.length) return;

  const convertible = selected.filter(
    (entry) => !isDirEntry(entry) && isVideoFile(entry.name),
  );
  if (!convertible.length) {
    showToast("Select at least one video file to convert.", "error");
    return;
  }

  const skipped = selected.length - convertible.length;
  const { added, duplicates, status } = enqueueHlsConversions(convertible);
  if (!added) {
    showToast("Selected videos are already in the HLS queue.", "error");
    return;
  }

  const notes: string[] = [];
  if (skipped) notes.push(`${skipped} skipped`);
  if (duplicates) notes.push(`${duplicates} already queued`);

  const label =
    status === "paused"
      ? added === 1
        ? "Added 1 video to paused HLS queue"
        : `Added ${added} videos to paused HLS queue`
      : added === 1
        ? "Queued 1 video for HLS"
        : `Queued ${added} videos for HLS`;
  showToast(notes.length ? `${label} (${notes.join(", ")})` : label, "success");
  if (status === "queued") void ensureHlsQueueProcessing();
}

function convertSelectedToHls() {
  if (!selectedFile.value) return;
  void convertToHls(selectedFile.value);
}

async function cancelUpload(key: any) {
  try {
    uploadCancelUpload(key);
  } catch (e: any) {
    showToast(String(e?.message || "Cancel failed"), "error");
  }
}

async function cancelHlsConversion() {
  if (!converting.value || convertingCanceling.value || convertingPauseRequested.value) return;
  convertingCanceling.value = true;
  convertingStage.value = "cancelling";
  try {
    const res = await lumen_api.driveCancelHlsConvert().catch(() => null);
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

async function waitForHlsConversionToSettle(timeoutMs = 8000) {
  const startedAt = Date.now();
  while (converting.value && Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
}

async function pauseHlsQueue(options: { silent?: boolean } = {}) {
  if (convertingCanceling.value || convertingPauseRequested.value) return;

  const queueSnapshot = hlsQueue.value.map((item) => ({
    id: item.id,
    status: item.status,
    error: item.error,
  }));
  const hasQueued = hlsQueue.value.some((item) => item.status === "queued");
  const hasRunning = converting.value;
  if (!hasQueued && !hasRunning) return;

  hlsQueuePauseRequested.value = true;
  if (hasQueued) {
    hlsQueue.value = hlsQueue.value.map((item) =>
      item.status === "queued" ? { ...item, status: "paused", error: undefined } : item,
    );
  }

  if (!hasRunning) {
    hlsQueuePauseRequested.value = false;
    convertingPauseRequested.value = false;
    if (!options.silent) showToast("HLS queue paused.", "success");
    return;
  }

  convertingPauseRequested.value = true;
  convertingStage.value = "cancelling";

  try {
    const res = await lumen_api.driveCancelHlsConvert().catch(() => null);
    if (!res?.ok) {
      throw new Error(String(res?.error || "Pause failed"));
    }
    await waitForHlsConversionToSettle();
    if (!options.silent) showToast("HLS queue paused.", "success");
  } catch (e: any) {
    const previous = new Map(queueSnapshot.map((item) => [item.id, item]));
    hlsQueue.value = hlsQueue.value.map((item) => {
      const prior = previous.get(item.id);
      return prior ? { ...item, status: prior.status, error: prior.error } : item;
    });
    hlsQueuePauseRequested.value = false;
    convertingPauseRequested.value = false;
    convertingStage.value = "transcoding";
    if (!options.silent) {
      showToast(String(e?.message || "Pause failed"), "error");
    }
  }
}

async function resumeHlsQueue() {
  if (!hlsQueueCanResume.value) return;
  hlsQueue.value = hlsQueue.value.map((item) =>
    item.status === "paused" ? { ...item, status: "queued", error: undefined } : item,
  );
  showToast("Resumed HLS queue.", "success");
  void ensureHlsQueueProcessing();
}

function resetArchiveDownloadState() {
  archiveDownloading.value = false;
  archiveDownloadFile.value = "";
  archiveDownloadStage.value = "preparing";
  archiveDownloadPercent.value = null;
  archiveDownloadBytesProcessed.value = null;
  archiveDownloadTotalBytes.value = null;
  archiveDownloadCanceling.value = false;
}

async function cancelHlsArchiveDownload() {
  if (!archiveDownloading.value || archiveDownloadCanceling.value) return;
  const prevStage = archiveDownloadStage.value;
  archiveDownloadCanceling.value = true;
  archiveDownloadStage.value = "cancelling";
  try {
    const res = await lumen_api.driveCancelHlsArchiveDownload().catch(() => null);
    if (!res?.ok) {
      showToast(String(res?.error || "Cancel failed"), "error");
      archiveDownloadCanceling.value = false;
      archiveDownloadStage.value = prevStage;
    }
  } catch (e: any) {
    showToast(String(e?.message || "Cancel failed"), "error");
    archiveDownloadCanceling.value = false;
    archiveDownloadStage.value = prevStage;
  }
}

async function downloadFile(file: DriveFile) {
  try {
    if (isHlsEntry(file)) {
      if (isWindowsAppPlatform()) {
          if (archiveDownloading.value) {
            showToast("Another HLS archive download is already running.", "error");
            return;
          }
          archiveDownloading.value = true;
          archiveDownloadFile.value = file.name;
          archiveDownloadStage.value = "selecting-path";
          archiveDownloadPercent.value = null;
          archiveDownloadBytesProcessed.value = null;
          archiveDownloadTotalBytes.value = null;
          archiveDownloadCanceling.value = false;
          const res = await lumen_api.driveDownloadHlsArchive({
            rootCid: String(file?.rootCid || file?.cid || "").trim(),
            name: String(file?.name || "").trim(),
            expectedSizeBytes: Number(file?.size || 0) || 0,
          });
          if (res?.ok) {
            showToast("Downloaded!", "success");
            return;
          }
          if (String(res?.error || "").toLowerCase().includes("cancel")) {
            return;
          }
          if (String(res?.error || "") === "download_in_progress") {
            showToast("Another HLS archive download is already running.", "error");
            return;
          }
          showToast(String(res?.error || "Download failed"), "error");
          return;
        }

        await downloadHlsAsZip(file);
        showToast("Downloaded!", "success");
        return;
    }

    const target = contentTargetFor(file);
    const gateways = await loadWhitelistedGatewayBases().catch(() => []);
    const result = await lumen_api?.ipfsGet?.(target, { gateways });

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
  } finally {
    resetArchiveDownloadState();
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
    lumen_api.clipboardWriteText(text);
  } catch(err) {
    console.error(err)
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
    const res = await lumen_api?.ipfsLs?.(target).catch(() => null);
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
  const res = await lumen_api?.ipfsLs?.(cid).catch(() => null);
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

function isLocalFileSelected(file: DriveFile | null | undefined): boolean {
  const cid = normalizeCidKey(file?.cid || "");
  if (!cid) return false;
  return selectedLocalCidSet.value.has(cid);
}

function setLocalFileSelected(file: DriveFile, checked: boolean) {
  if (!canUseLocalMultiSelect.value) return;
  const cid = normalizeCidKey(file?.cid || "");
  if (!cid) return;
  const next = new Set(selectedLocalCidSet.value);
  if (checked) next.add(cid);
  else next.delete(cid);
  selectedLocalCids.value = Array.from(next);
}

function clearLocalSelection() {
  selectedLocalCids.value = [];
}

function toggleVisibleLocalSelection(checked: boolean) {
  if (!canUseLocalMultiSelect.value) return;
  const next = new Set(selectedLocalCidSet.value);
  for (const entry of visibleLocalEntries.value) {
    const cid = normalizeCidKey(entry?.cid || "");
    if (!cid) continue;
    if (checked) next.add(cid);
    else next.delete(cid);
  }
  selectedLocalCids.value = Array.from(next);
}

function nextHlsQueueItemId(): string {
  return `hlsq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function hlsQueueKeyFor(file: DriveFile | null | undefined): string {
  if (!file) return "";
  const target = contentTargetFor(file);
  return String(target || "").trim().toLowerCase();
}

function updateHlsQueueItem(
  id: string,
  patch: Partial<Pick<HlsQueueItem, "status" | "error">>,
) {
  hlsQueue.value = hlsQueue.value.map((item) =>
    item.id === id ? { ...item, ...patch } : item,
  );
}

function resetFinishedHlsQueueIfIdle() {
  if (converting.value) return;
  if (!hlsQueueHasPendingItems()) hlsQueue.value = [];
}

function clearHlsQueue() {
  if (converting.value) {
    hlsQueue.value = hlsQueue.value.filter(
      (item) =>
        item.status === "queued" ||
        item.status === "converting" ||
        item.status === "paused",
    );
    return;
  }
  hlsQueue.value = [];
}

function hlsQueueItemStyle(status: string): Record<string, string> {
  if (status === "converting") return { borderColor: "var(--primary-a20)", background: "var(--primary-a05)" };
  if (status === "done") return { borderColor: "rgba(var(--color-success-rgb), 0.25)", background: "rgba(var(--color-success-rgb), 0.06)" };
  if (status === "paused") return { borderColor: "rgba(var(--color-primary-rgb), 0.25)", background: "rgba(var(--color-primary-rgb), 0.06)" };
  if (status === "failed") return { borderColor: "rgba(var(--color-error-rgb), 0.25)", background: "rgba(var(--color-error-rgb), 0.06)" };
  if (status === "cancelled") return { borderColor: "rgba(var(--color-warning-rgb), 0.25)", background: "rgba(var(--color-warning-rgb), 0.06)" };
  return {};
}

function hlsQueueStatusTextStyle(status: string): Record<string, string> {
  if (status === "failed") return { color: "var(--color-error)" };
  if (status === "paused") return { color: "var(--color-primary)" };
  if (status === "cancelled") return { color: "var(--color-warning)" };
  return {};
}

function hlsQueueStatusLabel(item: HlsQueueItem): string {
  if (item.status === "queued") return "Queued";
  if (item.status === "converting") return "Converting";
  if (item.status === "paused") return "Paused";
  if (item.status === "done") return "Done";
  if (item.status === "cancelled") return "Cancelled";
  return "Failed";
}

function hlsQueueSummaryText(): string {
  const parts: string[] = [];
  if (hlsQueueActiveCount.value) parts.push(`${hlsQueueActiveCount.value} active`);
  if (hlsQueuePausedCount.value) parts.push(`${hlsQueuePausedCount.value} paused`);
  if (hlsQueueDoneCount.value) parts.push(`${hlsQueueDoneCount.value} done`);
  if (hlsQueueFailedCount.value) parts.push(`${hlsQueueFailedCount.value} failed`);
  if (hlsQueueCancelledCount.value) {
    parts.push(`${hlsQueueCancelledCount.value} cancelled`);
  }
  return parts.join(" • ");
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

watch(
  hlsQueue,
  (items) => {
    persistHlsQueue(items);
  },
  { deep: true },
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
      const profileId = await getActiveProfileId();
      if (!profileId) {
        showToast("No active profile", "error");
        return;
      }

      const res = await gateway_lumen_api
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
            await lumen_api?.security?.lockSession?.();
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

async function removeLocalRootEntries(entries: DriveFile[]) {
  const unique = Array.from(
    new Map(
      entries
        .filter((entry) => isRootSavedEntry(entry))
        .map((entry) => [normalizeCidKey(entry.cid), entry] as const),
    ).values(),
  );
  if (!unique.length) return;

  const cidSet = new Set(unique.map((entry) => normalizeCidKey(entry.cid)).filter(Boolean));
  // Same staleness risk as upsertFileMetadata: refresh from localStorage right before
  // filtering so a concurrently-finished upload isn't wiped out by this write.
  loadFiles();
  files.value = files.value.filter((entry) => !cidSet.has(normalizeCidKey(entry?.cid || "")));
  saveFiles();

  if (Object.keys(localNames.value).length) {
    const nextNames = { ...localNames.value };
    let changed = false;
    for (const cid of cidSet) {
      if (!(cid in nextNames)) continue;
      delete nextNames[cid];
      changed = true;
    }
    if (changed) {
      localNames.value = nextNames;
      saveLocalNames();
    }
  }

  let unpinFailed = 0;
  for (const cid of cidSet) {
    try {
      const res = await lumen_api?.ipfsUnpin?.(cid);
      if (res && res.ok === false) unpinFailed += 1;
    } catch {
      unpinFailed += 1;
    }
  }

  await loadPinnedFiles();
  void loadStats();

  if (selectedFile.value?.cid && cidSet.has(normalizeCidKey(selectedFile.value.cid))) {
    selectedFile.value = null;
    renameDraft.value = "";
  }

  selectedLocalCids.value = selectedLocalCids.value.filter(
    (cid) => !cidSet.has(normalizeCidKey(cid)),
  );

  const total = cidSet.size;
  if (total === 1) {
    showToast(
      unpinFailed ? "Removed (couldn't unpin local data)" : "Removed",
      "success",
    );
    return;
  }

  if (unpinFailed) {
    showToast(
      `Removed ${total} entries (${unpinFailed} couldn't be unpinned locally)`,
      "success",
    );
    return;
  }

  showToast(`Removed ${total} entries`, "success");
}

async function removeSelectedLocalFiles() {
  if (!canBulkRemoveSelectedLocal.value) return;
  await removeLocalRootEntries(selectedLocalEntries.value.slice());
}

async function removeFile(file: DriveFile) {
  const cid = String(file?.cid || "").trim();
  if (!cid) return;
  if (!isRootSavedEntry(file)) {
    showToast("Remove is only available on root saved entries", "error");
    return;
  }

  if (hosting.value.kind === "local") {
    await removeLocalRootEntries([file]);
    return;
  }

  if (hosting.value.kind === "gateway") {
    try {
      if (!gateway_lumen_api.unpinCid) {
        showToast("Gateway removal unavailable", "error");
        return;
      }

      const profileId = await getActiveProfileId();
      if (!profileId) {
        showToast("No active profile", "error");
        return;
      }

      const res = await gateway_lumen_api
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
    let ct = "";

      const res = await lumen_api?.httpHead(target, { timeout: 6000 }).catch(() => null);
      const headers =
        res && res.headers && typeof res.headers === "object" ? res.headers : {};
      const headerKey = Object.keys(headers).find(
        (k) => String(k || "").toLowerCase() === "content-type",
      );
      ct = headerKey ? String(headers[headerKey] || "") : "";

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
    const got = await lumen_api?.ipfsGet?.(key, { gateways })
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
  if (type === "error") toastApi.error(msg);
  else toastApi.success(msg);
}

function compactError(err: string, maxLen = 120) {
  const clean = String(err || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "";
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, Math.max(0, maxLen - 1)) + "…";
}

async function reloadForActiveProfileChange() {
  const seq = ++profileReloadSeq;
  await pauseHlsQueue({ silent: true });

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
  gatewayPinned.value = [];
  gatewayPinnedNames.value = {};
  gatewayPinnedError.value = "";

  // Reload per-profile local state immediately (don't block on network/gateway calls).
  loadFiles();
  loadLocalNames();
  loadHlsQueue();
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
