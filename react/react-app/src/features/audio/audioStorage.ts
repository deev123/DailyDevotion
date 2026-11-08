const DATABASE = "daily-devotion-audio";
const STORE = "players";
export type AudioTrack = { id: string; name: string; file: Blob; position: number };
let dbPromise: Promise<IDBDatabase> | undefined;
let resetting = false;
const deleted = new Set<string>();
function db() {
    if (!dbPromise) {
        dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open(DATABASE, 1);
            request.onupgradeneeded = () => request.result.createObjectStore(STORE);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            request.onblocked = () => reject(new Error("Close other app tabs and try again."));
        });
        dbPromise.catch(() => { dbPromise = undefined; });
    }
    return dbPromise;
}
async function transaction(mode: IDBTransactionMode, action: (store: IDBObjectStore) => void) {
    const database = await db();
    return new Promise<void>((resolve, reject) => {
        const tx = database.transaction(STORE, mode);
        action(tx.objectStore(STORE));
        tx.oncomplete = () => resolve();
        tx.onabort = tx.onerror = () => reject(tx.error);
    });
}
export async function loadTracks(id: string): Promise<AudioTrack[]> {
    const database = await db();
    return new Promise((resolve, reject) => {
        const request = database.transaction(STORE).objectStore(STORE).get(id);
        request.onsuccess = () => resolve(request.result ?? []);
        request.onerror = () => reject(request.error);
    });
}
export async function saveTracks(id: string, tracks: AudioTrack[]) {
    await db();
    if (resetting || deleted.has(id)) throw new Error("Player has been deleted.");
    await transaction("readwrite", store => { store.put(tracks, id); });
}
export async function deleteAudio(id: string) {
    deleted.add(id);
    try { await transaction("readwrite", store => { store.delete(id); }); }
    catch (error) { deleted.delete(id); throw error; }
}
export async function clearAllAudio() {
    resetting = true;
    try { await transaction("readwrite", store => { store.clear(); }); }
    catch (error) { resetting = false; throw error; }
}
