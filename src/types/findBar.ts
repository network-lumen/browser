export type FindActionPayload = {
  action?: string;
  targetWebContentsId?: number | string | null;
};

export type FindResultPayload = {
  targetWebContentsId?: number | string | null;
  result?: {
    requestId?: number;
    activeMatchOrdinal?: number;
    matches?: number;
    finalUpdate?: boolean;
  };
};
