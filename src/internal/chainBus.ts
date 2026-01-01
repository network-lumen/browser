import { ref } from 'vue';
import { getLatestBlockHeight } from './chainRpc';

export const blockHeight = ref<number | null>(null);
export const blockHeightLoading = ref(false);

let subscribed = false;

function ensureSubscribed() {
  if (subscribed) return;

  const anyWindow: any = window as any;
  const rpc = anyWindow?.lumen?.rpc;
  if (!rpc || typeof rpc.onHeightChanged !== 'function') {
    return;
  }

  try {
    rpc.onHeightChanged((payload: any) => {
      const raw =
        payload && typeof payload === 'object' && 'height' in payload
          ? (payload as any).height
          : null;
      const h = Number(raw);
      if (Number.isFinite(h) && h > 0) {
        blockHeight.value = h;
      }
    });
    subscribed = true;
  } catch {
    // ignore subscription errors
  }
}

export async function refreshBlockHeight() {
  ensureSubscribed();
  if (blockHeightLoading.value) return;
  blockHeightLoading.value = true;
  try {
    const h = await getLatestBlockHeight();
    if (h != null) {
      blockHeight.value = h;
    }
  } finally {
    blockHeightLoading.value = false;
  }
}
