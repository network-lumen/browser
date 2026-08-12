import { describe, expect, it } from 'vitest';
import { rankAddressSuggestions } from '../../src/internal/services/addressSuggestions';

/**
 * The address bar's dropdown. Everything worth testing here is an order: which
 * of two matches comes first, and what happens when the same page is in both
 * stores. Nothing else in this module can be wrong without being obvious.
 */

const fav = (url: string, title?: string) => ({ url, title });
const hist = (url: string, extra: { title?: string; lastVisitedAt?: number; visitCount?: number } = {}) => ({
  url,
  ...extra
});

describe('ranking', () => {
  it('returns nothing for a blank query', () => {
    expect(rankAddressSuggestions('   ', { favourites: [fav('lumen://wallet/')] })).toEqual([]);
  });

  it('puts every favourite ahead of every history entry', () => {
    const result = rankAddressSuggestions('wa', {
      favourites: [fav('https://waypoint.example/deep/page')],
      history: [hist('lumen://wallet/')]
    });
    expect(result.map((r) => r.source)).toEqual(['favourite', 'history']);
  });

  it('prefers a host prefix over a host substring within one block', () => {
    const result = rankAddressSuggestions('drive', {
      history: [hist('https://mydrive.example/'), hist('https://drive.example/')]
    });
    expect(result.map((r) => r.url)).toEqual(['https://drive.example/', 'https://mydrive.example/']);
  });

  it('matches a title when the host does not contain the query', () => {
    const result = rankAddressSuggestions('quarterly', {
      favourites: [fav('https://example.com/a1b2', 'Quarterly report')]
    });
    expect(result.map((r) => r.title)).toEqual(['Quarterly report']);
  });

  it('drops candidates that match nowhere', () => {
    expect(rankAddressSuggestions('zzz', { history: [hist('https://example.com/')] })).toEqual([]);
  });

  it('breaks a tie on visit count, then recency', () => {
    const result = rankAddressSuggestions('ex', {
      history: [
        hist('https://ex1.example/', { visitCount: 1, lastVisitedAt: 500 }),
        hist('https://ex2.example/', { visitCount: 9, lastVisitedAt: 1 }),
        hist('https://ex3.example/', { visitCount: 1, lastVisitedAt: 900 })
      ]
    });
    expect(result.map((r) => r.url)).toEqual([
      'https://ex2.example/',
      'https://ex3.example/',
      'https://ex1.example/'
    ]);
  });

  it('shows a page saved and visited once, as the favourite', () => {
    const result = rankAddressSuggestions('wallet', {
      favourites: [fav('lumen://wallet/')],
      history: [hist('lumen://wallet/')]
    });
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('favourite');
  });

  it('treats the two stores canonical forms of one lumen:// URL as the same page', () => {
    const result = rankAddressSuggestions('wallet', {
      favourites: [fav('lumen://wallet')],
      history: [hist('lumen://wallet/')]
    });
    expect(result).toHaveLength(1);
  });

  it('honours the limit', () => {
    const history = Array.from({ length: 20 }, (_, i) => hist(`https://ex${i}.example/`));
    expect(rankAddressSuggestions('ex', { history, limit: 3 })).toHaveLength(3);
  });
});
