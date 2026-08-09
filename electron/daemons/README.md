# electron/daemons

Everything this app runs in the background, and the runtime that owns it.

```
daemon.cjs          the contract: a name, a tick, a period
index.cjs           the eight declarations, startDaemons / stopDaemons / daemonStatuses
chain_poller.cjs    height, status and the RPC it came from
ipfs_cache.cjs      the rolling pin cache: TTL, quota, LRU eviction
ipfs_seed.cjs       the self-repairing bootstrap
release_watcher.cjs update checks and the cached latest release
peers/              the peer pool and its single instance
```

A daemon never overlaps itself, never lets a throw escape, is always `unref`'d,
and can always be stopped. `main.cjs` calls `startDaemons()` at `whenReady` and
`stopDaemons()` on both quit paths. Adding a background loop is one line in
`index.cjs`.

**The one body that is not here is gateway health**, and the reason is worth
knowing before someone tries to move it. Its 190 lines drag 535 with them:
`fetchGatewaysFromRest`, `resolveGatewayBaseFromEndpoint`, the whitelist loader,
the Kyber key cache. That is not a daemon, it is the gateway client, and the IPC
handlers call it synchronously on every user action. It lives in
`gateways/client.cjs`, which both `ipc/gateway.cjs` and this folder import.
Moving only the daemon part would put a `require` cycle between the two.

The same reasoning is why `ipc/*` should stay thin: a handler translates a
channel into a call, the module it calls owns the state. `ipc/chain.cjs` and
`ipc/gateway.cjs` lost 90 and 565 lines to that rule.

A `setInterval` anywhere else in `electron/` is either a mistake or scoped to a
single job — the two that remain, HLS transcode progress and pubsub topic
discovery, live and die with the job that started them.
