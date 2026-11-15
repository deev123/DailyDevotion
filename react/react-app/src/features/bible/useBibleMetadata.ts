import { useCallback, useEffect, useState } from "react";
import YouVersionAPI, { type BibleVersionDetail } from "./YouVersionAPI";

export function useBibleMetadata(version: number | null) {
    const [selected, setSelected] = useState<{ version: number; detail: BibleVersionDetail | null } | null>(null);
    const [bookNames, setBookNames] = useState(new Map<number, Map<string, string>>());
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        if (!version) return;
        let cancelled = false;
        YouVersionAPI.fetchVersionDetail(version).then(detail => { if (!cancelled) setSelected({ version, detail }); });
        return () => { cancelled = true; };
    }, [version, attempt]);
    const retry = useCallback(() => setAttempt(previous => previous + 1), []);
    const loadBookNames = useCallback(() => {
        if (!version) return;
        void YouVersionAPI.fetchBookTitles(version).then(titles => setBookNames(previous => {
            const next = new Map(previous);
            next.delete(version); next.set(version, titles);
            while (next.size > 16) next.delete(next.keys().next().value!);
            return next;
        }));
    }, [version]);
    const settled = selected?.version === version;
    return {
        detail: settled ? selected.detail : null,
        failed: settled && selected.detail === null,
        titles: version ? bookNames.get(version) ?? null : null,
        loadBookNames, retry,
    };
}
