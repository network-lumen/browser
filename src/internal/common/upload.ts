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
    } | undefined;
}

let files = [] as DriveFile[];

api.ipfsOnAddProgress((p: any) => {
  const key = p.rootPath || p.rootName;
  if (!key) return;

  const activity = uploadActivities[key];
  if (!activity) return;

  activity.uploadingPercent = p.percent ?? 0;
  activity.uploadingFile = p.filename || activity.uploadingFile;
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

async function uploadDirectoryFromPath(dirPath: string): Promise<{ ok: boolean }> {
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
      
        const result = await api.ipfsAddDirectoryFromPathWithProgress({ rootPath, rootName: name }, { signal: controller.signal });
        if (!result?.cid)
            throw new Error("Failed to add folder to IPFS");

        const cid = String(result.cid);
        const totalBytes = Number(result?.totalBytes || 0) || 0;

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
            type: "dir",
        };
        files = [dirFile, ...filtered];
        localStorage.setItem(`${STORAGE_KEY_PREFIX}:${pid}`, JSON.stringify(files));
        return { ok: true };
    } catch (err) {
        console.error(err);
        throw new Error(`Failed to upload folder: ${name}`);
    } finally {
        uploadActivities[dirPath] = undefined;
    }
}

async function uploadFolderToLocal(): Promise<string> { // Upload a local folder to an IPFS local CID
    try {
        const res = await api.dialogOpenFolder({ title: "Select folder to upload", multi: true })
        const paths = Array.isArray(res.paths) ? res.paths : [];
        const selected = paths.map((p: any) => String(p || "").trim()).filter(Boolean);
        if (!selected.length) throw new Error("No folder selected");
        if (!await checkIpfsStatus()) throw new Error("IPFS is not connected");
        loadLocalNames();
        for (const dirPath of selected) 
            await uploadDirectoryFromPath(dirPath);
        return "ok";
    } catch (error) {
        return Promise.reject(error);
    }
}
setInterval(() => {
    console.log("Updated upload activities:", uploadActivities);
}, 5000);
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
    uploadActivities[key] = undefined;
    return "ok";
  } catch (error) {
    return Promise.reject(error);
  }
}

export {
    uploadFolderToLocal,
    uploadActivities,
    uploadCancelUpload
}
