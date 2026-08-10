Lumen Browser
================================

## Prerequisites

- Node.js 18+
- npm

By default, this shell stores its IPFS repo under the Electron user data directory (on Windows:
`%APPDATA%/lumen/ipfs`), not in the global `~/.ipfs` folder. The folder is named after `APP_NAME` in
`electron/bootstrap_paths.cjs`, and `LUMEN_USER_DATA_DIR` overrides it for one run — which is how
the end-to-end tests launch the app without touching your own wallet.

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

## Publishing on-chain releases

The publisher lives in the app itself, at `lumen://release`: it builds the record, signs it and
submits it for DAO validation. Artifacts are produced by `.github/workflows/build-mac.yml` (which
builds all three platforms despite the name) and attached to a draft GitHub release.

A release record must carry a SHA256 for its artifact. The updater refuses to install one without,
and takes both the URL and the digest from the record it read on-chain rather than from anything
the interface hands it — see `electron/ipc/release.cjs`.

## Mac launch

sudo xattr -rd com.apple.quarantine /Applications/Lumen\ Browser.app

## Linux launch

### Linux (VMware / Wayland)

If the application does not open on some Linux environments (especially VMware + Wayland), try
launching it with Ozone forced to X11:

```bash
./Lumen-Browser-x.x.x-linux-x64.AppImage --ozone-platform=x11
```

If that alone isn't enough in your environment, also try adding `--no-sandbox`:

```bash
./Lumen-Browser-x.x.x-linux-x64.AppImage --no-sandbox --ozone-platform=x11
```

This has been confirmed to work on VMware + Wayland; other environments may not need the extra
flag, or may need a different one.
