<template>
  <header
    class="navbar flex-align-center gap-50 txt-2xl"
    :style="{ background: 'var(--bg-primary, white)', borderBottom: '1px solid var(--border-color, #e5e7eb)', padding: '0.625rem' }"
  >
    <!-- history / refresh -->
    <UiButton
      variant="none"
      class="cursor-pointer border-none border-radius-circle hover-bg-black-a10"
      :style="{ background: 'var(--card-bg)', color: 'var(--text-secondary)', padding: '0.5rem' }"
      :disabled="!canGoBack"
      title="Back"
      @click="previous"
    >
      <ArrowLeft :size="18" />
    </UiButton>
    <UiButton
      variant="none"
      class="cursor-pointer border-none border-radius-circle hover-bg-black-a10"
      :style="{ background: 'var(--card-bg)', color: 'var(--text-secondary)', padding: '0.5rem' }"
      :disabled="!canGoForward"
      title="Forward"
      @click="next"
    >
      <ArrowRight :size="18" />
    </UiButton>

    <UiButton
      variant="none"
      class="cursor-pointer border-none border-radius-circle hover-bg-black-a10"
      :style="{ background: 'var(--card-bg)', color: 'var(--text-secondary)', padding: '0.5rem' }"
      :aria-busy="loading ? 'true' : 'false'"
      :disabled="loading"
      :title="loading ? 'Loading…' : 'Refresh'"
      @click="refresh"
    >
      <UiSpinner v-if="loading" size="sm" />
      <RefreshCw v-else :size="18" />
    </UiButton>

    <!-- URL input -->
    <div class="w-full relative flex-align-center appregion-no-drag">
      <Search :size="16" stroke-width="2" class="color-gray-blue absolute left-25" />
      <input
        v-model="urlField"
        type="text"
        class="outline-none w-full txt-xs border-radius-10px"
        :style="{ padding: '0.625rem 0.625rem 0.625rem 3rem', border: '1px solid var(--border-color, #e2e8f0)', background: 'var(--bg-primary, white)', color: 'var(--text-primary, #1e293b)' }"
        placeholder="Search or paste a Lumen link (lumen://home, lumen://search…)"
        @keydown.enter="onEnter"
      />
    </div>

    <!-- quick links -->
    <UiButton
      variant="none"
      class="cursor-pointer border-none border-radius-circle hover-bg-black-a10"
      :style="{ background: 'var(--card-bg)', color: 'var(--text-secondary)', padding: '0.5rem' }"
      title="Home"
      @click="$emit('goto', 'lumen://home')"
    >
      <House :size="18" />
    </UiButton>
    <UiButton
      variant="none"
      class="cursor-pointer border-none border-radius-circle hover-bg-black-a10"
      :style="{ background: 'var(--card-bg)', color: 'var(--text-secondary)', padding: '0.5rem' }"
      title="Network"
      @click="$emit('goto', 'lumen://network')"
    >
      <Globe :size="18" />
    </UiButton>
    <UiButton
      variant="none"
      class="cursor-pointer border-none border-radius-circle hover-bg-black-a10"
      :style="{ background: 'var(--card-bg)', color: 'var(--text-secondary)', padding: '0.5rem' }"
      title="Drive"
      @click="$emit('goto', 'lumen://drive')"
    >
      <Folder :size="18" />
    </UiButton>

    <!-- profiles -->
    <div class="profile-ctl gap-50 appregion-no-drag flex-align-center ">
      <div class="relative avatar-wrap padding-25">
        <UiButton
          class="avatar-btn txt-letter-spacing-00125 cursor-select-none  cursor-pointer txt-weight-strong txt-xs overflow-hidden border-none border-radius-circle flex-align-justify-center size-160"
          :class="
            isGuestOnly
              ? 'bg-white-blue-dark color-gray-blue-light'
              : 'border-1px-solid border-color-default ' + avatarHueClass(activeProfileName || activeProfileId)
          "
          :title="activeProfileDisplay"
          @click.stop="toggleProfileMenu"
        >
          <User v-if="isGuestOnly" :size="16" stroke-width="2.5" />
          <span v-else>{{ avatarLetter }}</span>
        </UiButton>

        <div
          v-if="showProfileMenu"
          class="menu z-1 box-shadow-default border-radius-10px flex flex-column absolute right-0 top-full margin-top-50 min-w-1500"
          :style="{ background: 'var(--bg-primary, white)', border: '1px solid var(--border-color, #e2e8f0)', padding: '0.625rem' }"
          role="menu"
        >
          <div class="menu-head txt-weight-strong txt-xs" :style="{ padding: '0.5rem', color: 'var(--text-primary, #64748b)' }">
            {{ isGuestOnly ? '' : 'Profiles' }}
          </div>

          <ul
            v-if="hasProfiles && !isGuestOnly"
            class="profile-list list-style-none padding-25 margin-0 gap-25 txt-xs overflow-auto flex flex-column max-h-50vh"
          >
            <li
              v-for="p in profiles"
              :key="p.id"
              class="profile-item gap-50 border-radius-10px flex-align-center"
              :style="{ padding: '0.5rem', background: p.id === activeProfileId ? 'var(--bg-secondary, #f8fafc)' : 'transparent', border: p.id === activeProfileId ? '1px solid var(--border-color, #e2e8f0)' : 'none' }"
              :class="{ 'active': p.id === activeProfileId }"
              role="menuitem"
            >
              <button
                type="button"
                class="flex-align-center flex-1 gap-50 cursor-pointer border-none bg-transparent text-align-left"
                @click.stop="selectProfile(p.id)"
              >
                <span
                  class="profile-avatar txt-weight-strong txt-xs overflow-hidden border-radius-circle flex-align-justify-center size-100"
                  :style="{ border: '1px solid var(--border-color, #e2e8f0)' }"
                  :class="avatarHueClass(p.name || p.id)"
                >
                  {{ (p.name || p.id).trim().charAt(0).toUpperCase() }}
                </span>
                <span class="txt-xs" :style="{ color: 'var(--text-primary, #64748b)' }">
                  {{ p.name || p.id }}
                </span>
              </button>

              <UiButton
                variant="none"
                class="margin-left-auto cursor-pointer border-none bg-white border-radius-circle hover-bg-black-a10 padding-50"
                title="Delete profile"
                @click.stop="onDeleteProfile(p.id)"
              >
                <Trash2 :size="18" class="color-red-base" />
              </UiButton>
            </li>
          </ul>

          <div v-else class="txt-xs" :style="{ padding: '0.5rem', color: 'var(--text-secondary, #64748b)' }">
            {{ isGuestOnly
              ? 'Guest mode active no local profiles created or imported yet.'
              : 'No profiles yet.' }}
          </div>

          <div class="menu-actions padding-top-50 flex flex-column gap-25">
            <UiButton variant="ghost" size="sm" @click="onCreateProfileClick">
              New profile…
            </UiButton>
            <UiButton variant="ghost" size="sm" :disabled="!activeProfileId" @click="onExportProfile">
              Export active profile…
            </UiButton>
            <UiButton variant="ghost" size="sm" @click="onImportProfileClick">
              Import profile…
            </UiButton>

            <div v-if="creatingProfile" class="flex flex-column gap-25 padding-top-25">
              <input
                v-model="newProfileName"
                type="text"
                class="outline-none flex-1 txt-xs border-radius-10px"
                :style="{ padding: '0.5rem', border: '1px solid var(--border-color, #e2e8f0)', background: 'var(--bg-primary, white)', color: 'var(--text-primary, #1e293b)' }"
                placeholder="Profile name"
              />
              <div class="flex gap-25">
                <UiButton size="sm" variant="primary" @click="confirmCreateProfile">
                  Create
                </UiButton>
                <UiButton size="sm" variant="ghost" @click="cancelCreateProfile">
                  Cancel
                </UiButton>
              </div>
            </div>

            <div v-if="profileMessage" class="txt-xs" :style="{ paddingTop: '0.625rem', color: 'var(--text-secondary, #64748b)' }">
              {{ profileMessage }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { ArrowLeft, ArrowRight, RefreshCw, Search, House, Folder, Globe, User, Trash2 } from 'lucide-vue-next';
import UiButton from '../ui/UiButton.vue';
import UiSpinner from '../ui/UiSpinner.vue';
import {
  profilesState,
  activeProfileId,
  setActiveProfile,
  createProfile,
  exportProfile,
  importProfile,
  deleteProfile,
  initProfiles,
  exportProfileBackup,
  importProfileFromBackup
} from '../internal/profilesStore';

type TabHistoryEntry = { url: string; title?: string };
type Tab = {
  id: string;
  history?: TabHistoryEntry[];
  history_position?: number;
};

const props = defineProps<{
  tabActive: string;
  tabs: Tab[];
  loading: boolean;
  currentUrl?: string;
}>();

const emit = defineEmits<{
  (e: 'goto', url: string): void;
  (e: 'history-step', payload: { delta: number }): void;
  (e: 'refresh-request'): void;
}>();

const urlField = ref('');
const showProfileMenu = ref(false);
const creatingProfile = ref(false);
const newProfileName = ref('');
const showImportArea = ref(false);
const importJson = ref('');
const profileMessage = ref('');

const profiles = profilesState;

const hasProfiles = computed(() => profiles.value.length > 0);

const activeProfile = computed(() => profiles.value.find((p) => p.id === activeProfileId.value) || null);
const isGuestOnly = computed(
  () => activeProfile.value?.role === 'guest' && profiles.value.length === 1
);

const activeProfileName = computed(() => activeProfile.value?.name || '');
const activeProfileDisplay = computed(
  () => activeProfile.value?.name || activeProfile.value?.id || 'Profile'
);

const avatarLetter = computed(() => {
  const base = activeProfileName.value || activeProfileId.value || 'P';
  return base.trim().charAt(0).toUpperCase();
});

function avatarHueClass(base: string) {
  const name = String(base || '');
  if (!name) return 'avatar-hue-0';
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  const bucket = Math.abs(h) % 12;
  return `avatar-hue-${bucket}`;
}

const activeTab = computed<Tab | null>(() => {
  return props.tabs.find((t) => t.id === props.tabActive) ?? null;
});

const canGoBack = computed(() => {
  const t = activeTab.value;
  if (!t || !Array.isArray(t.history)) return false;
  const pos = t.history_position ?? 0;
  return pos > 0;
});

const canGoForward = computed(() => {
  const t = activeTab.value;
  if (!t || !Array.isArray(t.history)) return false;
  const pos = t.history_position ?? 0;
  return pos < t.history.length - 1;
});

const loading = computed(() => props.loading);

// Sync displayed URL with current tab URL
watch(
  () => props.currentUrl,
  (val) => {
    const v = String(val || '').trim();
    if (!v) return;
    urlField.value = v;
  },
  { immediate: true }
);

function previous() {
  if (!canGoBack.value) return;
  emit('history-step', { delta: -1 });
}

function next() {
  if (!canGoForward.value) return;
  emit('history-step', { delta: 1 });
}

function refresh() {
  emit('refresh-request');
}

function normalizeInput(raw: string): string {
  const v = String(raw || '').trim();
  if (!v) return 'lumen://home';

  // already a lumen:// URL
  if (/^lumen:\/\//i.test(v)) {
    const withoutScheme = v.slice('lumen://'.length);
    const host = (withoutScheme.split(/[\/?#]/, 1)[0] || '').toLowerCase();
    const builtin = ['home', 'search', 'drive', 'settings', 'network', 'gateways', 'help'];
    if (!host) return 'lumen://home';
    if (builtin.includes(host)) return `lumen://${host}`;
    return v;
  }

  const lowered = v.toLowerCase();
  const builtin = ['home', 'search', 'drive', 'settings', 'network', 'gateways', 'help'];
  if (builtin.includes(lowered)) {
    return `lumen://${lowered}`;
  }

  const q = encodeURIComponent(v);
  return `lumen://search?q=${q}`;
}

function onEnter(ev: KeyboardEvent) {
  const el = ev.target as HTMLInputElement | null;
  const raw = el?.value ?? urlField.value;
  const target = normalizeInput(raw || '');
  urlField.value = target;
  emit('goto', target);
}

function resetProfileUi() {
  creatingProfile.value = false;
  showImportArea.value = false;
  profileMessage.value = '';
  newProfileName.value = '';
  importJson.value = '';
}

function toggleProfileMenu() {
  showProfileMenu.value = !showProfileMenu.value;
  if (!showProfileMenu.value) {
    resetProfileUi();
  }
}

function selectProfile(id: string) {
  setActiveProfile(id);
  showProfileMenu.value = false;
  resetProfileUi();
}

function onCreateProfileClick() {
  creatingProfile.value = true;
  showImportArea.value = false;
  profileMessage.value = '';
  newProfileName.value = '';
}

async function onExportProfile() {
  const id = activeProfileId.value;
  if (!id) return;
  try {
    const res = await exportProfileBackup(id);
    if (!res || res.ok === false) {
      profileMessage.value = 'Backup export failed.';
      return;
    }
    profileMessage.value = res.path
      ? `Backup folder created at: ${res.path}`
      : 'Backup folder created for this profile.';
  } catch {
    profileMessage.value = 'Backup export failed.';
  }
}

function onImportProfileClick() {
  // Use backup import flow instead of raw JSON.
  importProfileFromBackup()
    .then((imported) => {
      if (imported) {
        profileMessage.value = 'Profile imported from backup.';
        showProfileMenu.value = false;
        resetProfileUi();
      } else {
        profileMessage.value = 'Backup import canceled or failed.';
      }
    })
    .catch(() => {
      profileMessage.value = 'Backup import failed.';
    });
}

async function confirmCreateProfile() {
  const name = newProfileName.value.trim();
  if (!name) return;
  const created = await createProfile(name);
  if (created) {
    creatingProfile.value = false;
    profileMessage.value = 'Profile created.';
  } else {
    profileMessage.value = 'Failed to create profile.';
  }
}

function cancelCreateProfile() {
  creatingProfile.value = false;
  newProfileName.value = '';
}

async function confirmImportProfile() {
  const json = importJson.value.trim();
  if (!json) return;
  const imported = await importProfile(json);
  if (!imported) {
    profileMessage.value = 'Invalid profile JSON.';
    return;
  }
  showImportArea.value = false;
  importJson.value = '';
  profileMessage.value = 'Profile imported.';
}

function cancelImportProfile() {
  showImportArea.value = false;
  importJson.value = '';
}

async function onDeleteProfile(id: string) {
  const ok = await deleteProfile(id);
  if (!ok) {
    profileMessage.value = 'Failed to delete profile.';
    return;
  }
  profileMessage.value = 'Profile deleted.';
}

function onGlobalClick(e: MouseEvent) {
  const el = e.target as HTMLElement | null;
  if (!el) return;
  if (el.closest('.avatar-wrap') || el.closest('.menu')) return;
  showProfileMenu.value = false;
  resetProfileUi();
}

onMounted(() => {
  void initProfiles();
  window.addEventListener('click', onGlobalClick);
});

onBeforeUnmount(() => {
  window.removeEventListener('click', onGlobalClick);
});
</script>

<style scoped>
.avatar-hue-0  { background: hsl(  0deg 62% 56%); color: var(--white-blue-light); }
.avatar-hue-1  { background: hsl( 30deg 62% 56%); color: var(--gray-blue-dark); }
.avatar-hue-2  { background: hsl( 60deg 62% 56%); color: var(--gray-blue-dark); }
.avatar-hue-3  { background: hsl( 90deg 62% 56%); color: var(--gray-blue-dark); }
.avatar-hue-4  { background: hsl(120deg 62% 56%); color: var(--gray-blue-dark); }
.avatar-hue-5  { background: hsl(150deg 62% 56%); color: var(--gray-blue-dark); }
.avatar-hue-6  { background: hsl(180deg 62% 56%); color: var(--gray-blue-dark); }
.avatar-hue-7  { background: hsl(210deg 62% 56%); color: var(--white-blue-light); }
.avatar-hue-8  { background: hsl(240deg 62% 56%); color: var(--white-blue-light); }
.avatar-hue-9  { background: hsl(270deg 62% 56%); color: var(--white-blue-light); }
.avatar-hue-10 { background: hsl(300deg 62% 56%); color: var(--white-blue-light); }
.avatar-hue-11 { background: hsl(330deg 62% 56%); color: var(--white-blue-light); }
</style>













