import { useInternalLumen } from '../composables/useInternalLumen';

/** SHA-256 hash (uppercase hex) of a raw base64-encoded Tendermint tx, matching the on-chain tx hash format. */
export async function computeTxHash(txDataBase64: string): Promise<string> {
  try {
    const binaryString = atob(txDataBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  } catch (e) {
    console.error('Failed to hash tx:', e);
    return '0000000000000000000000000000000000000000000000000000000000000000';
  }
}

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

