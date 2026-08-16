// Runs the chain end-to-end tests, which broadcast real transactions.
//
// A launcher rather than an inline env assignment in package.json, so the same
// command works in every shell. The flag is what makes playwright.config
// include the project at all: a plain `playwright test` must never spend.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

// Playwright's CLI through node, not through `npx`: since the fix for
// CVE-2024-27980, spawning a .cmd without a shell fails outright, and it fails
// by setting `error` while leaving `status` null - which looks like a test
// failure with no output at all. Located from its package.json, because
// cli.js is not in the package's exports map.
const require = createRequire(import.meta.url);
const cli = join(dirname(require.resolve('@playwright/test/package.json')), 'cli.js');

const res = spawnSync(process.execPath, [cli, 'test', '--project=chain', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, LUMEN_E2E_CHAIN: '1' }
});

if (res.error) {
  console.error(res.error.message);
  process.exit(1);
}
process.exit(res.status ?? 1);
