import { activeProfileId } from "../profilesStore";
import { checkIpfsStatus } from "./ipfs";
const api: any = (window as any).lumen;
const uploadActivities: UploadActivity = {};
const LOCAL_NAMES_KEY_PREFIX = "lumen:drive:names:v1";
const STORAGE_KEY_PREFIX = "lumen:drive:files:v1";
let localNames: Record<string, string> = {};
const uploadControllers: Record<string, AbortController> = {};

type UploadActivity = {
    [key: string]: {
        uploadingFile: string;
        uploadingPercent: number | null;
        uploadingCanceling: number; // 0 = not canceling, 1 = canceling, 2 = cancelled
        uploadId?: string;
    } | undefined;
}

type UploadPathResult =
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

let files = [] as DriveFile[];

api.ipfsOnAddProgress((p: any) => {
  /* Example progress payload:
        {
        phase: 'upload',
        uploadedBytes: 670228807.68,
        totalBytes: 4788888535.04,
        percent: 13.98,
        fileCount: 4205,
        elapsedMs: 4943
        }
   */
  const key = p.key;
  if (!key) return;
  const activity = uploadActivities[key];
  if (!activity) return;
  activity.uploadingPercent = p.percent || 0;
});

function loadLocalNames() {
    localNames = {};
    const pid = String(activeProfileId.value || "").trim();
    if (!pid) return;
    const stored = localStorage.getItem(`${LOCAL_NAMES_KEY_PREFIX}:${pid}`);
    const storedParsed = stored ? JSON.parse(stored) : null;
    const storedNames = storedParsed && typeof storedParsed === "object" ? (storedParsed as Record<string, string>) : {};
    localNames = storedNames;
}

interface DriveFile {
  cid: string;
  name: string;
  size: number;
  uploadedAt?: number;
  type?: "file" | "dir";
  rootCid?: string;
  relPath?: string;
  sourceTarget?: string;
}

async function uploadFromPath(dirPath: string, fileType: "file" | "dir" = "dir"): Promise<UploadPathResult> {
    const rootPath = String(dirPath || "").trim();
    if (!rootPath) throw new Error("Invalid folder path");

    // Normalize the name by taking the last part of the path
    const s = String(rootPath || "").replace(/\\/g, "/").trim();
    const parts = s.split("/").filter(Boolean);
    const name = parts[parts.length - 1] || s;

    // Set initial activity state for this upload
    const controller = new AbortController();
    uploadControllers[dirPath] = controller;
    uploadActivities[dirPath] = {
        uploadingFile: name,
        uploadingPercent: 0,
        uploadingCanceling: 0
    };

    try {
        const uploadId = crypto.randomUUID();
        uploadActivities[dirPath].uploadId = uploadId;
        const result = fileType == "dir" 
            ? await api.ipfsAddDirectoryFromPathWithProgress({ rootPath, rootName: name, uploadId }, { signal: controller.signal })
            : await api.ipfsAddPathWithProgress({ filePath: dirPath, filename: name, uploadId }, { signal: controller.signal });
        if(!result.ok && result.error === "cancelled")
            throw new Error("Upload cancelled");
        if(!result.ok && result.error)
            throw new Error(result.error)
        if (!result?.cid)
            throw new Error("Failed to add " + fileType + " to IPFS");

        const cid = String(result.cid);
        const totalBytes = Number(result?.totalBytes || 0) || 0;

        try {
            await api.ipfsPropagateCidToPublicGateways({ cid });
        } catch (err) {
            console.error("Failed to propagate CID to public gateways:", err);
        }

        localNames[cid] = name;

        const pid = String(activeProfileId.value || "").trim();
        if (!pid) 
          throw new Error("No active profile found");
        const key = `${LOCAL_NAMES_KEY_PREFIX}:${pid}`;
        localStorage.setItem(key, JSON.stringify(localNames));

        const filtered = files.filter(
          (f) => String(f?.cid || "").trim() !== cid,
        );
        const dirFile: DriveFile = {
            cid,
            name,
            size: totalBytes,
            uploadedAt: Date.now(),
            type: fileType,
        };
        files = [dirFile, ...filtered];
        localStorage.setItem(`${STORAGE_KEY_PREFIX}:${pid}`, JSON.stringify(files));
        return { ok: true, cid, rootName: name, rootPath, totalBytes };
    } catch (err: any) {
        console.error(err);
        return { ok: false, error: String(err?.message || err || "Failed to upload"), rootName: name, rootPath };
    } finally {
        delete uploadActivities[dirPath];
    }
}

async function uploadFolderToLocal(): Promise<UploadPathResult[]> { // Upload a local folder to an IPFS local CID
    try {
        const res = await api.dialogOpenFolder({ title: "Select folder to upload", multi: true });
        const paths = Array.isArray(res.paths) ? res.paths : [];
        const selected = paths.map((p: any) => String(p || "").trim()).filter(Boolean) as string[];
        if (!selected.length) throw new Error("No folder selected");
        if (!await checkIpfsStatus()) throw new Error("IPFS is not connected");
        loadLocalNames();
        const settled = await Promise.allSettled(selected.map((dirPath) => uploadFromPath(dirPath, "dir")));
        return settled.map((item, idx) => {
            if (item.status === "fulfilled") return item.value;
            const rootPath = selected[idx];
            const s = String(rootPath || "").replace(/\\/g, "/").trim();
            const parts = s.split("/").filter(Boolean);
            const name = parts[parts.length - 1] || s;
            return {
                ok: false,
                error: String(item.reason?.message || item.reason || "Upload failed"),
                rootName: name,
                rootPath,
            };
        });
    } catch (error) {
        return Promise.reject(error);
    }
}

async function uploadFileToLocal(): Promise<UploadPathResult[]> { // Upload a local file to an IPFS local CID
    try { 
        const res = await api.dialogOpenFiles({ title: "Select file to upload", multi: true });
        const paths = Array.isArray(res.paths) ? res.paths : [];
        const selected = paths.map((p: any) => String(p || "").trim()).filter(Boolean) as string[];
        if (!selected.length) throw new Error("No file selected");
        if (!await checkIpfsStatus()) throw new Error("IPFS is not connected");
        loadLocalNames();
        const settled = await Promise.allSettled(selected.map((filePath) => uploadFromPath(filePath, "file")));
        return settled.map((item, idx) => {
            const rootPath = selected[idx];
            const s = String(rootPath || "").replace(/\\/g, "/").trim();
            const parts = s.split("/").filter(Boolean);
            const name = parts[parts.length - 1] || s;
            if (item.status === "fulfilled") return item.value;
            return {
                ok: false,
                error: String(item.reason?.message || item.reason || "Upload failed"),
                rootName: name,
                rootPath,
            };
        });
    } catch (error) {
        return Promise.reject(error);
    }    
}

async function uploadCancelUpload(key: string) {
  try {
    const activity = uploadActivities[key];
    if (!activity) throw new Error("File not found in upload activities");
    if(activity.uploadingCanceling !== 0) throw new Error("Upload is already being canceled");
    activity.uploadingCanceling = 1;
    const controller = uploadControllers[key];
    if (controller) {
      controller.abort();
      delete uploadControllers[key];
    }
    activity.uploadingCanceling = 2;
    delete uploadActivities[key];
    let cancel = await api.ipfsCancelAdd({ uploadId: activity.uploadId });
    if(!cancel.ok) throw new Error("Failed to cancel upload: " + cancel.error);
    return "ok";
  } catch (error) {
    console.error(error);
    return Promise.reject(error);
  }
}

export {
    uploadFolderToLocal,
    uploadFileToLocal,
    uploadActivities,
    uploadCancelUpload
}