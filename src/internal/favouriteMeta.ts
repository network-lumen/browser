import { t } from '../stores/i18nStore';
import {
  canonicalizeLumenUrl,
  getFileUrlTitle,
  isFileUrl,
  isHttpUrl,
  isLumenUrl,
} from "./navigationUrl";
import type { FavouriteKind, FavouriteMeta } from "../types/favourites";
import { safeDecodeUriComponent } from "./services/coerce";

export type { FavouriteKind, FavouriteMeta };

function normalizePreferredTitle(rawTitle?: string): string {
  return String(rawTitle || "").trim();
}

const INTERNAL_TITLES: Record<string, string> = {
  newtab: t("New tab"),
  home: "Home",
  search: "Search",
  settings: "Settings",
  drive: "Drive",
  ipfs: "IPFS",
  wallet: "Wallet",
  domain: "Domain",
  extensions: "Extensions",
  extension: "Extension",
  network: "Network",
  gateways: "Gateways",
  "my-gateways": t("My Gateways"),
  block: t("Block details"),
  transaction: t("Transaction details"),
  tx: t("Transaction details"),
  address: t("Address details"),
  release: "Release",
  help: "Help",
};


function stripWww(hostname: string): string {
  return String(hostname || "").replace(/^www\./i, "");
}

function humanizeSlug(value: string): string {
  const clean = String(value || "")
    .replace(/\.[a-z0-9]{1,8}$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function getInternalFavouriteTitle(host: string): string {
  const key = String(host || "").trim().toLowerCase();
  return INTERNAL_TITLES[key] || humanizeSlug(key) || t("Lumen page");
}

function buildMonogram(value: string): string {
  const cleaned = String(value || "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim();
  if (!cleaned) return "L";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  const token = parts[0] || "L";
  return token.slice(0, Math.min(2, token.length)).toUpperCase();
}

function trimSubtitle(value: string, max = 42): string {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function describeLumenUrl(rawUrl: string, preferredTitle?: string): FavouriteMeta {
  const url = canonicalizeLumenUrl(rawUrl);
  const chosenTitle = normalizePreferredTitle(preferredTitle);

  try {
    const parsed = new URL(url);
    const host = String(parsed.hostname || "").trim().toLowerCase();
    if (host === "search") {
      const query = String(parsed.searchParams.get("q") || "").trim();
      const title = query || "Search";
      return {
        url,
        title: chosenTitle || title,
        subtitle: t("Lumen search"),
        monogram: buildMonogram(chosenTitle || title),
        kind: "search",
      };
    }

    const title = chosenTitle || getInternalFavouriteTitle(host);
    const path = String(parsed.pathname || "").replace(/^\/+/, "").trim();
    const subtitle = path ? `lumen://${host}/${safeDecodeUriComponent(path)}` : `lumen://${host || "home"}`;
    return {
      url,
      title,
      subtitle: trimSubtitle(subtitle),
      monogram: buildMonogram(title || host),
      kind: "internal",
    };
  } catch {
    const title = t("Lumen page");
    return {
      url,
      title,
      subtitle: t("Lumen page"),
      monogram: buildMonogram(title || "Lumen"),
      kind: "internal",
    };
  }
}

function describeHttpUrl(rawUrl: string, preferredTitle?: string): FavouriteMeta {
  const chosenTitle = normalizePreferredTitle(preferredTitle);
  try {
    const parsed = new URL(rawUrl);
    const host = stripWww(parsed.hostname || rawUrl);
    const pathname = safeDecodeUriComponent(String(parsed.pathname || ""))
      .replace(/\/+$/, "")
      .trim();
    const segments = pathname.split("/").filter(Boolean);
    const leaf = humanizeSlug(segments[segments.length - 1] || "");
    const title = chosenTitle || leaf || host || "Website";
    return {
      url: rawUrl,
      title,
      subtitle: trimSubtitle(host || parsed.origin || rawUrl),
      monogram: buildMonogram(title),
      kind: "web",
    };
  } catch {
    return {
      url: rawUrl,
      title: chosenTitle || rawUrl,
      subtitle: t("Website"),
      monogram: buildMonogram(chosenTitle || rawUrl),
      kind: "web",
    };
  }
}

function describeFileUrl(rawUrl: string, preferredTitle?: string): FavouriteMeta {
  const title = normalizePreferredTitle(preferredTitle) || getFileUrlTitle(rawUrl);
  return {
    url: rawUrl,
    title,
    subtitle: t("Local file"),
    monogram: buildMonogram(title || "File"),
    kind: "file",
  };
}

const AVATAR_TONE_VARS: Partial<Record<FavouriteKind, string>> = {
  search: "--color-primary",
  internal: "--color-indigo",
  web: "--color-success",
  file: "--color-warning",
};

export function avatarToneStyle(kind: FavouriteKind): Record<string, string> {
  const cssVar = AVATAR_TONE_VARS[kind];
  if (!cssVar) return {};
  return {
    background: `rgba(var(${cssVar}-rgb), 0.12)`,
    color: `var(${cssVar})`,
    borderColor: `rgba(var(${cssVar}-rgb), 0.18)`,
  };
}

export function describeFavouriteUrl(rawUrl: string, preferredTitle?: string): FavouriteMeta {
  const url = String(rawUrl || "").trim();
  const chosenTitle = normalizePreferredTitle(preferredTitle);
  if (!url) {
    return {
      url: "",
      title: chosenTitle || t("Saved page"),
      subtitle: t("Shortcut"),
      monogram: buildMonogram(chosenTitle || "Lumen"),
      kind: "other",
    };
  }

  if (isLumenUrl(url)) return describeLumenUrl(url, chosenTitle);
  if (isFileUrl(url)) return describeFileUrl(url, chosenTitle);
  if (isHttpUrl(url)) return describeHttpUrl(url, chosenTitle);

  return {
    url,
    title: chosenTitle || url,
    subtitle: t("Shortcut"),
    monogram: buildMonogram(chosenTitle || url),
    kind: "other",
  };
}
