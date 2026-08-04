import { bytesToHex } from './services/coerce';

/** SHA-256 hash (uppercase hex) of a raw base64-encoded Tendermint tx, matching the on-chain tx hash format. */
export async function computeTxHash(txDataBase64: string): Promise<string> {
  try {
    const binaryString = atob(txDataBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
    return bytesToHex(hashBuffer, true);
  } catch (e) {
    console.error('Failed to hash tx:', e);
    return '0000000000000000000000000000000000000000000000000000000000000000';
  }
}
