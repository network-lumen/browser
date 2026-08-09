// The contract every background loop in this app follows.
//
// Before this existed there were eight of them in six modules, each with its
// own idea of the job: two used setInterval, two chained setTimeout, three
// could not be stopped at all, two guarded against overlapping themselves and
// the rest did not, and only one was unref'd. The differences were accidents,
// not decisions, so they live here once.
//
// A daemon is a name, a tick, and a period. It never overlaps itself, never
// lets a throw escape, is always unref'd, and can always be stopped.

function defineDaemon({ name, everyMs, firstRunMs = everyMs, enabled = null, tick }) {
  if (typeof tick !== 'function') throw new Error(`daemon ${name}: tick must be a function`);
  if (!Number.isFinite(everyMs) || everyMs <= 0) throw new Error(`daemon ${name}: everyMs must be positive`);

  let timer = null;
  let running = false;
  let inFlight = false;
  let lastRunAt = 0;
  let lastError = '';

  // Scheduled after the tick resolves, never on a fixed drumbeat: a tick that
  // takes longer than its period must not have the next one waiting behind it.
  function schedule(delayMs) {
    if (!running) return;
    timer = setTimeout(run, Math.max(50, Math.floor(delayMs)));
    timer.unref?.();
  }

  async function run() {
    if (!running) return;
    if (inFlight) {
      schedule(everyMs);
      return;
    }
    inFlight = true;
    try {
      await tick();
      lastError = '';
    } catch (e) {
      lastError = String(e && e.message ? e.message : e);
      console.warn(`[daemon] ${name} tick failed:`, lastError);
    } finally {
      inFlight = false;
      lastRunAt = Date.now();
      schedule(everyMs);
    }
  }

  return {
    name,
    start() {
      if (running) return false;
      if (typeof enabled === 'function' && !enabled()) return false;
      running = true;
      schedule(firstRunMs);
      return true;
    },
    stop() {
      running = false;
      if (timer) clearTimeout(timer);
      timer = null;
    },
    /** For diagnostics: what is running, when it last ran, and why it failed. */
    status() {
      return { name, running, inFlight, lastRunAt, lastError, everyMs };
    }
  };
}

module.exports = { defineDaemon };
