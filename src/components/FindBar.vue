<template>
  <div
    v-if="open"
    class="findbar"
    role="dialog"
    aria-label="Find in page"
    @mousedown.stop
    @click.stop
  >
    <input
      ref="inputEl"
      v-model="query"
      class="findbar-input"
      type="text"
      placeholder="Find in page"
      autocomplete="off"
      @keydown="onInputKeydown"
    />

    <div class="findbar-count" :class="{ muted: !query }" aria-live="polite">
      {{ countText }}
    </div>

    <UiButton
      variant="icon"
      title="Previous match (Shift+Enter)"
      :disabled="!canStep"
      @click="prev"
    >
      <ChevronUp :size="16" />
    </UiButton>

    <UiButton
      variant="icon"
      title="Next match (Enter)"
      :disabled="!canStep"
      @click="next"
    >
      <ChevronDown :size="16" />
    </UiButton>

    <UiButton variant="icon" title="Close (Esc)" @click="closeBar">
      <X :size="16" />
    </UiButton>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ChevronDown, ChevronUp, X } from "lucide-vue-next";
import UiButton from "../ui/UiButton.vue";

type FindActionPayload = {
  action?: string;
  targetWebContentsId?: number | string | null;
};

type FindResultPayload = {
  targetWebContentsId?: number | string | null;
  result?: {
    requestId?: number;
    activeMatchOrdinal?: number;
    matches?: number;
    finalUpdate?: boolean;
  };
};

const open = ref(false);
const query = ref("");
const inputEl = ref<HTMLInputElement | null>(null);

const targetWebContentsId = ref<number | null>(null);
const injectedActiveTarget = inject<any>("findActiveTargetWebContentsId", null);
const matches = ref(0);
const activeMatchOrdinal = ref(0);

let unsubAction: null | (() => void) = null;
let unsubResult: null | (() => void) = null;
let debounceTimer: number | null = null;

function safeNumber(v: any): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

const activeTargetWebContentsId = computed<number | null>(() => {
  return safeNumber(injectedActiveTarget?.value);
});

const effectiveTargetWebContentsId = computed<number | null>(() => {
  return activeTargetWebContentsId.value != null
    ? activeTargetWebContentsId.value
    : targetWebContentsId.value;
});

function findApi(): any | null {
  return (window as any).lumen?.find || null;
}

function setOpenState(next: boolean) {
  open.value = next;
  try {
    findApi()?.setOpen?.(next);
  } catch {
    // ignore
  }
}

async function clearSelection() {
  const id = effectiveTargetWebContentsId.value;
  if (id == null) return;
  try {
    await findApi()?.stopFindInPage?.({
      targetWebContentsId: id,
      action: "clearSelection",
    });
  } catch {
    // ignore
  }
}

async function focusTarget() {
  const id = effectiveTargetWebContentsId.value;
  if (id == null) return;
  try {
    await findApi()?.focusTarget?.(id);
  } catch {
    // ignore
  }
}

async function doFind(opts: { forward?: boolean; findNext?: boolean } = {}) {
  const id = effectiveTargetWebContentsId.value;
  if (id == null) return;
  const text = String(query.value || "");
  if (!text) return;
  try {
    await findApi()?.findInPage?.({
      targetWebContentsId: id,
      text,
      options: {
        forward: opts.forward !== false,
        findNext: !!opts.findNext,
      },
    });
  } catch {
    // ignore
  }
}

function scheduleFreshFind() {
  if (!open.value) return;
  if (debounceTimer != null) window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    debounceTimer = null;
    if (!open.value) return;
    if (!query.value) {
      matches.value = 0;
      activeMatchOrdinal.value = 0;
      void clearSelection();
      return;
    }
    void doFind({ forward: true, findNext: false });
  }, 80);
}

async function openBar(nextTargetId: number | null, opts: { selectAll?: boolean } = {}) {
  if (nextTargetId != null && nextTargetId !== targetWebContentsId.value) {
    targetWebContentsId.value = nextTargetId;
    matches.value = 0;
    activeMatchOrdinal.value = 0;
  }

  setOpenState(true);
  await nextTick();
  try {
    inputEl.value?.focus();
    if (opts.selectAll !== false) inputEl.value?.select();
  } catch {
    // ignore
  }

  if (query.value) scheduleFreshFind();
}

async function closeBar() {
  if (!open.value) return;
  await clearSelection();
  setOpenState(false);
  void focusTarget();
}

function next() {
  if (!open.value) return;
  void doFind({ forward: true, findNext: true });
}

function prev() {
  if (!open.value) return;
  void doFind({ forward: false, findNext: true });
}

function onInputKeydown(ev: KeyboardEvent) {
  if (ev.key === "Escape") {
    ev.preventDefault();
    void closeBar();
    return;
  }
  if (ev.key === "Enter") {
    ev.preventDefault();
    if (ev.shiftKey) prev();
    else next();
  }
}

const canStep = computed(() => open.value && !!query.value && effectiveTargetWebContentsId.value != null);

const countText = computed(() => {
  if (!query.value) return "";
  const m = matches.value || 0;
  const a = activeMatchOrdinal.value || 0;
  return `${a}/${m}`;
});

onMounted(() => {
  const api = findApi();
  unsubAction =
    api?.onAction?.((payload: FindActionPayload) => {
      const action = String(payload?.action || "").toLowerCase();
      const targetId = safeNumber(payload?.targetWebContentsId);

      if (action === "open") {
        void openBar(targetId, { selectAll: true });
        return;
      }
      if (action === "next") {
        if (!open.value) void openBar(targetId, { selectAll: false });
        next();
        return;
      }
      if (action === "prev") {
        if (!open.value) void openBar(targetId, { selectAll: false });
        prev();
        return;
      }
      if (action === "close") {
        void closeBar();
      }
    }) || null;

  unsubResult =
    api?.onResult?.((payload: FindResultPayload) => {
      const targetId = safeNumber(payload?.targetWebContentsId);
      if (targetId == null) return;
      if (effectiveTargetWebContentsId.value == null || targetId !== effectiveTargetWebContentsId.value) return;

      const r = payload?.result || {};
      matches.value = safeNumber(r.matches) ?? 0;
      activeMatchOrdinal.value = safeNumber(r.activeMatchOrdinal) ?? 0;
    }) || null;
});

onBeforeUnmount(() => {
  try {
    unsubAction?.();
  } catch {}
  try {
    unsubResult?.();
  } catch {}
  unsubAction = null;
  unsubResult = null;

  if (debounceTimer != null) window.clearTimeout(debounceTimer);
  debounceTimer = null;
});

watch(query, () => {
  if (!open.value) return;
  scheduleFreshFind();
});

watch(targetWebContentsId, () => {
  if (!open.value) return;
  if (!query.value) return;
  scheduleFreshFind();
});

watch(activeTargetWebContentsId, (id) => {
  if (!open.value) return;
  if (id == null) return;
  matches.value = 0;
  activeMatchOrdinal.value = 0;
  if (query.value) scheduleFreshFind();
});
</script>

<style scoped>
.findbar {
  position: absolute;
  top: 10px;
  right: 12px;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px;
  border-radius: 12px;
  border: 1px solid var(--border-color, rgba(60, 60, 67, 0.16));
  background: var(--bg-primary, #ffffff);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.findbar-input {
  width: 220px;
  height: 30px;
  padding: 0 10px;
  border-radius: 10px;
  border: 1px solid var(--border-color, rgba(60, 60, 67, 0.16));
  outline: none;
  background: var(--bg-primary, #ffffff);
  color: var(--text-primary, #000);
  font-size: 13px;
}

.findbar-input:focus-visible {
  border-color: var(--accent-primary, #007aff);
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.25);
}

.findbar-count {
  min-width: 52px;
  text-align: right;
  font-size: 12px;
  color: var(--text-secondary, #3c3c43);
  user-select: none;
}

.findbar-count.muted {
  opacity: 0.55;
}
</style>
