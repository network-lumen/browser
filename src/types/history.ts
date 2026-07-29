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

export type HistoryMap = Record<string, HistoryEntry[]>;
export type HistorySettingsMap = Record<string, HistorySettings>;
