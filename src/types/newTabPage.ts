export type ShortcutModalMode = "create" | "edit";

/** The fields of the add/edit shortcut form. */
export type ShortcutDraft = {
  title: string;
  url: string;
  pinned: boolean;
};
