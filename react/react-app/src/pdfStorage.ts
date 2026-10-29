// PDFs belong in IndexedDB, rather than the small string-only localStorage store.
const DATABASE = "daily-devotion-pdfs";
const FILES = "files";
const PAGES = "pages";
let database: Promise<IDBDatabase> | undefined;
const deleted = new Set<string>();
let resetting = false;

function openDatabase(): Promise<IDBDatabase> {
    if (!database) {
        database = new Promise((resolve, reject) => {
            const request = indexedDB.open(DATABASE, 1);
            request.onupgradeneeded = () => {
                request.result.createObjectStore(FILES);
                request.result.createObjectStore(PAGES);
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            request.onblocked = () => reject(new Error("Close other app tabs and try again."));
        });
        database.catch(() => { database = undefined; });
    }
    return database;
}

function completed(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error ?? new Error("PDF storage was interrupted."));
        transaction.onerror = () => reject(transaction.error);
    });
}

export async function loadPdf(id: string): Promise<{ file: Blob; name: string; page: number; word: number; speed: number } | null> {
    const db = await openDatabase();
    const transaction = db.transaction([FILES, PAGES], "readonly");
    const file = transaction.objectStore(FILES).get(id);
    const page = transaction.objectStore(PAGES).get(id);
    await completed(transaction);
    if (!file.result) return null;
    // Older readers stored just a page number in this store.
    const progress = typeof page.result === "number" ? { page: page.result } : (page.result ?? {});
    return {
        ...file.result,
        page: Number.isInteger(progress.page) && progress.page > 0 ? progress.page : 1,
        word: Number.isInteger(progress.word) && progress.word >= 0 ? progress.word : 0,
        speed: Number.isFinite(progress.speed) ? Math.min(800, Math.max(100, progress.speed)) : 300,
    };
}

export async function savePdf(id: string, file: File): Promise<void> {
    const db = await openDatabase();
    if (resetting) throw new Error("App data is being deleted.");
    if (deleted.has(id)) throw new Error("This PDF reader has been deleted.");
    // Replacing a book and resetting its page must succeed together.
    const transaction = db.transaction([FILES, PAGES], "readwrite");
    transaction.objectStore(FILES).put({ file, name: file.name }, id);
    transaction.objectStore(PAGES).put(1, id);
    await completed(transaction);
}

export async function savePdfProgress(id: string, page: number, word: number, speed: number): Promise<void> {
    const db = await openDatabase();
    if (resetting || deleted.has(id)) return;
    const transaction = db.transaction(PAGES, "readwrite");
    transaction.objectStore(PAGES).put({ page, word, speed }, id);
    await completed(transaction);
}

/** Clear stored PDFs and progress atomically and prevent pending saves until reload. */
export async function clearAllPdfData(): Promise<void> {
    resetting = true;
    try {
        const db = await openDatabase();
        const transaction = db.transaction([FILES, PAGES], "readwrite");
        transaction.objectStore(FILES).clear();
        transaction.objectStore(PAGES).clear();
        await completed(transaction);
    } catch (error) {
        resetting = false;
        throw error;
    }
}

export async function deletePdf(id: string): Promise<void> {
    // Prevent an outstanding file selection from recreating a deleted reader's data.
    deleted.add(id);
    try {
        const db = await openDatabase();
        const transaction = db.transaction([FILES, PAGES], "readwrite");
        transaction.objectStore(FILES).delete(id);
        transaction.objectStore(PAGES).delete(id);
        await completed(transaction);
    } catch (error) {
        deleted.delete(id);
        throw error;
    }
}
