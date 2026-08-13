import {
  inject,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from 'vue';

export function useTabLoadingSync(source: MaybeRefOrGetter<boolean>) {
  const setCurrentTabLoading = inject<((loading: boolean) => void) | null>(
    'setCurrentTabLoading',
    null,
  );

  function applyLoading(next: boolean) {
    try {
      setCurrentTabLoading?.(!!next);
    } catch {
      // ignore tab loading sync failures
    }
  }

  const readLoading = () => !!toValue(source);
  const clearLoading = () => applyLoading(false);

  // `readLoading` is already a getter and `applyLoading` already takes the new
  // value first, so both can be passed straight through.
  watch(readLoading, applyLoading, { immediate: true });

  // Re-reads on activation: the source may have changed while the tab was
  // cached by <KeepAlive>, so this cannot be point-free like the two below.
  onActivated(() => applyLoading(readLoading()));

  onDeactivated(clearLoading);
  onBeforeUnmount(clearLoading);
}
