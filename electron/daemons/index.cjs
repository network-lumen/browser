// Everything this app runs in the background, declared in one place: what runs,
// how often, and the one start/stop that covers all of it.
//
// Seven of the eight bodies live in this folder. The eighth, gateway health, is
// in gateways/client.cjs - see README.md for why its work cannot be separated
// from the client the IPC handlers call.
//
// Adding a loop means adding a line here, not another setInterval somewhere.

const { defineDaemon } = require('./daemon.cjs');
const { pollChainOnce } = require('./chain_poller.cjs');
const { pollReleaseOnce, RELEASE_POLL_INTERVAL_MS } = require('./release_watcher.cjs');
const {
  refreshWhitelistedGatewayHealth,
  gatewayHealthMonitorEnabled,
  gatewayHealthPeriodMs
} = require('../gateways/client.cjs');
const { cleanupExpired, CACHE_CLEANUP_INTERVAL_MS } = require('./ipfs_cache.cjs');
const {
  bootstrapPeriodically,
  bootstrapOnNetworkChange,
  SEED_REFRESH_INTERVAL_MS
} = require('./ipfs_seed.cjs');
const { getNetworkPool } = require('./peers/pool_singleton.cjs');

const daemons = [
  defineDaemon({
    name: 'chain-poller',
    firstRunMs: 1_000,
    everyMs: 5_000,
    tick: () => pollChainOnce('interval')
  }),

  defineDaemon({
    name: 'peer-health',
    firstRunMs: 250,
    everyMs: 10_000,
    tick: () => getNetworkPool().healthTick()
  }),

  defineDaemon({
    name: 'peer-onchain-refresh',
    firstRunMs: 1_000,
    everyMs: 15 * 60_000,
    tick: () => getNetworkPool().refreshFromOnChain()
  }),

  defineDaemon({
    name: 'gateway-health',
    firstRunMs: 2_500,
    everyMs: gatewayHealthPeriodMs(),
    enabled: gatewayHealthMonitorEnabled,
    tick: () => refreshWhitelistedGatewayHealth()
  }),

  defineDaemon({
    name: 'ipfs-cache-cleanup',
    firstRunMs: 15_000,
    everyMs: CACHE_CLEANUP_INTERVAL_MS,
    tick: () => cleanupExpired()
  }),

  defineDaemon({
    name: 'ipfs-seed-refresh',
    everyMs: SEED_REFRESH_INTERVAL_MS,
    tick: () => bootstrapPeriodically()
  }),

  defineDaemon({
    name: 'ipfs-seed-network-change',
    everyMs: 5 * 60_000,
    tick: () => bootstrapOnNetworkChange()
  }),

  defineDaemon({
    name: 'release-watcher',
    firstRunMs: 1_000,
    everyMs: RELEASE_POLL_INTERVAL_MS,
    tick: () => pollReleaseOnce()
  })
];

function startDaemons() {
  const started = daemons.filter((d) => d.start()).map((d) => d.name);
  console.log(`[daemon] started ${started.length}/${daemons.length}: ${started.join(', ')}`);
  return started;
}

function stopDaemons() {
  for (const d of daemons) d.stop();
}

/** For diagnostics: one line per background loop, whether it runs and when it last did. */
function daemonStatuses() {
  return daemons.map((d) => d.status());
}

module.exports = { startDaemons, stopDaemons, daemonStatuses, daemons };
