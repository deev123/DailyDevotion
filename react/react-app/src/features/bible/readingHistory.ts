export type ReadingPosition = { index: number; verse: string; offset: number; version: number | null };
export type BibleState = { current: ReadingPosition; history: ReadingPosition[]; infinite: boolean };
export const BIBLE_STORAGE_KEY = "lookupBibleState";
export const emptyPosition: ReadingPosition = { index: 0, verse: "1", offset: 130, version: null };

function validPosition(value: unknown): value is ReadingPosition {
    if (!value || typeof value !== "object") return false;
    const p = value as ReadingPosition;
    return Number.isSafeInteger(p.index) && p.index >= 0 && p.index < 1189 &&
        typeof p.verse === "string" && /^\d+(-\d+)?$/.test(p.verse) &&
        Number.isFinite(p.offset) && (p.version === null || (Number.isSafeInteger(p.version) && p.version > 0));
}

function compactHistory(entries: ReadingPosition[]): ReadingPosition[] {
    const result: ReadingPosition[] = [];
    for (const entry of entries) {
        const last = result.at(-1);
        // Keep the latest scroll offset and translation for consecutive visits
        // to the same verse. Earlier visits separated by another verse remain.
        if (last?.index === entry.index && last.verse === entry.verse) result[result.length - 1] = entry;
        else result.push(entry);
    }
    return result.slice(-20);
}

export function parseBibleState(raw: string | null): BibleState {
    try {
        const data = JSON.parse(raw ?? "null");
        if (validPosition(data?.current)) return {
            current: data.current,
            history: Array.isArray(data.history) ? compactHistory(data.history.filter(validPosition)) : [data.current],
            infinite: data.infinite === true,
        };
    } catch { /* Start with Genesis if storage is missing or damaged. */ }
    return { current: { ...emptyPosition }, history: [{ ...emptyPosition }], infinite: false };
}
export function updateHistory(history: ReadingPosition[], position: ReadingPosition, newVisit: boolean): ReadingPosition[] {
    return compactHistory([...(newVisit ? history : history.slice(0, -1)), position]);
}
