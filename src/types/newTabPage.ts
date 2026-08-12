export type ShortcutModalMode = "create" | "edit";

export type ShortcutDraft = {
  title: string;
  url: string;
  pinned: boolean;
};
