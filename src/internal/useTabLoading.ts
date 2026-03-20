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

  watch(
    () => readLoading(),
    (next) => {
      applyLoading(next);
    },
    { immediate: true },
  );

  onActivated(() => {
    applyLoading(readLoading());
  });

  onDeactivated(() => {
    applyLoading(false);
  });

  onBeforeUnmount(() => {
    applyLoading(false);
  });
}
