import { useEffect, useId, useRef, useState } from "react";
import ListPicker from "../../components/ListPicker";
import Menu, { type MenuOption } from "../../components/Menu";
import PassagePicker from "../../components/PassagePicker";
import YouVersionAPI from "../bible/YouVersionAPI";
import "./verseFlashcard.css";

type Selection = { start: string; end: string; first: number; last: number; version: number };
type Version = Awaited<ReturnType<typeof YouVersionAPI.fetchVersions>>[number];
function readSelection(id: string): Selection | null {
    try {
        const value: unknown = JSON.parse(localStorage.getItem(id + "_flashcard") ?? "null");
        if (!value || typeof value !== "object") return null;
        const item = value as Record<string, unknown>;
        if (typeof item.start !== "string" || typeof item.end !== "string" || !Number.isSafeInteger(item.first) || !Number.isSafeInteger(item.last) || !Number.isSafeInteger(item.version) || Number(item.first) < 1 || Number(item.last) < 1 || Number(item.version) < 1) return null;
        return item as Selection;
    } catch { return null; }
}
function passageText(html: string): string {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("script, style, .yv-clbl, .chapter-number, [class*=footnote]").forEach(node => node.remove());
    doc.querySelectorAll(".yv-vlbl, .verse-number, .verse-num").forEach(node => {
        const number = node.textContent?.trim();
        if (number) node.replaceWith(doc.createTextNode(`\n${number} `));
    });
    doc.querySelectorAll(".label, sup").forEach(node => node.remove());
    doc.querySelectorAll("p, br").forEach(node => node.before(doc.createTextNode("\n")));
    return (doc.body.textContent ?? "").replace(/[^\S\n]+/gu, " ").replace(/\n\s*\n/gu, "\n").trim();
}
function initials(text: string): string {
    return text.replace(/[\p{L}][\p{L}\p{M}\p{N}]*(?:['’][\p{L}\p{M}\p{N}]+)*/gu, word => (word.match(/^[\p{L}][\p{M}]*/u)?.[0] ?? word).toLocaleUpperCase());
}
function capitaliseWords(text: string): string {
    return text.replace(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:['’][\p{L}\p{M}\p{N}]+)*/gu, word =>
        word.replace(/^[\p{L}\p{N}][\p{M}]*/u, first => first.toLocaleUpperCase()));
}
function renderVerses(text: string) {
    return text.split("\n").map((line, index) => {
        const match = line.match(/^(\s*\d+[a-z]?)\s+(.*)$/iu);
        return <span className="verse-flashcard-line" key={index}>{match ? <><span className="verse-flashcard-number">{match[1]}</span>{" "}{match[2]}</> : line}</span>;
    });
}
function reference(selection: Selection) {
    return selection.start === selection.end
        ? `${selection.start}:${selection.first}${selection.first === selection.last ? "" : `–${selection.last}`}`
        : `${selection.start}:${selection.first}–${selection.end}:${selection.last}`;
}
export default function VerseFlashcard({ id, layoutOptions }: { id: string; layoutOptions: MenuOption[] }) {
    const labelId = useId();
    const [saved] = useState(() => readSelection(id));
    const [selection, setSelection] = useState<Selection | null>(saved);
    const [chapters, setChapters] = useState<string[]>([]);
    const [versions, setVersions] = useState<Version[]>([]);
    const [draftStart, setDraftStart] = useState(saved?.start ?? "");
    const [draftEnd, setDraftEnd] = useState(saved?.end ?? "");
    const [first, setFirst] = useState(String(saved?.first ?? 1));
    const [last, setLast] = useState(String(saved?.last ?? 1));
    const [version, setVersion] = useState<number | null>(saved?.version ?? null);
    const [editing, setEditing] = useState(!saved);
    const [flipped, setFlipped] = useState(false);
    const [text, setText] = useState("");
    const [copyright, setCopyright] = useState("");
    const [loading, setLoading] = useState(!!saved);
    const [error, setError] = useState("");
    const request = useRef(0);
    useEffect(() => {
        let active = true;
        Promise.all([
            fetch(`${import.meta.env.BASE_URL}Bible_Chapters.txt`).then(response => { if (!response.ok) throw new Error(); return response.text(); }),
            YouVersionAPI.fetchVersions(),
        ]).then(([list, available]) => {
            if (!active) return;
            const refs = list.split(/\r?\n/u).map(line => line.trim()).filter(line => YouVersionAPI.referenceToUsfm(line));
            setChapters(refs); setVersions(available);
            setDraftStart(current => current || refs[0] || ""); setDraftEnd(current => current || refs[0] || "");
            setVersion(current => current ?? available.find(item => item.id === Number(localStorage.getItem("defaultBibleVersion")))?.id ?? available.find(item => item.languageTag.toLowerCase().startsWith("en"))?.id ?? available[0]?.id ?? null);
            if (!refs.length || !available.length) setError("Could not load passages or translations. Check your connection and try again.");
        }).catch(() => { if (active) setError("Could not load passages or translations. Check your connection and try again."); });
        return () => { active = false; };
    }, []);
    useEffect(() => {
        if (!selection) return;
        const requests = request;
        const current = ++requests.current;
        const start = YouVersionAPI.referenceToUsfm(selection.start);
        const end = YouVersionAPI.referenceToUsfm(selection.end);
        if (!start || !end) return;
        const from = `${start}.${selection.first}`;
        const to = selection.start === selection.end ? String(selection.last) : `${end}.${selection.last}`;
        Promise.all([YouVersionAPI.fetchChapterHtml(selection.version, selection.start === selection.end && selection.first === selection.last ? from : `${from}-${to}`), YouVersionAPI.fetchVersionDetail(selection.version)]).then(([passage, detail]) => {
            if (current !== request.current) return;
            const content = passageText(passage.html);
            setLoading(false);
            if (!passage.ok || !content) { setError("Could not load this passage. Check the verse numbers, translation and connection, then try again."); return; }
            setText(capitaliseWords(content)); setCopyright(detail?.copyright ?? "");
            try { localStorage.setItem(id + "_flashcard", JSON.stringify(selection)); } catch { setError("The passage loaded, but could not be saved in this browser."); }
        });
        return () => { requests.current++; };
    }, [id, selection]);
    function apply(event: React.FormEvent) {
        event.preventDefault();
        const fromIndex = chapters.indexOf(draftStart); const toIndex = chapters.indexOf(draftEnd);
        const fromVerse = Number(first); const toVerse = Number(last);
        if (version === null || fromIndex < 0 || toIndex < fromIndex || !Number.isSafeInteger(fromVerse) || !Number.isSafeInteger(toVerse) || fromVerse < 1 || toVerse < 1 || (fromIndex === toIndex && toVerse < fromVerse)) {
            setError("Choose a valid passage: the end must be after the start, and verse numbers must be positive."); return;
        }
        setError(""); setText(""); setCopyright(""); setLoading(true); setFlipped(false); setEditing(false);
        setSelection({ start: draftStart, end: draftEnd, first: fromVerse, last: toVerse, version });
    }
    const selectedVersion = versions.find(item => item.id === selection?.version);
    return <section className="verse-flashcard-section" aria-labelledby={labelId}>
        <div className="verse-flashcard-heading"><div><span className="verse-flashcard-experimental">EXPERIMENTAL</span><h2 id={labelId}>Verse flashcard</h2></div><Menu options={layoutOptions}><button type="button" className="player-icon-button" aria-label="Flashcard section options"><span className="material-icons" aria-hidden="true">more_vert</span></button></Menu></div>
        <button type="button" className="verse-flashcard-settings" aria-expanded={editing} onClick={() => setEditing(value => !value)}>{editing ? "Close passage settings" : "Set passage and translation"}</button>
        {editing && <form className="verse-flashcard-form" onSubmit={apply}>
            <span className="verse-flashcard-label">Translation</span><ListPicker title="Select translation" value={version} onChange={setVersion} disabled={!versions.length} searchable groupTabs options={versions.map(item => ({ value: item.id, label: `${item.abbreviation} — ${item.title}`, group: item.languageName, groupKey: item.languageGroup, groupSearch: item.languageSearch }))} />
            <span className="verse-flashcard-label">Chapter</span><PassagePicker references={chapters} value={chapters.indexOf(draftStart)} onChange={index => { const next = chapters[index]; setDraftStart(next); setDraftEnd(next); }} />
            <label>From verse <input type="number" min="1" step="1" required value={first} onChange={event => setFirst(event.target.value)} /></label>

            <label>To verse <input type="number" min="1" step="1" required value={last} onChange={event => setLast(event.target.value)} /></label>
            <button type="submit" className="verse-flashcard-submit" disabled={!chapters.length || version === null}>Load passage</button>
        </form>}
        {loading && <p role="status">Loading passage…</p>}
        {error && <p className="passage-error" role="alert">{error}{!editing && <button type="button" className="verse-flashcard-retry" onClick={() => setEditing(true)}> Edit passage</button>}</p>}
        {selection && text && !loading && <><button type="button" className="verse-flashcard-card" onClick={() => setFlipped(value => !value)} aria-label={`${reference(selection)}. ${flipped ? "Full passage" : "First letters"}: ${flipped ? text : initials(text)}. Activate to show ${flipped ? "first letters" : "full passage"}.`}>
            <span className={`verse-flashcard-inner${flipped ? " is-flipped" : ""}`} aria-hidden="true">
                {[{ label: "First letters", content: initials(text), face: "front" }, { label: "Full passage", content: text, face: "back" }].map(side => <span key={side.face} className={`verse-flashcard-face verse-flashcard-${side.face}`}>
                    <span className="verse-flashcard-reference">{reference(selection)} · {selectedVersion?.abbreviation ?? ""}</span>
                    <span className="verse-flashcard-text">{renderVerses(side.content)}</span>
                    <span className="verse-flashcard-flip">{side.label} · Tap to flip</span>
                </span>)}
            </span>
        </button>{copyright && <p className="verse-flashcard-copyright">{copyright}</p>}</>}
    </section>;
}
