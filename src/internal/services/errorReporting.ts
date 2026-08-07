import { useInternalLumen } from '../../composables/useInternalLumen';

/**
 * The renderer's last-resort net for errors nobody caught.
 *
 * The main process has had one since it had a log file - `main_logger.cjs`
 * listens for `unhandledRejection` and `uncaughtExceptionMonitor`. The
 * renderer had nothing at all: an error thrown outside a `try` went to a
 * devtools console the user never opens, and left no trace on disk. Half the
 * app runs here.
 *
 * This does not replace a single `catch`. A `catch` that returns a fallback is
 * a decision about a value; by the time a global handler runs, the call has
 * already unwound and there is nothing to return. This is only for what would
 * otherwise be lost.
 */

/** Identical messages repeat - a render loop can throw on every frame. */
const RECENT_WINDOW_MS = 10_000;
/** Past this, stop: a storm must not become the reason the disk fills. */
const MAX_REPORTS_PER_WINDOW = 20;

const recent = new Map<string, number>();
let windowStartedAt = 0;
let reportsInWindow = 0;
let installed = false;

/** True when this exact error has not been seen in the current window. */
function shouldReport(signature: string): boolean {
  const now = Date.now();
  if (now - windowStartedAt > RECENT_WINDOW_MS) {
    windowStartedAt = now;
    reportsInWindow = 0;
    recent.clear();
  }
  if (reportsInWindow >= MAX_REPORTS_PER_WINDOW) return false;
  if (recent.has(signature)) return false;
  recent.set(signature, now);
  reportsInWindow += 1;
  return true;
}

function send(payload: Record<string, unknown>): void {
  const signature = `${payload.kind}|${payload.message}|${payload.line}|${payload.column}`;
  if (!shouldReport(signature)) return;
  try {
    (useInternalLumen() as any)?.appReportRendererError?.(payload);
  } catch {
    // The bridge is the thing that reports failures; it cannot report its own.
  }
}

/** The readable part of anything thrown, including what has no `message`. */
function describe(error: unknown): { message: string; stack: string } {
  if (error instanceof Error) {
    return { message: error.message || String(error), stack: error.stack || '' };
  }
  if (error && typeof error === 'object') {
    const message = String((error as { message?: unknown }).message || '');
    // A rejected IPC reply is a plain object; without this it reads as
    // "[object Object]" and says nothing about what failed.
    return { message: message || JSON.stringify(error).slice(0, 2000), stack: '' };
  }
  return { message: String(error), stack: '' };
}

/**
 * Idempotent, and safe to call before the bridge exists - the reports simply
 * go nowhere until it does, which beats not being installed when the error
 * that matters is the one during startup.
 */
export function installRendererErrorReporting(): void {
  if (installed) return;
  installed = true;

  window.addEventListener('error', (event: ErrorEvent) => {
    const { message, stack } = describe(event.error ?? event.message);
    send({
      kind: 'error',
      message,
      stack,
      source: String(event.filename || ''),
      line: Number(event.lineno) || 0,
      column: Number(event.colno) || 0,
      url: String(window.location?.href || ''),
    });
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const { message, stack } = describe(event.reason);
    send({
      kind: 'unhandledrejection',
      message,
      stack,
      source: '',
      line: 0,
      column: 0,
      url: String(window.location?.href || ''),
    });
  });
}

/** Test seam: forgets the throttle so a case starts from a clean window. */
export function resetRendererErrorReporting(): void {
  recent.clear();
  windowStartedAt = 0;
  reportsInWindow = 0;
  installed = false;
}
