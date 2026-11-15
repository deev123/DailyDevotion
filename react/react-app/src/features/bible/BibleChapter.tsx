import { useEffect, useEffectEvent, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PassagePicker from "../../components/PassagePicker";
import ListPicker from "../../components/ListPicker";
import SpeechPassage, { type PlayerState } from "../speech/SpeechPassage";
import YouVersionAPI from "./YouVersionAPI";
import { commentaryUrl } from "./bibleReference";
import { useBibleChapterSwipe } from "./useBibleChapterSwipe";

type ReaderControls = {
    index: number;
    version: number | null;
    onNavigate: (index: number) => void;
    onVersion: (version: number) => void;
    onReady: () => void;
    onContinue: (index: number, generation: number) => void;
    onSwipe: (index: number) => void;
    swipeDirection?: number;
    resume?: PlayerState;
    playerContainer: HTMLElement | null;
    playerActive: boolean;
    onPlayerOpen: () => void;
    headerContainer: HTMLElement | null;
    headerActive: boolean;
    rangeEdge: string;
};

/** A chapter in the Bible lookup reader. Layout passage widgets have a separate lifecycle. */
export default function BibleChapter({ id, references, reader }: { id: string; references: string[]; reader: ReaderControls }) {
    const { index, version } = reader;
    const reference = references[index] ?? "";
    const passageKey = `${index}|${version}`;
    const section = useRef<HTMLElement>(null);
    const stopPlayer = useRef<(() => void) | null>(null);
    const [trigger, setTrigger] = useState<HTMLDivElement | null>(null);
    const [versions, setVersions] = useState<Awaited<ReturnType<typeof YouVersionAPI.fetchVersions>>>([]);
    const [content, setContent] = useState({ key: "", html: "", error: "" });
    const [metadata, setMetadata] = useState({ version: 0, copyright: "", titles: new Map<string, string>() });
    const html = content.key === passageKey ? content.html : "";
    const error = content.key === passageKey ? content.error : "";
    const ready = !!html && metadata.version === version;
    const chooseInitialVersion = useEffectEvent((available: typeof versions) => {
        if (reader.version || !available.length) return;
        const preferred = Number(localStorage.getItem("defaultBibleVersion"));
        const fallback = available.find(v => v.id === preferred) ?? available.find(v => v.abbreviation.toUpperCase() === "BSB")
            ?? available.find(v => v.languageTag === "en") ?? available[0];
        reader.onVersion(fallback.id);
    });
    useEffect(() => {
        let cancelled = false;
        YouVersionAPI.fetchVersions().then(available => {
            if (cancelled) return;
            setVersions(available);
            chooseInitialVersion(available);
        });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (!version) return;
        let cancelled = false;
        Promise.all([YouVersionAPI.fetchVersionDetail(version), YouVersionAPI.fetchBookTitles(version)]).then(([detail, titles]) => {
            if (!cancelled) setMetadata({ version, copyright: detail?.copyright ?? "", titles });
        });
        return () => { cancelled = true; };
    }, [version]);

    useEffect(() => {
        if (!version || !reference || !versions.length) return;
        let cancelled = false;
        const usfm = YouVersionAPI.referenceToUsfm(reference);
        const books = versions.find(v => v.id === version)?.books;
        async function load() {
            if (!version) return;
            if (!usfm || (books && !books.includes(usfm.split(".")[0]))) {
                setContent({ key: passageKey, html: "", error: "This book is not available in the selected translation. Try another passage or translation." });
                return;
            }
            const result = await YouVersionAPI.fetchChapterHtml(version, usfm);
            if (!cancelled) setContent({ key: passageKey, html: result.html, error: result.error });
        }
        void load();
        return () => { cancelled = true; };
    }, [version, reference, passageKey, versions]);

    useEffect(() => {
        if (!reader.headerContainer || !section.current) return;
        const header = reader.headerContainer;
        const element = section.current;
        const update = () => element.style.setProperty("--passage-header-height", `${header.offsetHeight}px`);
        const observer = new ResizeObserver(update);
        update(); observer.observe(header);
        return () => observer.disconnect();
    }, [reader.headerContainer]);

    const notifyReady = useEffectEvent(() => reader.onReady());
    useEffect(() => {
        if (ready || error) notifyReady();
    }, [ready, error, reader.rangeEdge]);

    function label(value: string) {
        const code = YouVersionAPI.referenceToUsfm(value)?.split(".")[0];
        const title = metadata.version === version && code ? metadata.titles.get(code) : null;
        return title ? `${title} ${value.match(/\d+$/)?.[0] ?? ""}` : value;
    }
    const { bodyRef, ...swipeHandlers } = useBibleChapterSwipe({
        index, count: references.length, enabled: !!html || !!error, direction: reader.swipeDirection ?? 0,
        onNavigate: reader.onSwipe,
    });
    const selected = versions.find(v => v.id === version);
    const commentary = commentaryUrl(reference);
    const header = <div className="passage-header integrated-passage-header">
        <PassagePicker references={references} value={index} onChange={reader.onNavigate} formatReference={label} />
        <ListPicker title="Select translation" groupTabs className="integrated-translation-button"
            triggerLabel={selected?.abbreviation ?? "…"} value={version} disabled={!versions.length}
            options={versions.map(v => ({ value: v.id, label: `${v.abbreviation} — ${v.title}`,
                group: v.languageName, groupKey: v.languageGroup, groupSearch: v.languageSearch }))}
            onChange={next => {
                stopPlayer.current?.();
                reader.onVersion(next);
                localStorage.setItem("defaultBibleVersion", String(next));
            }} />
        <div className="integrated-player-trigger" ref={setTrigger}>
            {!html && <button type="button" className="player-icon-button" aria-label="Read aloud unavailable while passage loads" disabled>
                <span className="material-icons" aria-hidden="true">volume_up</span>
            </button>}
        </div>
    </div>;
    return <section ref={section} className="swipe-passage" data-reader-ready={ready} data-loaded-passage={content.key} {...swipeHandlers}>
        {reader.headerActive && reader.headerContainer && createPortal(header, reader.headerContainer)}
        <div ref={bodyRef} className="passage-body">
            <h2 className="bible-chapter-title">{label(reference)}</h2>
            {error ? <p className="passage-error" role="alert">{error}</p> : html ? <SpeechPassage
                key={passageKey} id={id} html={html} language={selected?.languageTag ?? "en"}
                passageKey={`${reference}|${version}`} playerContainer={reader.playerContainer} playerActive={reader.playerActive}
                playerLabel={label(reference)} onPlayerOpen={reader.onPlayerOpen} onPlaybackStart={reader.onPlayerOpen}
                playerTriggerContainer={trigger} stopPlayerRef={stopPlayer}
                initialOpen={reader.resume?.open} autoPlay={reader.resume?.playing} autoPlayGeneration={reader.resume?.generation}
                onContinueChapter={async (isCurrent, generation) => {
                    if (!isCurrent() || index + 1 >= references.length) return false;
                    reader.onContinue(index + 1, generation);
                    return true;
                }} /> : <p role="status">Loading chapter…</p>}
        </div>
        {metadata.version === version && metadata.copyright && <div className="passage-copyright">{metadata.copyright}</div>}
        {commentary && <div className="passage-commentary"><a href={commentary} target="_blank" rel="noopener noreferrer">
            Matthew Henry commentary — {label(reference)} (opens in a new tab)
        </a></div>}
    </section>;
}
