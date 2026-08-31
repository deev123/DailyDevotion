import type { MenuOption } from "./Menu.tsx" // import type important for importing types
import Menu from "./Menu.tsx"
import { useState, useEffect } from "react"
import GooeyCheckbox from "./GooeyCheckbox.tsx"
import confetti from "canvas-confetti"

type CatechismProps = {
    layoutOptions: MenuOption[],
    id: string,
    list: string // file name or local store var name
}

type CatechismEntry = {
    Question: string,
    Answer: string
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
    // catechism questions/answers loaded from json
    let [entries, setEntries] = useState<CatechismEntry[]>([]);
    let [checkboxChecked, setCheckboxChecked] = useState(false);

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
            if(prev < entries.length){
                result ++;
            }
            else{
                result = 0;
            }
            saveIndex(result);
            return result;
        });
    }

    // load the catechism list when created
    useEffect(() => {
        async function load() {
            const data = await loadCatechism(list) ?? [];
            setEntries(data);
        }
        load();
    },[]);

    // load index from local store if found on creation
    useEffect(() => {
        loadIndex();
    },[]);

    return (
    <section>
        <div className="passage-header">
            <select
                className="reading-title-select"
                value={index}
                onChange={(e) => {setIndex(+e.target.value); saveIndex(+e.target.value)}}
            >
                {entries.map((entry, i) => {
                    return <option key={`${id}_${i}`} value={i}>{entry.Question}</option>
                })}
            </select>
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
                    <p className="catechism-answer">{entries[index].Answer}</p>
                </>
            : <p>...</p>}
        </div>
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
