export async function getLatestBlockHeight(): Promise<number | null> {
  const anyWindow = window as any;
  const fn = anyWindow?.lumen?.rpc?.getHeight;

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

