

const lumen_api: any = (window as any).lumen;
const gateway_lumen_api = lumen_api?.gateway;
const profiles_lumen_api = lumen_api?.profiles;

async function checkLumenAPIReferences(){
    if(!lumen_api) throw new Error("FATAL000001");
    if(!gateway_lumen_api) throw new Error("FATAL000002");
    if(!profiles_lumen_api) throw new Error("FATAL000003");

    /** lumen_api..... */
    if(!lumen_api.driveOnHlsProgress || typeof lumen_api.driveOnHlsProgress != "function" ) throw new Error (FATAL_ERROR_MAP['FATAL000004']('driveOnHlsProgress'))
    if(!lumen_api.driveOnHlsArchiveProgress || typeof lumen_api.driveOnHlsArchiveProgress != "function") throw new Error (FATAL_ERROR_MAP['FATAL000004']('driveOnHlsArchiveProgress'))
    if(!lumen_api.ipfsOnPublicGatewayPropagationProgress || typeof lumen_api.ipfsOnPublicGatewayPropagationProgress != "function") throw new Error (FATAL_ERROR_MAP['FATAL000004']('ipfsOnPublicGatewayPropagationProgress'))
    if(!lumen_api.driveCancelHlsConvert || typeof lumen_api.driveCancelHlsConvert != "function") throw new Error (FATAL_ERROR_MAP['FATAL000004']('driveCancelHlsConvert'))
    if(!lumen_api.driveCancelHlsArchiveDownload || typeof lumen_api.driveCancelHlsArchiveDownload != "function") throw new Error (FATAL_ERROR_MAP['FATAL000004']('driveCancelHlsArchiveDownload'))
    if(!lumen_api.driveDownloadHlsArchive || typeof lumen_api.driveDownloadHlsArchive != "function") throw new Error (FATAL_ERROR_MAP['FATAL000004']('driveDownloadHlsArchive'))
    if(!lumen_api.httpHead || typeof lumen_api.httpHead != "function") throw new Error (FATAL_ERROR_MAP['FATAL000004']('httpHead'))

    /** lumen_api.driveBackup..... */
    if(!lumen_api.driveBackup.encryptSnapshot || typeof lumen_api.driveBackup.encryptSnapshot != "function") throw new Error (FATAL_ERROR_MAP['FATAL000004']('driveBackup.encryptSnapshot'))
    if(!lumen_api.driveBackup.decryptSnapshot || typeof lumen_api.driveBackup.decryptSnapshot != "function") throw new Error (FATAL_ERROR_MAP['FATAL000004']('driveBackup.decryptSnapshot'))

    /** lumen_api.gateway..... */
    if(!gateway_lumen_api.onIngestProgress || typeof gateway_lumen_api.onIngestProgress != "function") throw new Error (FATAL_ERROR_MAP['FATAL000004']('gateway.onIngestProgress'))
    if(!gateway_lumen_api.renameCid || typeof gateway_lumen_api.renameCid != "function") throw new Error (FATAL_ERROR_MAP['FATAL000004']('gateway.renameCid'))

    /** lumen_api.profiles... */ 
    if(!profiles_lumen_api.getActive || typeof profiles_lumen_api.getActive != "function") throw new Error (FATAL_ERROR_MAP['FATAL000004']('profiles.getActive'))

}

const FATAL_ERROR_MAP: Record<string, any> = {
  FATAL000001: "Lumen API not found",
  FATAL000002: "Gateway API not found",
  FATAL000003: "Profiles API not found",
  FATAL000004: (name: string) => `Missing function '${name}'`,
};

export {
    checkLumenAPIReferences,
    FATAL_ERROR_MAP
}