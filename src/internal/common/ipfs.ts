import { useInternalLumen } from '../../composables/useInternalLumen';

const api: any = useInternalLumen();

export async function checkIpfsStatus(): Promise<boolean> {
    try {
        const result = api.ipfsStatus?.();
        return result;
    } catch {
        return false;
    }
}
