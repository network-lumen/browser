<template>
  <div class="history-page internal-page flex min-h-full">
    <InternalSidebar title="History" :icon="HistoryIcon" activeKey="history" />

    <main class="history-main flex-1 min-w-0 min-h-0 p-20px flex flex-column gap-16px overflow-y-auto">
      <header class="history-header flex-align-center-justify-space-between gap-16px flex-justify-space-between border-default bg-card shadow-sm border-radius-24px py-20px px-20px">
        <div class="history-copy">
          <h1 class="color-text-primary m-0px text-clamp-18-4vw-28rem">History</h1>
        </div>

        <div class="history-header-actions flex-align-center gap-10px flex-wrap-wrap">
          <button
            type="button"
            class="history-mode-btn flex-inline-align-justify-center border-none color-text-secondary cursor-pointer bg-fill-secondary border-radius-full gap-8px py-12px px-16px txt-weight-medium transition-lift-015 hover-lift-1"
            :class="{ active: historyEnabled, 'badge-success': historyEnabled }"
            @click="toggleHistoryMode"
          >
            <component :is="historyEnabled ? Power : ShieldOff" :size="15" />
            <span>{{ historyEnabled ? "Saving on" : "Saving off" }}</span>
          </button>

          <button
            type="button"
            class="history-clear-btn disabled-fade-50 badge-error flex-inline-align-justify-center border-none cursor-pointer color-error border-radius-full gap-8px py-12px px-16px txt-weight-medium transition-lift-015 hover-lift-1"
            :disabled="!historyEntries.length"
            @click="clearAllHistory"
          >
            <Trash2 :size="15" />
            <span>Clear history</span>
          </button>
        </div>
      </header>

      <section class="history-toolbar flex-align-center-justify-space-between flex-justify-space-between gap-12px border-default bg-card shadow-sm py-14px px-16px border-radius-24px">
        <label class="history-search flex-align-center flex-1 min-w-0 border-radius-full color-text-tertiary gap-10px bg-fill-tertiary py-12px px-16px">
          <Search :size="17" />
          <input
            v-model="query"
            type="text"
            placeholder="Search history"
            spellcheck="false"
            autocomplete="off"
            class="flex-1 min-w-0 border-none outline-none bg-transparent color-text-primary history-search-input text-15px placeholder-tertiary"
          />
        </label>
      </section>

      <div v-if="!historyEnabled" class="history-banner color-text-secondary border-radius-16px py-14px px-16px bg-ios-orange-a08 border-1-ios-orange-a16">
        New pages are no longer saved for this profile. Existing history stays available until you clear it.
      </div>

      <div v-if="groupedEntries.length" class="flex flex-column gap-14px">
        <section v-for="group in groupedEntries" :key="group.label" class="history-group p-16px border-default bg-card shadow-sm border-radius-24px">
          <div class="history-group-head flex-align-center-justify-space-between gap-12px flex-justify-space-between pt-0px pr-2px pb-12px pl-2px">
            <h2 class="color-text-primary m-0px history-group-head-h2 text-16px">{{ group.label }}</h2>
            <span class="flex-inline-align-justify-center color-text-secondary border-radius-full txt-weight-strong h-28px py-0px px-8px bg-fill-secondary text-12px min-w-24rem-badge">{{ group.entries.length }}</span>
          </div>

          <div class="flex flex-column">
            <article v-for="entry in group.entries" :key="entry.id" class="history-item flex-align-center-justify-space-between flex-justify-space-between py-12px px-2px border-top-1-separator">
              <button class="color-inherit flex-align-center flex-1 min-w-0 border-none bg-transparent cursor-pointer text-left gap-12px" type="button" @click="openEntry(entry.url)">
                <span class="history-item-avatar h-44px flex-inline-align-justify-center flex-0-0-auto color-text-primary txt-weight-strong border-radius-14px text-12px letter-spacing-008em border-default bg-fill-secondary w-270" :style="avatarToneStyle(entry.kind)">
                  {{ entry.monogram }}
                </span>

                <span class="history-item-copy flex flex-column gap-2px min-w-0">
                  <span class="history-item-title color-text-primary txt-weight-medium nowrap overflow-hidden txt-overflow-ellipsis">{{ entry.title }}</span>
                  <span class="history-item-subtitle color-text-tertiary text-14px nowrap overflow-hidden txt-overflow-ellipsis">{{ entry.subtitle }}</span>
                </span>
              </button>

              <div class="history-item-meta flex-inline-align-center flex-0-0-auto gap-8px ml-8px">
                <span class="history-item-time color-text-tertiary text-12px txt-weight-medium">{{ formatTime(entry.lastVisitedAt) }}</span>
                <span v-if="entry.visitCount > 1" class="history-item-visits color-text-tertiary text-12px txt-weight-medium">
                  {{ entry.visitCount }} visits
                </span>
                <button
                  type="button"
                  class="history-item-remove border-none bg-transparent color-text-tertiary cursor-pointer h-200 border-radius-10px transition-all-015 w-200 hover-color-error background-fill-error-hover"
                  title="Remove from history"
                  @click.stop="removeHistoryEntry(entry.id)"
                >
                  <Trash2 :size="14" />
                </button>
              </div>
            </article>
          </div>
        </section>
      </div>

      <div v-else class="history-empty flex-1 flex-align-justify-center">
        <UiCard padding="none" :shadow="false" radius="24px" class="shadow-sm w-min-560px-full">
          <UiEmptyState :title="emptyTitle" :description="emptyCopy">
            <HistoryIcon :size="22" />
            <template #actions>
              <UiButton variant="secondary" v-if="!historyEnabled"
                type="button"
                @click="setHistoryEnabled(true)" class="active badge-success">
                <Power :size="15" />
                <span>Turn on history</span>
              </UiButton>
              <UiButton variant="primary" type="button" @click="openNewTab">
                <ArrowUpRight :size="14" />
                <span>Open new tab</span>
              </UiButton>
            </template>
          </UiEmptyState>
        </UiCard>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import UiCard from '../../ui/UiCard.vue';
import UiButton from '../../ui/UiButton.vue';
import UiEmptyState from '../../ui/UiEmptyState.vue';
import { computed, inject, ref } from "vue";
import {
  ArrowUpRight,
  History as HistoryIcon,
  Power,
  Search,
  ShieldOff,
  Trash2,
} from "lucide-vue-next";
import InternalSidebar from "../../components/InternalSidebar.vue";
import { avatarToneStyle, describeFavouriteUrl } from "../favouriteMeta";
import { useHistory } from "../historyStore";

const navigate = inject<((url: string, opts?: { push?: boolean }) => void) | null>("navigate", null);
const openInNewTab = inject<((url: string) => void) | null>("openInNewTab", null);

const query = ref("");

const {
  historyEntries,
  historyEnabled,
  removeHistoryEntry,
  clearHistory,
  setHistoryEnabled,
} = useHistory();

const renderedEntries = computed(() =>
  historyEntries.value.map((entry) => ({
    ...entry,
    ...describeFavouriteUrl(entry.url, entry.title),
  })),
);

const filteredEntries = computed(() => {
  const needle = String(query.value || "").trim().toLowerCase();
  if (!needle) return renderedEntries.value;
  return renderedEntries.value.filter((entry) =>
    [
      entry.title,
      entry.subtitle,
      entry.url,
    ].some((value) => String(value || "").toLowerCase().includes(needle)),
  );
});

const groupedEntries = computed(() => {
  const groups: Array<{ label: string; entries: typeof filteredEntries.value }> = [];
  for (const entry of filteredEntries.value) {
    const label = groupLabel(entry.lastVisitedAt);
    const current = groups[groups.length - 1];
    if (current && current.label === label) {
      current.entries.push(entry);
      continue;
    }
    groups.push({ label, entries: [entry] });
  }
  return groups;
});

const emptyTitle = computed(() => {
  if (!historyEnabled.value) return "History is off";
  if (query.value.trim()) return "No matching history";
  return "No history yet";
});

const emptyCopy = computed(() => {
  if (!historyEnabled.value) {
    return "Turn history back on for this profile when you want Lumen to remember recent pages again.";
  }
  if (query.value.trim()) {
    return "Try a broader term or clear the current search.";
  }
  return "Visited web pages, domains, IPFS, and IPNS content will appear here automatically.";
});

function openEntry(url: string) {
  const target = String(url || "").trim();
  if (!target) return;
  if (openInNewTab) {
    openInNewTab(target);
    return;
  }
  navigate?.(target, { push: true });
}

function openNewTab() {
  if (openInNewTab) {
    openInNewTab("lumen://newtab");
    return;
  }
  navigate?.("lumen://newtab", { push: true });
}

function toggleHistoryMode() {
  setHistoryEnabled(!historyEnabled.value);
}

function clearAllHistory() {
  if (!historyEntries.value.length) return;
  const confirmed = window.confirm("Clear the saved browsing history for this profile?");
  if (!confirmed) return;
  clearHistory();
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function groupLabel(timestamp: number) {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}
</script>


