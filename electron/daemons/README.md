# electron/daemons

Everything this app runs in a loop, and nothing else.

`daemon.cjs` is the contract: a name, a tick, a period. A daemon never overlaps
itself, never lets a throw escape, is always `unref`'d, and can always be
stopped. `index.cjs` declares them all and exposes `startDaemons`,
`stopDaemons` and `daemonStatuses`. `main.cjs` starts them at `whenReady` and
stops them on both quit paths.

**The rule of this folder: the schedule lives here, the work does not.** Each
tick stays in the module that owns the state it touches, and is imported here by
name. `refreshWhitelistedGatewayHealth` writes two caches inside `ipc/gateway.cjs`
and `cleanupExpired` evicts entries owned by `ipfs_cache.cjs`; moving either one
next to its schedule would separate it from the data it exists to change.

That holds even for the one that could move. `services/release_watcher.cjs` is
named after its loop, but `ipc/release.cjs` also takes `getLatestReleaseInfo`,
`pollNow` and `openExternal` from it — it is the release feature, which happens
to poll. Keeping one body here and five elsewhere would put the inconsistency in
the file that is supposed to be the summary.

Adding a background loop is one line in `index.cjs`. A `setInterval` anywhere
else in `electron/` is either a mistake or scoped to a single job — the two that
remain, HLS transcode progress and pubsub topic discovery, live and die with the
job that started them.
