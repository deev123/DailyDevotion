export type VideoEntry = { title: string; videoId: string };
export type ComponentConfig =
    | { type: "passage2"; id: string; list: string }
    | { type: "notebox"; id: string }
    | { type: "videoPlaylist"; id: string; list: string | VideoEntry[] }
    | { type: "catechism"; id: string; list: string }
    | { type: "pdfReader"; id: string };

type StoredLayout = {
    components: ComponentConfig[];
    hidden: unknown[];
    migratedEntries: unknown[];
    legacyPassageIds: string[];
    changed: boolean;
};

/** Normalise known older components while retaining unknown entries in storage. */
export function parseStoredLayout(json: string | null): StoredLayout | null {
    if (json === null) return null;
    let entries: unknown;
    try { entries = JSON.parse(json); } catch { return null; }
    if (!Array.isArray(entries)) return null;

    const result: StoredLayout = { components: [], hidden: [], migratedEntries: [], legacyPassageIds: [], changed: false };
    const ids = new Set<string>();
    for (const entry of entries) {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            result.hidden.push(entry); result.migratedEntries.push(entry); continue;
        }
        const item = entry as Record<string, unknown>;
        const id = item.id;
        const type = item.type;
        if (typeof id !== "string" || !id.trim() || ids.has(id)) {
            result.hidden.push(entry); result.migratedEntries.push(entry); continue;
        }
        let component: ComponentConfig | null = null;
        let storedEntry: unknown = entry;
        if ((type === "passage" || type === "speechPassage" || type === "integratedSpeechPassage" || type === "passage2") && typeof item.list === "string" && item.list.trim()) {
            component = { type: "passage2", id, list: item.list };
            if (type !== "passage2") {
                storedEntry = { ...item, type: "passage2" };
                result.changed = true;
                if (type === "passage") result.legacyPassageIds.push(id);
            }
        } else if (type === "videoPlaylist") {
            if (typeof item.list === "string" && item.list.trim()) {
                component = { type, id, list: item.list };
            } else if (Array.isArray(item.list)) {
                const list = item.list.filter((video): video is VideoEntry =>
                    video && typeof video === "object" && typeof video.title === "string" && typeof video.videoId === "string");
                component = { type, id, list };
                if (list.length !== item.list.length) { storedEntry = { ...item, list }; result.changed = true; }
            } else if (item.list === undefined || item.list === null) {
                component = { type, id, list: "NIV_Audio_Bible.json" };
                storedEntry = { ...item, list: component.list };
                result.changed = true;
            }
        } else if (type === "catechism" && typeof item.list === "string" && item.list.trim()) {
            component = { type, id, list: item.list };
        } else if (type === "notebox" || type === "pdfReader") {
            component = { type, id };
        }
        if (component) { ids.add(id); result.components.push(component); }
        else result.hidden.push(entry);
        result.migratedEntries.push(storedEntry);
    }
    return result;
}

/** Older non-React passages saved their index directly under their component ID. */
export function migrateLegacyPassageIndices(storage: Storage, ids: string[]): void {
    for (const id of ids) {
        try {
            const oldValue = storage.getItem(id);
            if (oldValue === null) continue;
            const oldIndex: unknown = JSON.parse(oldValue);
            if (!Number.isSafeInteger(oldIndex) || (oldIndex as number) < 0) continue;
            if (storage.getItem(id + "_index") === null) storage.setItem(id + "_index", JSON.stringify(oldIndex));
            storage.removeItem(id);
        } catch { /* Leave unreadable data intact. */ }
    }
}
