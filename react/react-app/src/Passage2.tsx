import type { MenuOption } from "./Menu.tsx" // import type important for importing types
import Menu from "./Menu.tsx"
import { useState, useEffect } from "react"
import GooeyCheckbox from "./GooeyCheckbox.tsx"
import confetti from "canvas-confetti"
import YouVersionAPI from "./YouVersionAPI.ts"

type Passage2Props = {
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


function Passage2({ layoutOptions, id, list }: Passage2Props){

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
            const stored = Number.parseInt(JSON.parse(localStorage.getItem(id + "_version") ?? "null"));
            const available = await YouVersionAPI.fetchVersions();
            setVersions(available);

            if (available.length === 0) return;

            // use stored version if still available, otherwise fall back to first
            if (stored && available.some((v) => v.id === stored)) {
                setVersionId(stored);
            } else {
                setVersionId(available[0].id);
                saveVersion(available[0].id);
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
            setHtml(result.html);
            setError(result.error);
        }
        loadChapter();
    }, [index, listElements, versionId]);

    function onVersionChange(val: number) {
        setVersionId(val);
        saveVersion(val);
    }

    return (
    <section>
        <div className="passage-header">
            <select
                className="reading-title-select"
                value={index}
                onChange={(e) => {setIndex(+e.target.value); saveIndex(+e.target.value)}}
            >
                {listElements.map((element, i) => {
                    return <option key={`${id}_${i}`} value={i}>{localizedLabel(element)}</option>
                })}
            </select>
            <div>
                <Menu options={layoutOptions}>
                    <button className="dots-button">⋮</button>
                </Menu>
            </div>
        </div>
        {versions.length > 1 &&
            <div className="version-header">
                <select
                    className="version-select"
                    value={versionId ?? ""}
                    onChange={(e) => {onVersionChange(+e.target.value)}}
                    disabled={versionId === null}
                >
                    {[...new Map(versions.map((v) => [v.languageName, []])).keys()].map((langName) => {
                        const langVersions = versions.filter((v) => v.languageName === langName);
                        return (
                            <optgroup key={`lang_${langName}`} label={langName}>
                                {langVersions.map((v) => {
                                    return <option key={`ver_${v.id}`} value={v.id}>{v.abbreviation} — {v.title}</option>
                                })}
                            </optgroup>
                        );
                    })}
                </select>
            </div>
        }
        <div className="passage2-body">
            {error ? <p className="passage2-error">{error}</p>
             : html ? <div dangerouslySetInnerHTML={{ __html: html }}/> : <p>...</p>}
        </div>
        {copyright &&
            <div className="passage2-copyright">{copyright}</div>
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

export default Passage2
