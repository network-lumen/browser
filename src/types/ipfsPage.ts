export type Entry = {
  key: string;
  name: string;
  cid: string;
  type: "dir" | "file";
  size: number | null;
  relPath: string;
};

export type MarkdownTarget = {
  proto: "ipfs" | "ipns";
  id: string;
  path: string;
  dir: boolean;
  suffix: string;
};

export type MarkdownResolvedLink =
  | { kind: "anchor"; value: string }
  | { kind: "internal"; value: string }
  | { kind: "external"; value: string };
