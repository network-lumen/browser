<template>
  <div class="appregion-no-drag flex-align-center flex-1 relative min-w-0 navbar-address-bar">
    <Search :size="15" stroke-width="2" class="color-text-tertiary absolute cursor-events-none left-12px" />
    <UiInput
      bg-class="bg-secondary"
      radius-class="border-radius-10px"
      font-size-class="text-13px"
      padding-class="pt-8px pr-48px pb-8px pl-40px"
      :focus-ring="false"
      :value="modelValue"
      :placeholder="t('Search or enter a URL')"
      class="navbar-url-bar-input border-default focus-outline-none focus-bg-primary focus-ring focus-shadow placeholder-tertiary"
      @input="onInput"
      @keydown.down.prevent="moveHighlight(1)"
      @keydown.up.prevent="moveHighlight(-1)"
      @keydown.esc="closeSuggestions"
      @keydown.enter="onEnter"
    />

    <UiButton
      variant="icon"
      icon-radius-class="border-radius-8px"
      icon-padding-class=""
      class="flex-inline-align-justify-center size-28px color-text-tertiary absolute top-half translate-y-center right-6px"
      :class="{ 'color-yellow-override': favourite }"
      :title="favourite ? t('Remove from shortcuts') : t('Add to shortcuts')"
      :aria-label="favourite ? t('Remove from shortcuts') : t('Add to shortcuts')"
      :aria-pressed="favourite ? 'true' : 'false'"
      @mousedown.prevent
      @click="emit('toggle-favourite')"
    >
      <Star :size="16" :fill="favourite ? 'currentColor' : 'none'" />
    </UiButton>

    <UiCard
      v-if="showSuggestions && suggestions.length"
      padding="none"
      :shadow="false"
      role="listbox"
      class="absolute p-8px shadow-xl z-100 left-0 right-0 calc-top-100-6px"
    >
      <button
        v-for="(item, index) in suggestions"
        :key="item.url"
        type="button"
        role="option"
        :aria-selected="index === highlighted ? 'true' : 'false'"
        class="flex-align-center gap-10px p-8px border-radius-10px w-full border-none bg-transparent cursor-pointer text-left min-w-0 hover-bg-hover"
        :class="{ 'bg-primary-a10': index === highlighted }"
        @mousedown.prevent="choose(item)"
        @mousemove="highlighted = index"
      >
        <span
          class="flex-inline-align-justify-center flex-shrink-0 color-text-primary txt-weight-strong border-radius-10px text-11px border-default bg-fill-secondary size-28px"
          :style="avatarToneStyle(item.kind)"
        >
          {{ item.monogram }}
        </span>
        <span class="flex flex-column flex-1 min-w-0">
          <span class="text-13px color-text-primary truncate">{{ item.title }}</span>
          <span class="text-11px color-text-tertiary truncate">{{ item.subtitle }}</span>
        </span>
        <Star v-if="item.source === 'favourite'" :size="13" fill="currentColor" class="color-text-tertiary flex-shrink-0" />
      </button>
    </UiCard>
  </div>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Search, Star } from 'lucide-vue-next';
import UiCard from '../ui/UiCard.vue';
import UiInput from '../ui/UiInput.vue';
import UiButton from '../ui/UiButton.vue';
import { avatarToneStyle } from '../internal/favouriteMeta';
import { rankAddressSuggestions } from '../internal/services/addressSuggestions';
import { useFavourites } from '../stores/favouritesStore';
import { useHistory } from '../stores/historyStore';
import type { AddressSuggestion } from '../types/addressSuggestions';

const props = defineProps<{
  modelValue: string;
  favourite: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'submit', value: string): void;
  (e: 'toggle-favourite'): void;
}>();

const { favouriteEntries } = useFavourites();
const { historyEntries } = useHistory();

const showSuggestions = ref(false);
const highlighted = ref(-1);

/**
 * The list opens on typing, not on focus. The field already holds the address
 * of the page being looked at, so a focus-triggered list would drop a dropdown
 * over the page every time the user clicks the URL bar to copy it.
 */
const query = computed(() => (showSuggestions.value ? props.modelValue : ''));

const suggestions = computed<AddressSuggestion[]>(() =>
  rankAddressSuggestions(query.value, {
    favourites: favouriteEntries.value,
    history: historyEntries.value
  })
);

// A shrinking list can leave the highlight past its end, and Enter would then
// fall through to navigating whatever raw text is in the field.
watch(suggestions, (list) => {
  if (highlighted.value >= list.length) highlighted.value = list.length - 1;
});

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value);
  showSuggestions.value = true;
  highlighted.value = -1;
}

function closeSuggestions() {
  showSuggestions.value = false;
  highlighted.value = -1;
}

function moveHighlight(delta: number) {
  const count = suggestions.value.length;
  if (!count) return;
  showSuggestions.value = true;
  // -1 is "nothing picked", and it stays in the cycle as one more slot: past
  // the last row you land back on the raw text you typed rather than wrapping
  // straight to the top and losing it.
  const slots = count + 1;
  highlighted.value = ((highlighted.value + 1 + delta + slots) % slots) - 1;
}

function choose(item: AddressSuggestion) {
  closeSuggestions();
  emit('update:modelValue', item.url);
  emit('submit', item.url);
}

function onEnter() {
  const picked = suggestions.value[highlighted.value];
  if (picked) {
    choose(picked);
    return;
  }
  closeSuggestions();
  emit('submit', props.modelValue);
}

function onGlobalClick(event: MouseEvent) {
  const el = event.target as HTMLElement | null;
  if (el?.closest('.navbar-address-bar')) return;
  closeSuggestions();
}

onMounted(() => window.addEventListener('click', onGlobalClick));
onBeforeUnmount(() => window.removeEventListener('click', onGlobalClick));
</script>
