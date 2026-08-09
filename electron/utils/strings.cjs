// Trim and cap anything crossing into the main process; the cap is the point.
// The 3 preloads and the generated MV3 shim keep copies - they cannot require.
function safeString(value, maxLen = 2048) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

function trimSlash(s) {
  return String(s || '').replace(/\/+$/, '');
}

module.exports = { safeString, trimSlash };
