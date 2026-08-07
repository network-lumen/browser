import { activeProfileId } from "../profilesStore";
import { checkIpfsStatus } from "./ipfs";
import { useInternalLumen } from '../../composables/useInternalLumen';
import type { UploadActivity, UploadPathResult, DriveFile } from "../../types/upload";
import { driveFilesKey, driveLocalNamesKey } from "../services/driveStorage";
import { readJson, writeJson } from "../services/storage";

import { errorMessage } from "../services/coerce";
const api: any = useInternalLumen();
const uploadActivities: UploadActivity = {};
let localNames: Record<string, string> = {};
const uploadControllers: Record<string, AbortController> = {};

let files = [] as DriveFile[];

function loadFiles() {
    const pid = String(activeProfileId.value || "").trim();
    files = readJson<DriveFile[]>(driveFilesKey(pid), []);
}

/**
 * Guarded because this runs as the module loads, before Vue has mounted
 * anything.
 *
 * Without the guard, a missing bridge threw here and took the whole renderer
 * down with a blank page - including `App.vue`'s own FATAL000001 screen, which
 * exists to tell the user precisely that the bridge is missing. The diagnostic
 * could never appear in the one situation it was written for. Caught by the
 * end-to-end test that loads the app with no bridge.
 */
api?.ipfsOnAddProgress?.((p: any) => {
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
    const storedParsed = readJson<unknown>(driveLocalNamesKey(pid), null);
    localNames = storedParsed && typeof storedParsed === "object" ? (storedParsed as Record<string, string>) : {};
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
        if (!result?.cid)
            throw new Error("Failed to add " + fileType + " to IPFS");
        if (result?.cid && String(result.error || "").includes("closed network connection"))
            console.warn("Kubo stream closed but CID exists → treating as success");
        else if(!result.ok && result.error)
            throw new Error(result.error)

        const cid = String(result.cid);
        const totalBytes = Number(result?.totalBytes || 0) || 0;

        api.ipfsPropagateCidToPublicGateways({ cid });
        localNames[cid] = name;

        const pid = String(activeProfileId.value || "").trim();
        if (!pid) 
          throw new Error("No active profile found");
        writeJson(driveLocalNamesKey(pid), localNames);

        loadFiles();
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
        writeJson(driveFilesKey(pid), files);
        return { ok: true, cid, rootName: name, rootPath, totalBytes };
    } catch (err) {
        console.error(err);
        return { ok: false, error: errorMessage(err, "Failed to upload"), rootName: name, rootPath };
    } finally {
        setTimeout(() => {
            delete uploadActivities[dirPath];
        }, 1000)
        
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
        loadFiles();
        const results: UploadPathResult[] = [];
        for (const dirPath of selected) {
            results.push(await uploadFromPath(dirPath, "dir"));
        }
        return results;
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
        loadFiles();
        const results: UploadPathResult[] = [];
        for (const filePath of selected) {
            results.push(await uploadFromPath(filePath, "file"));
        }
        return results;
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