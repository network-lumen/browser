const api: any = (window as any).lumen;
async function checkIpfsStatus(): Promise<boolean> {
    try {
        const result = api.ipfsStatus?.();
        return result;
    } catch {
        return false;
    }
}

export {
    checkIpfsStatus
}