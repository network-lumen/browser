export type UploadActivity = {
  [key: string]: {
    uploadingFile: string;
    uploadingPercent: number | null;
    uploadingCanceling: number; // 0 = not canceling, 1 = canceling, 2 = cancelled
    uploadId?: string;
  } | undefined;
};

export type UploadPathResult =
  | {
      ok: true;
      cid: string;
      rootName: string;
      rootPath: string;
      totalBytes: number;
    }
  | {
      ok: false;
      error: string;
      rootName: string;
      rootPath: string;
    };

export interface DriveFile {
  cid: string;
  name: string;
  size: number;
  uploadedAt?: number;
  type?: "file" | "dir";
  rootCid?: string;
  relPath?: string;
  sourceTarget?: string;
}
