<template>
  <!-- The counter sits in the 48px the input reserves on its right - space
       the star button held before it moved into the narrow menu, and which is
       empty on a phone. -->
  <button
    ref="trigger"
    type="button"
    class="navbar-tab-trigger narrow-only"
    :aria-expanded="open ? 'true' : 'false'"
    :aria-label="t('Tabs')"
    :title="t('Tabs')"
    @click.stop="emit('update:open', !open)"
  >
    <span class="navbar-tab-count">{{ countLabel }}</span>
    <ChevronDown :size="12" class="navbar-tab-chevron" :class="{ 'navbar-tab-chevron-open': open }" />
  </button>

  <!-- Teleported, and positioned against the trigger rather than against the
       address bar that holds it: anchored inside that container the panel
       inherited its width - 259px of a 412px screen - which left a title, a
       chip, a CID and a 44px close target fighting over the same line. -->
  <Teleport to="body">
    <div v-if="open" class="navbar-tab-panel" :style="panelStyle" @click.stop>
    <ul class="navbar-tab-list" role="list">
      <li
        v-for="row in rows"
        :key="row.id"
        class="navbar-tab-row"
        :class="{ 'navbar-tab-row-active': row.active }"
        :style="rowStyle(row.id)"
        @pointerdown="onPointerDown($event, row.id)"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      >
        <template v-if="pending.has(row.id)">
          <span class="navbar-tab-undo-label">{{ t('Tab closed') }}</span>
          <button type="button" class="navbar-tab-undo" @click.stop="undoClose(row.id)">
            {{ t('Undo') }}
          </button>
        </template>

        <template v-else>
          <button type="button" class="navbar-tab-select" @click.stop="select(row.id)">
            <span class="navbar-tab-icon">
              <UiSpinner v-if="row.loading" size="sm" />
              <img
                v-else-if="row.favicon"
                class="navbar-tab-favicon"
                :src="row.favicon"
                alt=""
                draggable="false"
              />
              <Earth v-else :size="18" class="color-text-tertiary" />
            </span>

            <span class="navbar-tab-text">
              <span class="navbar-tab-title">{{ row.title }}</span>
              <span class="navbar-tab-meta">
                <!-- Written out rather than built from the origin: a class name
                     assembled in script is invisible to check:conventions,
                     which would then report all four as dead CSS. -->
                <span
                  v-if="row.origin !== 'blank'"
                  class="navbar-tab-chip"
                  :class="{
                    'navbar-tab-chip-chain': row.origin === 'chain',
                    'navbar-tab-chip-ipfs': row.origin === 'ipfs',
                    'navbar-tab-chip-internal': row.origin === 'internal',
                    'navbar-tab-chip-web': row.origin === 'web'
                  }"
                >{{ originLabel(row.origin) }}</span>
                <span class="navbar-tab-subtitle">{{ row.subtitle }}</span>
              </span>
            </span>
          </button>

          <button
            type="button"
            class="navbar-tab-close"
            :aria-label="t('Close')"
            :title="t('Close')"
            @click.stop="scheduleClose(row.id)"
          >
            <X :size="16" />
          </button>
        </template>
      </li>
    </ul>

    <!-- Pinned below the scrolling list rather than at the top of it: the most
         frequent action belongs in the half of the screen a thumb reaches. -->
      <button type="button" class="navbar-tab-new" @click.stop="onNewTab">
        <Plus :size="16" />
        <span>{{ t('New tab') }}</span>
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * The tab list on a phone: a counter in the address bar, and a panel under it.
 *
 * Below the narrow breakpoint the desktop tab strip is hidden, because it does
 * not work there - 240px per tab in a 412px viewport with `overflow: hidden`
 * leaves the third tab, and the new-tab button, with nothing to tap. This is
 * what replaces it.
 *
 * A list of lines rather than the grid of thumbnails Chrome and Safari use:
 * external sites render in a cross-origin `<iframe>` on this target, which
 * cannot be captured, so a card grid would be a grid of empty rectangles. The
 * lines carry a favicon, a title, and a chip saying whether the tab is on a
 * chain name, on IPFS or on the ordinary web - the provenance the truncated
 * address bar can no longer show.
 *
 * CLOSING IS DEFERRED, not undone. A swipe or a tap on the cross turns the row
 * into "Tab closed / Undo" and starts a timer; the tab itself only goes when
 * the timer fires. Nothing has to be reconstructed to bring it back, which is
 * what makes the undo honest - a restored tab is the same tab, with its
 * history and its scroll position, not a fresh one pointed at the same URL.
 * Anything still pending when the panel closes is committed at once.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { ChevronDown, Earth, Plus, X } from 'lucide-vue-next';
import UiSpinner from '../ui/UiSpinner.vue';
import { t } from '../stores/i18nStore';
import { buildTabRows, tabCountLabel } from '../internal/services/tabSwitcher';
import type { Tab } from '../types/tab';
import type { TabOrigin } from '../types/tabSwitcher';

const props = defineProps<{
  tabs: Tab[];
  activeId: string;
  open: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'select', id: string): void;
  (e: 'close', id: string): void;
  (e: 'new-tab'): void;
}>();

/** How long an undo stays offered. Long enough to notice, short enough that
 *  the list is not left full of rows that are already gone. */
const UNDO_MS = 4000;

/** Past this many pixels a drag is a dismissal rather than a hesitation. */
const SWIPE_DISMISS_PX = 96;

/** Below this, a pointer is still deciding whether it meant to scroll. */
const SWIPE_START_PX = 8;

const rows = computed(() => buildTabRows(props.tabs, props.activeId, t('New tab')));
const countLabel = computed(() => tabCountLabel(props.tabs.length));

const pending = ref(new Map<string, ReturnType<typeof setTimeout>>());

const trigger = ref<HTMLElement | null>(null);

/**
 * Pinned just under the trigger, measured rather than assumed: the navbar is
 * 48px tall plus its padding, and hard-coding that would put the panel over
 * the bar the day someone changes it.
 */
const panelStyle = ref<Record<string, string>>({ top: '58px' });

const dragId = ref('');
const dragDx = ref(0);
let startX = 0;
let startY = 0;
let dragging = false;

function originLabel(origin: TabOrigin): string {
  if (origin === 'chain') return 'chain';
  if (origin === 'ipfs') return 'ipfs';
  if (origin === 'internal') return 'lumen';
  if (origin === 'web') return 'web';
  return '';
}

function rowStyle(id: string) {
  if (dragId.value !== id || !dragDx.value) return null;
  return { transform: `translateX(${dragDx.value}px)`, opacity: String(rowOpacity()) };
}

function rowOpacity(): number {
  const ratio = Math.min(1, Math.abs(dragDx.value) / SWIPE_DISMISS_PX);
  return Math.max(0.35, 1 - ratio * 0.65);
}

function select(id: string) {
  emit('select', id);
  emit('update:open', false);
}

function onNewTab() {
  emit('new-tab');
  emit('update:open', false);
}

/** Marks the row closed and commits it once the undo window has passed. */
function scheduleClose(id: string) {
  if (pending.value.has(id)) return;
  const timer = setTimeout(() => commitClose(id), UNDO_MS);
  pending.value.set(id, timer);
  // Map mutation is not reactive on its own.
  pending.value = new Map(pending.value);
}

function commitClose(id: string) {
  const timer = pending.value.get(id);
  if (timer) clearTimeout(timer);
  pending.value.delete(id);
  pending.value = new Map(pending.value);
  emit('close', id);
}

function undoClose(id: string) {
  const timer = pending.value.get(id);
  if (timer) clearTimeout(timer);
  pending.value.delete(id);
  pending.value = new Map(pending.value);
}

/** Everything still pending goes now - the panel is no longer there to undo in. */
function flushPending() {
  for (const [id, timer] of pending.value) {
    clearTimeout(timer);
    emit('close', id);
  }
  pending.value = new Map();
}

function onPointerDown(event: PointerEvent, id: string) {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  if (pending.value.has(id)) return;
  dragId.value = id;
  dragDx.value = 0;
  dragging = false;
  startX = event.clientX;
  startY = event.clientY;
}

function onPointerMove(event: PointerEvent) {
  if (!dragId.value) return;
  const dx = event.clientX - startX;
  const dy = event.clientY - startY;

  // A vertical intent wins outright: the list scrolls, and stealing that would
  // make a long list unusable to get one row's gesture.
  if (!dragging) {
    if (Math.abs(dy) > Math.abs(dx)) {
      dragId.value = '';
      return;
    }
    if (Math.abs(dx) < SWIPE_START_PX) return;
    dragging = true;
  }

  dragDx.value = dx;
}

function onPointerUp() {
  const id = dragId.value;
  const dx = dragDx.value;
  dragId.value = '';
  dragDx.value = 0;
  dragging = false;
  if (id && Math.abs(dx) >= SWIPE_DISMISS_PX) scheduleClose(id);
}

watch(
  () => props.open,
  (open) => {
    if (!open) {
      flushPending();
      return;
    }
    const rect = trigger.value?.getBoundingClientRect();
    if (rect) panelStyle.value = { top: `${Math.round(rect.bottom + 10)}px` };
  }
);

onBeforeUnmount(flushPending);
</script>
