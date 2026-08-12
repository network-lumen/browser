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

## Translations

The interface is written in English and translated through `t()`, keyed on the English text itself.
Catalogues live in `src/locales/<code>.json`. Every user-visible string already goes through `t()`
(`npm test` fails if a new one does not), so adding a language is only translation work — and an
empty entry renders the English, so a half-filled catalogue ships fine.

```bash
npm run i18n:extract   # add every new t('…') to each catalogue, report orphans
```

Thirteen languages ship. English and French are complete; the other eleven have their catalogue in
place and are being filled — an untranslated entry renders the English, so a partial catalogue is a
normal state rather than a broken one.

The language is asked once, during first-run onboarding, pre-selected from what the OS reports. After
that it belongs to the **profile**: switching profile switches language, and a profile created from
another starts in that one's language. Arabic sets `dir="rtl"` on the document.

Adding one is four lines and a file — see [CONTRIBUTING.md](./CONTRIBUTING.md#rule-0-user-visible-text-goes-through-t).

## Build for production

```bash
npm run build
```

This generates a static bundle in `dist/` that `electron/main.cjs` can load in production.

## Publishing on-chain releases

The publisher lives in the app itself, at `lumen://release`: it builds the record, signs it and
submits it for DAO validation. Artifacts are produced by `.github/workflows/build.yml` (which
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
