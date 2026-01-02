<template>
  <section class="main-shell flex flex-column w-full h-full">
    <div class="app overflow-hidden">
      <div
        class="tabs-header  h-200 padding-right-150 txt-xs overflow-hidden relative flex-align-center text-center"
        :style="{ background: 'var(--bg-primary, white)', borderBottom: '1px solid var(--border-color, #e5e7eb)' }"
        ref="hdr"
      >
        <div
          v-for="(t, i) in tabs"
          :key="t.id"
          class="tab h-200 min-w-1500 max-w-3000 flex-0-0-auto padding-left-50 padding-right-50 gap-50 cursor-select-none cursor-pointer border-radius-top-left-top-right-10px hover-bg-black-a10 flex-align-justify-center transition-ui"
          :data-id="t.id"
          :class="tabClasses(t)"
          :style="tabStyle(t.id)"
          @pointerdown="onTabPointerDown($event, t.id, i)"
          @auxclick="(e) => e.button === 1 && closeTab(t.id)"
        >
          <div class="flex-align-justify-center border-radius-circle size-100">
            <UiSpinner v-if="t.loading" class="color-gray-blue" size="sm" />
            <Earth v-else :size="16" class="color-gray-blue" />
          </div>
          <div class="label txt-overflow-ellipsis nowrap overflow-hidden flex-1-1-0 min-w-0" :title="currentTitle(t)">
            {{ currentTitle(t) }}
          </div>

          <UiButton
            variant="icon"
            title="Close"
            @pointerdown.stop
            @click.stop.prevent="closeTab(t.id)"
          >
            <X :size="14" />
          </UiButton>
        </div>

        <UiButton
          ref="addBtn"
          variant="none"
          title="New tab"
          class="hover-bg-black-a10 margin-left-25 border-radius-circle padding-25 border-none cursor-pointer bg-white-a45"
          @click="addTab"
        >
          <Plus :size="16" />
        </UiButton>

        <div class="w-full appregion-drag h-200"></div>

        <div
          v-if="isDragging"
          class="drop-indicator cursor-events-none bg-blue-sky absolute bottom-0 top-25 w-25"
          :style="{ left: dropLeft + 'px' }"
        ></div>
      </div>

      <TabBar
        :header_height="tabsHeaderHeight()"
        :tabActive="activeId"
        :tabs="tabs"
        @openInNewTab="openInNewTab"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue';
import { Earth, Plus, X } from 'lucide-vue-next';
import TabBar from '../layouts/TabBar.vue';
import UiSpinner from '../ui/UiSpinner.vue';
import UiButton from '../ui/UiButton.vue';
import { getInternalTitle } from '../internal/routes';

type TabHistoryEntry = { url: string; title?: string };
type Tab = {
  id: string;
  url?: string;
  history: TabHistoryEntry[];
  history_position: number;
  loading?: boolean;
};

const tabs = ref<Tab[]>([]);
const activeId = ref<string>('');

const hdr = ref<HTMLElement | null>(null);
const draggingId = ref<string | null>(null);
const isDragging = ref(false);
const dragStartX = ref(0);
const dragDx = ref(0);
const dropLeft = ref(0);
const addBtn = ref<HTMLElement | null>(null);

const startIndex = ref(-1);
const draggingWidth = ref(0);
const layout = ref<{ id: string; left: number; width: number; center: number }[]>([]);
const dropIndex = ref(-1);
const shifts = ref<Record<string, number>>({});

const labelWidth = ref(200);
const MIN_LABEL = 0;
const MAX_LABEL = 220;
const GAP = 1;

function tabClasses(t: Tab) {
  return {
    'active': t.id === activeId.value,
    'dragging z-2 cursor-events-none': draggingId.value === t.id
  };
}

function tabsHeaderHeight(): number {
  const header = hdr.value;
  return header ? header.clientHeight : 200;
}

onMounted(async () => {
  await nextTick();
  if (!tabs.value.length) {
    addTab();
  }
  recalcLabelWidth();
  createResizeObserver();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', recalcLabelWidth);
  ro?.disconnect();
});

watch(
  () => tabs.value.length,
  () => {
    nextTick(recalcLabelWidth);
  }
);

function currentTitle(t: Tab): string {
  const h = t.history || [];
  const idx = Math.min(Math.max(t.history_position ?? 0, 0), Math.max(h.length - 1, 0));
  return h[idx]?.title ?? 'New tab';
}

function makeTab(partial?: Partial<Tab>): Tab {
  const id = `tab-${tabs.value.length + 1}`;
  const defaultUrl = 'lumen://newtab';
  const defaultTitle = getInternalTitle(defaultUrl);
  const history = partial?.history || [{ url: defaultUrl, title: defaultTitle }];
  const history_position = partial?.history_position ?? 0;
  const current = history[history_position] || history[0];
  return {
    id,
    url: current?.url || defaultUrl,
    history,
    history_position,
    loading: false
  };
}

function addTab() {
  const t = makeTab();
  tabs.value.push(t);
  activeId.value = t.id;
  nextTick(recalcLabelWidth);
}

function closeTab(id: string) {
  if (tabs.value.length === 1) return;
  const idx = tabs.value.findIndex((t) => t.id === id);
  if (idx === -1) return;
  const closingActive = activeId.value === id;
  tabs.value.splice(idx, 1);
  if (closingActive) {
    const next = tabs.value[idx] || tabs.value[idx - 1] || tabs.value[0];
    if (next) activeId.value = next.id;
  }
  nextTick(recalcLabelWidth);
}

function openInNewTab(url: string) {
  const title = getInternalTitle(url);
  const t = makeTab({ history: [{ url, title }], history_position: 0 });
  t.url = url;
  tabs.value.push(t);
  activeId.value = t.id;
  nextTick(recalcLabelWidth);
}

// Expose tab opening to internal pages via provide/inject
provide('openInNewTab', (url: string) => {
  openInNewTab(url);
});

function measureLayout() {
  const root = hdr.value;
  if (!root) return;
  const nodes = Array.from(root.querySelectorAll<HTMLElement>('.tab'));
  const rootLeft = root.getBoundingClientRect().left;
  layout.value = nodes.map((n, i) => {
    const r = n.getBoundingClientRect();
    return {
      id: (n.dataset.id as string) || tabs.value[i]?.id || `i${i}`,
      left: r.left - rootLeft,
      width: r.width,
      center: r.left - rootLeft + r.width / 2
    };
  });
}

function currentLeftById() {
  const root = hdr.value;
  if (!root) return {};
  const rootLeft = root.getBoundingClientRect().left;
  const map: Record<string, number> = {};
  root.querySelectorAll<HTMLElement>('.tab').forEach((el) => {
    const id = el.dataset.id as string;
    const rect = el.getBoundingClientRect();
    map[id] = rect.left - rootLeft;
  });
  return map;
}

function tabStyle(id: string) {
  if (draggingId.value === id) {
    return { transform: `translateX(${dragDx.value}px)` };
  }
  const s = shifts.value[id] ?? 0;
  return s ? { transform: `translateX(${s}px)` } : null;
}

function onTabPointerDown(e: PointerEvent, id: string, idx: number) {
  if (e.button !== 0) return;
  activeId.value = id;
  const el = e.currentTarget as HTMLElement | null;
  if (!el) return;

  el.setPointerCapture(e.pointerId);

  draggingId.value = id;
  dragStartX.value = e.clientX;
  dragDx.value = 0;
  startIndex.value = idx;
  isDragging.value = false;
  shifts.value = {};

  measureLayout();
  const lay = layout.value[startIndex.value];
  draggingWidth.value = lay?.width ?? 0;
  dropIndex.value = idx;
  dropLeft.value = lay?.left ?? 0;

  const onMove = (ev: PointerEvent) => {
    const dx = ev.clientX - dragStartX.value;

    if (!isDragging.value && Math.abs(dx) > 6) {
      isDragging.value = true;
      document.documentElement.style.userSelect = 'none';
    }
    if (!isDragging.value) return;

    dragDx.value = dx;
    const start = layout.value[startIndex.value];
    if (!start) return;

    const centerX = start.left + dx + start.width / 2;

    let target = layout.value.findIndex((it) => centerX < it.center);
    if (target === -1) target = layout.value.length;

    dropIndex.value = target;

    dropLeft.value =
      target === layout.value.length
        ? (layout.value[target - 1]?.left ?? 0) + (layout.value[target - 1]?.width ?? 0)
        : layout.value[target]?.left ?? 0;

    const from = startIndex.value;
    const to = target;
    const w = draggingWidth.value;
    const sh: Record<string, number> = {};

    if (to > from) {
      for (let i = 0; i < layout.value.length; i++) {
        const idAt = layout.value[i]?.id;
        if (!idAt || idAt === draggingId.value) continue;
        if (i >= from + 1 && i <= to - 1) sh[idAt] = -w;
        if (i === to) sh[idAt] = -w;
      }
    } else if (to < from) {
      for (let i = 0; i < layout.value.length; i++) {
        const idAt = layout.value[i]?.id;
        if (!idAt || idAt === draggingId.value) continue;
        if (i >= to && i <= from - 1) sh[idAt] = +w;
      }
    }
    shifts.value = sh;
  };

  const onUp = async (ev: PointerEvent) => {
    el.releasePointerCapture(ev.pointerId);
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.documentElement.style.userSelect = '';

    const didDrag = isDragging.value;
    isDragging.value = false;

    const before = currentLeftById();

    if (didDrag) {
      const from = startIndex.value;
      let to = dropIndex.value;
      if (to > from) to -= 1;

      if (from !== -1 && to !== -1 && from !== to) {
        const arr = tabs.value.slice();
        const [moved] = arr.splice(from, 1);
        arr.splice(to, 0, moved);
        tabs.value = arr;
        activeId.value = moved.id;

        await nextTick();

        const after = currentLeftById();
        const root = hdr.value;
        if (root) {
          root.querySelectorAll<HTMLElement>('.tab').forEach((node) => {
            const idNode = node.dataset.id as string;
            if (before[idNode] === undefined || after[idNode] === undefined) return;
            const delta = before[idNode] - after[idNode];
            node.style.transform = `translateX(${delta}px)`;
            void node.offsetWidth;
            node.style.transform = '';
          });
        }
      }
    }

    draggingId.value = null;
    dragDx.value = 0;
    startIndex.value = -1;
    dropIndex.value = -1;
    shifts.value = {};
  };

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

let ro: ResizeObserver | null = null;

function recalcLabelWidth() {
  const root = hdr.value;
  if (!root) return;
  const n = tabs.value.length || 1;
  const total = root.clientWidth;
  const plusW = (addBtn.value?.offsetWidth ?? 36) + 8;
  const firstTab = root.querySelector<HTMLElement>('.tab');
  const firstLabel = root.querySelector<HTMLElement>('.tab .label');
  let extras = 64;
  if (firstTab && firstLabel) {
    extras = firstTab.offsetWidth - firstLabel.offsetWidth;
    if (extras < 40) extras = 40;
  }
  const available = total - plusW - GAP * Math.max(0, n - 1);
  const per = Math.floor((available - n * extras) / n);
  labelWidth.value = Math.max(MIN_LABEL, Math.min(MAX_LABEL, per));
}

function createResizeObserver() {
  if (ro) return;
  ro = new ResizeObserver(() => recalcLabelWidth());
  if (hdr.value) ro.observe(hdr.value);
  window.addEventListener('resize', recalcLabelWidth);
}
</script>

<style scoped>
.main-shell {
  min-height: 100vh;
  background: radial-gradient(1200px 400px at -10% 150%, var(--primary-a25), transparent 60%),
              radial-gradient(1200px 400px at 110% -50%, var(--white-blue-light), transparent 60%),
              linear-gradient(135deg, var(--white-blue-light), var(--white-blue-light));
}
</style>
