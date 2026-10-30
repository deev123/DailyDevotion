import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
// Include PDF.js compatibility helpers for browsers such as Samsung Internet.
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs"
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist"
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"
import type { PlayerState } from "./SpeechPassage.tsx"
import SpeechPassage from "./SpeechPassage.tsx"
import Menu from "./Menu.tsx"
import type { MenuOption } from "./Menu.tsx"
import { readPdfText } from "./pdfTextReader.ts"
import { loadPdfSections, savePdfSections } from "./pdfSections.ts"
import type { PdfSections } from "./pdfSections.ts"
import { loadPdf, savePdf, savePdfProgress } from "./pdfStorage.ts"

GlobalWorkerOptions.workerSrc = workerUrl;

type PdfReaderProps = { id: string; layoutOptions: MenuOption[] };


function PdfReader({ id, layoutOptions }: PdfReaderProps) {
    const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
    const [name, setName] = useState("");
    const [page, setPage] = useState(1);
    const [pageInput, setPageInput] = useState("1");
    const [width, setWidth] = useState(320);
    const [busy, setBusy] = useState(true);
    const [rendering, setRendering] = useState(false);
    const [error, setError] = useState("");
    const [textPage, setTextPage] = useState<{ pdf: PDFDocumentProxy; page: number; text: string; html: string } | null>(null);
    const [wordIndex, setWordIndex] = useState(0);
    const [speed, setSpeed] = useState(300);
    const [running, setRunning] = useState(false);
    const [rampWords, setRampWords] = useState(0);
    const playerState = useRef<PlayerState>({ open: false, playing: false });
    const [sections, setSections] = useState(() => loadPdfSections(id));
    const sectionsRef = useRef(sections);
    function setSection(section: Exclude<keyof PdfSections, "zoom">, open: boolean) {
        if (sectionsRef.current[section] === open) return;
        const next = { ...sectionsRef.current, [section]: open };
        sectionsRef.current = next;
        setSections(next);
        savePdfSections(id, next);
    }
    function setZoom(zoom: PdfSections["zoom"]) {
        if (sectionsRef.current.zoom === zoom) return;
        const next = { ...sectionsRef.current, zoom };
        sectionsRef.current = next;
        setSections(next);
        savePdfSections(id, next);
    }
    const zoom = sections.zoom;
    const settingsRef = useRef<HTMLDialogElement>(null);
    const runnerDialogRef = useRef<HTMLDialogElement>(null);
    const fullscreenWordRef = useRef<HTMLButtonElement>(null);
    const [fullscreenControls, setFullscreenControls] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [autoPlayPage, setAutoPlayPage] = useState<number | null>(null);
    const runnerOpen = sections.runner;
    const [textContainer, setTextContainer] = useState<HTMLDivElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const stopPlayerRef = useRef<(() => void) | null>(null);
    const [playerTriggerContainer, setPlayerTriggerContainer] = useState<HTMLDivElement | null>(null);
    const textReady = textPage?.pdf === pdf && textPage?.page === page;
    const pageText = textReady ? textPage.text : "";
    const speechHtml = textReady ? textPage.html : "";
    const words = useMemo(() => pageText.match(/\S+/gu) ?? [], [pageText]);
    const currentWord = Math.min(wordIndex, Math.max(0, words.length - 1));
    const currentSpeed = Math.round(Math.min(speed, Math.min(100, speed) + rampWords * 5));
    const viewportRef = useRef<HTMLDivElement>(null);
    const pageRef = useRef<HTMLDivElement>(null);
    const loadingRef = useRef<PDFDocumentLoadingTask | null>(null);
    const mounted = useRef(false);

    async function openFile(file: Blob) {
        const data = await file.arrayBuffer();
        if (!mounted.current) throw new Error("Reader closed.");
        const assets = `${import.meta.env.BASE_URL}pdf-assets/`;
        const task = getDocument({
            data,
            cMapUrl: `${assets}cmaps/`,
            cMapPacked: true,
            standardFontDataUrl: `${assets}standard_fonts/`,
            wasmUrl: `${assets}wasm/`,
            iccUrl: `${assets}iccs/`,
        });
        task.onPassword = () => { void task.destroy(); };
        loadingRef.current = task;
        return task.promise;
    }

    useEffect(() => {
        mounted.current = true;
        let cancelled = false;
        async function restore() {
            try {
                const saved = await loadPdf(id);
                if (cancelled || !saved) return;
                const document = await openFile(saved.file);
                if (cancelled) { void document.loadingTask.destroy(); return; }
                const restoredPage = Math.min(saved.page, document.numPages);
                setWordIndex(saved.word);
                setSpeed(saved.speed);
                setPdf(document);
                setName(saved.name);
                setPage(restoredPage);
                setPageInput(String(restoredPage));
            } catch (error) {
                if (!cancelled) console.error("Could not restore saved PDF:", error);
                if (!cancelled) setError("Could not open the saved PDF. Try choosing the file again.");
            } finally {
                if (!cancelled) setBusy(false);
            }
        }
        void restore();
        return () => {
            cancelled = true;
            mounted.current = false;
            void loadingRef.current?.destroy();
        };
    }, [id]);

    useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;
        const observer = new ResizeObserver(() => setWidth(viewport.clientWidth));
        observer.observe(viewport);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!pdf || !sections.showPage || !sections.page || !pageRef.current || width <= 0) return;
        let cancelled = false;
        let renderTask: ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]> | undefined;
        // Each render gets its own canvas, so quick page changes cannot clash.
        const canvas = document.createElement("canvas");
        setRendering(true);
        pageRef.current.replaceChildren();

        async function renderPage() {
            try {
                const currentPage = await pdf!.getPage(page);
                if (cancelled) return;
                const original = currentPage.getViewport({ scale: 1 });
                const viewport = currentPage.getViewport({ scale: width * zoom / original.width });
                const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
                canvas.width = Math.ceil(viewport.width * pixelRatio);
                canvas.height = Math.ceil(viewport.height * pixelRatio);
                canvas.style.width = `${viewport.width}px`;
                canvas.style.height = `${viewport.height}px`;
                canvas.setAttribute("role", "img");
                canvas.setAttribute("aria-label", `${name}, page ${page}. Read the page text below for a text version.`);
                renderTask = currentPage.render({
                    canvas,
                    viewport,
                    transform: [pixelRatio, 0, 0, pixelRatio, 0, 0],
                });
                await renderTask.promise;
                if (cancelled) return;
                pageRef.current?.replaceChildren(canvas);

            } catch (error) {
                if (!cancelled) {
                    console.error("Could not render PDF page:", error);
                    setError("Could not display this PDF page. Try another page or choose the file again.");
                }
            } finally {
                if (!cancelled) setRendering(false);
            }
        }
        void renderPage();
        return () => {
            cancelled = true;
            renderTask?.cancel();
        };
    }, [pdf, page, width, zoom, name, sections.page, sections.showPage]);

    useEffect(() => {
        if (!pdf) return;
        let cancelled = false;
        void pdf.getPage(page).then(pdfPage => readPdfText(pdfPage, content => {
            if (!cancelled) setTextPage({ pdf, page, ...content });
        })).then((content) => {
            if (!cancelled) setTextPage({ pdf, page, ...content });
        }).catch((error) => {
            if (!cancelled) {
                console.warn("Could not extract PDF page text:", error);
                setTextPage({ pdf, page, text: "", html: "" });
                setRunning(false);
            }
        });
        return () => { cancelled = true; };
    }, [pdf, page]);

    useEffect(() => {
        if (!pdf || busy) return;
        // Save each displayed word, including while playing, so closing the widget
        // does not depend on an unreliable unload handler.
        void savePdfProgress(id, page, textReady ? currentWord : wordIndex, speed).catch(() => {
            if (mounted.current) setError("Your reading position could not be saved. Check that browser storage is available.");
        });
    }, [id, pdf, busy, page, wordIndex, currentWord, textReady, speed]);

    useEffect(() => {
        if (!running || busy || !pdf || !textReady) return;
        const timer = window.setTimeout(() => {
            if (!words.length) {
                setRunning(false);
            } else if (currentWord < words.length - 1) {
                setWordIndex(currentWord + 1);
                setRampWords((count) => count + 1);
            } else if (page < pdf.numPages) {
                setWordIndex(0);
                setPage(page + 1);
                setPageInput(String(page + 1));
                setRampWords((count) => count + 1);
            } else {
                setRunning(false);
            }
        }, 60000 / currentSpeed);
        return () => window.clearTimeout(timer);
    }, [running, busy, pdf, textReady, words.length, currentWord, page, currentSpeed]);

    useEffect(() => {
        const pauseWhenHidden = () => { if (document.hidden) setRunning(false); };
        document.addEventListener("visibilitychange", pauseWhenHidden);
        return () => document.removeEventListener("visibilitychange", pauseWhenHidden);
    }, []);

    async function chooseFile(file: File) {
        setError("");
        if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
            setError("Please choose a PDF file.");
            return;
        }
        setRunning(false);
        setAutoPlayPage(null);
        stopPlayerRef.current?.();
        setBusy(true);
        const previousTask = loadingRef.current;
        let nextDocument: PDFDocumentProxy | undefined;
        try {
            nextDocument = await openFile(file);
            if (!mounted.current) { void nextDocument.loadingTask.destroy(); return; }
            // Only replace the current book once the new PDF can be opened and saved.
            await savePdf(id, file);
            if (!mounted.current) { void nextDocument.loadingTask.destroy(); return; }
            setWordIndex(0);
            setRampWords(0);
            setPdf(nextDocument);
            setName(file.name);
            setPage(1);
            setPageInput("1");
            if (previousTask) void previousTask.destroy();
        } catch (err) {
            if (mounted.current) console.error("Could not open or save PDF:", err);
            if (nextDocument) void nextDocument.loadingTask.destroy();
            loadingRef.current = previousTask;
            if (mounted.current) setError(err instanceof DOMException && err.name === "QuotaExceededError"
                ? "There is not enough browser storage for this PDF. Try a smaller file or remove another PDF reader."
                : "Could not open or save this PDF. Check that it is a valid PDF without a password and that browser storage is allowed.");
        } finally {
            if (mounted.current) setBusy(false);
        }
    }

    async function continueSpeech(isCurrent: () => boolean): Promise<boolean> {
        if (!pdf) return false;
        // Skip blank/image-only pages without queuing empty speech utterances.
        for (let next = page + 1; next <= pdf.numPages; next++) {
            const nextPage = await pdf.getPage(next);
            if (!mounted.current || !isCurrent()) return false;
            const content = await readPdfText(nextPage);
            if (!mounted.current || !isCurrent()) return false;
            const { text } = content;
            if (!/[\p{L}\p{N}]/u.test(text)) continue;
            setWordIndex(0);
            setTextPage({ pdf, page: next, ...content });
            setAutoPlayPage(next);
            setPage(next);
            setPageInput(String(next));
            return true;
        }
        return false;
    }

    function goToPage(value: number) {
        if (!pdf || busy) return;
        const next = Number.isFinite(value) ? Math.min(pdf.numPages, Math.max(1, Math.trunc(value))) : page;
        if (next === page) { setPageInput(String(page)); return; }
        setAutoPlayPage(playerState.current.playing ? next : null);
        stopPlayerRef.current?.();
        setRunning(false);
        setWordIndex(0);
        setPage(next);
        setPageInput(String(next));
        setError("");

    }

    function toggleFullscreenControls() {
        if (fullscreenControls) fullscreenWordRef.current?.focus();
        setFullscreenControls(!fullscreenControls);
    }

    function renderRunnerControls() {
        return (
                    <div className="pdf-runner-controls" role="group" aria-label="Word runner controls">
                        <button type="button" className="pdf-runner-icon-button" disabled={busy || !words.length || currentWord === 0}
                            aria-label="Back 10 words" title="Back 10 words" onClick={() => {
                                setRunning(false);
                                setWordIndex(Math.max(0, currentWord - 10));
                            }}><span className="material-icons" aria-hidden="true">replay_10</span></button>
                        <button type="button" className={`pdf-runner-icon-button pdf-runner-play${running ? " pdf-runner-playing" : ""}`}
                            disabled={busy || !words.length} aria-label={running ? "Pause word runner" : "Play word runner"}
                            title={running ? "Pause" : "Play"} onClick={() => {
                                stopPlayerRef.current?.();
                                setRunning(!running);
                                setRampWords(0);
                            }}><span className="material-icons" aria-hidden="true">{running ? "pause" : "play_arrow"}</span></button>
                        <button type="button" className="pdf-runner-icon-button pdf-runner-restart" disabled={busy || !words.length}
                            aria-label="Restart page" title="Restart page" onClick={() => {
                                setRunning(false);
                                setWordIndex(0);
                            }}>
                            <span className="material-icons" aria-hidden="true">replay</span>
                            <span className="material-icons pdf-runner-page-badge" aria-hidden="true">description</span>
                        </button>
                    </div>
        );
    }

    function renderRunnerSliders() {
        return <>
                    <label className="pdf-runner-slider">Speed: {speed} words/min
                        <input type="range" min="100" max="800" step="25" value={speed}
                            disabled={busy} onChange={(event) => setSpeed(Number(event.target.value))} />
                    </label>
                    <p className="pdf-storage-note">{running ? `Reading at ${currentSpeed} words/min. ` : ""}
                        Starts at 100 words/min and gradually builds to your chosen speed.</p>
                    <label className="pdf-runner-slider">Word position
                        <input type="range" min="0" max={Math.max(0, words.length - 1)} value={currentWord}
                            disabled={busy || !words.length} onChange={(event) => {
                                setRunning(false);
                                setWordIndex(Number(event.target.value));
                            }} />
                    </label>
        </>;
    }

    return (
        <section className="pdf-reader" aria-label={name || "PDF reader"}>
            <div className="passage-header pdf-header">
                <div className="pdf-title-row">
                    <button type="button" className="reading-title-select pdf-title-button" disabled={busy}
                        title={pdf ? `Replace ${name}` : "Choose a PDF"}
                        aria-label={pdf ? `Replace PDF: ${name}` : "Choose a PDF"}
                        onClick={() => fileInputRef.current?.click()}>{name || "Choose a PDF"}</button>
                    <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" hidden disabled={busy} onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) void chooseFile(file);
                    }} />
                    <button type="button" className="speech-icon-button speech-player-toggle" disabled={!pdf || busy}
                        aria-label={runnerOpen ? "Close word runner" : "Open word runner"}
                        title={runnerOpen ? "Close word runner" : "Open word runner"}
                        aria-expanded={runnerOpen} aria-controls={runnerOpen ? `${id}-word-runner` : undefined}
                        onClick={() => {
                            stopPlayerRef.current?.();
                            setSection("runner", !runnerOpen);
                            setRunning(false);
                        }}><span className="material-icons" aria-hidden="true">speed</span></button>
                    <div className="integrated-player-trigger" ref={setPlayerTriggerContainer}>
                        {(!pdf || busy || !textReady) && <button type="button" className="speech-icon-button" disabled aria-label="Read aloud unavailable while PDF loads">
                            <span className="material-icons" aria-hidden="true">volume_up</span>
                        </button>}
                    </div>
                    <button type="button" className="speech-icon-button" aria-label="PDF display settings" title="PDF display settings"
                        aria-haspopup="dialog" aria-expanded={settingsOpen} aria-controls={`${id}-pdf-settings`}
                        onClick={() => { settingsRef.current?.showModal(); setSettingsOpen(true); }}>
                        <span className="material-icons" aria-hidden="true">settings</span>
                    </button>
                    <Menu options={layoutOptions}><button className="dots-button" aria-label="PDF reader options">⋮</button></Menu>
                </div>
                {pdf && <div className="pdf-navigation">
                    <button disabled={busy || page <= 1} onClick={() => goToPage(page - 1)} aria-label="Previous PDF page">
                        <span className="material-icons" aria-hidden="true">chevron_left</span>
                    </button>
                    <form onSubmit={(e) => { e.preventDefault(); goToPage(Number(pageInput)); }}>
                        <label>Page <input type="number" min="1" max={pdf.numPages} value={pageInput}
                            disabled={busy} onChange={(e) => setPageInput(e.target.value)}
                            onBlur={() => goToPage(Number(pageInput))} /></label>
                        <span> / {pdf.numPages}</span>
                    </form>
                    <button disabled={busy || page >= pdf.numPages} onClick={() => goToPage(page + 1)} aria-label="Next PDF page">
                        <span className="material-icons" aria-hidden="true">chevron_right</span>
                    </button>
                </div>}
                {pdf && !busy && textReady && <SpeechPassage key={`${pdf.fingerprints[0]}-${page}`} html={speechHtml}
                    initialOpen={sections.speech} onPlayerStateChange={state => {
                        playerState.current = state;
                        setSection("speech", state.open);
                    }}
                    autoPlay={autoPlayPage === page} onComplete={continueSpeech}
                    id={id} language="en" passageKey={`${pdf.fingerprints[0]}|${page}`} hideText mergeInlineText
                    textContainer={pageText ? textContainer : null}
                    playerTriggerContainer={playerTriggerContainer} stopPlayerRef={stopPlayerRef}
                    onPlaybackStart={() => {
                        setRunning(false);
                        setSection("runner", false);
                        if (sectionsRef.current.showText) setSection("text", true);
                    }}
                    onPlayerOpen={() => { setRunning(false); setSection("runner", false); }} />}
                {pdf && !busy && !textReady && sections.speech && <div className="speech-mini-player" role="status">
                    Loading read aloud…
                </div>}
            </div>
            {pdf && runnerOpen && <div className="pdf-word-runner" id={`${id}-word-runner`}>
                <div className="pdf-runner-panel">
                    <div className="pdf-runner-panel-actions">
                        <button type="button" className="pdf-runner-expand" aria-label="Expand word runner" title="Expand word runner"
                            aria-haspopup="dialog" onClick={() => {
                                setFullscreenControls(false);
                                runnerDialogRef.current?.showModal();
                            }}><span className="material-icons" aria-hidden="true">open_in_full</span></button>
                    </div>
                    <div className="pdf-runner-word" aria-label="Current word">{textReady ? (words[currentWord] || "—") : "…"}</div>
                    <p className="pdf-storage-note">{!textReady ? "Loading words…" : words.length
                        ? `Page ${page} · Word ${currentWord + 1} of ${words.length}`
                        : "No selectable text on this page. Choose another page to continue."}</p>
                    {renderRunnerControls()}
                    {renderRunnerSliders()}
                    {textReady && words.length > 0 && currentWord === words.length - 1 && page === pdf.numPages && !running
                        && <p className="pdf-storage-note">End of book.</p>}
                </div>
            </div>}
            {pdf && runnerOpen && createPortal(<dialog ref={runnerDialogRef}
                className="pdf-word-runner pdf-runner-fullscreen" aria-label="Full-screen word runner"
                onClose={() => setFullscreenControls(false)}>
                <div className="pdf-runner-fullscreen-header" hidden={!fullscreenControls}>
                    <button type="button" className="pdf-runner-icon-button" aria-label="Close full-screen word runner"
                        title="Return to reader" onClick={() => runnerDialogRef.current?.close()}>
                        <span className="material-icons" aria-hidden="true">close</span>
                    </button>
                </div>
                <button ref={fullscreenWordRef} type="button" className="pdf-runner-fullscreen-word"
                    aria-label={`${textReady ? (words[currentWord] || "No readable text") : "Loading words"}. ${fullscreenControls ? "Hide controls" : "Show controls"}`}
                    onClick={toggleFullscreenControls}>{textReady ? (words[currentWord] || "—") : "…"}</button>
                <div className="pdf-runner-fullscreen-controls" hidden={!fullscreenControls}>
                    <p className="pdf-storage-note">{!textReady ? "Loading words…" : words.length
                        ? `Page ${page} · Word ${currentWord + 1} of ${words.length}`
                        : "No selectable text on this page. Choose another page to continue."}</p>
                    {renderRunnerControls()}
                    {renderRunnerSliders()}
                </div>
            </dialog>, document.body)}
            {!pdf && !busy && <p className="pdf-storage-note">Choose a book to start reading. Your file and page will be saved on this device.</p>}
            {error && <p className="passage-error" role="alert">{error}</p>}
            {(busy || (sections.showPage && sections.page && rendering)) && <p role="status">{busy ? "Opening PDF…" : "Loading page…"}</p>}
            <details className="pdf-page-view" hidden={!pdf || !sections.showPage} open={sections.page}
                onToggle={event => setSection("page", event.currentTarget.open)}>
                <summary>Page {page} view</summary>
                <div className="pdf-viewport" ref={viewportRef} aria-busy={busy || rendering}>
                    <div ref={pageRef} />
                </div>
            </details>
            {pdf && <details className="pdf-page-text" hidden={!sections.showText} open={sections.text}
                onToggle={event => setSection("text", event.currentTarget.open)}><summary>Page {page} text</summary>
                <div ref={setTextContainer} />
                {(!textReady || busy) ? <p>Loading page text…</p>
                    : !pageText && <p>No text is available for this page. Scanned pages may contain only images.</p>}
            </details>}
            {createPortal(<dialog ref={settingsRef} id={`${id}-pdf-settings`} className="passage-picker pdf-settings"
                aria-labelledby={`${id}-pdf-settings-title`} onClose={() => setSettingsOpen(false)}
                onClick={event => {
                    event.stopPropagation();
                    if (event.target !== event.currentTarget) return;
                    const rect = event.currentTarget.getBoundingClientRect();
                    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) settingsRef.current?.close();
                }}>
                <div className="passage-picker-heading">
                    <h2 id={`${id}-pdf-settings-title`}>PDF display settings</h2>
                    <button type="button" className="passage-picker-close" aria-label="Close PDF display settings" onClick={() => settingsRef.current?.close()}>×</button>
                </div>
                <div className="passage-picker-panel pdf-settings-content">
                    <fieldset>
                        <legend>Show sections</legend>
                        <label><input type="checkbox" checked={sections.showPage} onChange={event => setSection("showPage", event.target.checked)} /> Page view</label>
                        <label><input type="checkbox" checked={sections.showText} onChange={event => setSection("showText", event.target.checked)} /> Extracted text</label>
                    </fieldset>
                    <label className="pdf-zoom">Page zoom <select value={zoom} onChange={event => setZoom(Number(event.target.value) as PdfSections["zoom"])}>
                        <option value="1">Fit width</option>
                        <option value="1.5">150%</option>
                        <option value="2">200%</option>
                    </select></label>
                </div>
            </dialog>, document.body)}
            {pdf && <p className="pdf-storage-note">Saved on this device. Deleting this reader removes its saved PDF.</p>}
        </section>
    );
}

export default PdfReader
