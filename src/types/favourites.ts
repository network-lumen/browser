export type FavouriteEntry = {
  id: string;
  url: string;
  title?: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
};

export type FavMap = Record<string, FavouriteEntry[]>;
export type LegacyFavMap = Record<string, string[]>;

export type FavouriteKind = "internal" | "search" | "web" | "file" | "other";

export type FavouriteMeta = {
  url: string;
  title: string;
  subtitle: string;
  monogram: string;
  kind: FavouriteKind;
};
