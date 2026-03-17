const LUMEN_URL_RE = /^\s*lumen:\/\//i;
const HTTP_URL_RE = /^\s*https?:\/\//i;
const FILE_URL_RE = /^\s*file:\/\//i;
const WINDOWS_DRIVE_PATH_RE = /^[a-zA-Z]:[\\/]/;
const WINDOWS_UNC_PATH_RE = /^\\\\[^\\]+\\[^\\]+/;

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function encodePathSegment(segment: string): string {
  if (!segment) return segment;
  return encodeURIComponent(safeDecode(segment));
}

export function isLumenUrl(raw: string): boolean {
  return LUMEN_URL_RE.test(String(raw || ""));
}

export function isHttpUrl(raw: string): boolean {
  return HTTP_URL_RE.test(String(raw || ""));
}

export function isFileUrl(raw: string): boolean {
  return FILE_URL_RE.test(String(raw || ""));
}

export function isBrowserUrl(raw: string): boolean {
  return isHttpUrl(raw) || isFileUrl(raw);
}

export function normalizeWindowsPathToFileUrl(raw: string): string | null {
  const value = String(raw || "").trim();
  if (!value) return null;

  const slashNormalized = value.replace(/\\/g, "/");
  if (WINDOWS_DRIVE_PATH_RE.test(value) || /^[a-zA-Z]:\//.test(slashNormalized)) {
    const parts = slashNormalized.split("/");
    const drive = parts.shift() || "";
    const encodedPath = parts.map(encodePathSegment).join("/");
    return encodedPath ? `file:///${drive}/${encodedPath}` : `file:///${drive}/`;
  }

  if (WINDOWS_UNC_PATH_RE.test(value) || /^\/\/[^/]+\/[^/]+/.test(slashNormalized)) {
    const unc = slashNormalized.replace(/^\/+/, "");
    const [host = "", ...pathParts] = unc.split("/");
    if (!host || !pathParts.length) return null;
    return `file://${host}/${pathParts.map(encodePathSegment).join("/")}`;
  }

  return null;
}

export function canonicalizeLumenUrl(raw: string): string {
  const value = String(raw || "").trim();
  if (!isLumenUrl(value)) return value;

  try {
    const rest = value.slice("lumen://".length);
    const match = rest.match(/^([^/?#]+)(.*)$/);
    const host = (match?.[1] || "").trim();
    const tail = match?.[2] || "";
    if (host && (!tail || tail.startsWith("?") || tail.startsWith("#"))) {
      return `lumen://${host}/${tail}`;
    }
  } catch {
    // ignore
  }

  return value;
}

export function normalizeTabUrl(raw: string): string {
  const value = String(raw || "").trim();
  if (!value) return "lumen://home";

  const fileUrl = normalizeWindowsPathToFileUrl(value);
  if (fileUrl) return fileUrl;
  if (isBrowserUrl(value)) return value;
  if (isLumenUrl(value)) return canonicalizeLumenUrl(value);
  return canonicalizeLumenUrl(`lumen://${value}`);
}

export function normalizeAddressInput(
  raw: string,
  builtinHosts: Iterable<string> = [],
): string {
  const value = String(raw || "").trim();
  if (!value) return "lumen://home";

  const fileUrl = normalizeWindowsPathToFileUrl(value);
  if (fileUrl) return fileUrl;
  if (isBrowserUrl(value)) return value;
  if (isLumenUrl(value)) return canonicalizeLumenUrl(value);

  const builtin = new Set(Array.from(builtinHosts, (entry) => String(entry || "").toLowerCase()));
  const lowered = value.toLowerCase();
  if (builtin.has(lowered)) return `lumen://${lowered}`;

  if (!/^\w+:/i.test(value) && /\./.test(value) && !/\s/.test(value)) {
    return canonicalizeLumenUrl(`lumen://${value}`);
  }

  return `lumen://search?q=${encodeURIComponent(value)}`;
}

export function getFileUrlTitle(raw: string): string {
  const value = String(raw || "").trim();
  if (!value) return "Local file";

  try {
    const url = new URL(value);
    let pathname = safeDecode(String(url.pathname || ""));
    if (/^\/[a-zA-Z]:\//.test(pathname)) pathname = pathname.slice(1);
    const trimmed = pathname.replace(/\/+$/, "");
    if (!trimmed) return url.host || "Local file";
    const segments = trimmed.split("/").filter(Boolean);
    return segments[segments.length - 1] || trimmed;
  } catch {
    return value;
  }
}
