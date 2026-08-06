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
                @click="pauseHlsQueue()"
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
            <span class="text-12px color-text-secondary">{{ hlsQueueSummary() }}</span>
          </div>
          <div class="flex-inline-align-center flex-wrap-wrap gap-8px flex-justify-end">
            <UiButton variant="secondary" v-if="hlsQueueCanPause"
              type="button"
              @click="pauseHlsQueue()"
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
              <span>{{ hlsQueueStatusLabel(item.status) }}</span>
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
        <DriveFileRow
          v-for="file in displayFiles"
          :key="file.cid"
          :file="file"
          :thumbnail="thumbnailFor(file)"
          :selected="selectedFile?.cid === file.cid"
          :checked="isLocalFileSelected(file)"
          :selectable="canUseLocalMultiSelect"
          :is-directory="isDirEntry(file)"
          :browsing="isBrowsing"
          :busy="converting || uploading"
          @open="handleEntryClick(file)"
          @update:checked="(checked: boolean) => setLocalFileSelected(file, checked)"
          @action="(kind) => runEntryAction(kind, file)"
          @image-error="onImageError(file)"
          @video-ready="markVideoThumbReady(file)"
        />
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

      <DriveEntryThumbnail
        :file="selectedFile"
        variant="preview"
        container-class="h-160px flex-align-justify-center border-radius-12px mb-20px color-text-tertiary bg-secondary overflow-hidden border-1-light"
        v-bind="thumbnailFor(selectedFile)"
        @image-error="selectedFile && onImageError(selectedFile)"
      />

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
    <LocalDriveDialog :model-value="showLocalDetails" :stats="stats" :format-size="formatSize" :ipfs-connected="ipfsConnected" :drive-backup-last-export-at="driveBackupLastExportAt" :drive-backup-last-import-at="driveBackupLastImportAt" :format-date="formatDate" :local-saved-count="localSavedCount" :pinned-files="pinnedFiles" :busy="driveBackupBusy" :error="driveBackupError" @close="closeLocalDetails" @export="openDriveBackupExportModal" @import="triggerImportDriveBackup" @file-selected="handleImportDriveBackupFile" />

    <!-- ####### lumen://drive EXPORT SNAPSHOT MODAL ####### -->
    <DriveBackupExportDialog :model-value="showDriveBackupExportModal" :password="driveBackupExportPassword" :active-profile-display="activeProfileDisplay" :password-confirm="driveBackupExportPasswordConfirm" :busy="driveBackupBusy" :error="driveBackupError" @close="closeDriveBackupExportModal" @submit="confirmDriveBackupExport" @update:password="driveBackupExportPassword = $event" @update:password-confirm="driveBackupExportPasswordConfirm = $event" />

    <!-- ####### lumen://drive IMPORT SNAPSHOT MODAL ####### -->
    <DriveBackupImportDialog :model-value="showDriveBackupImportModal" :filename="driveBackupImportFilename" :password="driveBackupImportPassword" :active-profile-display="activeProfileDisplay" :format-date="formatDate" :has-pending-import="!!pendingDriveBackupImport" :details="driveBackupRestoreDetails" :busy="driveBackupBusy" :error="driveBackupError" @close="closeDriveBackupImportModal" @update:password="driveBackupImportPassword = $event" @decrypt="decryptDriveBackupImport" @restore="confirmDriveBackupRestore" />

    <!-- ####### lumen://drive SUBSCRIPTION DETAILS MODAL ####### -->
    <SubscriptionDetailsDialog :model-value="showGatewayDetails" :gateway-label="gatewayDetailsGatewayLabel" :usage="gatewayDetailsUsage" :bandwidth-used="gatewayDetailsBandwidthUsed" :gateway-details-status-class="gatewayDetailsStatusClass" :gateway-details-status-label="gatewayDetailsStatusLabel" :format-size="formatSize" :pinned="gatewayDetailsPinned" :loading="gatewayDetailsLoading" :usage-error="gatewayDetailsUsageError" @close="closeGatewayDetails" @unlock="requestUnlock" />

    <!-- ####### lumen://drive SITES DATA MODAL ####### -->
    <SitesDataDialog :model-value="showSiteDataModal" :records="siteDataRecords" :fields="siteDataFields" :row-id="siteDataRowId" :site-data-site-label="siteDataSiteLabel" :format-date="formatDate" :site-data-json="siteDataJson" :expanded-id="expandedSiteDataId" :raw-id="rawSiteDataId" :removing-id="removingSiteDataId" :loading="siteDataLoading" @close="closeSiteDataModal" @remove="removeSiteDataRecord" @toggle-expanded="toggleSiteDataExpanded" @toggle-raw="toggleSiteDataRaw" />

    <!-- ####### lumen://drive PLANS MODAL ####### -->
    <CloudPlansDialog :model-value="showPlansModal" :plans="plans" :plan-groups="planGroups" :plan-paged-groups="planPagedGroups" :plan-regions="planRegions" :plan-total-pages="planTotalPages" :has-plan-filters="hasPlanFilters" :gateway-expanded="isGatewayExpanded" :status-of="planStatus" :plan-gateway-label="gatewayDisplayName" :plan-display-name="planDisplayName" :plan-status-label="planStatusLabel" :format-regions-title="formatRegionsTitle" :format-regions-label="formatRegionsLabel" :format-plan-price="formatPlanPrice" :format-plan-price-short="formatPlanPriceShort" :plan-status-badge-class="planStatusBadgeClass" :plan-page-start="planPageStart" :plan-page-end="planPageEnd" :plans-loading="plansLoading" :plans-error="plansError" v-model:plan-filter="planFilter" v-model:plan-region="planRegion" v-model:plan-online-only="planOnlineOnly" v-model:plan-sort-by="planSortBy" v-model:plan-page="planPage" v-model:plan-page-size="planPageSize" @close="closePlansModal" @retry="openPlansModal" @reset-filters="resetPlanFilters" @toggle-gateway="toggleGatewayExpanded" @subscribe="openSubscribeModal" />

    <!-- ####### lumen://drive SUBSCRIBE PLAN MODAL ####### -->
    <SubscribeConfirmDialog :model-value="!!(showSubscribeModal && subscribePlan)" :plan="subscribePlan" :plan-display-name="planDisplayName" :format-plan-price="formatPlanPrice" :subscribe-months="subscribeMonths" :subscribe-total-price="subscribeTotalPrice" :balance="subscribeBalance" :balance-loading="subscribeBalanceLoading" :insufficient-funds="hasInsufficientFunds" :busy="subscribeBusy" :error="subscribeError" @close="closeSubscribeModal" @confirm="confirmSubscribe" />

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
  toRaw,
  markRaw,
} from "vue";

const { currentTabUrl, currentTabId, currentTabRefresh } = useTabState();
  
const lumen_api: any = useInternalLumen();
const gateway_lumen_api = lumen_api?.gateway;
const profiles_lumen_api = lumen_api?.profiles;
const siteData_lumen_api = lumen_api?.siteData;


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
  X,
  Share2,
  Pause,
  Play,
  TableProperties,
  AlertTriangle,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from "lucide-vue-next";
import UiSpinner from "../../ui/UiSpinner.vue";
import UiLoadingBlock from "../../ui/UiLoadingBlock.vue";
import UiCheckbox from "../../ui/UiCheckbox.vue";
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
import { formatBytes, formatDateTime } from "../services/format";
import { copyToClipboard } from "../../composables/useClipboard";
import { clampPercent, errorMessage } from '../services/coerce';
import { STORAGE_KEYS, readJson, readString, removeKey, writeJson, writeString } from "../services/storage";
import {
  bumpDriveBackupSeq,
  driveBackupLastExportAtKey,
  driveBackupLastImportAtKey,
  driveFilesKey,
  driveHlsQueueKey,
  driveLocalNamesKey,
  nextDriveBackupSeq,
  readDriveBackupSeq
} from "../services/driveStorage";
import {
  useFavourites,
  setFavouritesForProfile,
  getFavouriteEntriesForProfile,
  setFavouriteEntriesForProfile,
} from "../favouritesStore";
import JSZip from "jszip";
import { useToast } from "../../composables/useToast";
import type { DriveFile } from "../../types/upload";
import DriveEntryThumbnail from "../../entities/DriveEntryThumbnail.vue";
import DriveFileRow from "../../entities/DriveFileRow.vue";
import {
  addOptimisticPin,
  deriveGatewayStatus,
  encodeGatewayPath,
  formatRegionsLabel,
  formatRegionsTitle,
  gatewayDisplayName,
  normalizeRegions,
  reconcileOptimisticPins,
  removeOptimisticPin,
} from "../services/gateways";
import {
  countHlsQueue,
  hlsQueueHasPendingItems,
  hlsQueueIsPaused,
  hlsQueueItemStyle,
  hlsQueueStatusLabel,
  hlsQueueStatusTextStyle,
  hlsQueueSummaryText,
  nextHlsQueueItemId,
  parseStoredHlsQueue,
  serializeHlsQueue,
} from "../services/hlsQueue";
import {
  downloadBlob,
  downloadBytes,
  downloadTextFile,
  sanitizeFilenameSegment,
} from "../services/download";
import type { DriveEntryAction, DriveThumbnailSources } from "../../types/drive";
import {
  DRIVE_ENTRY_ICONS,
  driveEntryKindFromName,
  isHlsEntry,
  isImageFile,
  isVideoFile,
} from "../services/driveEntries";
import type {
  HlsQueueItem,
  IpfsStats,
  HostingKind,
  HostingState,
  PlanView,
  SubscriptionView,
  GatewayView,
  DriveBackupSnapshotV2,
  DriveBackupSnapshot,
} from "../../types/drivePage";

import { useTabNavigation, useTabState } from "../../composables/useTabNavigation";
import LocalDriveDialog from "../../dialogs/LocalDriveDialog.vue";
import DriveBackupExportDialog from "../../dialogs/DriveBackupExportDialog.vue";
import DriveBackupImportDialog from "../../dialogs/DriveBackupImportDialog.vue";
import SubscriptionDetailsDialog from "../../dialogs/SubscriptionDetailsDialog.vue";
import SitesDataDialog from "../../dialogs/SitesDataDialog.vue";
import CloudPlansDialog from "../../dialogs/CloudPlansDialog.vue";
import SubscribeConfirmDialog from "../../dialogs/SubscribeConfirmDialog.vue";
import { isPasswordLongEnough } from '../services/passwordPolicy';
const { navigate, openInNewTab } = useTabNavigation();
const files = ref<DriveFile[]>([]);
const pinnedFiles = ref<string[]>([]);
const localPinnedLoading = ref(false);
const selectedFile = ref<DriveFile | null>(null);
const selectedLocalCids = ref<string[]>([]);
const ipfsConnected = ref(false);
const stats = ref<IpfsStats | null>(null);
const hosting = ref<HostingState>({ kind: "local", gatewayId: "" });

// Search and Pagination
const ITEMS_PER_PAGE_KEY = STORAGE_KEYS.driveItemsPerPage;
const ALLOWED_ITEMS_PER_PAGE = [10, 20, 50, 100];

function loadItemsPerPage(): number {
  const stored = Number(readString(ITEMS_PER_PAGE_KEY));
  return ALLOWED_ITEMS_PER_PAGE.includes(stored) ? stored : 20;
}

const searchQuery = ref("");
const currentPage = ref(1);
const itemsPerPage = ref(loadItemsPerPage());

watch(itemsPerPage, (next) => {
  writeString(ITEMS_PER_PAGE_KEY, String(next));
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


const profiles = profilesState;
const activeProfile = computed(
  () => profiles.value.find((p) => p.id === activeProfileId.value) || null,
);

const activeProfileDisplay = computed(
  () => activeProfile.value?.name || activeProfile.value?.id || "",
);

const { favourites } = useFavourites();

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
const rawSiteDataId = ref("");

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

function toggleSiteDataRaw(record: any) {
  const id = siteDataRowId(record);
  rawSiteDataId.value = rawSiteDataId.value === id ? "" : id;
}

/** Top-level datas fields as a flat, scannable table - datas is arbitrary site-defined JSON, so nested arrays/objects are summarized (count) rather than dumped inline; "View raw JSON" still shows everything for anyone who wants the full picture. */
function siteDataFields(record: any): { key: string; value: string }[] {
  const datas = record?.datas && typeof record.datas === "object" && !Array.isArray(record.datas) ? record.datas : {};
  return Object.entries(datas).map(([key, value]) => ({ key, value: formatSiteDataFieldValue(value) }));
}

function formatSiteDataFieldValue(value: any): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
  if (typeof value === "object") {
    const count = Object.keys(value).length;
    return `${count} field${count === 1 ? "" : "s"}`;
  }
  const str = String(value);
  return str.length > 140 ? `${str.slice(0, 140)}…` : str;
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

    const haystack = `${gatewayDisplayName(gw)} ${gw.operator}`.toLowerCase();
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
        gatewayDisplayName(a).localeCompare(gatewayDisplayName(b)),
    );
  } else if (planSortBy.value === "name-asc") {
    gwList.sort((a, b) =>
      gatewayDisplayName(a).localeCompare(gatewayDisplayName(b)),
    );
  } else if (planSortBy.value === "name-desc") {
    gwList.sort((a, b) =>
      gatewayDisplayName(b).localeCompare(gatewayDisplayName(a)),
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
  downloadBlob(blob, `${archiveRoot}.zip`);
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

const hlsQueueCounts = computed(() => countHlsQueue(hlsQueue.value));
const hlsQueuePausedCount = computed(() => hlsQueueCounts.value.paused);

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
            ? clampPercent(Math.round(pct))
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
        error: errorMessage(e),
      })),
      gateway_lumen_api.getWalletPinnedCids(profileId, hint, 1).catch((e: any) => ({
        ok: false,
        error: errorMessage(e),
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
  } catch (e) {
    if (seq !== gatewayDetailsLoadSeq) return;
    gatewayDetailsUsageError.value = errorMessage(e, "Usage fetch failed");
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
  } catch (e) {
    plansError.value = errorMessage(e, "Unable to load plans.");
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
      .catch((e: any) => ({ ok: false, error: errorMessage(e) }));

    if (!res || res.ok === false) {
      subscribeError.value = normalizeSubscribeError(res?.error);
      return;
    }

    showSubscribeModal.value = false;
    subscribePlan.value = null;
    subscribeError.value = "";
    subscribeBalance.value = null;
    void openPlansModal();
  } catch (e) {
    subscribeError.value = normalizeSubscribeError(errorMessage(e));
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

    const server: string[] = Array.from(
      new Set<string>(
        cids
          .map((x: any) => String(x || "").trim())
          .filter((x: string) => x && !isIgnoredCid(x)),
      ),
    );
    const settled = reconcileOptimisticPins(
      optimisticGatewayPinned.value[gid] || {},
      server,
    );
    optimisticGatewayPinned.value = {
      ...optimisticGatewayPinned.value,
      [gid]: settled.pins,
    };
    gatewayPinned.value = settled.displayed;

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
  } catch (e) {
    if (seq !== gatewayPinnedSeq) return;
    gatewayPinned.value = [];
    gatewayPinnedNames.value = {};
    const msg = errorMessage(e, "Pinned CIDs fetch failed");
    gatewayPinnedError.value =
      msg === "Error: kyber_pubkey_http_unavailable" ? "" : msg;
  } finally {
    if (seq === gatewayPinnedSeq) gatewayPinnedLoading.value = false;
  }
}

function addOptimisticGatewayPinnedCid(cid: string) {
  const key = String(cid || "").trim();
  const gid = String(hosting.value.gatewayId || "").trim();
  if (!key || !gid) return;
  optimisticGatewayPinned.value = {
    ...optimisticGatewayPinned.value,
    [gid]: addOptimisticPin(optimisticGatewayPinned.value[gid] || {}, key),
  };
  if (hosting.value.kind === "gateway") {
    gatewayPinned.value = [
      key,
      ...gatewayPinned.value.filter((x) => String(x) !== key),
    ];
  }
}

function removeOptimisticGatewayPinnedCid(cid: string) {
  const gid = String(hosting.value.gatewayId || "").trim();
  if (!gid) return;
  optimisticGatewayPinned.value = {
    ...optimisticGatewayPinned.value,
    [gid]: removeOptimisticPin(optimisticGatewayPinned.value[gid] || {}, cid),
  };
}

function loadFiles() {
  files.value = [];
  const pid = String(activeProfileId.value || "").trim();
  const storedParsed = readJson<unknown>(driveFilesKey(pid), null);
  files.value = Array.isArray(storedParsed) ? (storedParsed as DriveFile[]) : [];
}

function saveFiles() {
  const pid = String(activeProfileId.value || "").trim();
  writeJson(driveFilesKey(pid), files.value);
  nextDriveBackupSeq(pid);
}

function loadLocalNames() {
  localNames.value = {};
  const pid = String(activeProfileId.value || "").trim();
  const key = driveLocalNamesKey(pid);
  try {
    const storedParsed = readJson<unknown>(key, null);
    const storedNames =
      storedParsed && typeof storedParsed === "object"
        ? (storedParsed as Record<string, string>)
        : {};

    // One-shot migrate legacy global key to per-profile storage, then delete legacy.
    const legacy = readString(STORAGE_KEYS.driveLocalNamesLegacy);
    if (legacy) {
      const legacyParsed = JSON.parse(legacy);
      const legacyNames =
        legacyParsed && typeof legacyParsed === "object"
          ? (legacyParsed as Record<string, string>)
          : {};

      // Prefer the current per-profile names over legacy for conflicts.
      localNames.value = { ...legacyNames, ...storedNames };
      writeJson(key, localNames.value);
      removeKey(STORAGE_KEYS.driveLocalNamesLegacy);
      return;
    }

    localNames.value = storedNames;
  } catch {
    localNames.value = {};
  }
}

function saveLocalNames() {
  const pid = String(activeProfileId.value || "").trim();
  writeJson(driveLocalNamesKey(pid), localNames.value);
  nextDriveBackupSeq(pid);
}

function activeWalletAddress(): string {
  const p = activeProfile.value;
  const addr = p && (p.walletAddress || p.address);
  return String(addr || "").trim();
}

function getCurrentDriveBackupSeq(profileId: string): number {
  const pid = String(profileId || "").trim();
  if (!pid) return 0;
  return readDriveBackupSeq(pid);
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
  const exportAtRaw = readString(exportKey);
  const importAtRaw = readString(importKey);
  const exportAt = exportAtRaw ? Number.parseInt(exportAtRaw, 10) : NaN;
  const importAt = importAtRaw ? Number.parseInt(importAtRaw, 10) : NaN;
  driveBackupLastExportAt.value = Number.isFinite(exportAt) ? exportAt : null;
  driveBackupLastImportAt.value = Number.isFinite(importAt) ? importAt : null;
}

function setDriveBackupMeta(kind: "export" | "import", ts: number) {
  const pid = String(activeProfileId.value || "").trim();
  if (!pid) return;
  const key = kind === "export" ? driveBackupLastExportAtKey(pid) : driveBackupLastImportAtKey(pid);
  writeString(key, String(ts));
  if (kind === "export") driveBackupLastExportAt.value = ts;
  else driveBackupLastImportAt.value = ts;
}

function makeDriveBackupSnapshot(): DriveBackupSnapshotV2 | null {
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

  // Named as unknown[] first: `snap` is `any`, and inlining the ternary let the
  // element type drift instead of settling on the strings this produces.
  const rawFav: unknown[] = Array.isArray(snap.favourites) ? snap.favourites : [];
  const nextFav = Array.from(
    new Set(rawFav.map((u) => String(u || "").trim()).filter(Boolean)),
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
  if (!isPasswordLongEnough(password)) {
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

    const nameSeg = sanitizeFilenameSegment(activeProfileDisplay.value) || "profile";
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `lumen-drive-backup-${nameSeg}-${stamp}.enc.json`;
    downloadTextFile(filename, JSON.stringify(res.encrypted, null, 2));
    setDriveBackupMeta("export", Date.now());
    showToast("Drive snapshot exported", "success");
    shouldClose = true;
  } catch (e) {
    driveBackupError.value = errorMessage(e, "export_failed");
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
  if (!isPasswordLongEnough(password)) {
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
  } catch (e) {
    driveBackupError.value = errorMessage(e, "decrypt_failed");
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

function persistHlsQueue(
  items: HlsQueueItem[] = hlsQueue.value,
  profileId: string = hlsQueueProfileId.value,
) {
  const key = driveHlsQueueKey(profileId);
  if (!items.length) {
    removeKey(key);
    return;
  }
  writeJson(key, serializeHlsQueue(items));
}

function loadHlsQueue(profileId: string = String(activeProfileId.value || "").trim()) {
  hlsQueueProfileId.value = String(profileId || "").trim();
  hlsQueuePauseRequested.value = false;
  convertingPauseRequested.value = false;

  const parsed = readJson<unknown>(driveHlsQueueKey(hlsQueueProfileId.value), null);
  const restored = parseStoredHlsQueue(parsed);
  hlsQueue.value = restored;
  persistHlsQueue(restored, hlsQueueProfileId.value);
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
    .catch((e: any) => ({ ok: false, error: errorMessage(e) }));

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
  } catch (e) {
    console.error("HLS conversion error:", e);
    const err = errorMessage(e, "HLS conversion error");
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
    hlsQueuePauseRequested.value || hlsQueueIsPaused(hlsQueue.value) ? "paused" : "queued";

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
  } catch (e) {
    showToast(errorMessage(e, "Cancel failed"), "error");
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
  } catch (e) {
    showToast(errorMessage(e, "Cancel failed"), "error");
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
  } catch (e) {
    const previous = new Map(queueSnapshot.map((item) => [item.id, item]));
    hlsQueue.value = hlsQueue.value.map((item) => {
      const prior = previous.get(item.id);
      return prior ? { ...item, status: prior.status, error: prior.error } : item;
    });
    hlsQueuePauseRequested.value = false;
    convertingPauseRequested.value = false;
    convertingStage.value = "transcoding";
    if (!options.silent) {
      showToast(errorMessage(e, "Pause failed"), "error");
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
  } catch (e) {
    showToast(errorMessage(e, "Cancel failed"), "error");
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
      downloadBytes(result.data, file.name);
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

async function copyLumenLinkFor(file: DriveFile) {
  const url = lumenLinkFor(file);
  await copyToClipboard(url);
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
  } catch (e) {
    if (seq !== browseLoadSeq) return;
    browseEntries.value = [];
    browseError.value = errorMessage(e, "Failed to list folder");
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
  if (!hlsQueueHasPendingItems(hlsQueue.value)) hlsQueue.value = [];
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

function hlsQueueSummary(): string {
  return hlsQueueSummaryText(countHlsQueue(hlsQueue.value));
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
        .catch((e: any) => ({ ok: false, error: errorMessage(e) }));

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
    } catch (e) {
      showToast(errorMessage(e, "rename_failed"), "error");
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
        .catch((e: any) => ({ ok: false, error: errorMessage(e) }));
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
    } catch (e) {
      showToast(errorMessage(e, "Gateway unpin failed"), "error");
      return;
    }
  }

  showToast("Remove failed", "error");
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

/**
 * Everything a row or the detail panel needs to picture an entry. Gathered
 * here because each piece reads page state - the gateway, the blob preview
 * cache, the set of videos whose real first frame has arrived.
 */
function thumbnailFor(file: DriveFile): DriveThumbnailSources {
  return {
    imageSrc: getImageSrc(file),
    videoSrc: getGatewayUrl(contentTargetFor(file)),
    poster: videoPosterFor(file),
    icon: getFileIcon(file),
  };
}

function runEntryAction(kind: DriveEntryAction, file: DriveFile) {
  if (kind === "details") return openEntryDetails(file);
  if (kind === "download") return downloadFile(file);
  if (kind === "convert") return convertToHls(file);
  if (kind === "share") return copyLumenLinkFor(file);
  if (kind === "remove") return removeFile(file);
}

function getFileIcon(file: DriveFile | null | undefined) {
  if (isDirEntry(file)) return DRIVE_ENTRY_ICONS.folder;
  if (isHlsEntry(file)) return DRIVE_ENTRY_ICONS.video;
  const kind = driveEntryKindFromName(String(file?.name || ""), {
    book: isEpubFile(file),
  });
  return DRIVE_ENTRY_ICONS[kind];
}

function formatSize(bytes: number): string {
  return formatBytes(bytes);
}

function formatDate(ts: number): string {
  return formatDateTime(ts);
}

const showToast = toastApi.show;

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
