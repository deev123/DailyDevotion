import { RequestCache } from "./apiCache";

// YouVersion Platform API wrapper
// docs: https://developers.youversion.com/api/bibles

export type BibleVersion = {
    id: number,
    abbreviation: string,
    title: string,
    languageTag: string,
    languageName: string,
    languageGroup: string,
    languageSearch: string,
    books: string[] | null
}

export type BibleVersionDetail = {
    id: number,
    abbreviation: string,
    title: string,
    languageTag: string,
    copyright: string
}

class YouVersionAPI {

    // YouVersion Platform app key from https://platform.youversion.com
    // Stored in .env.local as VITE_YOUVERSION_APP_KEY (gitignored)
    static APP_KEY = import.meta.env.VITE_YOUVERSION_APP_KEY ?? "";

    static BASE_URL = "https://api.youversion.com/v1";

    static REQUEST_TIMEOUT_MS = 12000;
    private static catalog = new RequestCache<BibleVersion[]>(8, 60 * 60 * 1000);
    private static details = new RequestCache<BibleVersionDetail>(16, 24 * 60 * 60 * 1000);
    private static titles = new RequestCache<Map<string, string>>(16, 24 * 60 * 60 * 1000);
    private static chapters = new RequestCache<{ ok: boolean; html: string; error: string; reference?: string }>(40, 24 * 60 * 60 * 1000);
    private static languages = new RequestCache<Map<string, Record<string, string>>>(1, 24 * 60 * 60 * 1000);

    private static async request(path: string): Promise<Response> {
        return fetch(this.BASE_URL + path, {
            headers: { Accept: "application/json", "X-YVP-App-Key": this.APP_KEY },
            signal: AbortSignal.timeout(this.REQUEST_TIMEOUT_MS),
        });
    }

    static readSavedVersion(key: string): number | null {
        try {
            const stored: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
            if (typeof stored !== "number" && (typeof stored !== "string" || !/^\d+$/.test(stored))) return null;
            const value = Number(stored);
            return Number.isSafeInteger(value) && value > 0 ? value : null;
        } catch { return null; }
    }

    private static version(value: Record<string, unknown>): BibleVersion {
        const legacyLanguage = value.language && typeof value.language === "object" ? value.language as Record<string, unknown> : {};
        const languageTag = String(value.language_tag || legacyLanguage.iso_639_1 || "");
        const parts = languageTag.split("-");
        const script = parts.find(part => /^[a-z]{4}$/i.test(part));
        const languageGroup = parts[0].toLowerCase() + (script ? `-${script}` : "");
        return { id: Number(value.id), abbreviation: String(value.abbreviation ?? ""),
            title: String(value.localized_title || value.title || value.abbreviation || `Bible ${value.id}`),
            languageTag, languageGroup: languageGroup || "und", languageName: languageGroup || "Other", languageSearch: languageTag,
            books: Array.isArray(value.books) ? value.books.filter((book): book is string => typeof book === "string") : null };
    }

    static fetchDefaultVersion(): Promise<number> {
        return this.catalog.get("default-en", async () => this.loadVersions("en")).then(async versions => {
            const chosen = versions.find(v => v.abbreviation.toUpperCase() === "BSB") ?? versions[0] ?? (await this.fetchVersionIndex())[0];
            if (!chosen) throw new Error("No translations are available. Open the translation selector to choose one.");
            return chosen.id;
        });
    }

    /** Compact catalogue for the selector, never a prerequisite for reading. */
    static fetchVersionIndex(): Promise<BibleVersion[]> {
        return this.catalog.get("index", async () => {
            const response = await this.request("/bibles?language_ranges[]=*&page_size=*&fields[]=id&fields[]=localized_title&fields[]=language_tag");
            if (!response.ok) throw new Error(`Could not load translations (${response.status}).`);
            if (response.status === 204) throw new Error("No translations are currently available.");
            const data = await response.json();
            if (!Array.isArray(data.data) || !data.data.length) throw new Error("No translations are currently available.");
            return data.data.map((value: Record<string, unknown>) => this.version(value));
        });
    }

    static fetchLanguageNames(): Promise<Map<string, Record<string, string>>> {
        return this.languages.get("names", async () => {
            const response = await this.request("/languages?bibles_available=true&page_size=*&fields[]=id&fields[]=display_names");
            if (!response.ok) throw new Error("Could not load language names.");
            const data = response.status === 204 ? { data: [] } : await response.json();
            return new Map((data.data ?? []).map((item: { id: string; display_names?: Record<string, string> }) => [item.id.toLowerCase(), item.display_names ?? {}]));
        });
    }

    // USFM book codes keyed by the book names used in the reading lists
    static BOOK_CODES: Record<string, string> = {
        "Genesis": "GEN",
        "Exodus": "EXO",
        "Leviticus": "LEV",
        "Numbers": "NUM",
        "Deuteronomy": "DEU",
        "Joshua": "JOS",
        "Judges": "JDG",
        "Ruth": "RUT",
        "1 Samuel": "1SA",
        "2 Samuel": "2SA",
        "1 Kings": "1KI",
        "2 Kings": "2KI",
        "1 Chronicles": "1CH",
        "2 Chronicles": "2CH",
        "Ezra": "EZR",
        "Nehemiah": "NEH",
        "Esther": "EST",
        "Job": "JOB",
        "Psalm": "PSA",
        "Psalms": "PSA",
        "Proverbs": "PRO",
        "Ecclesiastes": "ECC",
        "Song of Solomon": "SNG",
        "Isaiah": "ISA",
        "Jeremiah": "JER",
        "Lamentations": "LAM",
        "Ezekiel": "EZK",
        "Daniel": "DAN",
        "Hosea": "HOS",
        "Joel": "JOL",
        "Amos": "AMO",
        "Obadiah": "OBA",
        "Jonah": "JON",
        "Micah": "MIC",
        "Nahum": "NAM",
        "Habakkuk": "HAB",
        "Zephaniah": "ZEP",
        "Haggai": "HAG",
        "Zechariah": "ZEC",
        "Malachi": "MAL",
        "Matthew": "MAT",
        "Mark": "MRK",
        "Luke": "LUK",
        "John": "JHN",
        "Acts": "ACT",
        "Romans": "ROM",
        "1 Corinthians": "1CO",
        "2 Corinthians": "2CO",
        "Galatians": "GAL",
        "Ephesians": "EPH",
        "Philippians": "PHP",
        "Colossians": "COL",
        "1 Thessalonians": "1TH",
        "2 Thessalonians": "2TH",
        "1 Timothy": "1TI",
        "2 Timothy": "2TI",
        "Titus": "TIT",
        "Philemon": "PHM",
        "Hebrews": "HEB",
        "James": "JAS",
        "1 Peter": "1PE",
        "2 Peter": "2PE",
        "1 John": "1JN",
        "2 John": "2JN",
        "3 John": "3JN",
        "Jude": "JUD",
        "Revelation": "REV"
    };

    // convert a reference like "Genesis 1" or "1 John 3" into USFM "GEN.1" / "1JN.3"
    static referenceToUsfm(reference: string): string | null {
        const match = reference.trim().match(/^(.+?)\s+(\d+)$/);
        if (!match) return null;

        const bookName = match[1];
        const chapter = match[2];
        const bookCode = this.BOOK_CODES[bookName];
        if (!bookCode) return null;

        return `${bookCode}.${chapter}`;
    }

    // Legacy catalogue consumers retain their complete translation records.
    static async fetchVersions(): Promise<BibleVersion[]> {
        try { return await this.catalog.get("full", () => this.loadVersions("*")); }
        catch { return []; }
    }

    private static async loadVersions(language: string): Promise<BibleVersion[]> {
        const versions: BibleVersion[] = [];
        let token = "";
        do {
            const response = await this.request(`/bibles?language_ranges[]=${encodeURIComponent(language)}&page_size=99${token ? `&page_token=${encodeURIComponent(token)}` : ""}`);
            if (!response.ok) throw new Error(`Could not load translations (${response.status}).`);
            if (response.status === 204) break;
            const data = await response.json();
            versions.push(...(data.data ?? []).map((value: Record<string, unknown>) => this.version(value)));
            token = data.next_page_token ?? "";
        } while (token);
        const labels = new Map<string, { native: string; english: string }>();
        for (const version of versions) {
            if (!labels.has(version.languageGroup)) {
                let native = version.languageGroup, english = native;
                try {
                    native = new Intl.DisplayNames([version.languageGroup], { type: "language" }).of(version.languageGroup) ?? native;
                    english = new Intl.DisplayNames(["en"], { type: "language" }).of(version.languageGroup) ?? english;
                } catch { /* Display a language code when the browser lacks its name. */ }
                labels.set(version.languageGroup, { native, english });
            }
            const label = labels.get(version.languageGroup)!;
            version.languageName = label.native;
            version.languageSearch = `${version.languageTag} ${label.english}`;
        }
        return versions.sort((a, b) => a.languageName.localeCompare(b.languageName) || a.title.localeCompare(b.title));
    }

    static async fetchVersionDetail(bibleId: number): Promise<BibleVersionDetail | null> {
        try {
            return await this.details.get(String(bibleId), async () => {
                const response = await this.request(`/bibles/${bibleId}`);
                if (!response.ok) throw new Error("Could not load translation details.");
                const value = await response.json();
                if (Number(value.id) !== bibleId || typeof value.abbreviation !== "string" ||
                    (typeof value.localized_title !== "string" && typeof value.title !== "string")) throw new Error("Invalid translation details.");
                const languageTag = value.language_tag || value.language?.iso_639_1;
                if (typeof languageTag !== "string" || !languageTag.trim()) throw new Error("Translation language is missing.");
                return { id: Number(value.id), abbreviation: value.abbreviation, title: value.localized_title || value.title || "",
                    languageTag, copyright: value.copyright ?? "" };
            });
        } catch { return null; }
    }

    static async fetchBookTitles(bibleId: number): Promise<Map<string, string>> {
        try {
            return await this.titles.get(String(bibleId), async () => {
                const storageKey = `bibleApiCache:bookTitles:${bibleId}`;
                try {
                    const stored = JSON.parse(localStorage.getItem(storageKey) ?? "null");
                    if (stored?.expires > Date.now() && Array.isArray(stored.entries) && stored.entries.every((entry: unknown) =>
                        Array.isArray(entry) && entry.length === 2 && entry.every(value => typeof value === "string"))) return new Map<string, string>(stored.entries);
                } catch { /* Network and session cache remain available without storage. */ }
                const response = await this.request(`/bibles/${bibleId}/books`);
                if (!response.ok) throw new Error("Could not load book names.");
                const data = await response.json();
                const titles = new Map<string, string>();
                for (const book of data.data ?? []) if (book.id && book.title) titles.set(book.id, book.title);
                try { localStorage.setItem(storageKey, JSON.stringify({ expires: Date.now() + 86400000, entries: [...titles] })); } catch { /* Use session cache. */ }
                return titles;
            });
        } catch { return new Map(); }
    }

    static async fetchChapterHtml(bibleId: number, usfm: string): Promise<{ ok: boolean; html: string; error: string; unavailable?: boolean; reference?: string }> {
        try {
            return await this.chapters.get(`${bibleId}:${usfm}`, async () => {
                const response = await this.request(`/bibles/${bibleId}/passages/${encodeURIComponent(usfm)}?format=html&include_headings=false`);
                if (response.status === 404 || response.status === 403) throw new Error("unavailable");
                if (response.status === 204) throw new Error("empty");
                if (!response.ok) throw new Error(response.status === 429 ? "rate-limit" : `HTTP ${response.status}`);
                const data = await response.json();
                if (!data.content?.trim()) throw new Error("empty");
                return { ok: true, html: data.content, error: "", reference: typeof data.reference === "string" ? data.reference : undefined };
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "";
            if (message === "unavailable") return { ok: false, html: "", unavailable: true, error: "This passage is not available in the selected translation. Try another passage or translation." };
            if (message === "empty") return { ok: false, html: "", error: "No content is available for this passage and translation." };
            if (error instanceof Error && error.name === "TimeoutError") return { ok: false, html: "", error: "The passage took too long to load. Please retry." };
            return { ok: false, html: "", error: message === "rate-limit" ? "The Bible service is busy. Wait a moment and retry." : "Could not load the passage. Check your connection and retry." };
        }
    }
}

export default YouVersionAPI;
