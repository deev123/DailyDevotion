import type { MenuOption } from "../../components/Menu.tsx" // import type important for importing types
import Menu from "../../components/Menu.tsx"
import PassagePicker from "../../components/PassagePicker.tsx"
import ListPicker from "../../components/ListPicker.tsx"
import type { PlayerState } from "../speech/SpeechPassage.tsx"
import SpeechPassage from "../speech/SpeechPassage.tsx"
import { useState, useEffect, useRef } from "react"
import GooeyCheckbox from "../../components/GooeyCheckbox.tsx"
import confetti from "canvas-confetti"
import YouVersionAPI from "./YouVersionAPI.ts"

type PassageProps = {
    layoutOptions: MenuOption[],
    id: string,
    list: string // file name or local store var name
}

function commentaryUrl(reference: string): string | null {
    const match = reference.trim().match(/^(.+?)\s+(\d+)$/);
    if (!match || !YouVersionAPI.referenceToUsfm(reference)) return null;

    const book = match[1] === "Psalm" ? "psalms" : match[1].toLowerCase().replace(/\s+/g, "-");
    const chapter = Number(match[2]);
    if (chapter < 1) return null;
    // Bible Study Tools uses a different chapter filename for this book.
    const filename = book === "song-of-solomon" ? `${book}-${chapter}` : String(chapter);
    return `https://www.biblestudytools.com/commentaries/matthew-henry-complete/${book}/${filename}.html`;
}

// return as an array a list separated by newlines
async function loadList(filePath: string) {
    try {
        // console.log(filePath);
        const response = await fetch(import.meta.env.BASE_URL + filePath);
        // on dev server if file not found it may return index.html
        if (!response.ok) throw new Error("Failed to load file");

        const text = await response.text();
        // Split by line breaks and remove empty lines
        return text
        .split(/\r?\n/)       // works for \n or \r\n
        .map(line => line.trim()) // remove leading/trailing spaces
        .filter(line => line.length > 0); // skip empty lines

    } catch (err) {
        console.error(err);
    }
}


function IntegratedSpeechPassage({ layoutOptions, id, list }: PassageProps){
    const sectionRef = useRef<HTMLElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);
    const scrollPositionRef = useRef<{ index: number; offset: number } | null>(null);
    const playerState = useRef<PlayerState>({ open: false, playing: false });
    const [resumePlayer, setResumePlayer] = useState<PlayerState & { generation?: number }>({ open: false, playing: false });
    function prepareChapterChange() {
        setResumePlayer({ ...playerState.current });
        stopPlayerRef.current?.();
        setHtml("");
    }
    const stopPlayerRef = useRef<(() => void) | null>(null);
    const [playerTriggerContainer, setPlayerTriggerContainer] = useState<HTMLDivElement | null>(null);

    useEffect(() => {
        const header = headerRef.current;
        const section = sectionRef.current;
        if (!header || !section) return;
        const updateHeight = () => section.style.setProperty("--passage-header-height", `${header.offsetHeight}px`);
        updateHeight();
        if (typeof ResizeObserver === "undefined") {
            window.addEventListener("resize", updateHeight);
            return () => window.removeEventListener("resize", updateHeight);
        }
        const observer = new ResizeObserver(updateHeight);
        observer.observe(header);
        return () => observer.disconnect();
    }, []);

    let [index, setIndex] = useState(0);
    // elements of selection. e.g. loaded from Bible_Chapters.txt
    let [listElements, setListElements] = useState<string[]>([]);
    let [html, setHtml] = useState("");
    let [error, setError] = useState("");
    const [unavailablePassages, setUnavailablePassages] = useState<Set<string>>(() => new Set());
    let [checkboxChecked, setCheckboxChecked] = useState(false);

    // bible version selection
    let [versions, setVersions] = useState<{id: number, abbreviation: string, title: string, languageTag: string, languageName: string, languageGroup: string, languageSearch: string, books: string[] | null}[]>([]);
    let [versionId, setVersionId] = useState<number | null>(null);
    // copyright notice for the selected version
    let [copyright, setCopyright] = useState("");
    // localized book titles for the selected version: USFM code -> localized title e.g. GEN -> Génesis
    let [bookTitles, setBookTitles] = useState<Map<string, string>>(new Map());

    function saveIndex(val: number) {
        // A reading position belongs only to the chapter it was saved for.
        // Keep it when the currently selected chapter is chosen again.
        const previous = Number(localStorage.getItem(id + "_index") ?? "0");
        if (previous !== val) localStorage.removeItem(id + "_speechPosition");
        localStorage.setItem(id + "_index", JSON.stringify(val));
    }

    function loadIndex() {
        try {
            // The oldest reader saved its chapter under the bare component ID.
            const saved = localStorage.getItem(id + "_index") ?? localStorage.getItem(id) ?? "0";
            const value: unknown = JSON.parse(saved);
            setIndex(typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0);
        } catch { setIndex(0); }
    }

    function saveVersion(val: number) {
        localStorage.setItem(id + "_version", JSON.stringify(val));
    }

    function next() {
        if (listElements.length <= 1) return;
        const nextIndex = index < listElements.length - 1 ? index + 1 : 0;
        const item = sectionRef.current?.closest(".layout-section");
        scrollPositionRef.current = item ? { index: nextIndex, offset: item.getBoundingClientRect().bottom } : null;
        setError("");
        prepareChapterChange();
        saveIndex(nextIndex);
        setIndex(nextIndex);
    }

    useEffect(() => {
        if (scrollPositionRef.current?.index !== index || (!html && !error)) return;
        const frame = requestAnimationFrame(() => {
            const saved = scrollPositionRef.current;
            const item = sectionRef.current?.closest(".layout-section");
            if (saved?.index !== index || !item) return;
            scrollPositionRef.current = null;
            const delta = item.getBoundingClientRect().bottom - saved.offset;
            window.scrollBy({ top: delta, behavior: "instant" });
        });
        return () => cancelAnimationFrame(frame);
    }, [index, html, error]);

    async function continueToNextChapter(isCurrent: () => boolean, generation: number): Promise<boolean> {
        const nextIndex = index + 1;
        if (!isCurrent() || nextIndex >= listElements.length) return false;
        saveIndex(nextIndex);
        setResumePlayer({ open: true, playing: true, generation });
        setHtml("");
        setIndex(nextIndex);
        return true;
    }

    // produce a localized label for a reading list entry like "1 John 3".
    // resolves the English book name to its localized title in the selected version.
    function localizedLabel(reference: string): string {
        if (bookTitles.size === 0) return reference;

        const match = reference.trim().match(/^(.+?)\s+(\d+)$/);
        if (!match) return reference;

        const usfm = YouVersionAPI.referenceToUsfm(reference);
        if (!usfm) return reference;

        const bookCode = usfm.split(".")[0];
        const chapter = match[2];
        const localized = bookTitles.get(bookCode);
        if (!localized) return reference;

        return `${localized} ${chapter}`;
    }

    // load the list when created
    useEffect(() => {
        async function load() {
            const data = await loadList(list) ?? [];
            setListElements(data);
            if (data.length) setIndex(previous => previous < data.length ? previous : 0);
        }
        load();
    },[]);

    // load index and version from local store when created
    useEffect(() => {
        loadIndex();

        async function loadVersion() {
            const savedVersion = localStorage.getItem(id + "_version");
            let stored = 0;
            try { stored = Number.parseInt(JSON.parse(savedVersion ?? "null")); } catch { /* Use the normal fallback. */ }
            const defaultVersion = Number(localStorage.getItem("defaultBibleVersion"));
            const available = await YouVersionAPI.fetchVersions();
            setVersions(available);

            if (available.length === 0) return;

            // Saved choices take precedence, including those made before the rename.
            if (stored && available.some((v) => v.id === stored)) {
                setVersionId(stored);
            } else {
                // Prefer BSB only for a reader with no saved translation.
                const berean = available.find((v) =>
                    v.abbreviation.toUpperCase() === "BSB" ||
                    v.title.toLowerCase() === "berean standard bible"
                );
                const fallback = (savedVersion === null ? available.find(v => v.id === defaultVersion) ?? berean : undefined) ?? available.find(v => v.languageTag === "en") ?? available[0];
                setVersionId(fallback.id);
                saveVersion(fallback.id);
            }
        }
        loadVersion();
    },[]);

    // load the copyright notice and localized book titles whenever the selected version changes
    useEffect(() => {
        let cancelled = false;
        async function loadVersionData() {
            if (!versionId) return;
            const [detail, titles] = await Promise.all([
                YouVersionAPI.fetchVersionDetail(versionId),
                YouVersionAPI.fetchBookTitles(versionId),
            ]);
            if (cancelled) return;
            setCopyright(detail?.copyright ?? "");
            setBookTitles(titles);
        }
        setCopyright("");
        setBookTitles(new Map());
        loadVersionData();
        return () => { cancelled = true; };
    }, [versionId]);

    // query the chapter html when selection, list or version changes
    useEffect(() => {
        let cancelled = false;
        setHtml("");
        async function loadChapter() {
            if (!listElements[index]) return;
            if (!versionId) return;

            const reference = listElements[index];
            const usfm = YouVersionAPI.referenceToUsfm(reference);
            if (!usfm) {
                console.error(`Could not convert reference to USFM: ${reference}`);
                setHtml("");
                setError("Could not resolve this reading to a Bible reference.");
                return;
            }

            const selectedBooks = versions.find(version => version.id === versionId)?.books;
            if (selectedBooks && !selectedBooks.includes(usfm.split(".")[0])) {
                setError("This book is not available in the selected translation. Try another passage or translation.");
                return;
            }

            setError("");
            const result = await YouVersionAPI.fetchChapterHtml(versionId, usfm);
            if (cancelled) return;
            if (result.unavailable) setUnavailablePassages(previous => new Set(previous).add(`${versionId}:${usfm}`));
            setHtml(result.html);
            setError(result.error);
        }
        loadChapter();
        return () => { cancelled = true; };
    }, [index, listElements, versionId, versions]);

    function onVersionChange(val: number) {
        if (val !== versionId) prepareChapterChange();
        setVersionId(val);
        saveVersion(val);
        localStorage.setItem("defaultBibleVersion", String(val));
    }

    const reference = listElements[index];
    const commentary = reference ? commentaryUrl(reference) : null;

    return (
    <section ref={sectionRef}>
        <div ref={headerRef} className="passage-header integrated-passage-header">
            <PassagePicker
                references={listElements}
                value={index}
                onChange={(nextIndex) => {
                    if (nextIndex !== index) { scrollPositionRef.current = null; prepareChapterChange(); }
                    setIndex(nextIndex);
                    saveIndex(nextIndex);
                }}
                formatReference={localizedLabel}
            />
            {versions.length > 0 &&
                <ListPicker
                    title="Select translation"
                    groupTabs
                    className="integrated-translation-button"
                    triggerLabel={versions.find(version => version.id === versionId)?.abbreviation || "…"}
                    options={versions.map(version => ({
                        value: version.id,
                        label: `${version.abbreviation} — ${version.title}${version.books && reference && YouVersionAPI.referenceToUsfm(reference) && !version.books.includes(YouVersionAPI.referenceToUsfm(reference)!.split(".")[0]) ? " (book unavailable)" : reference && unavailablePassages.has(`${version.id}:${YouVersionAPI.referenceToUsfm(reference)}`) ? " (passage unavailable)" : ""}`,
                        group: version.languageName,
                        groupKey: version.languageGroup,
                        groupSearch: version.languageSearch,
                    }))}
                    value={versionId}
                    onChange={onVersionChange}
                    disabled={versionId === null}
                />
            }
            <div className="integrated-player-trigger" ref={setPlayerTriggerContainer}>
                {(!html || !!error) && <button type="button" className="player-icon-button" aria-label="Read aloud unavailable while passage loads" disabled>
                    <span className="material-icons" aria-hidden="true">volume_up</span>
                </button>}
            </div>
            <div>
                <Menu options={layoutOptions}>
                    <button className="dots-button" aria-label="Passage options">⋮</button>
                </Menu>
            </div>
        </div>
        <div className="passage-body">
            {error ? <p className="passage-error">{error}</p>
             : html ? <SpeechPassage key={`${index}-${versionId}`} html={html} id={id} passageKey={`${reference}|${versionId}`} passageIndex={index} playerTriggerContainer={playerTriggerContainer} stopPlayerRef={stopPlayerRef}
                 initialOpen={resumePlayer.open} autoPlay={resumePlayer.playing} autoPlayGeneration={resumePlayer.generation}
                 onContinueChapter={continueToNextChapter}
                 onPlayerStateChange={state => { playerState.current = state; }}
                 language={versions.find(version => version.id === versionId)?.languageTag || "en"} /> : <p>...</p>}
        </div>
        {copyright &&
            <div className="passage-copyright">{copyright}</div>
        }
        {commentary &&
            <div className="passage-commentary">
                <a href={commentary} target="_blank" rel="noopener noreferrer">
                    Matthew Henry commentary — {localizedLabel(reference)} (opens in a new tab)
                </a>
            </div>
        }
        <div className="passage-footer">
            <GooeyCheckbox
                isChecked={checkboxChecked}
                onChange={async ()=>{
                    setCheckboxChecked(true);
                    confetti({particleCount: 50, spread: 1000, origin: { y: 0.5 }});

                    await new Promise(resolve => setTimeout(resolve, 1000));
                    next();

                    setCheckboxChecked(false);
                }}
            ></GooeyCheckbox>
        </div>
    </section>
    )
}

export default IntegratedSpeechPassage
