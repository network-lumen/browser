<template>
  <div class="extensions-page internal-page">
    <header class="extensions-header">
      <div class="extensions-header-copy">
        <h1>Extensions</h1>
        <p>Browse the Chrome Web Store inside Lumen and import extensions directly.</p>
      </div>

      <form class="extensions-search-form" @submit.prevent="submitSearch">
        <input
          v-model="searchInput"
          type="text"
          class="extensions-search-input"
          placeholder="Search Chrome Web Store, or paste an extension URL / ID"
        />
        <button
          type="submit"
          class="extensions-primary-btn"
          :disabled="feedBusy || detailBusy || !searchInput.trim()"
        >
          {{ searchActionLabel }}
        </button>
      </form>
    </header>

    <section class="extensions-shell">
      <div class="extensions-feed-card">
        <div class="extensions-feed-head">
          <div>
            <div class="extensions-kicker">Chrome Web Store</div>
            <h2>{{ feedTitle }}</h2>
          </div>

          <button
            v-if="activeQuery"
            type="button"
            class="extensions-ghost-btn"
            :disabled="feedBusy"
            @click="resetToHome"
          >
            Home
          </button>
        </div>

        <div class="extensions-feed-subtitle">
          <span>{{ feedSubtitle }}</span>
          <span v-if="results.length">{{ results.length }} shown</span>
        </div>

        <div v-if="feedError" class="extensions-error">
          {{ feedError }}
        </div>

        <div v-else-if="feedBusy" class="extensions-loading">
          Loading Chrome Web Store…
        </div>

        <div v-else-if="results.length" class="extensions-grid">
          <article
            v-for="entry in results"
            :key="entry.id"
            class="extension-card"
            :class="{ selected: selectedExtensionId === entry.id }"
            role="button"
            tabindex="0"
            @click="openExtension(entry)"
            @keydown.enter.prevent="openExtension(entry)"
            @keydown.space.prevent="openExtension(entry)"
          >
            <div class="extension-card-top">
              <div class="extension-card-icon-wrap">
                <img
                  v-if="resolvedIconUrl(entry.id, entry.iconUrl)"
                  :src="resolvedIconUrl(entry.id, entry.iconUrl)"
                  alt=""
                  class="extension-card-icon"
                  @error="handleIconError(entry.id, entry.iconUrl)"
                />
                <div v-else class="extension-card-icon-fallback">
                  {{ initialsFor(entry.title) }}
                </div>
              </div>

              <div class="extension-card-meta">
                <div class="extension-card-title">{{ entry.title }}</div>
                <div class="extension-card-domain">{{ entry.publisher || entry.websiteHost || 'Chrome Web Store' }}</div>
              </div>
            </div>

            <p class="extension-card-description">
              {{ entry.description || 'No description available.' }}
            </p>

            <div class="extension-card-stats">
              <span>{{ formatRating(entry.rating, entry.ratingCount) }}</span>
              <span>{{ formatInstalls(entry.installs) }}</span>
            </div>

            <div class="extension-card-actions">
              <button
                type="button"
                class="extensions-inline-btn"
                @click.stop="openExtension(entry)"
              >
                Details
              </button>
              <button
                type="button"
                class="extensions-inline-btn primary"
                :disabled="importBusyId === entry.id"
                @click.stop="importExtension(entry.id)"
              >
                {{ importBusyId === entry.id ? 'Importing…' : isInstalled(entry.id) ? 'Imported' : 'Import' }}
              </button>
            </div>
          </article>
        </div>

        <div v-else class="extensions-empty">
          No extensions found.
        </div>
      </div>

      <aside class="extensions-sidebar">
        <div class="extensions-detail-card">
          <div class="extensions-kicker">Selected extension</div>

          <div v-if="detailError" class="extensions-error">
            {{ detailError }}
          </div>

          <div v-else-if="detailBusy" class="extensions-loading">
            Loading extension details…
          </div>

          <div v-else-if="selectedPreview" class="store-preview">
            <div class="store-preview-main">
              <div class="store-preview-icon-wrap">
                <img
                  v-if="resolvedIconUrl(selectedPreview.id, selectedPreview.iconUrl)"
                  :src="resolvedIconUrl(selectedPreview.id, selectedPreview.iconUrl)"
                  alt=""
                  class="store-preview-icon"
                  @error="handleIconError(selectedPreview.id, selectedPreview.iconUrl)"
                />
                <div v-else class="store-preview-fallback">
                  {{ initialsFor(selectedPreview.title) }}
                </div>
              </div>

              <div class="store-preview-copy">
                <div class="store-preview-title">{{ selectedPreview.title }}</div>
                <div class="store-preview-publisher">{{ selectedPreview.publisher || selectedPreview.websiteHost || 'Chrome Web Store' }}</div>
                <p class="store-preview-description">
                  {{ selectedPreview.description || 'No description available.' }}
                </p>
              </div>
            </div>

            <div class="store-preview-meta">
              <div class="store-meta-item">
                <span class="store-meta-label">Extension ID</span>
                <span class="store-meta-value mono">{{ selectedPreview.id }}</span>
              </div>
              <div class="store-meta-item">
                <span class="store-meta-label">Rating</span>
                <span class="store-meta-value">{{ formatRating(selectedPreview.rating, selectedPreview.ratingCount) }}</span>
              </div>
              <div class="store-meta-item">
                <span class="store-meta-label">Users</span>
                <span class="store-meta-value">{{ formatInstalls(selectedPreview.installs) }}</span>
              </div>
              <div v-if="selectedPreview.size" class="store-meta-item">
                <span class="store-meta-label">Size</span>
                <span class="store-meta-value">{{ selectedPreview.size }}</span>
              </div>
              <div v-if="selectedPreview.languages" class="store-meta-item">
                <span class="store-meta-label">Languages</span>
                <span class="store-meta-value">{{ selectedPreview.languages }}</span>
              </div>
              <div v-if="selectedPreview.websiteHost" class="store-meta-item">
                <span class="store-meta-label">Website</span>
                <span class="store-meta-value">{{ selectedPreview.websiteHost }}</span>
              </div>
            </div>

            <div class="store-preview-actions">
              <button
                type="button"
                class="extensions-primary-btn"
                :disabled="importBusyId === selectedPreview.id"
                @click="importExtension(selectedPreview.id)"
              >
                {{ importBusyId === selectedPreview.id ? 'Importing…' : isInstalled(selectedPreview.id) ? 'Imported' : 'Import extension' }}
              </button>
            </div>
          </div>

          <div v-else class="extensions-empty compact">
            Select an extension to preview it here.
          </div>

          <div v-if="importMessage" class="extensions-message">
            {{ importMessage }}
          </div>
        </div>

        <div class="extensions-installed-card">
          <div class="extensions-kicker">Library</div>
          <h2>Imported extensions</h2>

          <div v-if="installedExtensions.length" class="installed-list">
            <div
              v-for="entry in installedExtensions"
              :key="entry.id"
              class="installed-row"
            >
              <div class="installed-copy">
                <div class="installed-name">{{ entry.name }}</div>
                <div class="installed-subline">
                  <span>{{ entry.enabled ? 'Enabled' : 'Disabled' }}</span>
                  <span v-if="entry.version">v{{ entry.version }}</span>
                </div>
                <div v-if="entry.lastError" class="installed-error">{{ entry.lastError }}</div>
              </div>
            </div>
          </div>

          <div v-else class="installed-empty">
            No imported extensions yet.
          </div>
        </div>
      </aside>
    </section>

    <div class="extensions-bottom-spacer" aria-hidden="true"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue';

type StoreCard = {
  id: string;
  title: string;
  description: string;
  iconUrl: string;
  heroImage: string;
  publisher: string;
  website: string;
  websiteHost: string;
  category: string;
  rating: number | null;
  ratingCount: number | null;
  installs: number | null;
};

type StorePreview = StoreCard & {
  size: string;
  languages: string;
  url: string;
};

type InstalledExtension = {
  id: string;
  name: string;
  version?: string;
  enabled: boolean;
  loaded?: boolean;
  lastError?: string;
};

type RouteState = {
  q: string;
  id: string;
  input: string;
};

const STORE_CATEGORY_URL = 'https://chromewebstore.google.com/category/extensions';
const STORE_SEARCH_BASE_URL = 'https://chromewebstore.google.com/search/';

const currentTabUrl = inject<any>('currentTabUrl', null);
const navigate = inject<((url: string, opts?: { push?: boolean }) => void) | null>('navigate', null);

const searchInput = ref('');
const activeQuery = ref('');
const results = ref<StoreCard[]>([]);
const selectedPreview = ref<StorePreview | null>(null);
const feedBusy = ref(false);
const detailBusy = ref(false);
const feedError = ref('');
const detailError = ref('');
const importMessage = ref('');
const importBusyId = ref('');
const installedExtensions = ref<InstalledExtension[]>([]);
const proxiedIconUrls = ref<Record<string, string>>({});

let detachExtensionsListener: null | (() => void) = null;
let feedRequestToken = 0;
let detailRequestToken = 0;
const iconBinaryCache = new Map<string, string>();
const iconRequestsInFlight = new Set<string>();

const selectedExtensionId = computed(() => safeString(selectedPreview.value?.id, 128));
const installedExtensionIds = computed(() => new Set(installedExtensions.value.map((entry) => entry.id)));
const resolvedSearchId = computed(() => extractChromeWebStoreId(searchInput.value));
const searchActionLabel = computed(() => (resolvedSearchId.value ? 'Open' : 'Search'));
const feedTitle = computed(() => (activeQuery.value ? `Search results for "${activeQuery.value}"` : 'Browse extensions'));
const feedSubtitle = computed(() =>
  activeQuery.value
    ? 'Global search across the Chrome Web Store.'
    : 'Popular extensions pulled from the Chrome Web Store home page.'
);

function safeString(value: unknown, maxLen = 4096) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

function safeNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = value.replace(/[^0-9.+-]/g, '');
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function initialsFor(title: string) {
  const label = safeString(title, 256);
  if (!label) return 'EX';
  return (
    label
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'EX'
  );
}

function extractChromeWebStoreId(input: string) {
  const raw = safeString(input, 4096);
  if (!raw) return '';

  const direct = raw.match(/\b([a-p]{32})\b/i);
  if (direct) return String(direct[1] || '').toLowerCase();

  try {
    const url = new URL(raw);
    const segments = String(url.pathname || '')
      .split('/')
      .map((segment) => safeString(segment, 128))
      .filter(Boolean);
    const fromPath = segments.find((segment) => /^[a-p]{32}$/i.test(segment));
    if (fromPath) return String(fromPath).toLowerCase();

    const fromSearch =
      safeString(url.searchParams.get('id'), 64) ||
      safeString(url.searchParams.get('extension_id'), 64);
    if (/^[a-p]{32}$/i.test(fromSearch)) return fromSearch.toLowerCase();
  } catch {
    // ignore invalid url
  }

  return '';
}

function buildDetailUrl(extensionId: string) {
  const id = safeString(extensionId, 64);
  return id ? `https://chromewebstore.google.com/detail/${id}` : '';
}

function buildSearchUrl(query: string) {
  const q = safeString(query, 512);
  return q ? `${STORE_SEARCH_BASE_URL}${encodeURIComponent(q)}` : STORE_CATEGORY_URL;
}

function hostFromUrl(raw: string) {
  try {
    const url = new URL(String(raw || '').trim());
    return safeString(url.hostname || '', 255);
  } catch {
    return '';
  }
}

function escapeRegex(value: string) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildRouteUrl(state: Partial<RouteState>) {
  const params = new URLSearchParams();
  const q = safeString(state.q, 512);
  const id = extractChromeWebStoreId(state.id || '');
  const input = safeString(state.input, 4096);
  if (q) params.set('q', q);
  if (id) params.set('id', id);
  if (input) params.set('input', input);
  const query = params.toString();
  return query ? `lumen://extensions?${query}` : 'lumen://extensions';
}

function updateRouteState(state: Partial<RouteState>) {
  if (!navigate) return;
  const next = buildRouteUrl(state);
  const current = safeString(currentTabUrl?.value, 4096);
  if (current !== next) {
    navigate(next, { push: false });
  }
}

function readRouteState(raw: string): RouteState {
  const value = safeString(raw, 4096);
  if (!/^lumen:\/\//i.test(value)) {
    return { q: '', id: '', input: '' };
  }

  const queryString = value.includes('?') ? value.split('?', 2)[1] : '';
  try {
    const params = new URLSearchParams(queryString || '');
    return {
      q: safeString(params.get('q') || '', 512),
      id: extractChromeWebStoreId(params.get('id') || ''),
      input: safeString(params.get('input') || '', 4096)
    };
  } catch {
    return { q: '', id: '', input: '' };
  }
}

function parseInitData(html: string, key: 'ds:0' | 'ds:1') {
  const source = String(html || '');
  const marker = `AF_initDataCallback({key: '${key}'`;
  const start = source.indexOf(marker);
  if (start === -1) return null;

  const dataIndex = source.indexOf('data:', start);
  if (dataIndex === -1) return null;

  const sideChannelIndex = source.indexOf(', sideChannel:', dataIndex);
  if (sideChannelIndex === -1) return null;

  const literal = source.slice(dataIndex + 'data:'.length, sideChannelIndex).trim();
  if (!literal) return null;

  try {
    return JSON.parse(literal);
  } catch {
    return null;
  }
}

function isStoreCardCandidate(node: unknown): node is any[] {
  if (!Array.isArray(node)) return false;
  if (!/^[a-p]{32}$/i.test(String(node[0] || ''))) return false;
  if (typeof node[2] !== 'string' || !String(node[2] || '').trim()) return false;
  return true;
}

function toStoreCard(node: any[]): StoreCard | null {
  const id = extractChromeWebStoreId(String(node[0] || ''));
  const title = safeString(node[2], 512);
  if (!id || !title) return null;

  const website = safeString(node[7], 2048);
  const publisherCandidates = [
    safeString(node[18], 256),
    safeString(node[19], 256),
    safeString(node[8], 256)
  ];
  const publisher = publisherCandidates.find((value) => {
    if (!value) return false;
    if (value.startsWith('{') || value.startsWith('[')) return false;
    if (value.includes('\n') || value.includes('\r')) return false;
    return value.length <= 120;
  }) || '';

  return {
    id,
    title,
    description: safeString(node[6], 4096),
    iconUrl: safeString(node[1], 8192),
    heroImage: safeString(node[5], 8192),
    publisher,
    website,
    websiteHost: hostFromUrl(website),
    category: Array.isArray(node[10]) ? safeString(node[10][0], 128) : '',
    rating: safeNumber(node[3]),
    ratingCount: safeNumber(node[4]),
    installs: safeNumber(node[14])
  };
}

function extractStoreCards(data: unknown) {
  const ordered = new Map<string, StoreCard>();

  const visit = (node: unknown) => {
    if (isStoreCardCandidate(node)) {
      const card = toStoreCard(node);
      if (card && !ordered.has(card.id)) {
        ordered.set(card.id, card);
      }
    }

    if (Array.isArray(node)) {
      for (const entry of node) {
        visit(entry);
      }
    }
  };

  visit(data);
  return Array.from(ordered.values());
}

function parseStoreMetadata(html: string, fallbackId: string, fallbackCard: StoreCard | null): StorePreview {
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(html || ''), 'text/html');

  const readMeta = (name: string) =>
    safeString(
      doc.querySelector(`meta[property="${name}"]`)?.getAttribute('content') ||
      doc.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ||
      '',
      8192
    );

  const bodyHtml = String(html || '');
  const readLabeledValue = (label: string) => {
    const pattern = new RegExp(`>${escapeRegex(label)}<\\/div><div(?:[^>]*)>(.*?)<\\/div>`, 'i');
    const match = bodyHtml.match(pattern);
    if (!match || !match[1]) return '';
    return safeString(
      String(match[1])
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' '),
      2048
    );
  };

  const titleRaw = readMeta('og:title') || safeString(doc.title || '', 512);
  const title = titleRaw.replace(/\s*-\s*Chrome Web Store\s*$/i, '').trim() || fallbackCard?.title || 'Unknown extension';
  const description = readMeta('og:description') || readMeta('description') || fallbackCard?.description || '';
  const iconUrl = readMeta('og:image') || fallbackCard?.iconUrl || '';
  const canonicalUrl = readMeta('og:url') || buildDetailUrl(fallbackId);
  const publisher = readLabeledValue('Offered by') || fallbackCard?.publisher || '';
  const website = fallbackCard?.website || '';

  return {
    id: extractChromeWebStoreId(canonicalUrl) || fallbackId,
    title,
    description,
    iconUrl,
    heroImage: fallbackCard?.heroImage || '',
    publisher,
    website,
    websiteHost: hostFromUrl(website),
    category: fallbackCard?.category || '',
    rating: fallbackCard?.rating ?? null,
    ratingCount: fallbackCard?.ratingCount ?? null,
    installs: fallbackCard?.installs ?? null,
    size: readLabeledValue('Size'),
    languages: readLabeledValue('Languages'),
    url: canonicalUrl
  };
}

function resolvedIconUrl(extensionId: string, rawUrl: string) {
  const id = extractChromeWebStoreId(extensionId);
  return proxiedIconUrls.value[id] || safeString(rawUrl, 8192);
}

function buildDataUrl(contentType: string, dataB64: string) {
  const mime = safeString(contentType, 256) || 'image/png';
  const payload = safeString(dataB64, Number.MAX_SAFE_INTEGER);
  if (!payload) return '';
  return `data:${mime};base64,${payload}`;
}

async function cacheIconDataUrl(extensionId: string, rawUrl: string) {
  const id = extractChromeWebStoreId(extensionId);
  const iconUrl = safeString(rawUrl, 8192);
  if (!id || !iconUrl) return '';

  const existing = proxiedIconUrls.value[id];
  if (existing) return existing;

  const cached = iconBinaryCache.get(iconUrl);
  if (cached) {
    proxiedIconUrls.value = {
      ...proxiedIconUrls.value,
      [id]: cached
    };
    return cached;
  }

  if (iconRequestsInFlight.has(iconUrl)) return '';
  iconRequestsInFlight.add(iconUrl);
  try {
    const response = await (window as any).lumen?.httpGetBytes?.(iconUrl, {
      timeout: 30000,
      headers: {
        accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9'
      }
    });
    if (!response || response.ok === false || !response.dataB64) {
      return '';
    }

    const dataUrl = buildDataUrl(
      safeString(response?.headers?.['content-type'], 256) || 'image/png',
      safeString(response.dataB64, Number.MAX_SAFE_INTEGER)
    );
    if (!dataUrl) return '';

    iconBinaryCache.set(iconUrl, dataUrl);
    proxiedIconUrls.value = {
      ...proxiedIconUrls.value,
      [id]: dataUrl
    };
    return dataUrl;
  } catch {
    return '';
  } finally {
    iconRequestsInFlight.delete(iconUrl);
  }
}

function handleIconError(extensionId: string, rawUrl: string) {
  void cacheIconDataUrl(extensionId, rawUrl);
}

function hydrateVisibleIcons(entries: StoreCard[]) {
  const cards = Array.isArray(entries) ? entries.slice(0, 64) : [];
  for (const entry of cards) {
    if (!entry?.id || !entry?.iconUrl) continue;
    void cacheIconDataUrl(entry.id, entry.iconUrl);
  }
}

async function fetchHtml(url: string) {
  const response = await (window as any).lumen?.httpGet?.(url, {
    timeout: 30000,
    headers: {
      'accept-language': 'en-US,en;q=0.9'
    }
  });

  if (!response || response.ok === false || !response.text) {
    throw new Error(response?.error || 'chrome_web_store_fetch_failed');
  }

  return String(response.text || '');
}

async function loadFeed(query: string) {
  const token = ++feedRequestToken;
  feedBusy.value = true;
  feedError.value = '';

  try {
    const html = await fetchHtml(buildSearchUrl(query));
    if (token !== feedRequestToken) return;

    const data = parseInitData(html, 'ds:1');
    const cards = extractStoreCards(data);
    const normalized = query
      ? cards
      : [...cards].sort((a, b) => (b.installs || 0) - (a.installs || 0)).slice(0, 48);

    results.value = normalized;
    hydrateVisibleIcons(normalized);
    if (!normalized.length) {
      feedError.value = query ? 'No results found for that search.' : 'Failed to load Chrome Web Store home.';
    }
  } catch {
    if (token !== feedRequestToken) return;
    results.value = [];
    feedError.value = query
      ? 'Failed to search the Chrome Web Store.'
      : 'Failed to load the Chrome Web Store home page.';
  } finally {
    if (token === feedRequestToken) {
      feedBusy.value = false;
    }
  }
}

async function loadSelectedPreview(extensionId: string, fallbackCard: StoreCard | null = null) {
  const id = extractChromeWebStoreId(extensionId);
  if (!id) {
    selectedPreview.value = null;
    detailError.value = '';
    return;
  }

  const token = ++detailRequestToken;
  detailBusy.value = true;
  detailError.value = '';

  try {
    const html = await fetchHtml(buildDetailUrl(id));
    if (token !== detailRequestToken) return;
    selectedPreview.value = parseStoreMetadata(html, id, fallbackCard);
    void cacheIconDataUrl(id, selectedPreview.value?.iconUrl || fallbackCard?.iconUrl || '');
  } catch {
    if (token !== detailRequestToken) return;
    if (fallbackCard) {
      selectedPreview.value = {
        ...fallbackCard,
        size: '',
        languages: '',
        url: buildDetailUrl(id)
      };
      void cacheIconDataUrl(id, fallbackCard.iconUrl);
    } else {
      selectedPreview.value = null;
      detailError.value = 'Failed to load extension details.';
    }
  } finally {
    if (token === detailRequestToken) {
      detailBusy.value = false;
    }
  }
}

async function refreshInstalledExtensions() {
  try {
    const api = (window as any).lumen?.extensions;
    if (!api || typeof api.listExtensions !== 'function') return;
    const result = await api.listExtensions();
    if (!result || result.ok === false) return;
    const items = Array.isArray(result.extensions) ? result.extensions : [];
    installedExtensions.value = items
      .map((entry: any) => ({
        id: safeString(entry?.id, 128),
        name: safeString(entry?.name, 256) || 'Unnamed extension',
        version: safeString(entry?.version, 64),
        enabled: !!entry?.enabled,
        loaded: !!entry?.loaded,
        lastError: safeString(entry?.lastError, 2048)
      }))
      .filter((entry: InstalledExtension) => !!entry.id)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    // ignore
  }
}

function isInstalled(extensionId: string) {
  return installedExtensionIds.value.has(extractChromeWebStoreId(extensionId));
}

function openExtension(card: StoreCard) {
  updateRouteState({ q: safeString(activeQuery.value, 512), id: card.id });
}

function resetToHome() {
  updateRouteState({});
}

function submitSearch() {
  const directId = resolvedSearchId.value;
  const raw = safeString(searchInput.value, 512);
  if (directId) {
    updateRouteState({ q: safeString(activeQuery.value, 512), id: directId, input: raw });
    return;
  }

  if (!raw) {
    updateRouteState({});
    return;
  }

  updateRouteState({ q: raw });
}

async function importExtension(extensionId: string) {
  const id = extractChromeWebStoreId(extensionId);
  if (!id) return;

  const api = (window as any).lumen?.extensions;
  if (!api || typeof api.installFromChromeWebStore !== 'function') {
    importMessage.value = 'Extensions API is unavailable.';
    return;
  }

  importBusyId.value = id;
  importMessage.value = '';
  try {
    const result = await api.installFromChromeWebStore(id);
    if (!result || result.ok === false) {
      importMessage.value = result?.error || 'Import failed.';
      return;
    }
    importMessage.value = 'Extension imported.';
    await refreshInstalledExtensions();
  } catch {
    importMessage.value = 'Import failed.';
  } finally {
    importBusyId.value = '';
  }
}

function formatRating(rating: number | null, ratingCount: number | null) {
  if (!rating) return 'No ratings';
  const ratingLabel = rating.toFixed(1);
  if (!ratingCount) return `${ratingLabel} / 5`;
  return `${ratingLabel} / 5 (${formatCompactNumber(ratingCount)})`;
}

function formatInstalls(installs: number | null) {
  if (!installs) return 'Users unavailable';
  return `${formatCompactNumber(installs)} users`;
}

function formatCompactNumber(value: number) {
  try {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(value);
  } catch {
    return String(value);
  }
}

watch(
  () => currentTabUrl?.value,
  (nextUrl) => {
    const route = readRouteState(nextUrl || '');
    const routeInputId = extractChromeWebStoreId(route.input);
    const nextQuery = route.q || (!route.id && !routeInputId ? route.input : '');
    const nextSelectedId = route.id || routeInputId;

    if (searchInput.value !== nextQuery) {
      searchInput.value = nextQuery;
    }
    activeQuery.value = nextQuery;
    importMessage.value = '';

    void loadFeed(nextQuery);

    if (nextSelectedId) {
      const fallbackCard = results.value.find((entry) => entry.id === nextSelectedId) || null;
      void loadSelectedPreview(nextSelectedId, fallbackCard);
    } else {
      ++detailRequestToken;
      detailBusy.value = false;
      detailError.value = '';
      selectedPreview.value = null;
    }
  },
  { immediate: true }
);

watch(
  () => results.value,
  (nextResults) => {
    hydrateVisibleIcons(nextResults);
    if (!selectedExtensionId.value) return;
    const fallbackCard = nextResults.find((entry) => entry.id === selectedExtensionId.value);
    if (!fallbackCard || selectedPreview.value?.id !== fallbackCard.id) return;
    selectedPreview.value = {
      ...fallbackCard,
      size: selectedPreview.value?.size || '',
      languages: selectedPreview.value?.languages || '',
      url: selectedPreview.value?.url || buildDetailUrl(fallbackCard.id)
    };
    void cacheIconDataUrl(fallbackCard.id, fallbackCard.iconUrl);
  }
);

watch(
  () => searchInput.value,
  () => {
    feedError.value = '';
    detailError.value = '';
    importMessage.value = '';
  }
);

onMounted(() => {
  void refreshInstalledExtensions();
  try {
    const api = (window as any).lumen?.extensions;
    if (api && typeof api.onChanged === 'function') {
      detachExtensionsListener = api.onChanged(() => {
        void refreshInstalledExtensions();
      });
    }
  } catch {
    // ignore
  }
});

onBeforeUnmount(() => {
  try {
    detachExtensionsListener?.();
  } catch {
    // ignore
  }
  detachExtensionsListener = null;
});
</script>

<style scoped>
.extensions-page {
  padding: 1.25rem 1.25rem 5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
  overscroll-behavior: contain;
}

.extensions-page::-webkit-scrollbar {
  width: 10px;
}

.extensions-page::-webkit-scrollbar-track {
  background: transparent;
}

.extensions-page::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: color-mix(in srgb, var(--border-color) 88%, transparent);
  border: 2px solid transparent;
  background-clip: padding-box;
}

.extensions-page::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--text-tertiary) 78%, transparent);
  border: 2px solid transparent;
  background-clip: padding-box;
}

.extensions-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.extensions-header-copy h1 {
  margin: 0;
  font-size: 1.55rem;
  font-weight: 800;
  color: var(--text-primary);
}

.extensions-header-copy p {
  margin: 0.35rem 0 0;
  color: var(--text-secondary);
  line-height: 1.5;
}

.extensions-search-form {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: min(100%, 620px);
}

.extensions-search-input {
  flex: 1;
  min-width: 220px;
  padding: 0.9rem 1rem;
  border-radius: 16px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 0.95rem;
}

.extensions-search-input:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--primary-a10);
}

.extensions-primary-btn,
.extensions-ghost-btn,
.extensions-inline-btn {
  border: none;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 700;
  transition: filter 0.15s ease, opacity 0.15s ease, transform 0.15s ease;
}

.extensions-primary-btn:hover:not(:disabled),
.extensions-ghost-btn:hover:not(:disabled),
.extensions-inline-btn:hover:not(:disabled) {
  filter: brightness(1.05);
}

.extensions-primary-btn:disabled,
.extensions-ghost-btn:disabled,
.extensions-inline-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.extensions-primary-btn {
  padding: 0.85rem 1.15rem;
  background: var(--accent-primary);
  color: #fff;
}

.extensions-ghost-btn {
  padding: 0.7rem 1rem;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.extensions-inline-btn {
  padding: 0.45rem 0.8rem;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  font-size: 0.84rem;
}

.extensions-inline-btn.primary {
  background: var(--accent-primary);
  color: #fff;
  border-color: transparent;
}

.extensions-shell {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(380px, 1fr);
  gap: 1rem;
  min-height: 0;
  align-items: start;
}

.extensions-bottom-spacer {
  flex: 0 0 auto;
  width: 100%;
  min-height: 7rem;
}

.extensions-feed-card,
.extensions-detail-card,
.extensions-installed-card {
  border: 1px solid var(--border-color);
  border-radius: 20px;
  background: var(--card-bg);
  box-shadow: var(--shadow-sm);
}

.extensions-feed-card {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 0;
  height: max-content;
  align-self: start;
  margin-bottom: 2.5rem;
}

.extensions-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 0;
  align-self: start;
}

.extensions-detail-card,
.extensions-installed-card {
  padding: 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.extensions-detail-card {
  min-height: 360px;
}

.extensions-installed-card {
  min-height: 260px;
  flex: 1;
}

.extensions-feed-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.extensions-feed-head h2,
.extensions-installed-card h2 {
  margin: 0.15rem 0 0;
  font-size: 1.12rem;
  color: var(--text-primary);
}

.extensions-kicker {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--accent-primary);
}

.extensions-feed-subtitle {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.extensions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 0.85rem;
}

.extension-card {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  padding: 0.95rem;
  border-radius: 18px;
  border: 1px solid var(--border-light);
  background: var(--bg-secondary);
  cursor: pointer;
  min-height: 0;
  transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.extension-card:hover {
  transform: translateY(-1px);
  border-color: var(--accent-primary);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
}

.extension-card.selected {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 1px var(--primary-a20);
}

.extension-card-top {
  display: flex;
  gap: 0.75rem;
  min-width: 0;
}

.extension-card-icon-wrap {
  flex: 0 0 auto;
}

.extension-card-icon,
.extension-card-icon-fallback {
  width: 56px;
  height: 56px;
  border-radius: 16px;
}

.extension-card-icon {
  display: block;
  object-fit: cover;
  border: 1px solid var(--border-color);
  background: #fff;
}

.extension-card-icon-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary, var(--accent-primary)));
}

.extension-card-meta {
  min-width: 0;
}

.extension-card-title {
  font-size: 0.98rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.3;
  word-break: break-word;
}

.extension-card-domain {
  margin-top: 0.15rem;
  font-size: 0.84rem;
  color: var(--text-secondary);
}

.extension-card-description {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.extension-card-stats {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.82rem;
  color: var(--text-tertiary);
}

.extension-card-actions {
  margin-top: auto;
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}

.extensions-error,
.extensions-message,
.extensions-loading,
.extensions-empty {
  font-size: 0.92rem;
  border-radius: 14px;
  padding: 0.85rem 0.95rem;
}

.extensions-error {
  background: rgba(185, 28, 28, 0.08);
  color: #b91c1c;
}

.extensions-message {
  background: rgba(11, 87, 208, 0.08);
  color: var(--accent-primary);
}

.extensions-loading,
.extensions-empty {
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.extensions-empty.compact {
  padding: 1rem;
}

.store-preview {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.store-preview-main {
  display: flex;
  gap: 1rem;
}

.store-preview-icon-wrap {
  flex: 0 0 auto;
}

.store-preview-icon,
.store-preview-fallback {
  width: 96px;
  height: 96px;
  border-radius: 26px;
}

.store-preview-icon {
  display: block;
  object-fit: cover;
  border: 1px solid var(--border-color);
  background: #fff;
}

.store-preview-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary, var(--accent-primary)));
  color: #fff;
  font-size: 1.5rem;
  font-weight: 800;
}

.store-preview-copy {
  min-width: 0;
}

.store-preview-title {
  font-size: 1.24rem;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1.3;
}

.store-preview-publisher {
  margin-top: 0.2rem;
  color: var(--text-secondary);
  font-weight: 600;
}

.store-preview-description {
  margin: 0.7rem 0 0;
  color: var(--text-secondary);
  line-height: 1.55;
  font-size: 0.95rem;
}

.store-preview-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.store-meta-item {
  padding: 0.85rem 0.95rem;
  border-radius: 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  min-width: 0;
}

.store-meta-label {
  display: block;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.store-meta-value {
  display: block;
  margin-top: 0.25rem;
  color: var(--text-primary);
  word-break: break-word;
}

.store-preview-actions {
  display: flex;
  justify-content: flex-start;
}

.installed-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.installed-row {
  padding: 0.9rem 1rem;
  border-radius: 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
}

.installed-name {
  font-weight: 700;
  color: var(--text-primary);
}

.installed-subline {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.2rem;
  color: var(--text-secondary);
  font-size: 0.88rem;
  flex-wrap: wrap;
}

.installed-error {
  margin-top: 0.35rem;
  color: #b91c1c;
  font-size: 0.84rem;
}

.installed-empty {
  color: var(--text-secondary);
  flex: 1;
  min-height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0.75rem;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

@media (max-width: 1080px) {
  .extensions-shell {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .extensions-search-form {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }

  .extensions-feed-head,
  .extensions-feed-subtitle,
  .extension-card-actions,
  .store-preview-main {
    flex-direction: column;
  }

  .extensions-grid,
  .store-preview-meta {
    grid-template-columns: 1fr;
  }
}
</style>
