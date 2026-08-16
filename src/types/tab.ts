export type TabHistoryEntry = { url: string; title?: string };

export type RegisterFindTargetFn = (tabId: string, targetWebContentsId: number | null) => void;

export type Tab = {
  id: string;
  url?: string;
  draftUrl?: string;
  title?: string;
  history?: TabHistoryEntry[];
  history_position?: number;
  loading?: boolean;
  refreshTick?: number;
  favicon?: string | null;
};
