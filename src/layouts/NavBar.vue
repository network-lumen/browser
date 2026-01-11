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
        :style="{ background: 'var(--card-bg)', color: favActive ? 'gold' : 'var(--text-secondary)', padding: '0.5rem' }"
        title="Toggle favourite"
        @click="onToggleFavourite"
      >
        <Star :size="18" :fill="favActive ? 'currentColor' : 'none'" />
      </UiButton>

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
        title="Drive"
        @click="$emit('goto', 'lumen://drive')"
      >
        <Cloud :size="18" />
      </UiButton>

    <!-- profiles -->
    <div class="profile-ctl gap-50 appregion-no-drag flex-align-center ">
      <div class="relative avatar-wrap padding-25">
        <button type="button" class="profile-trigger" :title="activeProfileDisplay" @click.stop="toggleProfileMenu">
          <ProfileAvatar :profile="activeProfile" :size="30" :title="activeProfileDisplay" />
          <span class="profile-trigger-name">{{ activeProfileDisplay }}</span>
        </button>

        <div
          v-if="showProfileMenu"
          class="menu profile-menu z-1 absolute right-0 top-full margin-top-50"
          role="menu"
        >
          <ActiveProfileCard
            v-if="activeProfile"
            :profile="activeProfile"
            dense
            :label="isGuestOnly ? 'Guest mode' : 'Active profile'"
          />

          <div v-if="hasProfiles && !isGuestOnly" class="profile-menu-section">
            <div class="profile-menu-title">Profiles</div>
            <ul class="profile-list">
              <li
                v-for="p in profiles"
                :key="p.id"
                class="profile-row"
                :class="{ active: p.id === activeProfileId }"
                role="menuitem"
              >
                <button type="button" class="profile-row-btn" @click.stop="selectProfile(p.id)">
                  <ProfileAvatar :profile="p" :size="28" :title="p.name || p.id" />
                  <span class="profile-row-name">{{ p.name || p.id }}</span>
                </button>

                <button type="button" class="profile-row-delete" title="Delete profile" @click.stop="onDeleteProfile(p.id)">
                  <Trash2 :size="16" />
                </button>
              </li>
            </ul>
          </div>

          <div v-else class="profile-menu-hint">
            {{ isGuestOnly
              ? 'Guest mode active. Create or import a profile to get started.'
              : 'No profiles yet.' }}
          </div>

          <div class="profile-menu-actions">
            <UiButton variant="none" class="profile-menu-action" @click="onCreateProfileClick">
              New profile…
            </UiButton>
            <UiButton variant="none" class="profile-menu-action" :disabled="!activeProfileId" @click="onExportProfile">
              Export active profile…
            </UiButton>
            <UiButton variant="none" class="profile-menu-action" @click="onImportProfileClick">
              Import profile…
            </UiButton>

            <div v-if="creatingProfile" class="profile-create">
              <input v-model="newProfileName" type="text" class="profile-create-input" placeholder="Profile name" />
              <div class="profile-create-actions">
                <UiButton variant="none" class="profile-menu-action primary" @click="confirmCreateProfile">
                  Create
                </UiButton>
                <UiButton variant="none" class="profile-menu-action" @click="cancelCreateProfile">
                  Cancel
                </UiButton>
              </div>
            </div>

            <div v-if="profileMessage" class="profile-menu-message">
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
import { ArrowLeft, ArrowRight, RefreshCw, Search, House, Cloud, Trash2, Star } from 'lucide-vue-next';
import ActiveProfileCard from '../components/ActiveProfileCard.vue';
import ProfileAvatar from '../components/ProfileAvatar.vue';
import UiButton from '../ui/UiButton.vue';
import UiSpinner from '../ui/UiSpinner.vue';
import {
  profilesState,
  activeProfileId,
  setActiveProfile,
  createProfile,
  deleteProfile,
  initProfiles,
  exportProfileBackup,
  importProfileFromBackup
} from '../internal/profilesStore';
import { useFavourites } from '../internal/favouritesStore';

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
const { toggleFavourite, isFav } = useFavourites();
const favActive = computed(() => {
  if (props.currentUrl == null) return false;
  return isFav(props.currentUrl);
});
function onToggleFavourite() {
  if (props.currentUrl == null) return;
  toggleFavourite(props.currentUrl);
}
const showProfileMenu = ref(false);
const creatingProfile = ref(false);
const newProfileName = ref('');
const profileMessage = ref('');

const profiles = profilesState;

const hasProfiles = computed(() => profiles.value.length > 0);

const activeProfile = computed(() => profiles.value.find((p) => p.id === activeProfileId.value) || null);
const isGuestOnly = computed(
  () => activeProfile.value?.role === 'guest' && profiles.value.length === 1
);

const activeProfileDisplay = computed(
  () => activeProfile.value?.name || activeProfile.value?.id || 'Profile'
);

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

    // preserve any lumen:// URL as-is (including query/hash)
    if (/^lumen:\/\//i.test(v)) return v;

    // allow http(s) URLs
    if (/^https?:\/\//i.test(v)) return v;

    // allow bare internal routes ("home", "wallet"...)
    const lowered = v.toLowerCase();
    const builtin = [
      'home',
      'search',
      'drive',
      'wallet',
      'network',
      'settings',
      'help',
      'domain',
      'explorer',
      'dao',
      'ipfs',
      'gateways',
      'release',
      'newtab',
    ];
    if (builtin.includes(lowered)) return `lumen://${lowered}`;

    // "mydomain.com" -> lumen://mydomain.com
    if (!/^\w+:/i.test(v) && /\./.test(v) && !/\s/.test(v)) {
      return `lumen://${v}`;
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
  profileMessage.value = '';
  newProfileName.value = '';
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
.profile-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.5rem;
  padding: 0.35rem 0.5rem;
  border-radius: var(--border-radius-full);
  border: var(--border-width) solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-primary);
  cursor: pointer;
  max-width: 12rem;
}

.profile-trigger:where(:hover, :focus-visible) {
  background: var(--hover-bg);
}

.profile-trigger-name {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--text-primary);
  max-width: 9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-menu {
  min-width: 18rem;
  max-width: 22rem;
  background: var(--card-bg);
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--border-radius-xl);
  padding: 0.75rem;
  box-shadow: var(--shadow-lg);
}

.profile-menu-title {
  margin-top: 0.75rem;
  margin-bottom: 0.5rem;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.profile-list {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 40vh;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.profile-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: var(--border-radius-md);
  padding: 0.25rem;
}

.profile-row:where(:hover, :focus-within) {
  background: var(--hover-bg);
}

.profile-row.active {
  background: var(--fill-tertiary);
  border: var(--border-width) solid var(--border-light);
}

.profile-row-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  padding: 0.25rem;
  cursor: pointer;
  text-align: left;
  color: var(--text-primary);
}

.profile-row-name {
  font-size: var(--fs-sm);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.profile-row-delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--border-radius-full);
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--error-red);
}

.profile-row-delete:where(:hover, :focus-visible) {
  background: var(--hover-bg);
}

.profile-menu-hint {
  padding: 0.5rem 0.25rem;
  font-size: var(--fs-sm);
  color: var(--text-tertiary);
}

.profile-menu-actions {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.profile-menu-action {
  width: 100%;
  justify-content: flex-start;
  padding: 0.55rem 0.75rem;
  border-radius: var(--border-radius-md);
  border: var(--border-width) solid var(--border-light);
  background: transparent;
  cursor: pointer;
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.profile-menu-action:where(:hover, :focus-visible) {
  background: var(--hover-bg);
}

.profile-menu-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.profile-menu-action.primary {
  border-color: transparent;
  background: var(--accent-primary);
  color: #fff;
  justify-content: center;
}

.profile-menu-action.primary:where(:hover, :focus-visible) {
  filter: brightness(0.96);
}

.profile-create {
  margin-top: 0.25rem;
  padding-top: 0.5rem;
  border-top: var(--border-width) solid var(--border-light);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.profile-create-input {
  width: 100%;
  padding: 0.55rem 0.75rem;
  border-radius: var(--border-radius-md);
  border: var(--border-width) solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: var(--fs-sm);
}

.profile-create-actions {
  display: flex;
  gap: 0.5rem;
}

.profile-create-actions .profile-menu-action {
  flex: 1;
  justify-content: center;
}

.profile-menu-message {
  margin-top: 0.25rem;
  font-size: var(--fs-sm);
  color: var(--text-tertiary);
  padding: 0.25rem 0.25rem;
}
</style>
