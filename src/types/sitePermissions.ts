/** One right a site holds, or has had taken away. */
export type SitePermissionAction = {
  /** The action kind as the main process names it, e.g. "SendToken". */
  kind: string;
  allowed: boolean;
  updatedAt: number;
};

/** Everything the browser lets one site do. */
export type SitePermissionRecord = {
  siteKey: string;
  /** The blanket grant: whether the site may open Lumen's action modals at all. */
  allowModals: boolean;
  updatedAt: number;
  actions: SitePermissionAction[];
};
