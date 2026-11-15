import { useStableLoadingHeight } from "./useStableLoadingHeight";
import LoadingSkeleton from "../../components/LoadingSkeleton";
import { commentaryUrl } from "./bibleReference";
import type { MenuOption } from "../../components/Menu.tsx" // import type important for importing types
import Menu from "../../components/Menu.tsx"
import PassagePicker from "../../components/PassagePicker.tsx"
import TranslationPicker from "./TranslationPicker"
import { useBibleMetadata } from "./useBibleMetadata"
import type { PlayerState } from "../speech/SpeechPassage.tsx"
import SpeechPassage from "../speech/SpeechPassage.tsx"
import { useState, useEffect, useLayoutEffect, useRef } from "react"
import GooeyCheckbox from "../../components/GooeyCheckbox.tsx"
import confetti from "canvas-confetti"
import YouVersionAPI from "./YouVersionAPI.ts"

type PassageProps = {
    layoutOptions: MenuOption[],
    id: string,
    list: string // file name or local store var name
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

    const [index, setIndex] = useState(0);
    // elements of selection. e.g. loaded from Bible_Chapters.txt
    let [listElements, setListElements] = useState<string[]>([]);
    let [html, setHtml] = useState("");
    let [error, setError] = useState("");
    let [checkboxChecked, setCheckboxChecked] = useState(false);

    // A saved translation can be read immediately, without a catalogue request.
    const [versionId, setVersionId] = useState<number | null>(() => YouVersionAPI.readSavedVersion(id + "_version") ?? YouVersionAPI.readSavedVersion("defaultBibleVersion"));
    const [attempt, setAttempt] = useState(0);
    const metadata = useBibleMetadata(versionId);
    const loadingHeight = useStableLoadingHeight(sectionRef, !html && !error);

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

    useLayoutEffect(() => {
        const saved = scrollPositionRef.current;
        if (saved?.index !== index || (!html && !error)) return;
        const item = sectionRef.current?.closest(".layout-section");
        if (!item) return;
        scrollPositionRef.current = null;
        // The loading height is released in this commit. Preserve the previous
        // bottom offset before painting the newly sized passage.
        window.scrollBy({ top: item.getBoundingClientRect().bottom - saved.offset, behavior: "instant" });
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
        if (!metadata.titles?.size) return reference;

        const match = reference.trim().match(/^(.+?)\s+(\d+)$/);
        if (!match) return reference;

        const usfm = YouVersionAPI.referenceToUsfm(reference);
        if (!usfm) return reference;

        const bookCode = usfm.split(".")[0];
        const chapter = match[2];
        const localized = metadata.titles.get(bookCode);
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

    useEffect(() => { loadIndex(); }, []);
    useEffect(() => {
        if (versionId) { saveVersion(versionId); return; }
        let cancelled = false;
        const saved = YouVersionAPI.readSavedVersion(id + "_version") ?? YouVersionAPI.readSavedVersion("defaultBibleVersion");
        const request = saved ? Promise.resolve(saved) : YouVersionAPI.fetchDefaultVersion();
        request.then(next => {
            if (!cancelled) { setVersionId(next); saveVersion(next); }
        }).catch(() => { if (!cancelled) setError("Could not load a default translation. Please retry."); });
        return () => { cancelled = true; };
    }, [versionId, attempt]);

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

            setError("");
            const result = await YouVersionAPI.fetchChapterHtml(versionId, usfm);
            if (cancelled) return;
            setHtml(result.html);
            setError(result.error);
        }
        loadChapter();
        return () => { cancelled = true; };
    }, [index, listElements, versionId, attempt]);

    function onVersionChange(val: number) {
        if (val !== versionId) prepareChapterChange();
        setVersionId(val);
        saveVersion(val);
        localStorage.setItem("defaultBibleVersion", String(val));
    }

    const reference = listElements[index];
    const commentary = reference ? commentaryUrl(reference) : null;

    return (
    <section ref={sectionRef} className={loadingHeight !== undefined ? "passage-loading-fixed" : undefined} style={{ height: loadingHeight }}>
        <div ref={headerRef} className="passage-header integrated-passage-header">
            <PassagePicker
                references={listElements}
                value={index}
                onChange={(nextIndex) => {
                    if (nextIndex !== index) { scrollPositionRef.current = null; prepareChapterChange(); }
                    setIndex(nextIndex);
                    saveIndex(nextIndex);
                }}
                formatReference={localizedLabel} onOpen={metadata.loadBookNames}
            />
            <TranslationPicker value={versionId} detail={metadata.detail} onChange={onVersionChange} />
            <div className="integrated-player-trigger" ref={setPlayerTriggerContainer}>
                {(!html || !!error || !metadata.detail) && <button type="button" className="player-icon-button" aria-label="Read aloud unavailable while passage loads" disabled>
                    <span className="material-icons" aria-hidden="true">volume_up</span>
                </button>}
            </div>
            <div>
                <Menu options={layoutOptions}>
                    <button className="dots-button" aria-label="Passage options">⋮</button>
                </Menu>
            </div>
        </div>
        <div className="passage-body" aria-busy={!html && !error}>
            {error ? <div className="passage-error" role="alert"><p>{error}</p><button type="button" onClick={() => { setError(""); setHtml(""); setAttempt(previous => previous + 1); }}>Retry</button></div>
             : html && metadata.detail ? <SpeechPassage key={`${index}-${versionId}`} html={html} id={id} passageKey={`${reference}|${versionId}`} passageIndex={index} playerTriggerContainer={playerTriggerContainer} stopPlayerRef={stopPlayerRef}
                 initialOpen={resumePlayer.open} autoPlay={resumePlayer.playing} autoPlayGeneration={resumePlayer.generation}
                 onContinueChapter={continueToNextChapter}
                 onPlayerStateChange={state => { playerState.current = state; }}
                 language={metadata.detail?.languageTag || "und"} /> : html ? <div className="speech-integrated-text" dangerouslySetInnerHTML={{ __html: html }} /> : <LoadingSkeleton fill={loadingHeight !== undefined} />}
            {!error && metadata.failed && <p className="passage-error" role="status">Translation details could not be loaded. Read aloud is unavailable until they load. <button type="button" onClick={metadata.retry}>Retry details</button></p>}
        </div>
        {metadata.detail?.copyright &&
            <div className="passage-copyright">{metadata.detail.copyright}</div>
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
