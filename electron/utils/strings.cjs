// Trim and cap anything crossing into the main process; the cap is the point.
// The 3 sandboxed preloads keep their own copy - requiring this one kills them.
function safeString(value, maxLen = 2048) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

module.exports = { safeString };
