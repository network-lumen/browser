# electron/workers

Files that run in a `worker_threads` Worker. Two of them today: `pqc-worker`
(Dilithium key generation and the anti-spam proof of work) and
`view-ping-worker` (the signed, PQ-encrypted "this CID was viewed" call to a
gateway). Both exist for the same reason — the work takes long enough to freeze
the window.

Each file is loaded twice. `require()`d from the main process it exports a
client; that client starts a Worker on the same file (`new Worker(__filename)`),
and the copy running in the thread takes the other branch and answers messages.

**The rule of this folder: a worker cannot reach `electron`.** In a worker
thread `require('electron')` gives back a path string, not the API, so anything
that ends up calling `app.getPath()` — most of `electron/utils/`, by way of
`utils/fs.cjs` — breaks at the first call, not at import. Import only node
built-ins, real dependencies, and leaf modules that require nothing themselves
(`utils/pow.cjs` is one). Where that means copying code, the copy says so and
names the original.
