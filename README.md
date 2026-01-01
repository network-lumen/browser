Lumen Browser
================================

## Prerequisites

- Node.js 18+
- npm

By default, this shell stores its IPFS repo under the Electron user data directory (for example on Windows: `%APPDATA%/lumen-browser/ipfs`), not in the global `~/.ipfs` folder.

## Install

```bash
cd browser
npm install
```

## Run in dev mode (Electron + Vite)

```bash
npm run dev
```

This starts the Vite dev server and opens the Electron window.

## Build for production

```bash
npm run build
```

This generates a static bundle in `dist/` that `electron/main.cjs` can load in production.
