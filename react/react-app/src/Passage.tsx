import type { MenuOption } from "./Menu.tsx" // import type important for importing types
import Menu from "./Menu.tsx"
import PassagePicker from "./PassagePicker.tsx"
import ListPicker from "./ListPicker.tsx"
import SpeechPassage from "./SpeechPassage.tsx"
import { useState, useEffect } from "react"
import GooeyCheckbox from "./GooeyCheckbox.tsx"
import confetti from "canvas-confetti"
import YouVersionAPI from "./YouVersionAPI.ts"

type PassageProps = {
    layoutOptions: MenuOption[],
    id: string,
    speech?: boolean,
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


function Passage({ layoutOptions, id, list, speech = false }: PassageProps){

    let [index, setIndex] = useState(0);
    // elements of selection. e.g. loaded from Bible_Chapters.txt
    let [listElements, setListElements] = useState<string[]>([]);
    let [html, setHtml] = useState("");
    let [error, setError] = useState("");
    let [checkboxChecked, setCheckboxChecked] = useState(false);

    // bible version selection
    let [versions, setVersions] = useState<{id: number, abbreviation: string, title: string, languageTag: string, languageName: string}[]>([]);
    let [versionId, setVersionId] = useState<number | null>(null);
    // copyright notice for the selected version
    let [copyright, setCopyright] = useState("");
    // localized book titles for the selected version: USFM code -> localized title e.g. GEN -> Génesis
    let [bookTitles, setBookTitles] = useState<Map<string, string>>(new Map());

    function saveIndex(val: number) {
        localStorage.setItem(id + "_index", JSON.stringify(val));
    }

    function loadIndex() {
        setIndex(() =>
        {
            return Number.parseInt(JSON.parse(localStorage.getItem(id + "_index") ?? "0"));
        })
    }

    function saveVersion(val: number) {
        localStorage.setItem(id + "_version", JSON.stringify(val));
    }

    function next() {
        setIndex((prev) => {
            let result = prev;
            if(prev < listElements.length){
                result ++;
            }
            else{
                result = 0;
            }
            saveIndex(result);
            return result;
        });
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
        }
        load();
    },[]);

    // load index and version from local store when created
    useEffect(() => {
        loadIndex();

        async function loadVersion() {
            const savedVersion = localStorage.getItem(id + "_version");
            const stored = Number.parseInt(JSON.parse(savedVersion ?? "null"));
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
                const fallback = savedVersion === null ? berean ?? available[0] : available[0];
                setVersionId(fallback.id);
                saveVersion(fallback.id);
            }
        }
        loadVersion();
    },[]);

    // load the copyright notice and localized book titles whenever the selected version changes
    useEffect(() => {
        async function loadVersionData() {
            if (!versionId) return;
            const detail = await YouVersionAPI.fetchVersionDetail(versionId);
            setCopyright(detail?.copyright ?? "");

            const titles = await YouVersionAPI.fetchBookTitles(versionId);
            setBookTitles(titles);
        }
        setCopyright("");
        setBookTitles(new Map());
        loadVersionData();
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

            setError("");
            const result = await YouVersionAPI.fetchChapterHtml(versionId, usfm);
            if (cancelled) return;
            setHtml(result.html);
            setError(result.error);
        }
        loadChapter();
        return () => { cancelled = true; };
    }, [index, listElements, versionId]);

    function onVersionChange(val: number) {
        setVersionId(val);
        saveVersion(val);
    }

    const reference = listElements[index];
    const commentary = reference ? commentaryUrl(reference) : null;

    return (
    <section>
        <div className="passage-header">
            <PassagePicker
                references={listElements}
                value={index}
                onChange={(nextIndex) => { setIndex(nextIndex); saveIndex(nextIndex); }}
                formatReference={localizedLabel}
            />
            <div>
                <Menu options={layoutOptions}>
                    <button className="dots-button">⋮</button>
                </Menu>
            </div>
        </div>
        {versions.length > 1 &&
            <div className="version-header">
                <ListPicker
                    title="Select translation"
                    className="version-select"
                    options={versions.map(version => ({
                        value: version.id,
                        label: `${version.abbreviation} — ${version.title}`,
                        group: version.languageName,
                    }))}
                    value={versionId}
                    onChange={onVersionChange}
                    disabled={versionId === null}
                />
            </div>
        }
        <div className="passage-body">
            {error ? <p className="passage-error">{error}</p>
             : html ? (speech ? <SpeechPassage key={`${index}-${versionId}`} html={html} id={id}
                 language={versions.find(version => version.id === versionId)?.languageTag || "en"} />
                 : <div dangerouslySetInnerHTML={{ __html: html }}/>) : <p>...</p>}
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

export default Passage
