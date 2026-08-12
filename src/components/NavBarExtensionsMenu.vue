<template>
  <div class="appregion-no-drag relative ml-n8px">
    <UiButton
      variant="icon"
      icon-radius-class="border-radius-10px"
      icon-padding-class=""
      class="active-scale-98 disabled-opacity-35-not-allowed extensions-trigger flex-inline-align-justify-center size-32px"
      :class="{ 'color-yellow-override': open }"
      :title="t('Extensions')"
      @click.stop="toggleMenu"
    >
      <Puzzle :size="16" />
    </UiButton>

    <UiCard padding="none" :shadow="false" v-if="open" role="menu" class="navbar-extensions-menu absolute p-8px shadow-xl z-100 right-0 w-340px max-w-min-92vw-340px calc-top-100-6px">
      <div class="text-11px txt-weight-light color-text-tertiary text-uppercase letter-spacing-005em p-0px pr-8px pb-8px pl-8px">{{ t('Extensions') }}</div>

      <div v-if="extensions.length" class="flex flex-column gap-6px overflow-y-auto pr-4px max-h-280px">
        <div
          v-for="ext in extensions"
          :key="ext.id"
          class="flex-align-start gap-10px p-10px border-radius-12px bg-secondary border-05-light"
        >
          <div class="flex-1 min-w-0">
            <div class="text-13px txt-weight-light color-text-primary truncate">{{ ext.name }}</div>
            <div class="flex-align-center flex-wrap-wrap gap-6px mt-4px">
              <span class="text-11px color-text-tertiary" :class="{ 'color-error': !!ext.lastError, disabled: !ext.enabled }">
                {{ extensionStateLabel(ext) }}
              </span>
              <span v-if="ext.version" class="text-11px color-text-tertiary">v{{ ext.version }}</span>
            </div>
            <div v-if="ext.lastError" class="color-error text-11px mt-4px break-word line-height-14">{{ ext.lastError }}</div>
          </div>

          <div class="flex-align-center gap-6px">
            <UiButton variant="icon" icon-radius-class="border-radius-10px" icon-padding-class="" type="button"
              :title="t('Open extension')"
              :disabled="busy || !ext.enabled || !ext.launchUrl"
              @click.stop="openExtension(ext)" class="flex-inline-align-justify-center disabled-fade-50 size-28px">
              <ExternalLink :size="14" />
            </UiButton>

            <UiToggle
              size="sm"
              :title="ext.enabled ? t('Disable extension') : t('Enable extension')"
              :model-value="ext.enabled"
              :disabled="busy"
              @update:model-value="toggleExtensionEnabled(ext)"
            />

            <UiButton variant="icon" icon-radius-class="border-radius-10px" icon-padding-class="" type="button"
              :title="t('Reload extension')"
              :disabled="busy || !ext.enabled"
              @click.stop="reloadExtension(ext.id)" class="flex-inline-align-justify-center disabled-fade-50 size-28px">
              <RefreshCw :size="14" />
            </UiButton>

            <UiButton variant="danger" type="button"
              :title="t('Remove extension')"
              :disabled="busy"
              @click.stop="removeExtension(ext.id)" class="flex-inline-align-justify-center disabled-fade-50 size-28px navbar-extension-remove-btn">
              <Trash2 :size="14" />
            </UiButton>
          </div>
        </div>
      </div>

      <div v-else class="text-center text-12px color-text-tertiary py-14px px-8px">
        {{ t('No extensions installed yet.') }}
      </div>

      <div class="flex flex-column gap-8px mt-8px pt-8px border-top-05-border-light">
        <UiMenuItem :disabled="busy" @click.stop="loadUnpackedExtension">
          {{ t('Load unpacked extension') }}
        </UiMenuItem>

        <UiButton variant="primary" type="button"
          :disabled="busy"
          @click.stop="openChromeWebStore" class="disabled-fade-50 transition-bg-fast">
          <span>{{ t('Import from Chrome Web Store') }}</span>
          <ExternalLink :size="13" />
        </UiButton>

        <div v-if="message" class="text-12px color-text-tertiary py-0px px-2px">
          {{ message }}
        </div>
      </div>
    </UiCard>
  </div>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { ExternalLink, Puzzle, RefreshCw, Trash2 } from 'lucide-vue-next';
import UiButton from '../ui/UiButton.vue';
import UiCard from '../ui/UiCard.vue';
import UiMenuItem from '../ui/UiMenuItem.vue';
import UiToggle from '../ui/UiToggle.vue';
import { useInternalLumen } from '../composables/useInternalLumen';
import { useTabNavigation } from '../composables/useTabNavigation';
import { buildExtensionTabUrl } from '../internal/navigationUrl';
import { errorMessage } from '../internal/services/coerce';
import type { NavBarExtensionSummary } from '../types/navBar';

const emit = defineEmits<{ (e: 'goto', url: string): void }>();

const { openInNewTab, openExtensionPopup } = useTabNavigation();

const open = ref(false);
const extensions = ref<NavBarExtensionSummary[]>([]);
const busy = ref(false);
const message = ref('');

function normalizePayload(payload: any): NavBarExtensionSummary[] {
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.extensions)
      ? payload.extensions
      : [];
  return items
    .map((entry: any) => ({
      id: String(entry?.id || '').trim(),
      name: String(entry?.name || t('Unnamed extension')).trim() || t('Unnamed extension'),
      version: String(entry?.version || '').trim(),
      enabled: !!entry?.enabled,
      loaded: !!entry?.loaded,
      lastError: String(entry?.lastError || '').trim(),
      launchUrl: String(entry?.launchUrl || '').trim()
    }))
    .filter((entry: NavBarExtensionSummary) => !!entry.id)
    .sort((a: NavBarExtensionSummary, b: NavBarExtensionSummary) => a.name.localeCompare(b.name));
}

async function refreshExtensions() {
  try {
    const api = useInternalLumen()?.extensions;
    if (!api || typeof api.listExtensions !== 'function') return;
    const result = await api.listExtensions();
    if (result?.ok === false) {
      message.value = result?.error || t('Failed to load extensions.');
      return;
    }
    extensions.value = normalizePayload(result);
  } catch {
    message.value = t('Failed to load extensions.');
  }
}

function extensionStateLabel(ext: NavBarExtensionSummary) {
  if (ext.lastError) return 'Unavailable';
  if (!ext.enabled) return 'Disabled';
  if (ext.loaded) return 'Enabled';
  return 'Pending';
}

function toggleMenu() {
  open.value = !open.value;
  if (open.value) {
    message.value = '';
    void refreshExtensions();
  }
}

async function runExtensionAction(action: () => Promise<any>, successMessage = '') {
  if (busy.value) return;
  busy.value = true;
  message.value = '';
  try {
    const result = await action();
    if (!result || result.ok === false) {
      message.value = String(result?.error || '').trim();
      return;
    }
    if (successMessage) message.value = successMessage;
    if (result?.extension || result?.extensions) await refreshExtensions();
  } catch (error) {
    message.value = errorMessage(error, '').trim();
  } finally {
    busy.value = false;
  }
}

async function loadUnpackedExtension() {
  const api = useInternalLumen()?.extensions;
  if (!api || typeof api.loadUnpacked !== 'function') return;
  await runExtensionAction(async () => {
    const result = await api.loadUnpacked();
    // A cancelled picker is not a failure, and an empty message renders nothing.
    if (result?.canceled) return { ok: false, error: '' };
    return result;
  }, t('Extension loaded.'));
}

async function toggleExtensionEnabled(ext: NavBarExtensionSummary) {
  const api = useInternalLumen()?.extensions;
  if (!api) return;
  if (ext.enabled) {
    await runExtensionAction(() => api.disableExtension(ext.id), t('Extension disabled.'));
  } else {
    await runExtensionAction(() => api.enableExtension(ext.id), t('Extension enabled.'));
  }
}

async function reloadExtension(id: string) {
  const api = useInternalLumen()?.extensions;
  if (!api || typeof api.reloadExtension !== 'function') return;
  await runExtensionAction(() => api.reloadExtension(id), t('Extension reloaded.'));
}

async function removeExtension(id: string) {
  const api = useInternalLumen()?.extensions;
  if (!api || typeof api.removeExtension !== 'function') return;
  await runExtensionAction(async () => {
    const result = await api.removeExtension(id);
    if (result?.ok) extensions.value = extensions.value.filter((entry) => entry.id !== id);
    return result;
  }, t('Extension removed.'));
}

async function openExtension(ext: NavBarExtensionSummary) {
  if (!ext?.enabled) return;
  open.value = false;
  if (typeof openExtensionPopup === 'function') {
    openExtensionPopup({
      extensionId: ext.id,
      name: String(ext?.name || '').trim(),
      targetUrl: String(ext?.launchUrl || '').trim(),
      userGesture: true
    });
    return;
  }
  const target = buildExtensionTabUrl(ext.id, { name: String(ext?.name || '').trim() });
  if (typeof openInNewTab === 'function') {
    openInNewTab(target);
    return;
  }
  emit('goto', target);
}

function openChromeWebStore() {
  open.value = false;
  emit('goto', 'lumen://extensions');
}

function onGlobalClick(event: MouseEvent) {
  const el = event.target as HTMLElement | null;
  if (!el) return;
  if (el.closest('.extensions-trigger') || el.closest('.navbar-extensions-menu')) return;
  open.value = false;
}

let detachChangedListener: null | (() => void) = null;

onMounted(() => {
  void refreshExtensions();
  window.addEventListener('click', onGlobalClick);
  try {
    const api = useInternalLumen()?.extensions;
    if (api && typeof api.onChanged === 'function') {
      detachChangedListener = api.onChanged((payload: any) => {
        extensions.value = normalizePayload(payload);
      });
    }
  } catch {
    // ignore
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('click', onGlobalClick);
  try {
    detachChangedListener?.();
  } catch {
    // ignore
  }
  detachChangedListener = null;
});
</script>
