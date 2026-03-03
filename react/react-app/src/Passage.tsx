import type { MenuOption } from "./Menu.tsx" // import type important for importing types
import Menu from "./Menu.tsx"
import { useState, useEffect, type ReactElement } from "react"

type PassageProps = {
    layoutOptions: MenuOption[],
    id: string,
    list: string // file name or local store var name
}

// abstraction of api for getting the verses
class BibleAPI {

    // reference eg: "1 John 3", "Revelation 9" etc
    static async fetchPassage(reference: string, translation = "WEB") {
        if (!reference) return [];

        try {
            const url = `https://bible-api.com/${encodeURIComponent(reference)}?translation=${translation}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error("Failed to fetch passage");

            const data = await response.json();

            if (data.verses) {
                // turn API response into list of {verse, text} objects
                return data.verses.map((v: any) => ({ verse: v.verse, text: v.text }));
            }
            else {
                return [{ verse: "", text: "No passage found." }];
            }
        }
        catch (err) {
        console.error("BibleAPI error:", err);
        return [{ verse: "", text: "Error fetching passage." }];
        }
    }
}

// class for rendering verses in a viewport
class VerseRenderer {

  // make WEB translation more like the NIV
  static convertToLORD(text : string) {
    // regex to find Yahweh, Yah, LORD GOD, GOD
    const replacements: Record<string, string> = {
      "\\bYahweh\\b": "(The) LORD",
      "\\bYah\\b": "(The) LORD"
    };

    for (const pattern in replacements) {
      const regex = new RegExp(pattern, "g");
      text = text.replace(regex, replacements[pattern]);
    }

    // Optional: fix double spaces
    return text.replace(/\s{2,}/g, " ");
  }

  // create jsx components for verses from the api
  // sort of a component in a way
  static createVerseComponents(verses: any): ReactElement[] {
    let jsx = verses.map((v: any) => {
        return (
            <p>
                <span className="verse-number">{v.verse ? `${v.verse}. ` : ""}</span>
                {VerseRenderer.convertToLORD(v.text)}
            </p>
        );
    });
    return jsx;
  }
}

// return as an array a list separated by newlines
async function loadList(filePath: string) {
    try {
        // console.log(filePath);
        const response = await fetch(filePath);
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


function Passage({ layoutOptions, id, list }: PassageProps){

    // add additional options to menu if needed:
    // const menuOptions = [...layoutOptions, ...extraOptions];
    // console.log(layoutOptions);

    let [index, setIndex] = useState(0);
    // elements of selection. e.g. loaded from Psalms.txt
    let [listElements, setListElements] = useState<string[]>([]);
    let [verses, setVerses] = useState<ReactElement[]>([]);

    function saveIndex(val: number) {
        localStorage.setItem(id + "_index", JSON.stringify(val));
    }

    function loadIndex() {
        setIndex(() =>
        {
            return Number.parseInt(JSON.parse(localStorage.getItem(id + "_index") ?? "0"));
        })
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

    function prev() {
        setIndex((prev) => {
            let result = prev;
            if(prev > 0){
                result --;
            }
            else{
                result = listElements.length - 1;
            }
            saveIndex(result);
            return result;
        });
    }

    // load the list when created
    useEffect(() => {
        async function load() {
            const data = await loadList(list) ?? [];
            setListElements(data);
        }
        load();
    },[]);

    // load index from local store if found on creation
    useEffect(() => {
        loadIndex();
    },[]);

    // query the verses when selection or list changes
    useEffect(() => {
        async function loadVerses() {
            if (!listElements[index]) return;
            const reference = listElements[index];
            const data = await BibleAPI.fetchPassage(reference);
            const jsx = VerseRenderer.createVerseComponents(data);
            setVerses(jsx);
        }
        loadVerses();
    }, [index, listElements]);

    return (
    <section>
        <div className="passage-header">
            <select
                className="reading-title-select"
                value={index}
                onChange={(e) => {setIndex(+e.target.value); saveIndex(+e.target.value)}}    
            >
                {listElements.map((element, i) => {
                    return <option value={i}>{element}</option>
                })}
            </select>
            <div>
                <Menu options={layoutOptions}>
                    <button className="dots-button">⋮</button>
                </Menu>
            </div>
        </div>
        <div>
            {verses.length > 0 ? verses : <p>...</p>}
        </div>
    </section>
    )
}

export default Passage
