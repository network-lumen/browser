/**
 * Who sent an IPC message.
 *
 * A leaf on purpose: `sites/actions.cjs` owns the strict "is this the app's own
 * window" check, but it also reads the profiles file, and `ipc/profiles.cjs`
 * asking it back for a sender predicate is a require cycle - which resolves to
 * `undefined` at load and throws only when the handler finally runs.
 */

/**
 * Whether this call came from page content rather than from the app's own
 * window - a `<webview>`, which is every site, extension page and http tab.
 *
 * For a channel the app and a site both legitimately use, where the site is
 * entitled to less of the answer. `ensureUiSender` is the stricter question and
 * the right one when a site has no business calling at all.
 */
function isWebviewSender(evt) {
  const sender = evt?.sender;
  if (!sender || sender.isDestroyed?.()) return false;
  try {
    return String(sender.getType?.() || '').toLowerCase() === 'webview';
  } catch {
    // Unknown provenance is treated as untrusted on purpose.
    return true;
  }
}

module.exports = {
  isWebviewSender,
};
