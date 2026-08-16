<!--
  ####### NavBar ACTIVITY CENTER (uploads / pins / propagation) #######

  ⚠️ NOT MOUNTED ON PURPOSE. Finished and working, but deliberately kept out
  of the navbar for now (decision of 2026-08-03) until we want to ship it.

  So it will show up as an orphan in any dead-code sweep: nothing imports it,
  and `initActivityCenter()` therefore never runs, leaving the whole service
  dormant. Do NOT delete it on that basis. To ship it, import this component
  in src/layouts/NavBar.vue and drop <ActivityCenterButton /> into the
  "Quick Actions" block next to the Drive button.
-->
<template>
  <div class="appregion-no-drag relative">
    <UiButton
      variant="icon"
      icon-radius-class="border-radius-10px"
      icon-padding-class=""
      class="active-scale-98 flex-inline-align-justify-center size-32px relative"
      :class="{ 'color-yellow-override': open }"
      :title="runningCount ? t('Activity ({count} running)', { count: runningCount }) : t('Activity')"
      @click.stop="toggle"
    >
      <Activity :size="16" />
      <span
        v-if="runningCount"
        class="absolute top-0 right-0 border-radius-full bg-accent color-white text-10px min-w-16px h-16px flex-align-justify-center px-2px"
      >{{ runningCount }}</span>
    </UiButton>

    <UiCard
      v-if="open"
      padding="none"
      :shadow="false"
      role="menu"
      class="absolute p-8px shadow-xl z-100 right-0 w-340px max-w-min-92vw-340px calc-top-100-6px"
    >
      <div class="flex-align-center flex-justify-space-between p-0px pr-8px pb-8px pl-8px">
        <span class="text-11px txt-weight-light color-text-tertiary text-uppercase letter-spacing-005em">{{ t('Activity') }}</span>
        <UiButton
          v-if="items.length"
          variant="none"
          class="text-11px color-text-tertiary cursor-pointer bg-transparent border-none"
          :title="t('Clear finished entries')"
          @click="clearActivityHistory"
        >
          {{ t('Clear') }}
        </UiButton>
      </div>

      <div v-if="items.length" class="flex flex-column gap-6px overflow-y-auto pr-4px max-h-300px">
        <div
          v-for="item in items"
          :key="item.id"
          class="flex flex-column gap-6px border-radius-10px p-10px bg-secondary"
        >
          <div class="flex-align-center gap-8px min-w-0">
            <component :is="kindIcon(item.kind)" :size="14" class="color-text-tertiary flex-0-0-auto" />
            <span class="text-12px color-text-primary truncate flex-1 min-w-0">{{ item.title }}</span>
            <span class="text-10px flex-0-0-auto" :class="statusClass(item.status)">{{ statusLabel(item.status) }}</span>
          </div>

          <UiProgressBar
            v-if="item.status === 'running' || item.status === 'paused'"
            :percent="item.percent"
            :indeterminate="item.percent === null && item.status === 'running'"
            track-class="w-full h-4px bg-fill-secondary"
          />

          <span class="text-11px color-text-tertiary truncate">{{ item.detail }}</span>

          <div v-if="hasControls(item)" class="flex-align-center gap-6px">
            <UiButton v-if="controls(item).pause" variant="secondary" class="text-11px py-2px px-8px" @click="pauseActivity(item)">{{ t('Pause') }}</UiButton>
            <UiButton v-if="controls(item).resume" variant="secondary" class="text-11px py-2px px-8px" @click="resumeActivity(item)">{{ t('Resume') }}</UiButton>
            <UiButton v-if="controls(item).cancel" variant="danger" class="text-11px py-2px px-8px" @click="cancelActivity(item)">{{ t('Cancel') }}</UiButton>
          </div>
        </div>
      </div>

      <div v-else class="text-12px color-text-tertiary text-center py-20px px-8px">
        {{ t('Nothing yet. Uploads, saved content and gateway propagation show up here.') }}
      </div>
    </UiCard>
  </div>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { Activity, ArrowUpFromLine, Save, Share2 } from 'lucide-vue-next';
import UiButton from '../ui/UiButton.vue';
import UiCard from '../ui/UiCard.vue';
import UiProgressBar from '../ui/UiProgressBar.vue';
import {
  activityControls,
  activityItems,
  cancelActivity,
  clearActivityHistory,
  initActivityCenter,
  pauseActivity,
  resumeActivity,
  runningActivityCount
} from '../internal/services/activityCenter';
import type { ActivityItem, ActivityKind, ActivityStatus } from '../types/activityCenter';

const open = ref(false);
const items = activityItems;
const runningCount = runningActivityCount;

const controls = activityControls;

function hasControls(item: ActivityItem): boolean {
  const c = activityControls(item);
  return c.pause || c.resume || c.cancel;
}

function kindIcon(kind: ActivityKind) {
  if (kind === 'upload') return ArrowUpFromLine;
  if (kind === 'pin') return Save;
  return Share2;
}

function statusLabel(status: ActivityStatus): string {
  if (status === 'running') return t('Running');
  if (status === 'paused') return t('Paused');
  if (status === 'completed') return t('Done');
  if (status === 'failed') return t('Failed');
  return t('Cancelled');
}

function statusClass(status: ActivityStatus): string {
  if (status === 'failed') return 'color-error';
  if (status === 'completed') return 'color-success';
  if (status === 'paused') return 'color-warning';
  return 'color-text-tertiary';
}

function toggle() {
  open.value = !open.value;
}

function closeOnOutsideClick() {
  open.value = false;
}

onMounted(() => {
  initActivityCenter();
  document.addEventListener('click', closeOnOutsideClick);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', closeOnOutsideClick);
});
</script>
