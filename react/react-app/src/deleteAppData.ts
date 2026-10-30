import { clearAllPdfData } from "./pdfStorage";

const appKeys = [
    "componentsConfig", "streak", "themeBackground", "themeText", "themePreset",
    "themeCustomBackground", "themeCustomText", "themeFont", "themeFontSize", "themeLetterSpacing",
];
const componentSuffixes = ["_index", "_version", "_title", "_text", "_state", "_voice", "_speechRate", "_speechPosition", "_speechFollow", "_speechContinue", "_videoPositions", "_pdfSections"];

/** Remove this app's data without clearing unrelated apps on the same origin. */
export async function deleteAppData(): Promise<void> {
    const ids = new Set(["section1", "section2"]);
    try {
        const config: unknown = JSON.parse(localStorage.getItem("componentsConfig") ?? "[]");
        if (Array.isArray(config)) {
            for (const entry of config) if (typeof entry?.id === "string") ids.add(entry.id);
        }
    } catch { /* Still remove known keys if the saved layout is malformed. */ }
    const keys = new Set(appKeys);
    for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index);
        if (!key) continue;
        for (const suffix of componentSuffixes) {
            if (!key.endsWith(suffix)) continue;
            const id = key.slice(0, -suffix.length);
            if (ids.has(id) || /^comp_[a-z0-9]+$/u.test(id)) keys.add(key);
        }
    }
    // Leave local settings untouched if clearing PDF storage fails.
    await clearAllPdfData();
    for (const key of keys) localStorage.removeItem(key);
}
