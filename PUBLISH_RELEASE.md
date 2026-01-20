# Publish a Lumen Browser release (Windows)

This guide explains how to build, upload, and publish an on-chain release so the desktop app can auto-update.

## 0) Important conventions

- `release.version` **must match** the app version string returned by Electron (`app.getVersion()`), which comes from `contributor/browser/package.json`.
  - Example: if the app shows `0.1.7`, publish `0.1.8` (not `v0.1.8`).
- Auto-update matching uses:
  - `channel`: `beta` (default) or `stable`
  - `platform`: `windows-amd64` (most Windows PCs are x64)
  - `kind`: `browser`
- The updater downloads only `http(s)` URLs.

## 1) Build the Windows installer

From `/browser`:

```powershell
npm ci
npm run dist:win
```

Your installer should be in `/browser/release/`, e.g.:

- `release/Lumen Browser-Setup-0.1.8.exe`

## 2) Upload the installer to your CDN / hosting

Upload the `.exe` to a stable HTTPS URL, for example:

```
https://lumen-network.org/Lumen%20Browser-Setup-0.1.8.exe
```

## 3) Compute artifact metadata (SHA-256 + size)

From `/browser`:

```powershell
$file = "/Lumen Browser-Setup-0.1.8.exe"
(Get-Item $file).Length
(Get-FileHash -Algorithm SHA256 $file).Hash.ToLower()
```

- **Size (bytes)**: use the number from `.Length`
- **SHA-256**: paste the 64-hex string

## 4) Publish the on-chain release from the app

In the desktop app:

1. Open `lumen://release`
2. Make sure you are using an allowlisted publisher profile (otherwise you’ll be redirected to home).
3. Click **Publish release**
4. Fill the fields:
   - **Version**: `0.1.8`
   - **Channel**: `beta` (recommended for tests)
   - **Supersedes (IDs)**: optional
     - Put the previous release IDs that this one replaces (e.g. `1`, or `1, 2`)
     - Leave empty if it’s your first release
   - **Release notes**: keep it short; put the full changelog elsewhere if needed
5. Add one artifact:
   - **Platform**: `windows-amd64`
   - **Kind**: `browser`
   - **CID**: optional (leave empty if you only use HTTPS)
   - **SHA-256**: value from step 3
   - **Size (bytes)**: value from step 3
   - **URLs**: paste your HTTPS download URL (one per line)
6. Submit / sign the transaction

## 5) Verify auto-update detects it

The app checks periodically for a newer release:

- Default channel: `beta`
- It should prompt even if the release is still `PENDING` (useful for testing).

If you don’t see the update prompt:

- Confirm the published `version` is exactly `0.1.8` (no leading `v`).
- Confirm your artifact matches `platform=windows-amd64` and `kind=browser`.
- Confirm the URL is `https://...` and reachable.
- Confirm the `SHA-256` on-chain matches the actual file you uploaded.

