import { useEffect, useLayoutEffect, useRef, useState } from "react";
import YouVersionAPI from "../bible/YouVersionAPI";

type Chapter = { index: number; html: string };
type Direction = "before" | "after";

// Keep the Bible's paragraph and verse markup, but never insert executable content or links.
function cleanMarkup(html: string, questionVerse?: number): string {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("script, style, iframe, object, embed, form, input, button, svg, math, link, meta").forEach(node => node.remove());
    for (const element of doc.body.querySelectorAll("*")) {
        for (const attr of [...element.attributes]) if (attr.name !== "class") element.removeAttribute(attr.name);
    }
    if (questionVerse !== undefined) {
        const selector = ".yv-vlbl, .verse-number, .verse-num";
        const label = [...doc.body.querySelectorAll<HTMLElement>(selector)].find(node => Number(node.textContent?.trim()) === questionVerse);
        if (label) {
            label.classList.add("verse-context-question-label");
            const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
            const textNodes: Text[] = [];
            let inVerse = false;
            while (walker.nextNode()) {
                const node = walker.currentNode as Text;
                const verseLabel = node.parentElement?.closest(selector);
                if (verseLabel === label) { inVerse = true; continue; }
                if (inVerse && verseLabel) break;
                if (inVerse && node.textContent?.trim()) textNodes.push(node);
            }
            for (const node of textNodes) {
                const mark = doc.createElement("mark");
                mark.className = "verse-context-question-text";
                node.replaceWith(mark);
                mark.append(node);
            }
        }
    }
    return doc.body.innerHTML;
}

export default function PassageContext({ chapters, index, verse, bibleId, version, onClose }: {
    chapters: string[]; index: number; verse: number; bibleId: number; version: string; onClose: () => void;
}) {
    const [loaded, setLoaded] = useState<Chapter[]>([]);
    const [loading, setLoading] = useState<Direction | "initial" | null>("initial");
    const [error, setError] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);
    const loadedRef = useRef<Chapter[]>([]);
    const cache = useRef(new Map<number, Chapter>());
    const busy = useRef(false);
    const alive = useRef(true);
    const initialPosition = useRef(false);
    const restore = useRef<{ height: number; top: number } | null>(null);

    useEffect(() => {
        alive.current = true;
        let cancelled = false;
        const get = async (chapterIndex: number): Promise<Chapter> => {
            const code = YouVersionAPI.referenceToUsfm(chapters[chapterIndex]);
            if (!code) throw new Error("This chapter is unavailable.");
            const result = await YouVersionAPI.fetchChapterHtml(bibleId, code);
            if (!result.ok || !result.html.trim()) throw new Error("Could not load this chapter.");
            return { index: chapterIndex, html: cleanMarkup(result.html, chapterIndex === index ? verse : undefined) };
        };
        async function initialise() {
            try {
                const main = await get(index);
                if (cancelled) return;
                cache.current.set(index, main);
                // Neighbouring chapters are cached in advance when available.
                await Promise.all([index - 1, index + 1].filter(i => i >= 0 && i < chapters.length).map(async i => {
                    try { const chapter = await get(i); if (!cancelled) cache.current.set(i, chapter); } catch { /* Retry when requested. */ }
                }));
                if (cancelled) return;
                const initial = [index - 1, index, index + 1].flatMap(i => cache.current.has(i) ? [cache.current.get(i)!] : []);
                // Do not skip over an unavailable neighbouring chapter.
                const contiguous = initial.filter(item => item.index === index || Math.abs(item.index - index) === 1);
                loadedRef.current = contiguous;
                setLoaded(contiguous); setLoading(null);
            } catch {
                if (!cancelled) { setError("Could not load the passage. Check your connection and try again."); setLoading(null); }
            }
        }
        void initialise();
        return () => { cancelled = true; alive.current = false; };
    }, [bibleId, chapters, index, verse]);

    useLayoutEffect(() => {
        const scroller = scrollRef.current;
        if (!scroller || !loaded.length) return;
        if (restore.current) {
            scroller.scrollTop = restore.current.top + scroller.scrollHeight - restore.current.height;
            restore.current = null;
        } else if (!initialPosition.current) {
            const main = scroller.querySelector<HTMLElement>(`[data-chapter-index="${index}"]`);
            const label = main?.querySelector<HTMLElement>(".verse-context-question-label");
            const target = label ?? main;
            if (target) scroller.scrollTop = Math.max(0, target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - scroller.clientHeight / 3);
            initialPosition.current = true;
        }
    }, [loaded, index, verse]);

    async function loadMore(direction: Direction) {
        if (busy.current || !loadedRef.current.length) return;
        const target = direction === "before" ? loadedRef.current[0].index - 1 : loadedRef.current[loadedRef.current.length - 1].index + 1;
        if (target < 0 || target >= chapters.length) return;
        busy.current = true; setLoading(direction); setError("");
        try {
            let chapter = cache.current.get(target);
            if (!chapter) {
                const code = YouVersionAPI.referenceToUsfm(chapters[target]);
                if (!code) throw new Error("Unavailable chapter");
                const result = await YouVersionAPI.fetchChapterHtml(bibleId, code);
                if (!result.ok || !result.html.trim()) throw new Error("Unavailable chapter");
                chapter = { index: target, html: cleanMarkup(result.html) };
                cache.current.set(target, chapter);
            }
            if (!alive.current) return;
            if (direction === "before" && scrollRef.current) restore.current = { height: scrollRef.current.scrollHeight, top: scrollRef.current.scrollTop };
            const next = direction === "before" ? [chapter, ...loadedRef.current] : [...loadedRef.current, chapter];
            loadedRef.current = next; setLoaded(next);
        } catch {
            if (alive.current) setError(`Could not load the ${direction === "before" ? "previous" : "next"} chapter. Use the button to retry.`);
        } finally {
            busy.current = false;
            if (alive.current) setLoading(null);
        }
    }
    const first = loaded[0]?.index;
    const last = loaded[loaded.length - 1]?.index;
    function returnToVerse() {
        const scroller = scrollRef.current;
        const target = scroller?.querySelector<HTMLElement>(".verse-context-question-label") ?? scroller?.querySelector<HTMLElement>(`[data-chapter-index="${index}"]`);
        if (!scroller || !target) return;
        const top = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - scroller.clientHeight / 3;
        scroller.scrollTo({ top: Math.max(0, top), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
    return <div className="verse-context">
        <div className="verse-context-heading"><div><span className="verse-game-eyebrow">READ AT YOUR OWN PACE</span><h3>Passage context</h3><p>{chapters[index]}:{verse} · {version}</p></div><button type="button" className="verse-context-close" onClick={onClose}>Close</button></div>
        {loading === "initial" && <p role="status">Loading the passage…</p>}
        {loaded.length > 0 && <button type="button" className="verse-context-return" onClick={returnToVerse}>Return to question verse</button>}
        {loaded.length > 0 && <div ref={scrollRef} className="verse-context-scroll" role="region" aria-label="Passage context" tabIndex={0} onScroll={event => {
            if (loading || error || !initialPosition.current) return;
            const element = event.currentTarget;
            if (element.scrollTop < 120) void loadMore("before");
            else if (element.scrollHeight - element.scrollTop - element.clientHeight < 120) void loadMore("after");
        }}>
            {first > 0 && <button type="button" className="verse-context-more" disabled={!!loading} onClick={() => void loadMore("before")}>{loading === "before" ? "Loading…" : "Load previous chapter"}</button>}
            {loaded.map(chapter => <article key={chapter.index} data-chapter-index={chapter.index}><h4>{chapters[chapter.index]}</h4><div className="passage-body" dangerouslySetInnerHTML={{ __html: chapter.html }} /></article>)}
            {last < chapters.length - 1 && <button type="button" className="verse-context-more" disabled={!!loading} onClick={() => void loadMore("after")}>{loading === "after" ? "Loading…" : "Load next chapter"}</button>}
        </div>}
        {error && <p className="verse-game-error" role="alert">{error}{!loaded.length && <> <button type="button" className="verse-context-close" onClick={onClose}>Close and try again</button></>}</p>}
    </div>;
}
