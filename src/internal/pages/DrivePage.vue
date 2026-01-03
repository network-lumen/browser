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
      
      <nav class="sidebar-nav">
        <div class="nav-section">
          <span class="nav-label">Storage</span>
          <button 
            class="nav-item" 
            :class="{ active: currentView === 'files' }"
            @click="currentView = 'files'"
          >
            <FolderOpen :size="18" />
            <span>My Files</span>
            <span class="badge" v-if="files.length">{{ files.length }}</span>
          </button>
          <button 
            class="nav-item" 
            :class="{ active: currentView === 'pinned' }"
            @click="currentView = 'pinned'; loadPinnedFiles()"
          >
            <Pin :size="18" />
            <span>Pinned</span>
          </button>
          <button 
            class="nav-item" 
            :class="{ active: currentView === 'fetch' }"
            @click="currentView = 'fetch'"
          >
            <Download :size="18" />
            <span>Fetch CID</span>
          </button>
        </div>
      </nav>

      <!-- Storage Stats -->
      <div class="storage-stats" v-if="stats">
        <div class="stats-header">
          <Database :size="14" />
          <span>Storage Used</span>
        </div>
        <div class="stats-bar">
          <div class="stats-fill" :style="{ width: storagePercent + '%' }"></div>
        </div>
        <p class="stats-value">{{ formatSize(stats.repoSize) }}</p>
      </div>

      <!-- IPFS Status -->
      <div class="ipfs-status" :class="{ connected: ipfsConnected }">
        <div class="status-dot"></div>
        <span>{{ ipfsConnected ? 'IPFS Online' : 'IPFS Offline' }}</span>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <!-- Header -->
      <header class="content-header">
        <div>
          <h1 class="txt-lg txt-weight-strong">
            {{ currentView === 'files' ? 'My Files' : currentView === 'pinned' ? 'Pinned Content' : 'Fetch from IPFS' }}
          </h1>
          <p class="txt-xs color-gray-blue margin-top-10">
            {{ currentView === 'files' ? 'Upload and manage your decentralized files' : currentView === 'pinned' ? 'Content pinned to your local node' : 'Download content from the IPFS network' }}
          </p>
        </div>
        
        <div class="header-actions" v-if="currentView !== 'fetch'">
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

          <label class="upload-btn" v-if="currentView === 'files'">
            <Plus :size="18" />
            <span>Upload</span>
            <input type="file" multiple @change="handleFileUpload" />
          </label>
        </div>
      </header>

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

      <!-- Fetch CID View -->
      <div v-if="currentView === 'fetch'" class="fetch-section">
        <div class="fetch-card">
          <div class="fetch-icon">
            <CloudDownload :size="48" stroke-width="1.5" />
          </div>
          <h3 class="txt-md txt-weight-strong margin-top-50">Fetch Content by CID</h3>
          <p class="txt-xs color-gray-blue margin-top-25 margin-bottom-50">
            Enter a Content Identifier (CID) to download from the IPFS network
          </p>
          <div class="fetch-input-group">
            <input 
              v-model="fetchCid" 
              type="text" 
              placeholder="QmXxx... or bafyxxx..."
              class="fetch-input"
              @keyup.enter="fetchFromCid"
            />
            <button class="fetch-btn" @click="fetchFromCid" :disabled="!fetchCid || fetching">
              <Download :size="18" v-if="!fetching" />
              <UiSpinner size="sm" v-else />
              <span>{{ fetching ? 'Fetching...' : 'Fetch' }}</span>
            </button>
          </div>
          <div v-if="fetchError" class="fetch-error txt-xs margin-top-25">
            {{ fetchError }}
          </div>
        </div>
      </div>

      <!-- Files Grid View -->
      <div v-else-if="displayFiles.length > 0 && viewMode === 'grid'" class="files-grid">
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
              :src="getGatewayUrl(file.cid)" 
              :alt="file.name"
              class="preview-image"
              @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
            />
            <!-- Show video preview -->
            <video 
              v-else-if="isVideoFile(file.name)" 
              :src="getGatewayUrl(file.cid)"
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
            <button class="action-btn" title="Copy CID" @click.stop="copyCid(file.cid)">
              <Copy :size="16" />
            </button>
            <button class="action-btn" title="Open in Gateway" @click.stop="openInGateway(file.cid)">
              <ExternalLink :size="16" />
            </button>
            <button class="action-btn danger" title="Remove" @click.stop="deleteFile(file.cid)">
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
              :src="getGatewayUrl(file.cid)" 
              :alt="file.name"
              class="list-thumbnail"
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
            <button class="action-btn" title="Copy CID" @click.stop="copyCid(file.cid)">
              <Copy :size="14" />
            </button>
            <button class="action-btn danger" title="Remove" @click.stop="deleteFile(file.cid)">
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
              <th class="th-cid">CID</th>
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
                    :src="getGatewayUrl(file.cid)" 
                    :alt="file.name"
                    class="table-thumbnail"
                  />
                  <component v-else :is="getFileIcon(file.name)" :size="16" stroke-width="1.5" />
                </div>
                <span>{{ file.name }}</span>
              </td>
              <td class="td-size">{{ formatSize(file.size) }}</td>
              <td class="td-cid">
                <code>{{ file.cid.slice(0, 20) }}...</code>
                <button class="copy-inline" @click.stop="copyCid(file.cid)" title="Copy CID">
                  <Copy :size="12" />
                </button>
              </td>
              <td class="td-date">{{ file.uploadedAt ? formatDate(file.uploadedAt) : '—' }}</td>
              <td class="td-actions">
                <button class="action-btn" title="Download" @click.stop="downloadFile(file)">
                  <Download :size="14" />
                </button>
                <button class="action-btn" title="Open Gateway" @click.stop="openInGateway(file.cid)">
                  <ExternalLink :size="14" />
                </button>
                <button class="action-btn danger" title="Remove" @click.stop="deleteFile(file.cid)">
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
          <component :is="currentView === 'pinned' ? Pin : FolderOpen" :size="64" stroke-width="1" />
        </div>
        <h3 class="txt-md txt-weight-strong margin-top-50">
          {{ currentView === 'pinned' ? 'No pinned content' : 'No files yet' }}
        </h3>
        <p class="txt-sm color-gray-blue margin-top-25">
          {{ currentView === 'pinned' ? 'Content you pin will appear here' : 'Drag and drop files or click Upload to add files' }}
        </p>
        <label v-if="currentView === 'files'" class="upload-btn-large margin-top-50">
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
          :src="getGatewayUrl(selectedFile.cid)" 
          :alt="selectedFile.name"
          class="detail-preview-image"
        />
        <!-- Show video preview in detail panel -->
        <video 
          v-else-if="isVideoFile(selectedFile.name)" 
          :src="getGatewayUrl(selectedFile.cid)"
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
          <span class="info-value">{{ selectedFile.name }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Size</span>
          <span class="info-value">{{ formatSize(selectedFile.size) }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">CID</span>
          <span class="info-value cid">{{ selectedFile.cid }}</span>
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
        <button class="detail-btn" @click="openShareModal(selectedFile)">
          <Share2 :size="16" />
          Share
        </button>
        <button class="detail-btn" @click="openPermalinkModal(selectedFile)">
          <Link2 :size="16" />
          Permalink
        </button>
        <button class="detail-btn" @click="copyCid(selectedFile.cid)">
          <Copy :size="16" />
          Copy CID
        </button>
        <button class="detail-btn" @click="openInGateway(selectedFile.cid)">
          <ExternalLink :size="16" />
          Open Gateway
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

    <!-- Share Modal -->
    <Transition name="modal">
      <div v-if="showShareModal" class="modal-overlay" @click="closeShareModal">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>Share File</h3>
            <button class="modal-close" @click="closeShareModal">
              <X :size="20" />
            </button>
          </div>
          <div class="modal-body">
            <p class="modal-desc">Share this file using the links below</p>
            
            <div class="share-option">
              <span class="share-label">Gateway URL</span>
              <div class="share-input-group">
                <input 
                  :value="`${GATEWAY_URL}/ipfs/${shareFile?.cid}`" 
                  readonly 
                  class="share-input"
                  ref="gatewayUrlInput"
                />
                <button class="share-copy-btn" @click="copyGatewayUrl(shareFile?.cid || '')">
                  <Copy :size="16" />
                </button>
              </div>
            </div>

            <div class="share-option">
              <span class="share-label">IPFS CID</span>
              <div class="share-input-group">
                <input 
                  :value="shareFile?.cid" 
                  readonly 
                  class="share-input"
                />
                <button class="share-copy-btn" @click="copyCid(shareFile?.cid || '')">
                  <Copy :size="16" />
                </button>
              </div>
            </div>

            <div class="share-option">
              <span class="share-label">Public Gateway</span>
              <div class="share-input-group">
                <input 
                  :value="`https://ipfs.io/ipfs/${shareFile?.cid}`" 
                  readonly 
                  class="share-input"
                />
                <button class="share-copy-btn" @click="copyPublicGatewayUrl(shareFile?.cid || '')">
                  <Copy :size="16" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Permalink (IPNS) Modal -->
    <Transition name="modal">
      <div v-if="showPermalinkModal" class="modal-overlay" @click="closePermalinkModal">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>Create Permalink</h3>
            <button class="modal-close" @click="closePermalinkModal">
              <X :size="20" />
            </button>
          </div>
          <div class="modal-body">
            <p class="modal-desc">
              Create a permanent IPNS link that always points to this content
            </p>

            <div v-if="!permalinkCreating && !permalinkResult" class="permalink-options">
              <div class="form-group">
                <label>Select IPNS Key</label>
                <select v-model="selectedPermalinkKey" class="form-select">
                  <option value="self">Default (self)</option>
                  <option v-for="key in ipnsKeys" :key="key.Id" :value="key.Name">
                    {{ key.Name }}
                  </option>
                </select>
              </div>

              <button class="btn-modal-primary" @click="createPermalink">
                <Link2 :size="18" />
                Create Permalink
              </button>

              <div class="permalink-help">
                <AlertCircle :size="16" />
                <span>IPNS links are permanent addresses that can be updated to point to new content</span>
              </div>
            </div>

            <div v-else-if="permalinkCreating" class="permalink-loading">
              <UiSpinner size="md" />
              <p>Creating permalink...</p>
            </div>

            <div v-else-if="permalinkResult" class="permalink-success">
              <div class="success-icon">
                <CheckCircle :size="48" />
              </div>
              <p class="success-title">Permalink Created!</p>
              
              <div class="permalink-result-box">
                <span class="result-label">IPNS Address</span>
                <div class="result-input-group">
                  <input 
                    :value="permalinkResult.name" 
                    readonly 
                    class="result-input"
                  />
                  <button class="result-copy-btn" @click="copyPermalink(permalinkResult.name)">
                    <Copy :size="16" />
                  </button>
                </div>
              </div>

              <div class="permalink-result-box">
                <span class="result-label">Gateway URL</span>
                <div class="result-input-group">
                  <input 
                    :value="`${GATEWAY_URL}/ipns/${permalinkResult.name}`" 
                    readonly 
                    class="result-input"
                  />
                  <button class="result-copy-btn" @click="copyPermalinkGateway">
                    <Copy :size="16" />
                  </button>
                </div>
              </div>

              <button class="btn-modal-secondary" @click="closePermalinkModal">
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { 
  HardDrive, FolderOpen, Pin, Download, Database, Plus, Upload,
  CloudDownload, Copy, ExternalLink, Trash2, X, Link, Link2, Share2,
  FileText, FileImage, FileVideo, FileAudio, FileArchive, File,
  CheckCircle, AlertCircle, LayoutGrid, List, TableProperties
} from 'lucide-vue-next';
import UiSpinner from '../../ui/UiSpinner.vue';

interface DriveFile {
  cid: string;
  name: string;
  size: number;
  uploadedAt?: number;
}

interface IpfsStats {
  repoSize: number;
  storageMax: number;
  numObjects: number;
}

interface IpnsKey {
  Name: string;
  Id: string;
}

const currentView = ref<'files' | 'pinned' | 'fetch'>('files');
const viewMode = ref<'grid' | 'list' | 'details'>('details');
const files = ref<DriveFile[]>([]);
const pinnedFiles = ref<string[]>([]);
const selectedFile = ref<DriveFile | null>(null);
const ipfsConnected = ref(false);
const stats = ref<IpfsStats | null>(null);

const uploading = ref(false);
const uploadingFile = ref('');
const fetching = ref(false);
const fetchCid = ref('');
const fetchError = ref('');
const isDragging = ref(false);

const toast = ref('');
const toastType = ref<'success' | 'error'>('success');

const showShareModal = ref(false);
const shareFile = ref<DriveFile | null>(null);
const showPermalinkModal = ref(false);
const permalinkFile = ref<DriveFile | null>(null);
const permalinkCreating = ref(false);
const permalinkResult = ref<{ name: string; value: string } | null>(null);
const selectedPermalinkKey = ref('self');
const ipnsKeys = ref<IpnsKey[]>([]);

const STORAGE_KEY = 'lumen_drive_files';
const GATEWAY_URL = 'http://127.0.0.1:8088';

const displayFiles = computed(() => {
  if (currentView.value === 'pinned') {
    return pinnedFiles.value.map(cid => {
      const existing = files.value.find(f => f.cid === cid);
      return existing || { cid, name: cid.slice(0, 12) + '...', size: 0 };
    });
  }
  return files.value;
});

const storagePercent = computed(() => {
  if (!stats.value || !stats.value.storageMax) return 0;
  return Math.min(100, (stats.value.repoSize / stats.value.storageMax) * 100);
});

const toastIcon = computed(() => toastType.value === 'success' ? CheckCircle : AlertCircle);

onMounted(async () => {
  await checkIpfsStatus();
  loadFiles();
  loadStats();
  
  document.addEventListener('dragover', handleDragOver);
  document.addEventListener('dragleave', handleDragLeave);
  document.addEventListener('drop', handleDrop);
});

onUnmounted(() => {
  document.removeEventListener('dragover', handleDragOver);
  document.removeEventListener('dragleave', handleDragLeave);
  document.removeEventListener('drop', handleDrop);
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

async function handleDrop(e: DragEvent) {
  e.preventDefault();
  isDragging.value = false;
  
  const droppedFiles = e.dataTransfer?.files;
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
    const result = await (window as any).lumen?.ipfsPinList?.();
    if (result?.ok) {
      pinnedFiles.value = result.pins || [];
    }
  } catch {}
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

async function handleFileUpload(e: Event) {
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

async function uploadFile(file: File) {
  uploading.value = true;
  uploadingFile.value = file.name;

  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    const result = await (window as any).lumen?.ipfsAdd?.(Array.from(bytes), file.name);

    if (result?.cid) {
      files.value.unshift({
        cid: result.cid,
        name: file.name,
        size: file.size,
        uploadedAt: Date.now()
      });
      saveFiles();
      loadStats();
      showToast(`Uploaded: ${file.name}`, 'success');
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

async function fetchFromCid() {
  if (!fetchCid.value) return;
  
  fetching.value = true;
  fetchError.value = '';

  try {
    const result = await (window as any).lumen?.ipfsGet?.(fetchCid.value);
    
    if (result?.ok && result.data) {
      const blob = new Blob([new Uint8Array(result.data)]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fetchCid.value;
      a.click();
      URL.revokeObjectURL(url);
      showToast('File downloaded!', 'success');
    } else {
      fetchError.value = result?.error || 'Failed to fetch content';
    }
  } catch (err) {
    fetchError.value = 'Network error';
  } finally {
    fetching.value = false;
  }
}

async function downloadFile(file: DriveFile) {
  try {
    const result = await (window as any).lumen?.ipfsGet?.(file.cid);
    
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

function copyCid(cid: string) {
  navigator.clipboard.writeText(cid);
  showToast('CID copied!', 'success');
}

function copyGatewayUrl(cid: string) {
  const url = `${GATEWAY_URL}/ipfs/${cid}`;
  navigator.clipboard.writeText(url);
  showToast('URL copied!', 'success');
}

function openInGateway(cid: string) {
  const url = `${GATEWAY_URL}/ipfs/${cid}`;
  window.open(url, '_blank');
}

function selectFile(file: DriveFile) {
  selectedFile.value = file;
}

function deleteFile(cid: string) {
  files.value = files.value.filter(f => f.cid !== cid);
  saveFiles();
  if (selectedFile.value?.cid === cid) {
    selectedFile.value = null;
  }
  showToast('File removed', 'success');
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
  return `${GATEWAY_URL}/ipfs/${cid}`;
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

function openShareModal(file: DriveFile) {
  shareFile.value = file;
  showShareModal.value = true;
}

function closeShareModal() {
  showShareModal.value = false;
  shareFile.value = null;
}

function copyPublicGatewayUrl(cid: string) {
  const url = `https://ipfs.io/ipfs/${cid}`;
  navigator.clipboard.writeText(url);
  showToast('Public URL copied!', 'success');
}

async function openPermalinkModal(file: DriveFile) {
  permalinkFile.value = file;
  permalinkResult.value = null;
  selectedPermalinkKey.value = 'self';
  
  try {
    const anyWindow: any = window;
    const result = await anyWindow.lumen?.ipfsKeyList();
    if (result?.ok && result.keys) {
      ipnsKeys.value = result.keys.filter((k: IpnsKey) => k.Name !== 'self');
    }
  } catch (e) {
    console.warn('Failed to load IPNS keys:', e);
  }
  
  showPermalinkModal.value = true;
}

function closePermalinkModal() {
  showPermalinkModal.value = false;
  permalinkFile.value = null;
  permalinkResult.value = null;
  permalinkCreating.value = false;
}

async function createPermalink() {
  if (!permalinkFile.value) return;
  
  permalinkCreating.value = true;
  
  try {
    const anyWindow: any = window;
    const result = await anyWindow.lumen?.ipfsPublishToIPNS(
      permalinkFile.value.cid,
      selectedPermalinkKey.value
    );
    
    if (result?.ok && result.name) {
      permalinkResult.value = {
        name: result.name,
        value: result.value
      };
      showToast('Permalink created!', 'success');
    } else {
      showToast('Failed to create permalink', 'error');
      closePermalinkModal();
    }
  } catch (e) {
    console.error('Error creating permalink:', e);
    showToast('Error creating permalink', 'error');
    closePermalinkModal();
  } finally {
    permalinkCreating.value = false;
  }
}

function copyPermalink(name: string) {
  navigator.clipboard.writeText(name);
  showToast('IPNS address copied!', 'success');
}

function copyPermalinkGateway() {
  if (permalinkResult.value) {
    const url = `${GATEWAY_URL}/ipns/${permalinkResult.value.name}`;
    navigator.clipboard.writeText(url);
    showToast('Permalink URL copied!', 'success');
  }
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
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
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
  background: #3498db;
  color: white;
}

.storage-stats {
  padding: 1rem;
  background: var(--card-bg, #f8fafc);
  border-radius: 12px;
  margin-top: 1rem;
  margin-bottom: 0.75rem;
  border: 1px solid var(--border-color, #e2e8f0);
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
  background: linear-gradient(90deg, #3498db 0%, #2980b9 100%);
  border-radius: 3px;
  transition: width 0.3s;
}

.stats-value {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
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

.upload-btn, .upload-btn-large {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
}

.upload-btn:hover, .upload-btn-large:hover {
  background: linear-gradient(135deg, #2980b9 0%, #1a5276 100%);
  box-shadow: 0 6px 16px rgba(52, 152, 219, 0.4);
  transform: translateY(-1px);
}

.upload-btn input, .upload-btn-large input {
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
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 8px 24px rgba(52, 152, 219, 0.25);
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
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
}

.fetch-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #2980b9 0%, #1a5276 100%);
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
  background: #eff6ff;
  border-color: #3498db;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.15);
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
  background: #3498db;
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
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  border: none;
  color: white;
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
}

.detail-btn.primary:hover {
  background: linear-gradient(135deg, #2980b9 0%, #1a5276 100%);
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(52, 152, 219, 0.4);
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
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
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
  color: #3498db;
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
  background: #eff6ff;
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
  background: #eff6ff;
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
  color: #3498db;
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
  background: #3498db;
  color: white;
}

.td-actions .action-btn.danger:hover {
  background: #e74c3c;
}

.files-table tbody tr:hover .td-actions .action-btn {
  background: #3498db;
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
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
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
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
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
  border-color: #3498db;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.btn-modal-primary {
  width: 100%;
  padding: 0.875rem;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
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
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
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
  border-top-color: #3498db;
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
  background: #3498db;
  color: white;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.result-copy-btn:hover {
  background: #2980b9;
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

