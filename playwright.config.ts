import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  // Two kinds of end-to-end here, and they are not interchangeable. `renderer`
  // drives the Vue app in a browser with the bridge mocked, which is how a user
  // flow is tested. `electron` launches the real app - main process, preloads,
  // IPC - which is the only thing that can say the app still boots.
  projects: [
    { name: 'renderer', testDir: 'tests/e2e', testIgnore: '**/electron/**' },
    // One at a time: each spec launches a full app with its own IPFS daemon, and
    // three of those at once is heavier than the machine's patience.
    { name: 'electron', testDir: 'tests/e2e/electron', timeout: 240_000, workers: 1 }
  ],
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:5173',
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 10_000,
    ignoreHTTPSErrors: true,
  },
  webServer: {
    command: 'npm run dev:renderer',
    port: 5173,
    reuseExistingServer: true,
  },
});