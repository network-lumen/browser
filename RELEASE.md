# Publishing Releases (`lumen://release`)

This document explains **how to publish a Lumen Browser release** from the internal page `lumen://release`, how it is stored **on-chain** (module `x/release`), and how the **DAO (governance)** validation flow works.

---

## TL;DR (end-to-end)

1. **Bump the Lumen Browser version** (e.g. `0.2.6`) in `contributor/browser/package.json`.
2. **Build the artifact** (Windows: `npm run dist:win`, otherwise: `npm run dist` on your OS).
3. **Upload the artifact** to at least **1 stable HTTP(S) URL** (ideally 2 mirrors) and/or IPFS.
4. **Compute `sha256` + `size`** of the artifact (required).
5. Open `lumen://release` → **Publish release** → fill `version/channel/notes` + **Artifacts**.
6. After publishing: status = **PENDING**
7. If you publish for channel **stable**: it will still be **PENDING**. To make it “go live”: click **Send to DAO (validate)** (this creates a governance proposal), then go to `lumen://dao` and have the DAO voters vote it through.
8. When the proposal passes: status becomes **VALIDATED** → clients on the matching channel/kind/platform will see the update.

---

## 1) Key concepts

### On-chain release metadata ≠ on-chain binary
The blockchain does **not** store the binary. It stores only **verifiable metadata**:
- `version` (semver)
- `channel` (`stable`, `beta`, etc.)
- a list of **artifacts**, each with:
  - `platform` (e.g. `windows-amd64`)
  - `kind` (e.g. `browser`)
  - `urls[]` (HTTP(S) mirrors and/or `ipfs://...`)
  - `sha256_hex` (required)
  - `size` (bytes)
  - `cid` (optional, IPFS)
- `status`: `PENDING` → `VALIDATED` (or `REJECTED` / `EXPIRED`)
- `yanked`: if `true`, clients should ignore it

### Channel / Platform / Kind (the 3 filters that must match)
The update watcher selects the “right” release based on:
- **Channel**: env var `LUMEN_RELEASE_CHANNEL` (default: `beta`)
- **Kind**: `LUMEN_RELEASE_KIND` (default: `browser`)
- **Platform**: `LUMEN_RELEASE_PLATFORM` (default: auto-detect, e.g. `windows-amd64`)

If an update doesn’t show up, 90% of the time it’s a mismatch on those fields.

### Why DAO validation exists
We don’t want a single person to push a critical update without control.

The `x/release` flow is:
- `PublishRelease` creates a `PENDING` release.
- Governance executes `ValidateRelease` via a proposal (or `RejectRelease`).
- Clients on `stable` accept only **`VALIDATED`** releases.

Important nuance (current chain/client behavior):
- The chain endpoint `GET /lumen/release/latest` returns **only `VALIDATED`** releases (for any channel).
- The client tries `/latest` first, and only scans `/releases` as a fallback when `/latest` is unavailable/404.

So, to make updates deterministic (including on `beta`), **validate the release** when possible.

---

## 2) Permissions (who can do what?)

On the chain REST API, params are visible here:

```bash
API=http://127.0.0.1:1317
curl -s "$API/lumen/release/params"
```

Key fields (proto `lumen.release.v1.Params`):
- `allowed_publishers[]`: addresses allowed to `Publish/Mirror/Yank`.
- `channels[]`: allowed channel names (publishing fails if the channel is not in this list).
- `publish_fee_ulmn`: fee escrowed on publish (if non-zero).
- `max_pending_ttl`: seconds until `PENDING` expires (and becomes `EXPIRED`).
- `max_*`: limits (artifacts, urls, notes…).

In Lumen Browser:
- Open `lumen://release`.
- If your active profile has no access, you’ll be redirected.

Signing prerequisites:
- the publisher UI (`lumen://release`) is gated by `allowed_publishers[]`
- for **publishing**: your wallet must be in `allowed_publishers` (otherwise `PublishRelease` is rejected on-chain)
- have an active **profile** (wallet) in Lumen Browser
- unlock the signing session if needed (mnemonic + PQC keys if encrypted)
- have enough funds for:
  - the on-chain **publish fee** (`publish_fee_ulmn`, if non-zero)
  - the governance **deposit** if you submit a DAO proposal

---

## 3) Build a Lumen Browser release

Useful scripts in `contributor/browser/package.json`:
- `npm run dist` → build + `electron-builder` (default target for your OS)
- `npm run dist:win` → build + Windows NSIS installer

### GitHub Actions (recommended)
If you prefer not to build locally, you can let CI build **Windows + macOS + Linux** for you:
1. Bump `version` in `contributor/browser/package.json` (e.g. `0.2.6`) and push it.
2. Create a git tag that contains the same version (e.g. `v0.2.6`) and push the tag.
3. CI creates/updates a GitHub Release for that tag and uploads:
   - Windows installer (`.exe`)
   - macOS DMG (`.dmg`)
   - Linux AppImage (`.AppImage`)
   - `SHA256SUMS.txt`

Example:

```bash
cd contributor/browser
npm ci
npm run dist:win
```

Output:
- `release/` (configured by `build.directories.output`, inside `contributor/browser/`)
- Example filename: `Lumen Browser-Setup-0.2.5.exe`

---

## 4) Get SHA-256 + size (required)

### Windows (PowerShell)

```powershell
$file = (Get-ChildItem -Path "release" -File -Filter "*.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
$file
(Get-FileHash -Algorithm SHA256 $file).Hash.ToLower()
(Get-Item $file).Length
```

### Linux

```bash
FILE="./release/<your-artifact>"
sha256sum "$FILE" | awk '{print $1}'
stat -c%s "$FILE"
```

### macOS

```bash
FILE="./release/<your-artifact>"
shasum -a 256 "$FILE" | awk '{print $1}'
stat -f%z "$FILE"
```

---

## 5) Hosting (URLs) — recommendations

The Windows updater downloads from the **first HTTP(S) URL** in the artifact’s `urls[]`.

Best practices:
- Provide at least **1 stable HTTP(S) URL** (ideally 2 mirrors).
- Keep URLs **immutable** (never replace the file behind the same URL).
- The on-chain `sha256` must match the served file exactly.
- Optional: add an `ipfs://<cid>` URL as a fallback.

Note: automatic “download + install” is implemented **only on Windows** in the current client. On macOS/Linux, URLs are still useful (manual download), but don’t rely on an automatic installer flow.

### Expected `platform` values (Lumen Browser)
They must match the client auto-detect:
- `windows-amd64` (Windows x64)
- `windows-386` (Windows 32-bit, if supported)
- `linux-amd64`
- `linux-arm64`
- `darwin-amd64` / `darwin-arm64`

If you publish an artifact with a different platform string, the watcher won’t select it.

---

## 6) Publish via `lumen://release` (publisher UI)

1. Open `lumen://release`.
2. Click **Publish release**.
2b. (Optional) Paste a **GitHub release URL** (e.g. `https://github.com/network-lumen/browser/releases/tag/v0.2.8`) and click **Auto-fill** to populate version/notes/artifacts from GitHub + `SHA256SUMS.txt`.
3. Fill:
   - **Version**: semver (e.g. `0.2.6`) — must match the built app’s `package.json` version.
   - **Channel**: usually `beta` first, then `stable` after validation.
   - **Supersedes**: optional (IDs to “replace”, informational).
   - **Release notes**: short text (bounded by params).
4. In **Artifacts**:
   - `Platform`: e.g. `windows-amd64`
   - `Kind`: `browser`
   - `SHA-256`: 64 hex chars
   - `Size (bytes)`: number
   - `CID`: optional
   - `URLs`: one per line (HTTP(S) recommended)
5. Click **Publish**.

On-chain, this broadcasts a `MsgPublishRelease` (module `lumen.release.v1`).

### Verify on-chain (debug)
```bash
API=http://127.0.0.1:1317

# Params
curl -s "$API/lumen/release/params"

# Latest (VALIDATED-only; used for stable channel)
curl -s "$API/lumen/release/latest?channel=beta&platform=windows-amd64&kind=browser"

# Canonical latest path (same semantics)
curl -s "$API/lumen/release/latest/beta/windows-amd64/browser"

# List (includes PENDING; used for beta channel)
curl -s "$API/lumen/release/releases?channel=beta&limit=50"

# By version
curl -s "$API/lumen/release/by_version/0.2.6"

# List (pagination)
curl -s "$API/lumen/release/releases?page=1&limit=10"
```

---

## 7) DAO validation (stable)

If a release is `PENDING`, the details panel shows:
- **Send to DAO (validate)**
- **Send to DAO (reject)**

### Validate
1. Click **Send to DAO (validate)**.
2. Set a **deposit (LMN)** if needed: if the deposit is too low, the proposal stays in “deposit period” (no voting until `min_deposit` is reached).
3. **Broadcast proposal**.

Then:
- Go to `lumen://dao` and vote (or ask the voters to vote).
- When it passes, governance executes `MsgValidateRelease` (authority = gov module address).
- Status becomes `VALIDATED`.

Tip: the toast “Proposal broadcasted (txhash)” gives you a hash. You can paste it into:
- `lumen://explorer/tx/<txhash>`

### Reject
Same flow, but governance executes `MsgRejectRelease`.

Notes:
- The module has a `PENDING` expiration (`max_pending_ttl`), so don’t leave releases pending for too long.
- The publish fee (`publish_fee_ulmn`) is escrowed on publish; it’s refunded on `VALIDATED`, and forfeited to the community pool on `REJECTED` / `EXPIRED` / `YANKED`.

---

## 8) How the client detects updates (debugging)

### Main process (watcher)
The watcher periodically queries the chain API:
- `GET /lumen/release/latest?channel=...&platform=...&kind=...`
- fallback: `GET /lumen/release/releases?limit=50&channel=...`

Important: `GET /lumen/release/latest` returns **only `VALIDATED`** releases. If it returns a result, the client will use it (and won’t scan `PENDING` releases).

Implementation:
- `contributor/browser/electron/services/release_watcher.cjs`

Useful env vars:
- `LUMEN_RELEASE_CHANNEL` (default: `beta`)
- `LUMEN_RELEASE_KIND` (default: `browser`)
- `LUMEN_RELEASE_PLATFORM` (default: auto)
- `LUMEN_RELEASE_POLL_MS` (default: 10 min)
- `DEBUG_LUMEN_RELEASE=1` for logs

### UI (update notification)
The renderer compares `latest.version` vs `package.json version` and shows an update notification.

Implementation:
- `contributor/browser/src/internal/services/releaseUpdates.ts`
- `contributor/browser/src/components/ReleaseUpdatePrompt.vue`

### Download / install
- Windows: download + SHA256 check + launch NSIS installer, then quit the app.
- macOS/Linux: **no automatic install** in the current client. Clicking “Update now” opens the artifact download URL for a manual install.

Implementation:
- `contributor/browser/electron/services/release_installer.cjs`

---

## 9) “Clean release” checklist (recommended)

- [ ] Version updated in `contributor/browser/package.json`.
- [ ] Build OK (`npm run dist` / `npm run dist:win`).
- [ ] Installer tested on a “clean” machine.
- [ ] SHA256 + size verified on the final file.
- [ ] URLs are publicly reachable and immutable (ideally 2 mirrors).
- [ ] Published on-chain via `lumen://release`.
- [ ] If `stable`: DAO proposal + vote + status `VALIDATED`.
- [ ] Verify the watcher detects the release (test on a `beta` machine first).

---

## 10) Troubleshooting

### “I don’t see the update”
- Check `channel/kind/platform` on the artifact vs the client env vars.
- Check the release is not `yanked`.
- For `stable`: status must be `VALIDATED` (otherwise `/latest` returns 404).
- Remember: if `/latest` returns a `VALIDATED` release for that triple, the client won’t scan `PENDING` ones.
- Wait for the refresh cycle (~10 min) or use the “Update test” tools if enabled.

### “Publishing failed”
Most common causes:
- invalid `sha256_hex` (must be 64 hex chars)
- missing/invalid `size`
- too many URLs or artifacts (param limits)
- wallet not allowed (not in `allowed_publishers`)
- invalid channel name (not in `params.channels`)

### “password_required / invalid_password”
Unlock the signing session (mnemonic and/or encrypted PQC keys).
