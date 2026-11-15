import { useStableLoadingHeight } from "./useStableLoadingHeight";
import LoadingSkeleton from "../../components/LoadingSkeleton";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PassagePicker from "../../components/PassagePicker";
import TranslationPicker from "./TranslationPicker";
import { useBibleMetadata } from "./useBibleMetadata";
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
    loadingHeight?: number;
};

/** A chapter in the Bible lookup reader. Layout passage widgets have a separate lifecycle. */
export default function BibleChapter({ id, references, reader }: { id: string; references: string[]; reader: ReaderControls }) {
    const { index, version } = reader;
    const reference = references[index] ?? "";
    const passageKey = `${index}|${version}`;
    const section = useRef<HTMLElement>(null);
    const stopPlayer = useRef<(() => void) | null>(null);
    const [trigger, setTrigger] = useState<HTMLDivElement | null>(null);
    const [content, setContent] = useState<{ key: string; html: string; error: string; reference?: string }>({ key: "", html: "", error: "" });
    const [attempt, setAttempt] = useState(0);
    const [versionError, setVersionError] = useState("");
    const metadata = useBibleMetadata(version);
    const html = content.key === passageKey ? content.html : "";
    const error = (!version ? versionError : "") || (content.key === passageKey ? content.error : "");
    const ready = !!html;
    const loadingHeight = useStableLoadingHeight(section, !html && !error, reader.loadingHeight);
    const chooseInitialVersion = useEffectEvent((next: number) => { if (!reader.version) reader.onVersion(next); });
    useEffect(() => {
        if (version) return;
        let cancelled = false;
        const saved = YouVersionAPI.readSavedVersion("defaultBibleVersion");
        const request = saved ? Promise.resolve(saved) : YouVersionAPI.fetchDefaultVersion();
        request.then(next => { if (!cancelled) { setVersionError(""); chooseInitialVersion(next); } })
            .catch(() => { if (!cancelled) setVersionError("Could not load a default translation. Please retry."); });
        return () => { cancelled = true; };
    }, [version, attempt]);

    useEffect(() => {
        if (!version || !reference) return;
        let cancelled = false;
        const usfm = YouVersionAPI.referenceToUsfm(reference);
        async function load() {
            if (!version) return;
            if (!usfm) {
                setContent({ key: passageKey, html: "", error: "This book is not available in the selected translation. Try another passage or translation." });
                return;
            }
            const result = await YouVersionAPI.fetchChapterHtml(version, usfm);
            if (!cancelled) setContent({ key: passageKey, html: result.html, error: result.error, reference: result.reference });
        }
        void load();
        return () => { cancelled = true; };
    }, [version, reference, passageKey, attempt]);

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
        const title = code ? metadata.titles?.get(code) : null;
        if (value === reference && content.key === passageKey && content.reference) return content.reference;
        return title ? `${title} ${value.match(/\d+$/)?.[0] ?? ""}` : value;
    }
    const { bodyRef, ...swipeHandlers } = useBibleChapterSwipe({
        index, count: references.length, enabled: !!html || !!error, direction: reader.swipeDirection ?? 0,
        onNavigate: reader.onSwipe,
    });
    const commentary = commentaryUrl(reference);
    const header = <div className="passage-header integrated-passage-header">
        <PassagePicker references={references} value={index} onChange={reader.onNavigate} formatReference={label} onOpen={metadata.loadBookNames} />
        <TranslationPicker value={version} detail={metadata.detail} onChange={next => {
            stopPlayer.current?.();
            reader.onVersion(next);
            localStorage.setItem("defaultBibleVersion", String(next));
        }} />
        <div className="integrated-player-trigger" ref={setTrigger}>
            {(!html || !metadata.detail) && <button type="button" className="player-icon-button" aria-label="Read aloud unavailable while passage loads" disabled>
                <span className="material-icons" aria-hidden="true">volume_up</span>
            </button>}
        </div>
    </div>;
    return <section ref={section} className={`swipe-passage${loadingHeight !== undefined ? " passage-loading-fixed" : ""}`} style={{ height: loadingHeight }} data-reader-ready={ready} data-loaded-passage={content.key} {...swipeHandlers}>
        {reader.headerActive && reader.headerContainer && createPortal(header, reader.headerContainer)}
        <div ref={bodyRef} className="passage-body" aria-busy={!html && !error}>
            <h2 className="bible-chapter-title">{label(reference)}</h2>
            {error ? <div className="passage-error" role="alert"><p>{error}</p><button type="button" onClick={() => { setContent({ key: "", html: "", error: "" }); setVersionError(""); setAttempt(previous => previous + 1); }}>Retry</button></div> : html && metadata.detail ? <SpeechPassage
                key={passageKey} id={id} html={html} language={metadata.detail?.languageTag || "en"}
                passageKey={`${reference}|${version}`} playerContainer={reader.playerContainer} playerActive={reader.playerActive}
                playerLabel={label(reference)} onPlayerOpen={reader.onPlayerOpen} onPlaybackStart={reader.onPlayerOpen}
                playerTriggerContainer={trigger} stopPlayerRef={stopPlayer}
                initialOpen={reader.resume?.open} autoPlay={reader.resume?.playing} autoPlayGeneration={reader.resume?.generation}
                onContinueChapter={async (isCurrent, generation) => {
                    if (!isCurrent() || index + 1 >= references.length) return false;
                    reader.onContinue(index + 1, generation);
                    return true;
                }} /> : html ? <div className="speech-integrated-text" dangerouslySetInnerHTML={{ __html: html }} /> : <LoadingSkeleton label="Loading chapter…" fill={loadingHeight !== undefined} />}
            {!error && metadata.failed && <p className="passage-error" role="status">Translation details could not be loaded. Read aloud is unavailable until they load. <button type="button" onClick={metadata.retry}>Retry details</button></p>}
        </div>
        {metadata.detail?.copyright && <div className="passage-copyright">{metadata.detail.copyright}</div>}
        {commentary && <div className="passage-commentary"><a href={commentary} target="_blank" rel="noopener noreferrer">
            Matthew Henry commentary — {label(reference)} (opens in a new tab)
        </a></div>}
    </section>;
}
