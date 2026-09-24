<template>
  <div>
    <div class="flex-align-center flex-wrap-wrap gap-6px p-0px pt-8px pb-8px">
      <UiButton variant="primary" type="button" :disabled="!canNavigate" class="disabled-fade-50" @click="emit('open-root')">
        {{ rootLabel || '/' }}
      </UiButton>
      <template v-for="(crumb, index) in crumbs" :key="crumb.path">
        <span class="color-text-secondary">/</span>
        <UiButton variant="primary" type="button" :disabled="!canNavigate" class="disabled-fade-50" @click="emit('open-crumb', index)">
          {{ crumb.label }}
        </UiButton>
      </template>
    </div>

    <UiCard padding="none" :shadow="false" v-if="!entries.length" class="p-16px color-text-secondary">
      {{ t('Empty folder') }}
    </UiCard>

    <div v-else class="border-radius-16px border-default overflow-hidden">
      <div
        v-for="entry in entries"
        :key="entry.key"
        class="hover-bg-secondary grid-cols-200minmax-140-180 last-border-bottom-none gap-12px grid flex-inline-align-center py-12px px-16px border-bottom-1 bg-primary"
        @dblclick="emit('open', entry)"
      >
        <div class="flex-align-center cursor-pointer gap-10px min-w-0" @click="emit('open', entry)">
          <Folder v-if="entry.type === 'dir'" :size="16" class="color-text-secondary" />
          <BookOpen v-else-if="isEpubName(entry.name)" :size="16" class="color-text-secondary" />
          <File v-else :size="16" class="color-text-secondary" />
          <span class="truncate">{{ entry.name }}</span>
        </div>
        <!-- A dash rather than "0 B" for a directory: kubo reports Size 0 for
             one, and a column of zeroes reads as a folder full of empty files. -->
        <div class="mono text-right color-text-secondary text-14px">
          {{ formatBytes(entry.size, { empty: '-' }) }}
        </div>
        <div class="flex-justify-end gap-8px">
          <UiButton variant="primary" type="button" @click.stop="emit('copy-link', entry)">
            {{ t('Copy link') }}
          </UiButton>
          <UiButton variant="primary" type="button" @click.stop="emit('open', entry)">
            {{ t('Open') }}
          </UiButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * An IPFS directory, drawn the app's way.
 *
 * Two pages show the same thing and used to disagree about how.
 * `lumen://ipfs/<cid>` drew this table; `lumen://<domain>` handed the gateway
 * URL to a webview, and a directory with no `index.html` came back as the
 * gateway's own "Index of /ipfs/…" page - another font, another language, and
 * a CID in place of the domain. One component, so a folder looks the same
 * whichever way it was addressed.
 *
 * It knows nothing about where the entries came from or where a click should
 * go: the pages answer both, because the URL to navigate to is the one thing
 * that genuinely differs between them.
 */
import { BookOpen, File, Folder } from 'lucide-vue-next';
import UiButton from '../ui/UiButton.vue';
import UiCard from '../ui/UiCard.vue';
import { t } from '../stores/i18nStore';
import { formatBytes } from '../internal/services/format';
import { isEpubName } from '../internal/services/driveEntries';
import type { IpfsCrumb, IpfsDirEntry } from '../types/ipfsDirectory';

defineProps<{
  entries: IpfsDirEntry[];
  crumbs: IpfsCrumb[];
  /** False while the tab cannot be navigated, which greys the trail. */
  canNavigate: boolean;
  /** What the first crumb reads: '/' for a CID, the host for a domain. */
  rootLabel?: string;
}>();

const emit = defineEmits<{
  (e: 'open', entry: IpfsDirEntry): void;
  (e: 'open-root'): void;
  (e: 'open-crumb', index: number): void;
  (e: 'copy-link', entry: IpfsDirEntry): void;
}>();
</script>
