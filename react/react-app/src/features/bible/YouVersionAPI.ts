// YouVersion Platform API wrapper
// docs: https://developers.youversion.com/api/bibles

type BibleVersion = {
    id: number,
    abbreviation: string,
    title: string,
    languageTag: string,
    languageName: string,
    languageGroup: string,
    languageSearch: string,
    books: string[] | null
}

type BibleVersionDetail = {
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

    // cache for the version list so it is only fetched once per session
    static versionsCache: BibleVersion[] | null = null;

    // cache of per-version detail (copyright) keyed by version id
    static versionDetailCache: Map<number, BibleVersionDetail> = new Map();

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

    // The wildcard returns the Bibles available to this app across languages.
    static async fetchVersions(): Promise<BibleVersion[]> {
        if (this.versionsCache) return this.versionsCache;

        try {
            const byId = new Map<number, BibleVersion>();
            // Language metadata supplies endonyms even where the browser's locale data does not.
            const namesPromise = fetch(`${this.BASE_URL}/languages?bibles_available=true&page_size=*&fields[]=id&fields[]=display_names`, {
                headers: { "Accept": "application/json", "X-YVP-App-Key": this.APP_KEY }
            }).then(async response => response.ok && response.status !== 204 ? (await response.json()).data : []).catch(() => []);

            let pageToken = "";
            do {
                const url = `${this.BASE_URL}/bibles?language_ranges[]=*&page_size=99${pageToken ? `&page_token=${encodeURIComponent(pageToken)}` : ""}`;
                const response = await fetch(url, {
                    headers: {
                        "Accept": "application/json",
                        "X-YVP-App-Key": this.APP_KEY
                    }
                });
                if (!response.ok) {
                    throw new Error(`Failed to fetch versions (${response.status})`);
                }
                if (response.status === 204) break;

                const data = await response.json();

                for (const v of data.data as any[]) {
                    const languageTag = v.language_tag ?? v.language?.iso_639_1 ?? "";
                    const parts = languageTag.split("-");
                    const baseLanguage = parts[0].toLowerCase();
                    const script = parts.find((part: string) => /^[a-z]{4}$/i.test(part));
                    const languageGroup = baseLanguage + (script ? `-${script}` : "");
                    byId.set(v.id, {
                        id: v.id,
                        abbreviation: v.abbreviation,
                        title: v.localized_title ?? v.title,
                        languageTag,
                        languageName: languageGroup || "Other",
                        languageGroup: languageGroup || "und",
                        languageSearch: languageTag,
                        books: Array.isArray(v.books) ? v.books.filter((book: unknown): book is string => typeof book === "string") : null
                    });
                }
                pageToken = data.next_page_token || "";
            } while (pageToken);

            const languageData: { id: string; display_names?: Record<string, string> }[] = await namesPromise;
            const names = new Map(languageData.map(item => [item.id.toLowerCase(), item.display_names ?? {}]));
            for (const version of byId.values()) {
                const base = version.languageGroup.split("-")[0];
                const displayNames = names.get(version.languageGroup.toLowerCase()) ?? names.get(base) ?? {};
                let native: string | undefined = displayNames[version.languageGroup] ?? displayNames[base];
                let english = displayNames.en ?? "";
                try {
                    native ||= new Intl.DisplayNames([version.languageGroup], { type: "language" }).of(version.languageGroup);
                    english ||= new Intl.DisplayNames(["en"], { type: "language" }).of(version.languageGroup) ?? "";
                } catch { /* Use the code if no name is available. */ }
                version.languageName = native || english || version.languageGroup;
                version.languageSearch = `${version.languageTag} ${english}`;
            }

            // group by language so optgroups stay together, then sort within each language
            const versions = [...byId.values()].sort((a, b) => {
                const langCmp = a.languageName.localeCompare(b.languageName);
                if (langCmp !== 0) return langCmp;
                return a.title.localeCompare(b.title);
            });
            this.versionsCache = versions;
            return versions;
        }
        catch (err) {
            console.error("YouVersionAPI versions error:", err);
            return [];
        }
    }

    // fetch the detail (including copyright) for a single bible version
    static async fetchVersionDetail(bibleId: number): Promise<BibleVersionDetail | null> {
        if (this.versionDetailCache.has(bibleId)) return this.versionDetailCache.get(bibleId)!;

        try {
            const url = `${this.BASE_URL}/bibles/${bibleId}`;
            const response = await fetch(url, {
                headers: {
                    "Accept": "application/json",
                    "X-YVP-App-Key": this.APP_KEY
                }
            });
            if (!response.ok) throw new Error(`Failed to fetch version detail (${response.status})`);

            const v = await response.json();

            const detail: BibleVersionDetail = {
                id: v.id,
                abbreviation: v.abbreviation,
                title: v.localized_title ?? v.title,
                languageTag: v.language_tag ?? "",
                copyright: v.copyright ?? ""
            };
            this.versionDetailCache.set(bibleId, detail);
            return detail;
        }
        catch (err) {
            console.error("YouVersionAPI version detail error:", err);
            return null;
        }
    }

    // fetch the localized book titles for a bible version
    // returns a map of USFM book code (e.g. "GEN") -> localized title (e.g. "Génesis")
    static async fetchBookTitles(bibleId: number): Promise<Map<string, string>> {
        try {
            const url = `${this.BASE_URL}/bibles/${bibleId}/books?page_size=99`;
            const response = await fetch(url, {
                headers: {
                    "Accept": "application/json",
                    "X-YVP-App-Key": this.APP_KEY
                }
            });
            if (!response.ok) throw new Error(`Failed to fetch books (${response.status})`);

            const data = await response.json();

            const bookMap = new Map<string, string>();
            for (const book of data.data as any[]) {
                if (book.id && book.title) {
                    bookMap.set(book.id, book.title);
                }
            }
            return bookMap;
        }
        catch (err) {
            console.error("YouVersionAPI books error:", err);
            return new Map();
        }
    }

    // fetch a whole chapter as html, e.g. fetchChapterHtml(3034, "GEN.1")
    static async fetchChapterHtml(bibleId: number, usfm: string) {
        try {
            const url = `${this.BASE_URL}/bibles/${bibleId}/passages/${encodeURIComponent(usfm)}?format=html&include_headings=false`;
            const response = await fetch(url, {
                headers: {
                    "Accept": "application/json",
                    "X-YVP-App-Key": this.APP_KEY
                }
            });
            if (response.status === 404) return { ok: false, html: "", unavailable: true, error: "This passage is not available in the selected translation. Try another passage or translation." };
            if (!response.ok) throw new Error(`Failed to fetch passage (${response.status})`);

            // 204 means the passage has no content available for this version
            if (response.status === 204) {
                return { ok: false, html: "", error: "No content available for this passage/version." };
            }

            const data = await response.json();
            return { ok: true, html: data.content ?? "", error: "" };
        }
        catch (err) {
            console.error("YouVersionAPI passage error:", err);
            return { ok: false, html: "", error: "Error fetching passage." };
        }
    }
}

export default YouVersionAPI
