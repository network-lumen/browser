import type { AppLogEntry, AppLogLevel } from '../../types/appLog';

/**
 * A ring buffer of everything the app said about itself.
 *
 * On the desktop a failure leaves a trail: a log file, a devtools console a
 * keystroke away. On a phone there is neither. Diagnosing the Android build so
 * far has meant asking someone to plug in a cable and run `chrome://inspect`,
 * which is a lot to ask and impossible to do on the bus - so the app keeps its
 * own recent history and shows it in Settings > Troubleshooting.
 *
 * `console` is wrapped rather than replaced: the original is still called, so
 * anything already watching (remote debugging, logcat through the WebView)
 * sees exactly what it saw before.
 *
 * The buffer is capped. A browser left open for a day would otherwise hold
 * every line it ever printed, and the interesting ones are always the last
 * few hundred.
 */

/**
 * How many lines are kept.
 *
 * Exported so the test asserts the bound this module actually holds rather
 * than a number copied beside it - the two drifted apart the moment the cap
 * was raised to chase a startup failure.
 */
export const LOG_BUFFER_LIMIT = 2000;

const entries: AppLogEntry[] = [];
let installed = false;
let sequence = 0;

/** Formats one console argument for storage, without throwing on a cycle. */
function render(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function record(level: AppLogLevel, args: unknown[]): void {
  entries.push({
    id: ++sequence,
    at: Date.now(),
    level,
    message: args.map(render).join(' ').slice(0, 4000)
  });
  if (entries.length > LOG_BUFFER_LIMIT) entries.splice(0, entries.length - LOG_BUFFER_LIMIT);
}

/**
 * Starts recording. Safe to call twice - the second call does nothing rather
 * than wrapping the already-wrapped console and doubling every line.
 */
export function installLogCapture(): void {
  if (installed) return;
  installed = true;

  const levels: AppLogLevel[] = ['log', 'info', 'warn', 'error'];
  for (const level of levels) {
    // no-console is disabled for these two lines and nowhere else. The rule
    // stops debug output being left in a screen; this is the module that
    // captures that output, so it has to touch the methods the rule guards -
    // including the ones it forbids, which are exactly the ones worth keeping.
    /* eslint-disable no-console */
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      record(level, args);
      original(...args);
    };
    /* eslint-enable no-console */
  }

  // The two that never reach console on their own, and are usually the ones
  // worth having: a promise nobody caught, and an error that escaped.
  window.addEventListener('unhandledrejection', (event) => {
    record('error', ['[unhandled rejection]', event.reason]);
  });
  window.addEventListener('error', (event) => {
    record('error', ['[uncaught]', event.message, `${event.filename}:${event.lineno}`]);
  });

  record('info', ['[appLog] capture started']);
}

/**
 * Forgets that capture was installed, so the next `installLogCapture()` wraps
 * console again.
 *
 * The guard above exists so a second call does not double every line, and it
 * holds a truth about the console this module wrapped. Anything that puts the
 * original console back - a test, between cases - has made that truth false
 * and has to say so, or capture can never be re-established.
 */
export function resetLogCapture(): void {
  installed = false;
}

/** Everything recorded so far, oldest first. */
export function getLogEntries(): AppLogEntry[] {
  return entries.slice();
}

export function clearLogEntries(): void {
  entries.length = 0;
  sequence = 0;
}

/** The buffer as one block of text, for the clipboard. */
export function formatLogEntries(): string {
  return entries
    .map((e) => `${new Date(e.at).toISOString()} ${e.level.toUpperCase().padEnd(5)} ${e.message}`)
    .join('\n');
}
