/**
 * Digging a module's params out of whatever the bridge hands back.
 *
 * Three shapes reach the renderer for the same thing, because the IPC handlers
 * grew separately: dns answers `{ ok, data: { params } }`, pqc answers
 * `{ ok, data: { params } }` after unwrapping once itself, and a bare REST
 * response is `{ params }`. Written as a `??` chain at the call site it looks
 * right and stops one level short - `res.data` is `{ params }`, which is an
 * object, so the chain is satisfied and every field lookup on it returns
 * undefined. Nothing throws; the screen just shows a placeholder forever.
 *
 * So it is one function with a test, rather than the same guess in each caller.
 */
export function unwrapModuleParams(response: unknown): Record<string, unknown> | null {
  const seen = new Set<unknown>();
  let current: unknown = response;

  // At most a handful of wrappers; the guard is against a self-referencing
  // object rather than against depth.
  for (let depth = 0; depth < 4; depth += 1) {
    if (!current || typeof current !== 'object') return null;
    if (seen.has(current)) return null;
    seen.add(current);

    const node = current as Record<string, unknown>;
    if (node.params && typeof node.params === 'object') {
      current = node.params;
      continue;
    }
    if (node.data && typeof node.data === 'object') {
      current = node.data;
      continue;
    }
    // No wrapper left: this is the params object, unless it is an envelope that
    // never carried one.
    return 'ok' in node && Object.keys(node).length <= 2 ? null : node;
  }

  return null;
}

/**
 * A params field as a number, tolerating snake_case, camelCase and the strings
 * the chain uses for anything that might exceed a JS integer.
 *
 * @returns null when absent or unparseable - never 0, which would read as "no
 *   fee" or "no rate limit" and is the answer that costs a refused transaction.
 */
export function paramNumber(
  params: Record<string, unknown> | null,
  camelKey: string,
  snakeKey: string
): number | null {
  if (!params) return null;
  const raw = params[camelKey] ?? params[snakeKey];
  if (raw == null || raw === '') return null;
  const parsed = Number.parseFloat(String(raw));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}
