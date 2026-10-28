import { useEffect, useMemo, useRef, useState } from "react"
// Include PDF.js compatibility helpers for browsers such as Samsung Internet.
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs"
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist"
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"
import Menu from "./Menu.tsx"
import type { MenuOption } from "./Menu.tsx"
import { loadPdf, savePdf, savePdfProgress } from "./pdfStorage.ts"

GlobalWorkerOptions.workerSrc = workerUrl;

type PdfReaderProps = { id: string; layoutOptions: MenuOption[] };

function PdfReader({ id, layoutOptions }: PdfReaderProps) {
    const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
    const [name, setName] = useState("");
    const [page, setPage] = useState(1);
    const [pageInput, setPageInput] = useState("1");
    const [zoom, setZoom] = useState(1);
    const [width, setWidth] = useState(320);
    const [busy, setBusy] = useState(true);
    const [rendering, setRendering] = useState(false);
    const [error, setError] = useState("");
    const [textPage, setTextPage] = useState<{ pdf: PDFDocumentProxy; page: number; text: string } | null>(null);
    const [wordIndex, setWordIndex] = useState(0);
    const [speed, setSpeed] = useState(300);
    const [running, setRunning] = useState(false);
    const [rampWords, setRampWords] = useState(0);
    const [runnerOpen, setRunnerOpen] = useState(false);
    const textReady = textPage?.pdf === pdf && textPage?.page === page;
    const pageText = textReady ? textPage.text : "";
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
        if (!pdf || !pageRef.current || width <= 0) return;
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
    }, [pdf, page, width, zoom, name]);

    useEffect(() => {
        if (!pdf) return;
        let cancelled = false;
        void pdf.getPage(page).then((pdfPage) => pdfPage.getTextContent()).then((content) => {
            if (!cancelled) setTextPage({ pdf, page, text: content.items.map((item) =>
                "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("") });
        }).catch((error) => {
            if (!cancelled) {
                console.warn("Could not extract PDF page text:", error);
                setTextPage({ pdf, page, text: "" });
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
            setZoom(1);
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

    function goToPage(value: number) {
        if (!pdf || busy) return;
        const next = Number.isFinite(value) ? Math.min(pdf.numPages, Math.max(1, Math.trunc(value))) : page;
        if (next === page) return;
        setRunning(false);
        setWordIndex(0);
        setPage(next);
        setPageInput(String(next));
        setError("");

    }

    return (
        <section className="pdf-reader" aria-label={name || "PDF reader"}>
            <div className="passage-header pdf-header">
                <div className="pdf-title-row">
                    <h2 className="reading-title-select">{name || "PDF reader"}</h2>
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
            </div>
            <div className="pdf-file-controls">
                <label className={"pdf-file-button" + (busy ? " pdf-control-disabled" : "")}>
                    <span className="material-icons" aria-hidden="true">upload_file</span>
                    <span>{pdf ? "Replace PDF" : "Choose a PDF"}</span>
                    <input type="file" accept="application/pdf,.pdf" disabled={busy} onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) void chooseFile(file);
                    }} />
                </label>
                {pdf && <label className="pdf-zoom">Zoom <select value={zoom} onChange={(e) => setZoom(Number(e.target.value))}>
                    <option value="1">Fit width</option>
                    <option value="1.5">150%</option>
                    <option value="2">200%</option>
                </select></label>}
            </div>
            {pdf && <div className="pdf-word-runner">
                <button className="pdf-runner-toggle" aria-expanded={runnerOpen} onClick={() => {
                    setRunnerOpen(!runnerOpen);
                    setRunning(false);
                }}>Word runner {runnerOpen ? "▴" : "▾"}</button>
                {runnerOpen && <div className="pdf-runner-panel">
                    <div className="pdf-runner-word" aria-label="Current word">{textReady ? (words[currentWord] || "—") : "…"}</div>
                    <p className="pdf-storage-note">{!textReady ? "Loading words…" : words.length
                        ? `Page ${page} · Word ${currentWord + 1} of ${words.length}`
                        : "No selectable text on this page. Choose another page to continue."}</p>
                    <div className="pdf-runner-controls">
                        <button disabled={busy || !words.length} onClick={() => {
                            setRunning(!running);
                            setRampWords(0);
                        }}>{running ? "Pause" : "Play"}</button>
                        <button disabled={busy || !words.length || currentWord === 0} onClick={() => {
                            setRunning(false);
                            setWordIndex(Math.max(0, currentWord - 10));
                        }}>Back 10 words</button>
                        <button disabled={busy || !words.length} onClick={() => {
                            setRunning(false);
                            setWordIndex(0);
                        }}>Restart page</button>
                    </div>
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
                    {textReady && words.length > 0 && currentWord === words.length - 1 && page === pdf.numPages && !running
                        && <p className="pdf-storage-note">End of book.</p>}
                </div>}
            </div>}
            {!pdf && !busy && <p className="pdf-storage-note">Choose a book to start reading. Your file and page will be saved on this device.</p>}
            {error && <p className="passage-error" role="alert">{error}</p>}
            {(busy || rendering) && <p role="status">{busy ? "Opening PDF…" : "Loading page…"}</p>}
            <div className="pdf-viewport" ref={viewportRef} aria-busy={busy || rendering}>
                <div ref={pageRef} />
            </div>
            {pdf && <details className="pdf-page-text"><summary>Page {page} text</summary>
                <p>{pageText || "No text is available for this page. Scanned pages may contain only images."}</p>
            </details>}
            {pdf && <p className="pdf-storage-note">Saved on this device. Deleting this reader removes its saved PDF.</p>}
        </section>
    );
}

export default PdfReader
