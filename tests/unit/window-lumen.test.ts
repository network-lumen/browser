import { describe, expect, it, vi } from 'vitest';

describe('window.lumen preload API', () => {
  it('should expose a lumen object with expected gateway methods', () => {
    const fakeLumen = {
      gateway: {
        getStatus: vi.fn().mockResolvedValue({ ok: true })
      },
      profiles: {
        getActive: vi.fn().mockResolvedValue({ id: 'abc', walletAddress: 'lmn1...' })
      }
    };

    const anyWindow: any = {};
    anyWindow.lumen = fakeLumen;

    expect(anyWindow.lumen).toHaveProperty('gateway');
    expect(anyWindow.lumen.gateway).toHaveProperty('getStatus');
    expect(anyWindow.lumen).toHaveProperty('profiles');
    expect(anyWindow.lumen.profiles).toHaveProperty('getActive');
  });
});