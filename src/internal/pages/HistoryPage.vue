<template>
  <div class="history-page internal-page">
    <InternalSidebar title="History" :icon="HistoryIcon" activeKey="history" />

    <main class="history-main">
      <header class="history-header">
        <div class="history-copy">
          <h1>History</h1>
        </div>

        <div class="history-header-actions">
          <button
            type="button"
            class="history-mode-btn"
            :class="{ active: historyEnabled }"
            @click="toggleHistoryMode"
          >
            <component :is="historyEnabled ? Power : ShieldOff" :size="15" />
            <span>{{ historyEnabled ? "Saving on" : "Saving off" }}</span>
          </button>

          <button
            type="button"
            class="history-clear-btn"
            :disabled="!historyEntries.length"
            @click="clearAllHistory"
          >
            <Trash2 :size="15" />
            <span>Clear history</span>
          </button>
        </div>
      </header>

      <section class="history-toolbar">
        <label class="history-search">
          <Search :size="17" />
          <input
            v-model="query"
            type="text"
            placeholder="Search history"
            spellcheck="false"
            autocomplete="off"
          />
        </label>
      </section>

      <div v-if="!historyEnabled" class="history-banner">
        New pages are no longer saved for this profile. Existing history stays available until you clear it.
      </div>

      <div v-if="groupedEntries.length" class="history-groups">
        <section v-for="group in groupedEntries" :key="group.label" class="history-group">
          <div class="history-group-head">
            <h2>{{ group.label }}</h2>
            <span>{{ group.entries.length }}</span>
          </div>

          <div class="history-list">
            <article v-for="entry in group.entries" :key="entry.id" class="history-item">
              <button class="history-item-main" type="button" @click="openEntry(entry.url)">
                <span class="history-item-avatar" :class="`tone-${entry.kind}`">
                  {{ entry.monogram }}
                </span>

                <span class="history-item-copy flex flex-column gap-15 min-w-0">
                  <span class="history-item-title">{{ entry.title }}</span>
                  <span class="history-item-subtitle">{{ entry.subtitle }}</span>
                </span>
              </button>

              <div class="history-item-meta">
                <span class="history-item-time">{{ formatTime(entry.lastVisitedAt) }}</span>
                <span v-if="entry.visitCount > 1" class="history-item-visits">
                  {{ entry.visitCount }} visits
                </span>
                <button
                  type="button"
                  class="history-item-remove"
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

      <div v-else class="history-empty">
        <div class="history-empty-card">
          <div class="history-empty-icon">
            <HistoryIcon :size="22" />
          </div>
          <h3>{{ emptyTitle }}</h3>
          <p>{{ emptyCopy }}</p>
          <div class="history-empty-actions">
            <button
              v-if="!historyEnabled"
              type="button"
              class="history-mode-btn active"
              @click="setHistoryEnabled(true)"
            >
              <Power :size="15" />
              <span>Turn on history</span>
            </button>
            <button type="button" class="history-open-btn" @click="openNewTab">
              <ArrowUpRight :size="14" />
              <span>Open new tab</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
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
import { describeFavouriteUrl } from "../favouriteMeta";
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

<style scoped>
.history-page {
  display: flex;
  min-height: 100%;
}

.history-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-y: auto;
}

.history-header,
.history-toolbar,
.history-group,
.history-empty-card {
  border: var(--border-width) solid var(--border-color);
  background: var(--card-bg);
  box-shadow: var(--shadow-sm);
}

.history-header,
.history-toolbar,
.history-empty-card {
  border-radius: 24px;
}

.history-header {
  padding: 1.2rem 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.history-copy h1 {
  margin: 0;
  font-size: clamp(1.8rem, 4vw, 2.8rem);
  letter-spacing: -0.05em;
  color: var(--text-primary);
}

.history-copy p {
  margin: 0.5rem 0 0;
  color: var(--text-secondary);
}

.history-copy strong {
  color: var(--text-primary);
}

.history-header-actions,
.history-empty-actions {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.history-mode-btn,
.history-clear-btn,
.history-open-btn {
  border: none;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.72rem 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform 0.15s ease,
    background 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;
}

.history-mode-btn {
  background: var(--fill-secondary);
  color: var(--text-secondary);
}

.history-mode-btn.active {
  background: var(--fill-success);
  color: var(--ios-green);
}

.history-clear-btn {
  background: var(--fill-error);
  color: var(--ios-red);
}

.history-clear-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.history-open-btn {
  background: var(--gradient-primary);
  color: white;
  box-shadow: var(--shadow-primary);
}

.history-mode-btn:hover,
.history-clear-btn:hover:not(:disabled),
.history-open-btn:hover {
  transform: translateY(-1px);
}

.history-toolbar {
  padding: 0.95rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
}

.history-search {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.8rem 0.95rem;
  border-radius: 999px;
  background: var(--fill-tertiary);
  color: var(--text-tertiary);
}

.history-search input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 0.96rem;
}

.history-search input::placeholder {
  color: var(--text-tertiary);
}

.history-banner {
  padding: 0.9rem 1rem;
  border-radius: 18px;
  border: 1px solid rgba(var(--ios-orange-rgb), 0.16);
  background: rgba(var(--ios-orange-rgb), 0.08);
  color: var(--text-secondary);
}

.history-groups {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.history-group {
  border-radius: 24px;
  padding: 1rem;
}

.history-group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0 0.1rem 0.7rem;
}

.history-group-head h2 {
  margin: 0;
  font-size: 1rem;
  color: var(--text-primary);
}

.history-group-head span {
  min-width: 1.7rem;
  height: 1.7rem;
  padding: 0 0.45rem;
  border-radius: 999px;
  background: var(--fill-secondary);
  color: var(--text-secondary);
  font-size: 0.76rem;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.history-list {
  display: flex;
  flex-direction: column;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  justify-content: space-between;
  padding: 0.8rem 0.15rem;
  border-top: 1px solid var(--separator);
}

.history-list .history-item:first-child {
  border-top: none;
}

.history-item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  text-align: left;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.history-item-avatar {
  width: 2.7rem;
  height: 2.7rem;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  border: var(--border-width) solid var(--border-color);
  background: var(--fill-secondary);
  color: var(--text-primary);
}

.history-item-avatar.tone-search {
  background: rgba(var(--ios-blue-rgb), 0.12);
  color: var(--ios-blue);
  border-color: rgba(var(--ios-blue-rgb), 0.18);
}

.history-item-avatar.tone-internal {
  background: rgba(var(--ios-indigo-rgb), 0.12);
  color: var(--ios-indigo);
  border-color: rgba(var(--ios-indigo-rgb), 0.18);
}

.history-item-avatar.tone-web {
  background: rgba(var(--ios-green-rgb), 0.12);
  color: var(--ios-green);
  border-color: rgba(var(--ios-green-rgb), 0.18);
}

.history-item-avatar.tone-file {
  background: rgba(var(--ios-orange-rgb), 0.12);
  color: var(--ios-orange);
  border-color: rgba(var(--ios-orange-rgb), 0.18);
}


.history-item-title,
.history-item-subtitle {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-item-title {
  color: var(--text-primary);
  font-weight: 700;
}

.history-item-subtitle {
  color: var(--text-tertiary);
  font-size: 0.84rem;
}

.history-item-meta {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  flex: 0 0 auto;
  margin-left: 0.5rem;
}

.history-item-time,
.history-item-visits {
  font-size: 0.78rem;
  color: var(--text-tertiary);
  font-weight: 700;
}

.history-item-remove {
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.history-item-remove:hover {
  background: var(--fill-error);
  color: var(--ios-red);
}

.history-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.history-empty-card {
  width: min(560px, 100%);
  padding: 1.5rem;
  text-align: center;
}

.history-empty-icon {
  width: 3.25rem;
  height: 3.25rem;
  margin: 0 auto 0.9rem;
  border-radius: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--fill-secondary);
  color: var(--text-primary);
}

.history-empty-card h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.15rem;
}

.history-empty-card p {
  margin: 0.7rem auto 0;
  max-width: 34rem;
  color: var(--text-secondary);
  line-height: 1.55;
}

.history-empty-actions {
  justify-content: center;
  margin-top: 1rem;
}

@media (max-width: 980px) {
  .history-page {
    flex-direction: column;
  }

  .history-header,
  .history-toolbar,
  .history-item {
    flex-direction: column;
    align-items: stretch;
  }

  .history-item-meta,
  .history-header-actions {
    justify-content: flex-start;
    margin-left: 0;
  }
}

@media (max-width: 640px) {
  .history-main {
    padding: 0.85rem;
  }

  .history-header,
  .history-toolbar,
  .history-group,
  .history-empty-card {
    border-radius: 20px;
  }
}
</style>
