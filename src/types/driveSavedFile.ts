export type DriveSavedFile = {
  cid: string;
  name: string;
  size: number;
  uploadedAt: number;
  type?: "file" | "dir";
  rootCid?: string;
  relPath?: string;
};
