import type { MenuOption } from "./Menu.tsx" // import type important for importing types
import Menu from "./Menu.tsx"
import { useState, useEffect, useRef } from "react"

type NoteBoxProps = {
    layoutOptions: MenuOption[],
    id: string
}

const states = {
    visible: "visibility",
    hidden: "visibility_off",
    locked: "lock"
};

function NoteBox({ layoutOptions, id }: NoteBoxProps){

    // add additional options to menu if needed:
    // const menuOptions = [...layoutOptions, ...extraOptions];
    // console.log(layoutOptions);

    // editables stored as refs since react's autorenderer isnt suitable for editable content
    // content is loaded once and then saved when edited
    let titleRef = useRef<HTMLDivElement>(null);
    let textRef = useRef<HTMLDivElement>(null);
    let [state, setState] = useState(localStorage.getItem(id + "_state") || states.visible)
    
    // applyState() to set these correctly
    let isEditing = useRef(false);
    let isHidden = useRef(false);

    // incase needed
    // shouldnt use
    function load() {    
        if(titleRef.current && textRef.current) {
            titleRef.current.innerHTML = localStorage.getItem(id + "_title") || "Notes";
            textRef.current.innerHTML = localStorage.getItem(id + "_text") || "<br>";
        }
        setState(() => localStorage.getItem(id + "_state") || states.visible);
    }

    // save all variables
    function save() {
        if(titleRef.current && textRef.current) {
            localStorage.setItem(id + "_title", titleRef.current.innerHTML);
            localStorage.setItem(id + "_text", textRef.current.innerHTML);
        }
        localStorage.setItem(id + "_state", state);
       
    }

    useEffect(() => {
        load(); // load state from localStorage and set innerHTML of editable elements
        //applyState(); // done every render
    }, [])

    useEffect(() => {
        save();
        // applyState();
    }, [state]) // if state changes then save. saved when content is edited too. see below

    function cycleState() {
        switch(state){
            case states.hidden:
                setState(states.visible);
                break;
            case states.visible:
                setState(states.locked);
                break;
            case states.locked:
                setState(states.hidden);
                break;
            default:
                console.warn("A notebox state was corrupt. using state = visible fallback");
                setState(states.visible);
                break;
        }
        // applyState(); // done by useEffect
        save();
    }

    function applyState() {

        switch(state){
            case states.hidden:
                isEditing.current = false;
                isHidden.current = true;
                break;
            case states.visible:
                isEditing.current = true;
                isHidden.current = false;
                break;
            case states.locked:
                isEditing.current = false;
                isHidden.current = false;
                break;
        }
    }

    // set isEditing and visibility based on state before rendering
    // moved to useEffect
    applyState();

    return (
    <section>
        <div className="notes-container">
            <div className="notes-header">
                <h2 ref={titleRef} contentEditable={isEditing.current} onInput={() => {save();}} ></h2>
                <div className="notes-header-buttons">
                    <button className="material-icons icon-button notes-edit-button" onClick={cycleState}>{state}</button>
                    <Menu options={layoutOptions}>
                        <button className="dots-button">⋮</button>
                    </Menu>
                </div>
            </div>
            <div ref={textRef} className={"notes-content" + ((isHidden.current ? " hide-text" : ""))} contentEditable={isEditing.current} onInput={() => {save();}} >
            </div>
        </div>
    </section>
    )
}

export default NoteBox
