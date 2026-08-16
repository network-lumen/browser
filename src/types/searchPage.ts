export type SearchType = "site" | "image" | "all";
export type ResultKind = "site" | "ipfs" | "tx" | "block" | "address" | "link";
export type ResultItem = {
  id: string;
  title: string;
  url: string;
  description?: string;
  kind: ResultKind;
  /** What is drawn under a result. Presentation only - see `tags`. */
  badges?: string[];
  /**
   * The indexer's own tags, untouched by anything drawn on screen.
   *
   * Separate from `badges` because the thumbnail safety heuristic reads them,
   * and it treats "no tags at all" as unknown and therefore sensitive. While
   * the two shared one array, a display fallback that pushed the MIME type in
   * gave every untagged image exactly one tag - "image/jpeg" - which is not
   * empty and matches none of the sensitive words, so the least-known images
   * were the ones rendered in the clear and never analysed.
   *
   * Absent means unknown, which is the safe reading.
   */
  tags?: string[];
  thumbUrl?: string;
  thumbCid?: string;
  media?: "image" | "unknown";
  fileKind?: "image" | "pdf" | "html" | "txt" | "epub" | "docx" | "unknown";
  score?: number;
  uniqueViews7d?: number;
  viewCid?: string;
  gateway?: { id: string; endpoint: string };
  site?: {
    domain?: string | null;
    cid?: string | null;
    entryCid?: string | null;
    entryPath?: string | null;
    wallet?: string | null;
    owned?: boolean;
  };
};

export type GatewayView = {
  id: string;
  endpoint: string;
  baseUrl?: string;
  regions?: string[];
};

export type SearchCursor = {
  score: number;
  id: string;
  rankAt?: number;
};

export type SearchRouteCursorGateway = {
  id: string;
  cursor: SearchCursor | null;
};

export type SearchRouteCursor = {
  version: 1;
  rankAt?: number;
  gateways: SearchRouteCursorGateway[];
  anchorId?: string;
};

export type ParsedSearchUrl = {
  q: string;
  type: SearchType;
  cursor: SearchRouteCursor | null;
  gatewayId: string | null;
};

export type SearchPageCursorState = {
  startIndex: number;
  endIndex: number;
  cursor: SearchRouteCursor | null;
  gatewayId: string | null;
};

export type GatewaySearchResult = {
  items: ResultItem[];
  hasPrev: boolean;
  prevCursor: SearchRouteCursor | null;
  pageCursor: SearchRouteCursor | null;
  hasMore: boolean;
  nextCursor: SearchRouteCursor | null;
  gateway: GatewayView | null;
};

export type GatewaySearchHit = {
  cid?: string;
  root_cid?: string;
  path?: string;
  title?: string;
  kind?: string;
  mime?: string;
  ext_guess?: string;
  resourceType?: string;
  tags_json?: any;
  topics?: any;
  snippet?: string;
  views_unique_7d?: number;
  linked_domain?: string;
  rank_signals?: any;
};

export type GatewaySiteSearchResult = {
  type?: string;
  domain?: string;
  rootDomain?: string;
  cid?: string;
  entry_cid?: string;
  entry_path?: string;
  wallet?: string;
  score?: number;
  views_unique_7d?: number;
  tags?: any;
  owned?: boolean;
  title?: string;
  snippet?: string;
};
