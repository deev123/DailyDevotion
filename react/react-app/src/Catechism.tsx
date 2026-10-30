import type { MenuOption } from "./Menu.tsx" // import type important for importing types
import Menu from "./Menu.tsx"
import ListPicker from "./ListPicker.tsx"
import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import YouVersionAPI from "./YouVersionAPI.ts"
import GooeyCheckbox from "./GooeyCheckbox.tsx"
import confetti from "canvas-confetti"

type CatechismProps = {
    layoutOptions: MenuOption[],
    id: string,
    list: string // file name or local store var name
}

type CatechismEntry = {
    Question: string,
    Answer: string,
    AnswerWithProofs?: string,
    Proofs?: { Id: number, References: string[] }[]
}

// Book abbreviations used by the original Creeds.json proof texts.
const proofBooks: Record<string, string> = {
    Gen: "Genesis", Exod: "Exodus", Lev: "Leviticus", Num: "Numbers", Deut: "Deuteronomy",
    Josh: "Joshua", Judg: "Judges", Ruth: "Ruth", "1Sam": "1 Samuel", "2Sam": "2 Samuel", "1Kgs": "1 Kings", "2Kgs": "2 Kings",
    "1Chr": "1 Chronicles", "2Chr": "2 Chronicles", Job: "Job", Ps: "Psalm", Prov: "Proverbs",
    Ezra: "Ezra", Neh: "Nehemiah", Esth: "Esther", Eccl: "Ecclesiastes", Song: "Song of Solomon", Isa: "Isaiah", Jer: "Jeremiah", Lam: "Lamentations", Ezek: "Ezekiel", Dan: "Daniel",
    Hos: "Hosea", Joel: "Joel", Amos: "Amos", Jonah: "Jonah", Mic: "Micah", Nah: "Nahum", Hab: "Habakkuk", Zeph: "Zephaniah", Zech: "Zechariah", Mal: "Malachi",
    Matt: "Matthew", Mark: "Mark", Luke: "Luke", John: "John", Acts: "Acts", Rom: "Romans",
    "1Cor": "1 Corinthians", "2Cor": "2 Corinthians", Gal: "Galatians", Eph: "Ephesians",
    Phil: "Philippians", Col: "Colossians", "1Thess": "1 Thessalonians", "2Thess": "2 Thessalonians",
    "1Tim": "1 Timothy", "2Tim": "2 Timothy", Titus: "Titus", Phlm: "Philemon", Heb: "Hebrews", Jas: "James",
    "1Pet": "1 Peter", "2Pet": "2 Peter", "1John": "1 John", "2John": "2 John", "3John": "3 John", Jude: "Jude", Rev: "Revelation"
};

const catechisms = [
    { label: "Heidelberg Catechism", file: "Heidelberg_Catechism.json" },
    { label: "Westminster Shorter Catechism", file: "Westminster_Shorter_Catechism.json" },
    { label: "Westminster Larger Catechism", file: "Westminster_Larger_Catechism.json" }
];

function proofReference(reference: string) {
    const parts = reference.split("-");
    const parse = (part: string) => {
        const match = part.match(/^([1-3]?[A-Za-z]+)\.(\d+)(?:\.(\d+))?$/);
        if (!match) return null;
        const book = proofBooks[match[1]];
        const code = book && YouVersionAPI.BOOK_CODES[book];
        return code ? { book, code, chapter: match[2], verse: match[3] } : null;
    };
    const start = parse(parts[0]);
    const end = parts[1] ? parse(parts[1]) : null;
    if (!start || (parts[1] && !end)) return { label: reference, usfm: null };
    const label = `${start.book} ${start.chapter}${start.verse ? `:${start.verse}` : ""}` +
        (end ? `–${end.book !== start.book ? `${end.book} ` : ""}${end.chapter !== start.chapter ? `${end.chapter}${end.verse ? ":" : ""}` : ""}${end.verse ?? ""}` : "");
    const usfm = `${start.code}.${start.chapter}${start.verse ? `.${start.verse}` : ""}` +
        (end ? `-${end.code === start.code && end.chapter === start.chapter && end.verse
            ? end.verse : `${end.code}.${end.chapter}${end.verse ? `.${end.verse}` : ""}`}` : "");
    return { label, usfm };
}

// fetch the catechism json file and return its data array
async function loadCatechism(filePath: string) {
    try {
        const response = await fetch(import.meta.env.BASE_URL + filePath);
        // on dev server if file not found it may return index.html
        if (!response.ok) throw new Error("Failed to load file");

        const data = await response.json();
        return data.Data ?? [];
    } catch (err) {
        console.error(err);
    }
}

function Catechism({ layoutOptions, id, list }: CatechismProps){

    let [index, setIndex] = useState(0);
    const [catechism, setCatechism] = useState(() => {
        const saved = localStorage.getItem(id + "_catechism");
        return catechisms.some(item => item.file === saved) ? saved! : list;
    });
    // catechism questions/answers loaded from json
    let [entries, setEntries] = useState<CatechismEntry[]>([]);
    let [checkboxChecked, setCheckboxChecked] = useState(false);
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [selectedReference, setSelectedReference] = useState<{ label: string, usfm: string | null } | null>(null);
    const [passage, setPassage] = useState("");
    const [passageStatus, setPassageStatus] = useState("");
    const [copyright, setCopyright] = useState("");
    const [translation, setTranslation] = useState("");

    useEffect(() => {
        if (!selectedReference) return;
        let cancelled = false;
        async function loadPassage() {
            setPassage("");
            setCopyright("");
            setTranslation("");
            setPassageStatus("Loading passage…");
            if (!selectedReference?.usfm) {
                setPassageStatus("This reference could not be resolved.");
                return;
            }
            const versions = await YouVersionAPI.fetchVersions();
            const english = versions.filter(v => v.languageTag.startsWith("en"));
            const version = english.find(v => v.abbreviation.toUpperCase() === "BSB" || v.title.toLowerCase() === "berean standard bible") ?? english[0];
            if (!version) {
                if (!cancelled) setPassageStatus("Bible text is unavailable. Please check your connection and Bible API configuration.");
                return;
            }
            const [result, detail] = await Promise.all([
                YouVersionAPI.fetchChapterHtml(version.id, selectedReference.usfm),
                YouVersionAPI.fetchVersionDetail(version.id)
            ]);
            if (cancelled) return;
            setPassage(result.html);
            setTranslation(result.ok && result.html ? `${version.title} (${version.abbreviation})` : "");
            setCopyright(detail?.copyright ?? "");
            setPassageStatus(result.ok && result.html ? "" : "This passage is unavailable. Please try again later.");
        }
        void loadPassage();
        return () => { cancelled = true; };
    }, [selectedReference]);

    function saveIndex(val: number) {
        localStorage.setItem(id + "_index_" + catechism, JSON.stringify(val));
    }

    function next() {
        setIndex((prev) => {
            let result = prev;
            if(prev < entries.length - 1){
                result ++;
            }
            else{
                result = 0;
            }
            saveIndex(result);
            return result;
        });
    }

    // Keep a separate position for each catechism, including existing Heidelberg progress.
    useEffect(() => {
        let cancelled = false;
        setEntries([]);
        async function load() {
            const data = await loadCatechism(catechism) ?? [];
            if (cancelled) return;
            const saved = localStorage.getItem(id + "_index_" + catechism) ??
                (catechism === list ? localStorage.getItem(id + "_index") : null);
            let stored = 0;
            try { stored = Number(JSON.parse(saved ?? "0")); } catch { /* Start at the first question. */ }
            setIndex(Number.isInteger(stored) && stored >= 0 && stored < data.length ? stored : 0);
            setEntries(data);
        }
        void load();
        return () => { cancelled = true; };
    }, [catechism, id, list]);

    return (
    <section>
        <div className="passage-header">
            <div className="catechism-selectors">
            <ListPicker title="Select catechism"
                options={catechisms.map((item, i) => ({ value: i, label: item.label }))}
                value={catechisms.findIndex(item => item.file === catechism)}
                onChange={value => {
                    const file = catechisms[value].file;
                    localStorage.setItem(id + "_catechism", file);
                    setCatechism(file);
                }} />
            <ListPicker
                title="Select question"
                options={entries.map((element, i) => ({ value: i, label: `${i + 1}. ${element.Question}` }))}
                value={index}
                onChange={(nextIndex) => { setIndex(nextIndex); saveIndex(nextIndex); }}
            />
            </div>
            <div>
                <Menu options={layoutOptions}>
                    <button className="dots-button">⋮</button>
                </Menu>
            </div>
        </div>
        <div className="catechism-body">
            {entries[index] ?
                <>
                    <p className="catechism-question">{entries[index].Question}</p>
                    <p className="catechism-answer">{(catechism === "Westminster_Shorter_Catechism.json" ? entries[index].AnswerWithProofs ?? entries[index].Answer : entries[index].Answer).split(/(\[\d+\])/g).map((part, i) =>
                        /^\[\d+\]$/.test(part) ? <sup className="catechism-proof-marker" key={i}>{part.slice(1, -1)}</sup> : part
                    )}</p>
                    {!!entries[index].Proofs?.length && <div className="catechism-proofs">
                        <h3>Scripture references</h3>
                        {entries[index].Proofs!.map(proof => <p key={proof.Id}>
                            <span className="catechism-proof-number">{proof.Id}. </span>
                            {proof.References.flatMap(reference => reference.split(",")).map((reference, i) => {
                                const parsed = proofReference(reference);
                                return <span key={`${reference}-${i}`}>
                                    {i > 0 && "; "}<button type="button" className="catechism-reference" onClick={() => {
                                        setSelectedReference(parsed);
                                        dialogRef.current?.showModal();
                                    }}>{parsed.label}</button>
                                </span>;
                            })}
                        </p>)}
                    </div>}
                </>
            : <p>...</p>}
        </div>
        {createPortal(<dialog ref={dialogRef} className="passage-picker catechism-dialog" aria-labelledby={`${id}-reference-title`}
            onClose={() => setSelectedReference(null)}>
            <div className="catechism-dialog-header">
                <h2 id={`${id}-reference-title`}>{selectedReference?.label}</h2>
                <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Close passage">×</button>
            </div>
            {translation && <p className="catechism-translation">{translation}</p>}
            {passageStatus && <p role="status">{passageStatus}</p>}
            {passage && <div className="passage-body bible-text" dangerouslySetInnerHTML={{ __html: passage }} />}
            {copyright && <small>{copyright}</small>}
        </dialog>, document.body)}
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

export default Catechism
