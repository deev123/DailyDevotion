import type { MenuOption } from "./Menu.tsx" // import type important for importing types
import Menu from "./Menu.tsx"
import { useEffect, useState } from "react"
import type { ReactElement } from "react"

type VideoPlaylistProps = {
    layoutOptions: MenuOption[],
    id: string,
    list: string // file name or local store var name
}

type Video_t = {
    title: string,
    videoId: string
}

function VideoPlaylist({ layoutOptions, id, list }: VideoPlaylistProps){
    // add additional options to menu if needed:
    // const menuOptions = [...layoutOptions, ...extraOptions];
    // console.log(layoutOptions);

    let [index, setIndex] = useState(0);
    // elements of selection. e.g. loaded from Psalms.txt
    let [listElements, setListElements] = useState<Video_t[]>([]);

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
        // load a JSON formatted list of objects [{title,videoId}]
        // no thorough error checking, only allow proper sources
        async function load() {
            let data = [];
            try {
                const response = await fetch(list);
                if (!response.ok) throw new Error("Failed to load file");
                data = await response.json();
                // console.log(data);
                if(!Array.isArray(data)) {
                    throw new Error(`Error: ${list} is not correct JSON`);
                }
            } catch (err) {
                console.error(err);
            }
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
        async function loadVideo() {
            // TODO: load video here
        }
        loadVideo();
    }, [index, listElements]);


    return <section>
        <div className="passage-header">
            <select
                className="reading-title-select"
                value={index}
                onChange={(e) => {setIndex(+e.target.value); saveIndex(+e.target.value)}}    
            >
                {listElements.map((element, i) => {
                    return <option key={`${id}_${i}`} value={i}>{element.title}</option>
                })}
            </select>
            <div>
                <Menu options={layoutOptions}>
                    <button className="dots-button">⋮</button>
                </Menu>
            </div>
        </div>
        <div className="video-container">
            <h1>{listElements[index]?.title ?? ""}</h1>
            <h1>{listElements[index]?.videoId ?? ""}</h1>
        </div>
    </section>
}

export default VideoPlaylist
