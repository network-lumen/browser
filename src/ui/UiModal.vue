<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 flex-align-justify-center bg-black-a50 backdrop-blur-4 z-9999"
      role="dialog"
      aria-modal="true"
      @click.self="close"
    >
      <div class="bg-card border-radius-16px shadow-lg overflow-hidden flex flex-column max-h-90vh" :class="panelClass" @click.stop>
        <div v-if="$slots.header || title" class="flex-align-center-justify-space-between p-20px border-bottom-default">
          <slot name="header">
            <h3 class="m-0px color-text-primary">{{ title }}</h3>
          </slot>
          <button v-if="closable" type="button" class="bg-transparent border-none cursor-pointer color-text-secondary" @click="close">
            <X :size="18" />
          </button>
        </div>
        <div class="p-20px overflow-y-auto min-h-0">
          <slot />
        </div>
        <div v-if="$slots.footer" class="flex-justify-end gap-12px p-20px border-top-default">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';
import { X } from 'lucide-vue-next';

/**
 * The shell every modal in the app is drawn in: the overlay, the panel, and
 * the header/body/footer slots. `UiDialog` sits on top of it and adds the
 * Cancel-beside-one-action footer that most dialogs want.
 *
 * Escape and the scroll lock live here rather than in each caller because
 * neither existed anywhere: no modal in the app closed on Escape, and the page
 * behind one kept scrolling under the overlay. Both were uniformly absent,
 * which is exactly why nobody noticed - now that every dialog comes through
 * this file, one place fixes all of them.
 */

/**
 * Every modal currently open, oldest first. Escape closes the top one only:
 * dialogs do stack here - the site host can raise a permission prompt over a
 * page's own modal - so a plain global listener would have closed all of them
 * at once.
 */
const openModals: Array<() => void> = [];

/** Set by whichever modal opened first; restored when the last one closes. */
let previousBodyOverflow: string | null = null;

function onGlobalKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  const top = openModals[openModals.length - 1];
  if (!top) return;
  event.stopPropagation();
  top();
}

function register(dismiss: () => void) {
  if (!openModals.length) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onGlobalKeydown, true);
  }
  openModals.push(dismiss);
}

function unregister(dismiss: () => void) {
  const at = openModals.lastIndexOf(dismiss);
  if (at !== -1) openModals.splice(at, 1);
  if (!openModals.length) {
    window.removeEventListener('keydown', onGlobalKeydown, true);
    document.body.style.overflow = previousBodyOverflow ?? '';
    previousBodyOverflow = null;
  }
}

const props = withDefaults(defineProps<{
  modelValue: boolean;
  title?: string;
  closable?: boolean;
  panelClass?: string;
}>(), {
  closable: true,
  panelClass: 'w-min-520px-92vw',
});

const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>();

function close() {
  emit('update:modelValue', false);
}

/**
 * Escape is refused while `closable` is false, matching the cross and the
 * click outside - a dialog that blocks dismissal during a request means it,
 * and the keyboard is not a way around that.
 */
function dismissFromEscape() {
  if (props.closable) close();
}

watch(
  () => props.modelValue,
  (open, wasOpen) => {
    if (open === wasOpen) return;
    if (open) register(dismissFromEscape);
    else unregister(dismissFromEscape);
  },
  { immediate: true }
);

// A modal unmounted while still open (its whole page went away) would
// otherwise leave the scroll locked for good.
onBeforeUnmount(() => unregister(dismissFromEscape));
</script>
