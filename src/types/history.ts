export type HistoryEntry = {
  id: string;
  url: string;
  title?: string;
  lastVisitedAt: number;
  visitCount: number;
};

export type HistorySettings = {
  enabled: boolean;
};
