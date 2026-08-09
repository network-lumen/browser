// Language-level helpers with no domain in them, shared rather than re-typed.
// `nowMs()` is deliberately absent: four files wrapped `Date.now()` in it, which
// is a name for something that already had one.

function clampInt(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, x | 0));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fisher-Yates partial shuffle, so callers get a fair sample and not a prefix.
function pickRandom(items, count) {
  const arr = Array.isArray(items) ? items.slice() : [];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr.slice(0, Math.max(0, count | 0));
}

module.exports = { clampInt, sleep, pickRandom };
