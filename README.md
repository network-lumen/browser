Lumen Open‑Source Browser
================================

This folder contains a minimal Electron + Vue shell for the Lumen browser. It includes:

- a startup screen that checks a local Kubo daemon on `127.0.0.1:5001`
- a placeholder main screen
- shared CSS tokens copied from the main Lumen UI

## Prerequisites

- Node.js 18+
- npm
- `kubo` npm package is installed locally (it is included in `package.json` and provides the IPFS binary used by Electron)

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