import { beforeEach, afterEach, vi } from 'vitest';

beforeEach(() => {
  globalThis.window = globalThis.window || ({} as any);
});

afterEach(() => {
  vi.restoreAllMocks();
});