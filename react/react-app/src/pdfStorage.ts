// PDFs belong in IndexedDB, rather than the small string-only localStorage store.
const DATABASE = "daily-devotion-pdfs";
const FILES = "files";
const PAGES = "pages";
let database: Promise<IDBDatabase> | undefined;
const deleted = new Set<string>();

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

export async function loadPdf(id: string): Promise<{ file: Blob; name: string; page: number } | null> {
    const db = await openDatabase();
    const transaction = db.transaction([FILES, PAGES], "readonly");
    const file = transaction.objectStore(FILES).get(id);
    const page = transaction.objectStore(PAGES).get(id);
    await completed(transaction);
    if (!file.result) return null;
    return { ...file.result, page: Number.isInteger(page.result) && page.result > 0 ? page.result : 1 };
}

export async function savePdf(id: string, file: File): Promise<void> {
    const db = await openDatabase();
    if (deleted.has(id)) throw new Error("This PDF reader has been deleted.");
    // Replacing a book and resetting its page must succeed together.
    const transaction = db.transaction([FILES, PAGES], "readwrite");
    transaction.objectStore(FILES).put({ file, name: file.name }, id);
    transaction.objectStore(PAGES).put(1, id);
    await completed(transaction);
}

export async function savePdfPage(id: string, page: number): Promise<void> {
    const db = await openDatabase();
    if (deleted.has(id)) return;
    const transaction = db.transaction(PAGES, "readwrite");
    transaction.objectStore(PAGES).put(page, id);
    await completed(transaction);
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
