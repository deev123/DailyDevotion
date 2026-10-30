import { lazy, Suspense, useEffect, useState } from "react";
import { parseStoredLayout, migrateLegacyPassageIndices, type ComponentConfig } from "./layoutStorage.ts";
import IntegratedSpeechPassage from "./IntegratedSpeechPassage.tsx"
import NoteBox from "./NoteBox.tsx"
import VideoPlaylist from "./VideoPlaylist.tsx"
import Catechism from "./Catechism.tsx"
import Header from "./Header.tsx"
import Menu from "./Menu.tsx"
import { deletePdf } from "./pdfStorage.ts"

const PdfReader = lazy(() => import("./PdfReader.tsx"));

type Component_t = ComponentConfig;

// New layouts start with YouVersion readers; saved layouts take precedence.
const componentsConfigDefault: Component_t[] = [
    {
        type: "passage2",
        id: "section1",
        list: "Psalms.txt",
    },
    {
        type: "passage2",
        id: "section2",
        list: "Bible_Chapters.txt",
    }
];

function Layout(){
    const [layoutError, setLayoutError] = useState("");
    
    const [storedLayout] = useState(() => parseStoredLayout(localStorage.getItem("componentsConfig")));
    const [componentsConfig, setComponentsConfig] = useState<Component_t[]>(storedLayout?.components ?? componentsConfigDefault);

    // Keep unrecognised entries in storage so a later version can still recover them.
    function saveComponentsConfig(config: Component_t[]) {
        localStorage.setItem("componentsConfig", JSON.stringify([...config, ...(storedLayout?.hidden ?? [])]));
    }

    useEffect(() => {
        if (!storedLayout) return;
        migrateLegacyPassageIndices(localStorage, storedLayout.legacyPassageIds);
        if (storedLayout.changed) localStorage.setItem("componentsConfig", JSON.stringify(storedLayout.migratedEntries));
    }, [storedLayout]);

    function moveUp(id: string)
    {
        setComponentsConfig( prev => {
            const index = prev.findIndex(c => c.id === id);
            if (index <= 0 || index === -1) return prev;

            // copy the list
            const newList = [...prev];
            // swap indexes
            let temp = newList[index -1];
            newList[index -1] = newList[index];
            newList[index] = temp;
            // save the config list
            saveComponentsConfig(newList);
            return newList;
        });
    }

    function moveDown(id: string)
    {
        setComponentsConfig( prev => {
            const index = prev.findIndex(c => c.id === id);
            if (index >= prev.length - 1 || index === -1) return prev;

            // copy the list
            const newList = [...prev];
            // swap indexes
            let temp = newList[index +1];
            newList[index +1] = newList[index];
            newList[index] = temp;
            // save the config list
            saveComponentsConfig(newList);
            return newList;
        });
    }

    async function deleteComponent(id: string)
    {
        setLayoutError("");
        if (componentsConfig.some((component: Component_t) => component.id === id && component.type === "pdfReader")) {
            try {
                // Keep the component available for retry if deleting its file fails.
                await deletePdf(id);
            } catch {
                setLayoutError("Could not delete the saved PDF. Please try deleting the component again.");
                return;
            }
        }
        setComponentsConfig((prev) => {
            const index = prev.findIndex(c => c.id === id);
            if(index === -1) return prev; // not found

            // Handle cleanup of local store values when deleted
            // Potentially better to make classes for each component with helpers like deleteStores()
            // but for now layout will manage cleanup here
            switch(prev[index].type){
                case "notebox":
                    localStorage.removeItem(id + "_title");
                    localStorage.removeItem(id + "_text");
                    localStorage.removeItem(id + "_state");
                    break;
                case "videoPlaylist":
                    localStorage.removeItem(id + "_index");
                    localStorage.removeItem(id + "_videoPositions");
                    break;
                case "pdfReader":
                    localStorage.removeItem(id + "_pdfSections");
                    localStorage.removeItem(id + "_voice");
                    localStorage.removeItem(id + "_speechRate");
                    localStorage.removeItem(id + "_speechPosition");
                    localStorage.removeItem(id + "_speechFollow");
                    localStorage.removeItem(id + "_speechContinue");
                    break;
                case "passage2":
                    localStorage.removeItem(id + "_voice");
                    localStorage.removeItem(id + "_speechRate");
                    localStorage.removeItem(id + "_speechPosition");
                    localStorage.removeItem(id + "_speechFollow");
                    localStorage.removeItem(id + "_speechContinue");
                    localStorage.removeItem(id + "_index");
                    localStorage.removeItem(id + "_version");
                    break;
                case "catechism":
                    localStorage.removeItem(id + "_index");
                    break;
            }

            // new list with the old index skipped
            const newList = [...prev.slice(0, index), ...prev.slice(index +1)];
            // save the new config list
            saveComponentsConfig(newList);
            return newList;
        });
    }

    // generate a unique id for a new component
    function generateId()
    {
        let id: string;
        do
        {
            id = "comp_" + Math.random().toString(36).slice(2, 9);
        } while (componentsConfig.some(c => c.id === id) || storedLayout?.hidden.some(entry => entry && typeof entry === "object" && "id" in entry && entry.id === id));
        return id;
    }

    function addComponent(config: Component_t)
    {
        setComponentsConfig( prev => {
            // add config onto the existing list and then save
            const newList = [...prev, config];
            // save the new config list
            saveComponentsConfig(newList);
            return newList;
        });
    }

    // addComponent takes a component_t config object as an argmunet to add to layout
    // these menu options define the configs to pass for each type of component
    let addElementOptions = [
    {
        label: "PDF reader",
        action: () => addComponent({ type: "pdfReader", id: generateId() })
    },
    {
        label: "Passage",
        action: () => {
            addComponent({
                type: "passage2",
                id: generateId(),
                list: "Bible_Chapters.txt"
            });
        }
    },
    {
        label: "Psalm",
        action: () => {
            addComponent({
                type: "passage2",
                id: generateId(),
                list: "Psalms.txt"
            });
        }
    },
    {
        label: "Note Box",
        action: () => {
            addComponent({
                type: "notebox",
                id: generateId(),
            });
        }
    },
    // video playlist
    {
        label: "Video Playlist",
        action: () => {
            addComponent({
                type: "videoPlaylist",
                id: generateId(),
                list: "NIV_Audio_Bible.json"
            });
        }
    },
    {
        label: "Heidelberg Catechism",
        action: () => {
            addComponent({
                type: "catechism",
                id: generateId(),
                list: "Heidelberg_Catechism.json"
            });
        }
    }];

    // wraps the layout; the settings button is fixed-position so it floats over everything
    let elements = <>
        <Header/>
        <div className="container">
        {layoutError && <p className="passage-error" role="alert">{layoutError}</p>}
        {
            componentsConfig.map((c: Component_t) => {

            const layoutOptions = [
                {
                    label: "Move Up",
                    action: () => moveUp(c.id)
                },
                {
                    label: "Move Down",
                    action: () => moveDown(c.id)
                },
                {
                    label: "Delete",
                    action: () => deleteComponent(c.id)
                }
            ];

            // console.log(layoutControls);

            switch(c.type){
                case "pdfReader":
                    return <Suspense key={c.id} fallback={<section><p>Loading PDF reader…</p></section>}>
                        <PdfReader layoutOptions={layoutOptions} id={c.id}/>
                    </Suspense>;
                case "notebox":
                    return <NoteBox layoutOptions={layoutOptions} id={c.id} key={c.id}/>;
                case "videoPlaylist":
                    return <VideoPlaylist layoutOptions={layoutOptions} id={c.id} list={c.list} key={c.id}/>;
                case "passage2":
                    return <IntegratedSpeechPassage layoutOptions={layoutOptions} id={c.id} list={c.list} key={c.id}/>;
                case "catechism":
                    return <Catechism layoutOptions={layoutOptions} id={c.id} list={c.list} key={c.id}/>;
                }
            })
        }
        <section className="add-component-container">
            <Menu options={addElementOptions}>
                <button className="add-component-button">+</button>
            </Menu>
        </section>
        </div>
    </>

    return elements
}

export default Layout
