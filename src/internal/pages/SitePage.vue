<template>
  <div class="site-page">
    <main class="main-content">
      <header v-if="error" class="content-header">
        <div class="header-actions">
          <button v-if="error" class="plans-btn" type="button" @click="retry" :disabled="loading">
            <RefreshCw :size="16" />
            <span>Retry</span>
          </button>
        </div>
      </header>

      <div v-if="loading" class="loading-wrap">
        <UiSpinner size="md" />
        <div class="loading-lines">
          <span class="txt-xs color-gray-blue">Resolving on-chain content…</span>
          <span v-if="statusLine" class="txt-xs color-gray-blue">{{ statusLine }}</span>
        </div>
      </div>

      <div v-else-if="error" class="error-wrap">
        <div class="error-content">
          <h3>{{ error }}</h3>
          <div class="error-details">
            <p>This content may not be available because:</p>
            <ul>
              <li>The content hasn't been pinned to any gateway yet</li>
              <li>The gateway servers are slow or unavailable</li>
              <li>Your local IPFS node doesn't have this content</li>
              <li>The domain record doesn't point to valid content</li>
            </ul>
            <p class="error-hint">Try again later or check if the content exists on IPFS.</p>
          </div>
        </div>
      </div>

      <div v-else class="viewer">
        <iframe
          v-if="resolvedHttpUrl"
          class="site-frame"
          :src="resolvedHttpUrl"
          referrerpolicy="no-referrer"
          sandbox="allow-scripts allow-forms allow-same-origin"
        ></iframe>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { inject, ref, watch } from 'vue';
import { RefreshCw } from 'lucide-vue-next';
import UiSpinner from '../../ui/UiSpinner.vue';
import {
  buildCandidateUrl,
  normalizePath,
  pickFastestSource,
  resolveDomainTarget,
} from '../services/contentResolver';

const currentTabUrl = inject<any>('currentTabUrl', null);

const loading = ref(false);
const error = ref('');
const resolvedHttpUrl = ref('');
const statusLine = ref('');

function parseLumenUrl(raw: string): { host: string; path: string; suffix: string } {
  const s = String(raw || '').trim();
  const u = /^lumen:\/\//i.test(s) ? s.slice('lumen://'.length) : s;
  const host = (u.split(/[\/?#]/, 1)[0] || '').trim();
  const afterHost = u.slice(host.length);
  const m = afterHost.match(/^([^?#]*)(.*)$/);
  const path = m?.[1] || '';
  const suffix = m?.[2] || '';
  return { host, path: path || '/', suffix };
}

async function resolveAndLoad() {
  const url = currentTabUrl?.value || window.location.href;
  const parsed = parseLumenUrl(url);
  const host = parsed.host;
  const path = normalizePath(parsed.path || '/');
  const suffix = parsed.suffix || '';

  loading.value = true;
  error.value = '';
  resolvedHttpUrl.value = '';
  statusLine.value = '';

  try {
    const { target } = await resolveDomainTarget(host);
    let effectivePath = path;

    if (effectivePath === '/' || effectivePath === '') {
      const indexPath = '/index.html';
      try {
        const picked = await pickFastestSource(target, indexPath, suffix, {
          onStatus: (s) => {
            statusLine.value = s;
          },
        });
        resolvedHttpUrl.value = buildCandidateUrl(picked.base, target, indexPath, suffix);
        return;
      } catch {
        effectivePath = '/';
      }
    }

    const picked = await pickFastestSource(target, effectivePath, suffix, {
      onStatus: (s) => {
        statusLine.value = s;
      },
    });
    resolvedHttpUrl.value = buildCandidateUrl(picked.base, target, effectivePath, suffix);
  } catch (e: any) {
    const isAgg = typeof AggregateError !== 'undefined' && e instanceof AggregateError;
    error.value = isAgg
      ? 'No source could serve this content.'
      : String(e?.message || e || 'Unable to load this domain.');
  } finally {
    loading.value = false;
    statusLine.value = '';
  }
}

function retry() {
  void resolveAndLoad();
}

watch(
  () => currentTabUrl?.value,
  () => resolveAndLoad(),
  { immediate: true }
);
</script>

<style scoped>
.site-page {
  display: flex;
  width: 100%;
  height: 100vh;
  min-height: 100vh;
  background: var(--bg-primary, #ffffff);
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
  min-height: 0;
}

.content-header {
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem 1rem 0;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.plans-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.9rem;
  border-radius: 10px;
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-secondary, #f8fafc);
  color: var(--text-primary, #1e293b);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.plans-btn:hover:not(:disabled) {
  background: var(--bg-primary, #ffffff);
  border-color: var(--accent-primary);
}

.plans-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-wrap {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 12px;
  border: 1px solid var(--border-color, #e2e8f0);
  background: var(--bg-secondary, #f8fafc);
}

.loading-lines {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.error-wrap {
  padding: 2rem;
  border-radius: 12px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #b91c1c;
}

.error-content h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #991b1b;
}

.error-details {
  color: #7f1d1d;
}

.error-details p {
  margin-bottom: 0.75rem;
  font-size: 0.9375rem;
}

.error-details ul {
  list-style: disc;
  padding-left: 1.5rem;
  margin-bottom: 1rem;
}

.error-details li {
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  color: #b91c1c;
}

.error-hint {
  font-size: 0.875rem;
  font-style: italic;
  color: #dc2626;
  margin-top: 1rem;
}

.viewer {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.site-frame {
  width: 100%;
  height: 100%;
  border: none;
  background: #ffffff;
}
</style>

