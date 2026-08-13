/**
 * The icon drawn next to a URL everywhere one is listed - sidebar shortcuts,
 * the new tab page, `lumen://history`.
 *
 * Which icon to draw is decided from the URL alone:
 *   - an internal page (`lumen://settings`) gets the Lumen mark;
 *   - a Lumen domain (`lumen://web.lmn`) gets the site's own `/favicon.ico`,
 *     fetched through whichever gateway answers first;
 *   - an http(s) site gets the icon the webview reported the last time the site
 *     was open, falling back to probing its `/favicon.ico`.
 *
 * Resolved icons are pinned to localStorage, so a list draws them on the next
 * start without re-probing a single gateway. Only successes are pinned: a
 * gateway that was not up yet must not blacklist a site forever.
 */
import { ref } from 'vue';
import lumenMark from '../../img/favicon.ico';
import { isHttpUrl, isLumenUrl } from '../navigationUrl';
import {
  buildCandidateUrl,
  localIpfsGatewayBase,
  loadWhitelistedGatewayBases,
  probeUrl,
  resolveDomainTarget,
  resolveIpnsToCid,
} from './contentResolver';
import { STORAGE_KEYS, readJson, writeJson } from './storage';
import type { SiteIconKind } from '../../types/siteIcons';

/** The Lumen mark, for callers that draw internal pages themselves. */
export const LUMEN_MARK = lumenMark;

const PINNED_KEY = STORAGE_KEYS.siteIcons;
/** Keep the pinned set small enough to stay a cheap localStorage read. */
const MAX_PINNED = 400;

export type { SiteIconKind };

function lumenHostOf(rawUrl: string): string {
  const withoutScheme = String(rawUrl || '').trim().slice('lumen://'.length);
  return (withoutScheme.split(/[/?#]/, 1)[0] || '').trim().toLowerCase();
}

function webHostOf(rawUrl: string): string {
  try {
    const url = new URL(String(rawUrl || '').trim());
    return url.host.toLowerCase();
  } catch {
    return '';
  }
}

export function siteIconKind(rawUrl: string): SiteIconKind {
  const url = String(rawUrl || '').trim();
  if (!url) return 'none';
  if (isLumenUrl(url)) {
    // Internal route keys never contain a dot, domains always do.
    return lumenHostOf(url).includes('.') ? 'site' : 'lumen';
  }
  if (isHttpUrl(url)) return webHostOf(url) ? 'site' : 'none';
  return 'none';
}

/**
 * The cache identity of a URL: its host, namespaced by scheme so a Lumen domain
 * and an http host of the same name never collide.
 */
function iconKeyFor(rawUrl: string): string {
  const url = String(rawUrl || '').trim();
  if (!url) return '';
  if (isLumenUrl(url)) {
    const host = lumenHostOf(url);
    return host.includes('.') ? `lumen:${host}` : '';
  }
  if (isHttpUrl(url)) {
    const host = webHostOf(url);
    return host ? `web:${host}` : '';
  }
  return '';
}

const pinnedIcons = ref<Record<string, string>>(readJson<Record<string, string>>(PINNED_KEY, {}));

function persistPinnedIcons() {
  const entries = Object.entries(pinnedIcons.value);
  if (entries.length > MAX_PINNED) {
    // Oldest insertions first, so trimming from the front drops the stalest.
    pinnedIcons.value = Object.fromEntries(entries.slice(entries.length - MAX_PINNED));
  }
  writeJson(PINNED_KEY, pinnedIcons.value);
}

function rememberIcon(key: string, icon: string) {
  if (!key || !icon) return;
  if (pinnedIcons.value[key] === icon) return;
  pinnedIcons.value = { ...pinnedIcons.value, [key]: icon };
  persistPinnedIcons();
}

function forgetIcon(key: string) {
  if (!key || !(key in pinnedIcons.value)) return;
  const next = { ...pinnedIcons.value };
  delete next[key];
  pinnedIcons.value = next;
  persistPinnedIcons();
}

/** The pinned icon for a URL, or `null` while none is known yet. */
export function siteIconUrl(rawUrl: string): string | null {
  const key = iconKeyFor(rawUrl);
  if (!key) return null;
  return pinnedIcons.value[key] || null;
}

/**
 * Pins the icon a webview reported for the page it just loaded. This is the
 * only source that reflects a site's real `<link rel="icon">`, so it wins over
 * anything probed.
 */
export function pinSiteIcon(rawUrl: string, icon: string | null | undefined) {
  const key = iconKeyFor(rawUrl);
  const src = String(icon || '').trim();
  if (!key || !src) return;
  rememberIcon(key, src);
}

/** Drops an icon that turned out not to render, so it is probed again later. */
export function dropSiteIcon(rawUrl: string) {
  forgetIcon(iconKeyFor(rawUrl));
}

async function resolveLumenDomainIcon(host: string): Promise<string | null> {
  const { target } = await resolveDomainTarget(host);
  const cid =
    target.proto === 'ipfs'
      ? String(target.id || '').trim()
      : await resolveIpnsToCid(target.id).catch(() => null);
  if (!cid) return null;

  const ipfsTarget = { proto: 'ipfs' as const, id: cid };
  const localUrl = buildCandidateUrl(localIpfsGatewayBase(), ipfsTarget, '/favicon.ico', '');
  if (await probeUrl(localUrl, 1500)) return localUrl;

  const bases = await loadWhitelistedGatewayBases().catch(() => [] as string[]);
  if (!bases.length) return null;

  const probes = bases.map((base) => {
    const url = buildCandidateUrl(base, ipfsTarget, '/favicon.ico', '');
    return probeUrl(url, 1500).then((ok) => {
      if (!ok) throw new Error('not_found');
      return url;
    });
  });

  return await Promise.any(probes);
}

async function resolveWebIcon(rawUrl: string): Promise<string | null> {
  try {
    const url = new URL(rawUrl);
    const candidate = `${url.origin}/favicon.ico`;
    return (await probeUrl(candidate, 2000)) ? candidate : null;
  } catch {
    return null;
  }
}

const inflight = new Map<string, Promise<string | null>>();

/**
 * The icon for a URL, probing for one if it is not pinned yet. Concurrent calls
 * for the same host share a single probe.
 */
export function resolveSiteIcon(rawUrl: string): Promise<string | null> {
  const key = iconKeyFor(rawUrl);
  if (!key) return Promise.resolve(null);

  const pinned = pinnedIcons.value[key];
  if (pinned) return Promise.resolve(pinned);

  const running = inflight.get(key);
  if (running) return running;

  const url = String(rawUrl || '').trim();
  const task = (isLumenUrl(url) ? resolveLumenDomainIcon(lumenHostOf(url)) : resolveWebIcon(url))
    .catch(() => null)
    .then((icon) => {
      inflight.delete(key);
      // Only successes are pinned: a gateway that was not up yet must not
      // blacklist a site until the next release.
      if (icon) rememberIcon(key, icon);
      return icon;
    });

  inflight.set(key, task);
  return task;
}

/**
 * Starts resolving the icon for a URL if it is not pinned already. Safe to call
 * on every render: repeated calls for the same host share one probe.
 */
export function ensureSiteIcon(rawUrl: string): void {
  void resolveSiteIcon(rawUrl);
}
