/**
 * Trimmed, length-capped string coercion, for everything that crosses a
 * boundary the main process does not control - an IPC payload, a manifest, a
 * chain reply.
 *
 * This existed identically in thirteen files. Three of those copies have to
 * stay: `webview-preload.cjs`, `extension-preload.cjs` and `store-preload.cjs`
 * run sandboxed, where `require()` of a local file is not possible at all, so
 * they carry their own by necessity rather than by accident.
 *
 * The cap is the point as much as the trim. An unbounded string from a site or
 * an extension ends up in a log line, a map key or a dialog, and 2048 is the
 * default because nothing legitimate crossing this boundary is longer.
 */
function safeString(value, maxLen = 2048) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

module.exports = { safeString };
