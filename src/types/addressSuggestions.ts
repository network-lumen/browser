import type { FavouriteKind } from './favourites';

export type AddressSuggestionSource = 'favourite' | 'history';

/** One candidate the address bar can offer, already drawn the way a row needs it. */
export interface AddressSuggestion {
  url: string;
  title: string;
  subtitle: string;
  monogram: string;
  kind: FavouriteKind;
  source: AddressSuggestionSource;
}

/**
 * The subset of a favourite or history entry the ranking reads. Both stores
 * hold more than this; taking only what is scored keeps the service callable
 * from a test without building either store's full record.
 */
export interface AddressSuggestionCandidate {
  url: string;
  title?: string;
  /** History only, and only used to break a tie between equal matches. */
  lastVisitedAt?: number;
  visitCount?: number;
}

export interface AddressSuggestionOptions {
  favourites?: AddressSuggestionCandidate[];
  history?: AddressSuggestionCandidate[];
  limit?: number;
}

/** A candidate with everything the sort compares, before the sort keys are dropped. */
export interface ScoredAddressSuggestion {
  suggestion: AddressSuggestion;
  tier: number;
  recency: number;
  visits: number;
}
