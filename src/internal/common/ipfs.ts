import { useInternalLumen } from '../../composables/useInternalLumen';

/**
 * Whether the local IPFS daemon is answering.
 *
 * Gates every Drive upload, and got both halves wrong.
 *
 * The bridge was read once, into a module-level `const`, at import time. If
 * this module loaded before the preload had attached, that constant stayed
 * `undefined` for the life of the session and every upload was refused with
 * "IPFS is not connected" on a perfectly healthy node - the same shape as the
 * bug in `upload.ts` that used to blank the whole renderer. It is read per
 * call now.
 *
 * And the reply was returned as-is. `ipfs:status` answers `{ok: true}` or
 * `{ok: false, error}`, and both are truthy objects, so the caller's
 * `if (!await checkIpfsStatus())` was false either way: the check never fired
 * once, and an upload against a dead daemon went ahead to fail later with
 * whatever the add itself threw.
 */
export async function checkIpfsStatus(): Promise<boolean> {
  try {
    const status = await useInternalLumen()?.ipfsStatus?.();
    return status?.ok === true;
  } catch {
    return false;
  }
}
