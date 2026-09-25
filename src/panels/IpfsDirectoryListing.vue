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

    <!-- Always, not past some number of entries. A threshold meant the box
         was missing from exactly the folders someone opens first, and "it is
         not there" is a worse surprise than one unused row. -->
    <div v-if="entries.length" class="ipfs-listing-search">
      <Search :size="15" class="ipfs-listing-search-icon" />
      <UiInput
        bg-class="bg-secondary"
        radius-class="border-radius-10px"
        font-size-class="text-14px"
        padding-class="pt-8px pr-10px pb-8px pl-40px"
        :focus-ring="false"
        v-model="query"
        :placeholder="t('Search in this folder')"
        class="w-full border-default focus-outline-none focus-bg-primary focus-ring focus-shadow placeholder-tertiary"
      />
      <span v-if="query" class="ipfs-listing-count">
        {{ t('{shown} of {total}', { shown: String(visible.length), total: String(entries.length) }) }}
      </span>
    </div>

    <UiCard padding="none" :shadow="false" v-if="!entries.length" class="p-16px color-text-secondary">
      {{ t('Empty folder') }}
    </UiCard>

    <UiCard padding="none" :shadow="false" v-else-if="!visible.length" class="p-16px color-text-secondary">
      {{ t('No file matches that.') }}
    </UiCard>

    <div v-else class="border-radius-16px border-default overflow-hidden">
      <div
        v-for="entry in visible"
        :key="entry.key"
        class="ipfs-listing-row hover-bg-secondary last-border-bottom-none border-bottom-1 bg-primary"
        @dblclick="emit('open', entry)"
      >
        <div class="ipfs-listing-main" @click="emit('open', entry)">
          <Folder v-if="entry.type === 'dir'" :size="16" class="ipfs-listing-icon color-text-secondary" />
          <BookOpen v-else-if="isEpubName(entry.name)" :size="16" class="ipfs-listing-icon color-text-secondary" />
          <File v-else :size="16" class="ipfs-listing-icon color-text-secondary" />
          <!-- Wrapped rather than truncated: on a phone a truncated name is a
               name nobody can read, and there is no hover to reveal the rest. -->
          <span class="ipfs-listing-name">{{ entry.name }}</span>
        </div>

        <!-- A dash rather than "0 B" for a directory: kubo reports Size 0 for
             one, and a column of zeroes reads as a folder full of empty files. -->
        <div class="ipfs-listing-size mono color-text-secondary">
          {{ formatBytes(entry.size, { empty: '-' }) }}
        </div>

        <div class="ipfs-listing-actions">
          <UiButton variant="primary" type="button" class="narrow-hide" @click.stop="emit('copy-link', entry)">
            {{ t('Copy link') }}
          </UiButton>
          <UiButton variant="primary" type="button" class="narrow-hide" @click.stop="emit('open', entry)">
            {{ t('Open') }}
          </UiButton>

          <!-- On a phone the row itself opens the entry, so the only control
               worth its width is the one the row cannot do. -->
          <button
            type="button"
            class="ipfs-listing-copy narrow-only"
            :aria-label="t('Copy link')"
            :title="t('Copy link')"
            @click.stop="emit('copy-link', entry)"
          >
            <Link2 :size="18" />
          </button>
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
import { computed, ref, watch } from 'vue';
import { BookOpen, File, Folder, Link2, Search } from 'lucide-vue-next';
import UiButton from '../ui/UiButton.vue';
import UiCard from '../ui/UiCard.vue';
import UiInput from '../ui/UiInput.vue';
import { t } from '../stores/i18nStore';
import { formatBytes } from '../internal/services/format';
import { isEpubName } from '../internal/services/driveEntries';
import { filterDirectoryEntries } from '../internal/services/ipfsDirectory';
import type { IpfsCrumb, IpfsDirEntry } from '../types/ipfsDirectory';

const props = defineProps<{
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

const query = ref('');

const visible = computed(() => filterDirectoryEntries(props.entries, query.value));

// A query belongs to the folder it was typed in: carrying it into the next one
// would open a directory that looks empty for a reason nothing on screen gives.
watch(
  () => props.entries,
  () => {
    query.value = '';
  }
);
</script>
