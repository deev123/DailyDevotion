import { BibleHistoryDialog, BibleSettingsDialog } from "./BibleReaderDialogs";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PlayerState } from "../speech/SpeechPassage";
import BibleChapter from "./BibleChapter";
import { BIBLE_STORAGE_KEY, parseBibleState, updateHistory, type ReadingPosition } from "./readingHistory";

// The API's original verse wrappers survive the integrated speech markup.
const verseSelector = "[data-usfm], [data-verse], .yv-v, .verse";
function verseNumber(element: HTMLElement): string | null {
    const usfm = element.getAttribute("data-usfm");
    const label = element.getAttribute("data-verse") ?? element.getAttribute("v") ?? (usfm ? usfm.split(".")[2] : null)
        ?? element.querySelector(".yv-vlbl, .label, .verse-number")?.textContent?.trim()
        ?? (element.nextElementSibling?.matches(".yv-vlbl") ? element.nextElementSibling.textContent?.trim() : null);
    return label && /^\d+(-\d+)?$/.test(label) ? label : null;
}

export default function BibleReader({ active }: { active: boolean }) {
    const [initial] = useState(() => parseBibleState(localStorage.getItem(BIBLE_STORAGE_KEY)));
    const state = useRef(initial);
    const [start, setStart] = useState(initial.current.index);
    const [currentIndex, setCurrentIndex] = useState(initial.current.index);
    const [playerContainer, setPlayerContainer] = useState<HTMLDivElement | null>(null);
    const [playerIndex, setPlayerIndex] = useState<number | null>(null);
    const [headerContainer, setHeaderContainer] = useState<HTMLDivElement | null>(null);
    const [end, setEnd] = useState(initial.current.index);
    const [swipeDirection, setSwipeDirection] = useState(0);
    const [resume, setResume] = useState<PlayerState>({ open: false, playing: false });
    const [restorationCycle, setRestorationCycle] = useState(0);
    const [loadedStart, setLoadedStart] = useState(-1);
    const [loadedEnd, setLoadedEnd] = useState(-1);
    const [version, setVersion] = useState(initial.current.version);
    const [infinite, setInfinite] = useState(initial.infinite);
    const [references, setReferences] = useState<string[]>([]);
    const [history, setHistory] = useState(initial.history);
    const root = useRef<HTMLDivElement>(null);
    const sentinel = useRef<HTMLDivElement>(null);
    const previousSentinel = useRef<HTMLDivElement>(null);
    const prependAnchor = useRef<{ index: number; top: number } | null>(null);
    const settingsDialog = useRef<HTMLDialogElement>(null);
    const historyDialog = useRef<HTMLDialogElement>(null);
    const pending = useRef<ReadingPosition | null>(initial.current);
    const activeRef = useRef(active);
    const canCapture = useRef(false);
    const restoreFrame = useRef<number | null>(null);
    const loading = useRef(false);
    const [listError, setListError] = useState(false);

    const persist = useCallback(() => {
        localStorage.setItem(BIBLE_STORAGE_KEY, JSON.stringify(state.current));
    }, []);

    useEffect(() => {
        let cancelled = false;
        fetch(import.meta.env.BASE_URL + "Bible_Chapters.txt").then(response => {
            if (!response.ok) throw new Error("Chapter list unavailable");
            return response.text();
        }).then(text => {
            if (!cancelled) setReferences(text.split(/\r?\n/).map(line => line.trim()).filter(Boolean));
        }).catch(() => { if (!cancelled) setListError(true); });
        return () => { cancelled = true; };
    }, []);

    const restore = useCallback(() => {
        if (restoreFrame.current !== null) cancelAnimationFrame(restoreFrame.current);
        restoreFrame.current = null;
        if (!activeRef.current || document.fonts?.status === "loading" || document.querySelector?.("dialog:modal")) return;
        const position = pending.current ?? (canCapture.current ? null : state.current.current);
        if (!position) return;
        const findTarget = () => {
            const chapter = root.current?.querySelector<HTMLElement>(`[data-chapter-index="${position.index}"] [data-reader-ready="true"][data-loaded-passage="${position.index}|${position.version}"]`);
            if (!chapter) return null;
            return Array.from(chapter.querySelectorAll<HTMLElement>(verseSelector)).find(el => verseNumber(el) === position.verse) ?? chapter;
        };
        const target = findTarget();
        if (!target) return;
        window.scrollBy({ top: target.getBoundingClientRect().top - position.offset, behavior: "instant" });
        // Keep the saved anchor protected across the next paint. Layout scroll
        // events must never turn a partially restored page into a new position.
        restoreFrame.current = requestAnimationFrame(() => {
            restoreFrame.current = requestAnimationFrame(() => {
                restoreFrame.current = null;
                if ((pending.current && pending.current !== position) || !activeRef.current || canCapture.current) return;
                if (document.fonts?.status === "loading" || document.querySelector?.("dialog:modal")) return;
                // Speech highlighting or player setup may replace the verse DOM
                // between frames. Always measure the current node, not a detached one.
                const currentTarget = findTarget();
                if (!currentTarget) return;
                window.scrollBy({ top: currentTarget.getBoundingClientRect().top - position.offset, behavior: "instant" });
                if (pending.current === position) {
                    pending.current = null;
                    setRestorationCycle(previous => previous + 1);
                }
            });
        });
    }, []);

    useLayoutEffect(() => {
        activeRef.current = active;
        canCapture.current = false;
        pending.current = { ...state.current.current };
        if (active) restore();
        return () => {
            if (restoreFrame.current !== null) cancelAnimationFrame(restoreFrame.current);
            restoreFrame.current = null;
        };
    }, [active, restore]);

    useEffect(() => {
        if (!active || !root.current) return;
        const observer = new ResizeObserver(restore);
        observer.observe(root.current);
        // Translation names, copyright and web fonts may arrive after the text.
        document.fonts?.ready.then(() => { if (activeRef.current) restore(); });
        document.fonts?.addEventListener("loadingdone", restore);
        return () => {
            observer.disconnect();
            document.fonts?.removeEventListener("loadingdone", restore);
        };
    }, [active, restore]);

    useEffect(() => {
        if (!active) return;
        const observer = new MutationObserver(() => {
            if (document.querySelector("dialog:modal")) {
                canCapture.current = false;
                return;
            }
            // A chapter can finish loading while a popup is open. Restore and
            // resume nearby-chapter loading only after the popup is dismissed.
            if (!canCapture.current) {
                pending.current ??= { ...state.current.current };
                restore();
            }
            setRestorationCycle(previous => previous + 1);
        });
        observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] });
        return () => observer.disconnect();
    }, [active, restore]);

    useEffect(() => {
        if (!active) return;
        let timer: number | undefined;
        function capture() {
            if (!activeRef.current || !canCapture.current || pending.current || !root.current || document.querySelector("dialog:modal")) return;
            const saved = state.current.current;
            const savedChapter = root.current.querySelector<HTMLElement>(`[data-chapter-index="${saved.index}"] [data-reader-ready="true"]`);
            const savedVerse = savedChapter && Array.from(savedChapter.querySelectorAll<HTMLElement>(verseSelector)).find(el => verseNumber(el) === saved.verse);
            // The header hiding or showing can change which verse is below it
            // without moving the text. Retain the same anchor in that case.
            if (savedVerse && Math.abs(savedVerse.getBoundingClientRect().top - saved.offset) < 1) return;
            const chapters = Array.from(root.current.querySelectorAll<HTMLElement>("[data-chapter-index]"));
            const readingLine = (root.current.querySelector(".bible-sticky-header")?.getBoundingClientRect().bottom ?? 100) + 16;
            const chapter = chapters.find(el => (el.querySelector(".speech-integrated-text") ?? el).getBoundingClientRect().bottom > readingLine);
            if (!chapter) return;
            setCurrentIndex(Number(chapter.dataset.chapterIndex));
            if (!chapter.querySelector('[data-reader-ready="true"] .speech-integrated-text')) return;
            const verses = Array.from(chapter.querySelectorAll<HTMLElement>(verseSelector)).filter(el => verseNumber(el));
            const visible = verses.find(el => el.getBoundingClientRect().bottom > readingLine);
            const position: ReadingPosition = {
                index: Number(chapter.dataset.chapterIndex), verse: visible ? verseNumber(visible)! : "1",
                offset: (visible ?? chapter).getBoundingClientRect().top, version: state.current.current.version,
            };
            state.current.current = position;
            state.current.history = updateHistory(state.current.history, position, false);
            persist();
        }
        function beginUserScroll(event: Event) {
            if (document.querySelector("dialog:modal")) return;
            if ((event.target as Element)?.closest?.("dialog")) return;
            // Clicking a toolbar button does not mean the reading position moved.
            if (event instanceof PointerEvent && event.clientX < document.documentElement.clientWidth) return;
            if (event instanceof KeyboardEvent && (event.target as HTMLElement)?.closest?.("button, input, textarea, select, a, dialog")) return;
            if (event instanceof KeyboardEvent && !["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) return;
            if (pending.current) {
                const position = pending.current;
                if (!root.current?.querySelector(`[data-chapter-index="${position.index}"] [data-reader-ready="true"][data-loaded-passage="${position.index}|${position.version}"]`)) return;
                pending.current = null;
                if (restoreFrame.current !== null) cancelAnimationFrame(restoreFrame.current);
                restoreFrame.current = null;
            }
            canCapture.current = true;
        }
        function onScroll() {
            if (!canCapture.current || pending.current) return;
            window.clearTimeout(timer);
            timer = window.setTimeout(capture, 120);
        }
        window.addEventListener("wheel", beginUserScroll, { passive: true });
        window.addEventListener("touchmove", beginUserScroll, { passive: true });
        window.addEventListener("keydown", beginUserScroll);
        window.addEventListener("pointerdown", beginUserScroll, { passive: true });
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("pagehide", capture);
        window.addEventListener("reading-position-save", capture);
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener("wheel", beginUserScroll);
            window.removeEventListener("touchmove", beginUserScroll);
            window.removeEventListener("keydown", beginUserScroll);
            window.removeEventListener("pointerdown", beginUserScroll);
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("pagehide", capture);
            window.removeEventListener("reading-position-save", capture);
        };
    }, [active, persist]);

    function navigate(position: ReadingPosition, newVisit = true) {
        window.dispatchEvent(new Event("reading-position-save"));
        setResume({ open: false, playing: false });
        setPlayerIndex(null);
        setSwipeDirection(0);
        canCapture.current = false;
        pending.current = position;
        state.current.current = position;
        state.current.history = updateHistory(state.current.history, position, newVisit);
        setHistory(state.current.history);
        setCurrentIndex(position.index);
        setStart(position.index);
        setEnd(position.index);
        setVersion(position.version);
        loading.current = false;
        prependAnchor.current = null;
        persist();
        requestAnimationFrame(restore);
    }

    function changeVersion(next: number) {
        if (state.current.current.version === next) return;
        setResume({ open: false, playing: false });
        setPlayerIndex(null);
        window.dispatchEvent(new Event("reading-position-save"));
        state.current.current = { ...state.current.current, version: next };
        canCapture.current = false;
        pending.current = { ...state.current.current };
        state.current.history = updateHistory(state.current.history, state.current.current, false);
        setVersion(next);
        persist();
    }

    const ready = useCallback(() => {
        loading.current = false;
        requestAnimationFrame(restore);
    }, [restore]);

    useEffect(() => {
        if (!active || !infinite || !sentinel.current || end >= references.length - 1) return;
        const observer = new IntersectionObserver(entries => {
            if (!entries[0].isIntersecting || loading.current || pending.current || loadedEnd !== end || document.querySelector("dialog:modal")) return;
            if (!root.current?.querySelector(`[data-chapter-index="${end}"] .speech-integrated-text`)) return;
            loading.current = true;
            setEnd(previous => Math.min(previous + 1, references.length - 1));
        }, { rootMargin: "0px 0px 500px 0px" });
        observer.observe(sentinel.current);
        return () => observer.disconnect();
    }, [active, infinite, end, references.length, loadedEnd, restorationCycle]);

    // Preserve the visible text when inserting a chapter above it, including
    // the later height change when the fetched chapter replaces its placeholder.
    useLayoutEffect(() => {
        const saved = prependAnchor.current;
        if (!saved || saved.index !== start + 1) return;
        const anchor = root.current?.querySelector<HTMLElement>(`[data-chapter-index="${saved.index}"]`);
        const inserted = root.current?.querySelector<HTMLElement>(`[data-chapter-index="${start}"]`);
        if (!anchor || !inserted) return;
        prependAnchor.current = null;
        window.scrollBy({ top: anchor.getBoundingClientRect().top - saved.top, behavior: "instant" });
        let anchorDocumentTop = anchor.getBoundingClientRect().top + window.scrollY;
        const observer = new ResizeObserver(() => {
            const nextAnchorTop = anchor.getBoundingClientRect().top + window.scrollY;
            if (activeRef.current && !document.querySelector?.("dialog:modal")) {
                window.scrollBy({ top: nextAnchorTop - anchorDocumentTop, behavior: "instant" });
            }
            anchorDocumentTop = nextAnchorTop;
            // Once the new text is in place, ordinary changes in that chapter
            // (such as opening its speech player) should scroll normally.
            if (inserted.querySelector(".speech-integrated-text, .passage-error")) observer.disconnect();
        });
        observer.observe(inserted);
        return () => observer.disconnect();
    }, [start]);

    const loadPrevious = useCallback(() => {
        if (start <= 0 || loading.current || pending.current || loadedStart !== start || document.querySelector("dialog:modal")) return;
        const chapter = root.current?.querySelector<HTMLElement>(`[data-chapter-index="${start}"]`);
        if (!chapter?.querySelector(".speech-integrated-text")) return;
        prependAnchor.current = { index: start, top: chapter.getBoundingClientRect().top };
        loading.current = true;
        setStart(previous => previous - 1);
    }, [start, loadedStart]);

    useEffect(() => {
        if (!active || !infinite || start <= 0 || !previousSentinel.current) return;
        const observer = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting) loadPrevious();
        }, { rootMargin: "500px 0px 0px 0px" });
        observer.observe(previousSentinel.current);
        return () => observer.disconnect();
    }, [active, infinite, start, loadPrevious, restorationCycle]);

    return <div className="bible-reader" ref={root}>
        <div className="bible-sticky-header">
        <div className="bible-passage-controls" role="group" aria-label="Bible reading controls">
            <button type="button" className="player-icon-button bible-header-icon" aria-label="Reading history" title="Reading history" onClick={() => {
                window.dispatchEvent(new Event("reading-position-save"));
                setHistory(state.current.history);
                historyDialog.current?.showModal();
            }}><span className="material-icons" aria-hidden="true">history</span></button>
            <div className="bible-header-passage" ref={setHeaderContainer} />
            <button type="button" className="player-icon-button bible-header-icon" aria-label="Bible settings" title="Bible settings"
                aria-haspopup="dialog" onClick={() => { window.dispatchEvent(new Event("reading-position-save")); settingsDialog.current?.showModal(); }}>
                <span className="material-icons" aria-hidden="true">settings</span>
            </button>
        </div>
        <div className="bible-audio-controls" ref={setPlayerContainer} />
        </div>
        <div ref={previousSentinel} className="bible-load-previous">
            {infinite && start > 0 && <button type="button" onClick={loadPrevious}>Load previous chapter</button>}
        </div>
        {listError && <p role="alert">Could not load the chapter list. Reload to try again.</p>}
        {Array.from({ length: end - start + 1 }, (_, offset) => start + offset).map(index =>
            <div className="bible-chapter" data-chapter-index={index} key={index}>
                <BibleChapter id={`lookupBible_${index}`} references={references}
                    reader={{ index, version, onVersion: changeVersion, playerContainer, playerActive: playerIndex === index, onPlayerOpen: () => setPlayerIndex(index), headerContainer, headerActive: index === currentIndex, rangeEdge: `${start}:${end}`,
                        swipeDirection: index === start ? swipeDirection : 0,
                        onSwipe: next => {
                            navigate({ index: next, verse: "1", offset: 130, version: state.current.current.version }, false);
                            setSwipeDirection(next > index ? 1 : -1);
                        }, onReady: () => {
                        if (index === start) setLoadedStart(index);
                        if (index === end) setLoadedEnd(index);
                        if (index === start || index === end) ready(); else restore();
                    }, resume: index === start ? resume : undefined,
                        onContinue: (next, generation) => {
                            navigate({ index: next, verse: "1", offset: 130, version: state.current.current.version }, false);
                            setResume({ open: true, playing: true, generation });
                            setPlayerIndex(next);
                        },
                        onNavigate: next => navigate({ index: next, verse: "1", offset: 130, version: state.current.current.version }) }} />
            </div>
        )}
        <div ref={sentinel} className="bible-load-more">
            {end < references.length - 1 ? <button type="button" onClick={() => {
                if (infinite) setEnd(end + 1);
                else navigate({ index: end + 1, verse: "1", offset: 130, version });
            }}>{infinite ? "Load next chapter" : "Next chapter"}</button> : references.length > 0 ? <p>End of the Bible</p> : null}
            {start > 0 && !infinite && <button type="button" onClick={() => navigate({ index: start - 1, verse: "1", offset: 130, version })}>Previous chapter</button>}
        </div>
        <BibleSettingsDialog dialogRef={settingsDialog} infinite={infinite} onInfiniteChange={enabled => {
            window.dispatchEvent(new Event("reading-position-save"));
            setInfinite(enabled);
            state.current.infinite = enabled;
            if (!enabled) navigate(state.current.current, false);
            persist();
        }} />
        <BibleHistoryDialog dialogRef={historyDialog} history={history} references={references} onSelect={position => { canCapture.current = false; navigate(position); }} />
    </div>;
}
