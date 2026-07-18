import { useInternalLumen } from '../composables/useInternalLumen';

export async function getLatestBlockHeight(): Promise<number | null> {
  const fn = useInternalLumen()?.rpc?.getHeight;

  if (typeof fn !== 'function') {
    return null;
  }

  try {
    const result = await fn();
    const raw =
      result && typeof result === 'object' && 'height' in result
        ? (result as any).height
        : result;
    const height = Number(raw);

    if (!Number.isFinite(height) || height <= 0) {
      return null;
    }

    return height;
  } catch {
    return null;
  }
}

